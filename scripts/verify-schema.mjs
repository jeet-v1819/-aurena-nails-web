#!/usr/bin/env node
/**
 * Schema ↔ database consistency check (development tool).
 *
 * Reads `prisma/schema.prisma` through Prisma's own WASM schema parser (the
 * same code path the CLI uses, so it also works on machines that cannot
 * download Prisma's native engines), introspects the live database through
 * `information_schema`, and reports every mismatch: missing tables/columns,
 * wrong types, wrong nullability, missing unique constraints, missing indexes
 * and missing foreign keys.
 *
 *   npm run verify:schema
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { Client } from "pg";
import { loadEnv } from "./load-env.mjs";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, "..");
loadEnv({ cwd: ROOT });

const schemaText = fs.readFileSync(path.join(ROOT, "prisma", "schema.prisma"), "utf8");
const schemaWasm = require("@prisma/prisma-schema-wasm");
const dmmf = JSON.parse(schemaWasm.get_dmmf(JSON.stringify({ prismaSchema: schemaText })));

/** Acceptable `udt_name` values per Prisma scalar (+ native type overrides). */
const NATIVE_TYPES = {
  Text: ["text"],
  VarChar: ["varchar"],
  Char: ["bpchar"],
  SmallInt: ["int2"],
  Integer: ["int4"],
  BigInt: ["int8"],
  Decimal: ["numeric"],
  DoublePrecision: ["float8"],
  Real: ["float4"],
  Date: ["date"],
  Time: ["time"],
  Timestamp: ["timestamp"],
  Json: ["json", "jsonb"],
  JsonB: ["jsonb"],
  Uuid: ["uuid"],
  Boolean: ["bool"],
  ByteA: ["bytea"],
};

const SCALAR_TYPES = {
  String: ["text", "varchar", "bpchar", "uuid"],
  Int: ["int4", "int2", "int8"],
  BigInt: ["int8"],
  Float: ["float8", "float4"],
  Decimal: ["numeric"],
  Boolean: ["bool"],
  DateTime: ["timestamp", "timestamptz", "date", "time"],
  Json: ["json", "jsonb"],
  Bytes: ["bytea"],
};

function acceptableUdtNames(field) {
  if (field.kind === "enum") return [field.type];
  const nativeName = Array.isArray(field.nativeType) ? field.nativeType[0] : null;
  const base = nativeName && NATIVE_TYPES[nativeName] ? NATIVE_TYPES[nativeName] : SCALAR_TYPES[field.type];
  const list = base ? [...base] : [];
  if (field.isList) {
    // Postgres arrays are reported with a leading underscore.
    return list.map((name) => `_${name}`);
  }
  return list;
}

/** `@@index([a, b])` / `@@index([a(sort: Desc)])` parsed from the schema text. */
function declaredModelIndexes() {
  const indexes = [];
  const modelBlocks = schemaText.split(/^model\s+/m).slice(1);
  for (const block of modelBlocks) {
    const modelName = block.slice(0, block.indexOf(" ")).trim();
    for (const match of block.matchAll(/@@index\(\[([^\]]+)\]/g)) {
      const columns = match[1]
        .split(",")
        .map((part) => part.trim().replace(/\(.*\)$/, "").trim())
        .filter(Boolean);
      if (columns.length) indexes.push({ table: modelName, columns });
    }
  }
  return indexes;
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: /sslmode=(require|verify-full|verify-ca)/.test(process.env.DATABASE_URL ?? "")
    ? { rejectUnauthorized: false }
    : undefined,
});

/** Columns covered by an index, read from `pg_indexes.indexdef`. */
function indexColumnsOf(index) {
  const inside = index.indexdef.match(/\(([^)]*)\)/)?.[1] ?? "";
  return inside
    .replace(/"/g, "")
    .split(",")
    .map((part) => part.trim().replace(/\s+(ASC|DESC|NULLS.*)$/i, "").trim())
    .filter(Boolean);
}

const problems = [];
let passed = 0;
const check = (label, condition, detail) => {
  if (condition) passed += 1;
  else problems.push(`${label}${detail ? ` — ${detail}` : ""}`);
};

await client.connect();

const columns = new Map();
for (const row of (
  await client.query(
    `SELECT table_name, column_name, data_type, udt_name, is_nullable, numeric_precision, numeric_scale
     FROM information_schema.columns WHERE table_schema = 'public'`
  )
).rows) {
  columns.set(`${row.table_name}.${row.column_name}`, row);
}

const tables = new Set(
  (await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`)).rows.map(
    (r) => r.table_name
  )
);

const indexRows = (await client.query(`SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public'`))
  .rows;

const fkRows = (
  await client.query(`
    SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `)
).rows;
const foreignKeys = new Set(fkRows.map((r) => `${r.table_name}.${r.column_name}->${r.foreign_table}`));

// ---------------------------------------------------------------------------
// Tables and columns
// ---------------------------------------------------------------------------
for (const model of dmmf.datamodel.models) {
  check(`table "${model.name}"`, tables.has(model.name));

  for (const field of model.fields) {
    if (field.kind === "object") continue;
    const column = columns.get(`${model.name}.${field.name}`);
    check(`column ${model.name}.${field.name}`, Boolean(column));
    if (!column) continue;

    const acceptable = acceptableUdtNames(field);
    if (acceptable.length) {
      check(
        `type ${model.name}.${field.name} (${field.type}${field.isList ? "[]" : ""})`,
        acceptable.includes(column.udt_name),
        `database has ${column.udt_name}, expected ${acceptable.join(" | ")}`
      );
    }

    const nativeName = Array.isArray(field.nativeType) ? field.nativeType[0] : null;
    if (nativeName === "Decimal" && Array.isArray(field.nativeType) && field.nativeType.length > 1) {
      const [precision, scale] = field.nativeType
        .slice(1)
        .join(",")
        .split(",")
        .map((value) => Number(value.trim()));
      check(
        `precision ${model.name}.${field.name} (${precision},${scale})`,
        Number(column.numeric_precision) === Number(precision) && Number(column.numeric_scale) === Number(scale),
        `database has (${column.numeric_precision},${column.numeric_scale})`
      );
    }

    check(
      `nullability ${model.name}.${field.name}`,
      // Scalar lists (String[]) are always written by Prisma, so Prisma leaves
      // the column nullable: accept either.
      (field.isList || field.isRequired === (column.is_nullable === "NO")),
      `schema says ${field.isRequired ? "required" : "optional"}, database says ${
        column.is_nullable === "NO" ? "NOT NULL" : "nullable"
      }`
    );

    if (field.isUnique && !field.isList) {
      const found = indexRows.some(
        (index) =>
          index.tablename === model.name &&
          index.indexdef.startsWith("CREATE UNIQUE INDEX") &&
          indexColumnsOf(index).join(",") === field.name
      );
      check(`unique ${model.name}.${field.name}`, found);
    }
  }

  for (const unique of [...(model.uniqueFields ?? []), ...(model.uniqueIndexes ?? [])]) {
    const fields = Array.isArray(unique) ? unique : unique.fields;
    if (!fields?.length) continue;
    const found = indexRows.some((index) => {
      if (index.tablename !== model.name || !index.indexdef.startsWith("CREATE UNIQUE INDEX")) return false;
      const cols = indexColumnsOf(index);
      return cols.length === fields.length && fields.every((f) => cols.includes(f));
    });
    check(`unique ${model.name}(${fields.join(", ")})`, found);
  }
}

// ---------------------------------------------------------------------------
// Declared @@index entries
// ---------------------------------------------------------------------------
for (const { table, columns: cols } of declaredModelIndexes()) {
  const found = indexRows.some(
    (index) => index.tablename === table && indexColumnsOf(index).join(",") === cols.join(",")
  );
  check(`index ${table}(${cols.join(", ")})`, found);
}

// ---------------------------------------------------------------------------
// Relations -> foreign keys
// ---------------------------------------------------------------------------
for (const model of dmmf.datamodel.models) {
  for (const field of model.fields) {
    if (field.kind !== "object" || !field.relationFromFields?.length) continue;
    for (const [position, fromField] of field.relationFromFields.entries()) {
      const target = field.relationToFields?.[position] ?? "id";
      if (!columns.has(`${model.name}.${fromField}`)) continue;
      if (!columns.has(`${field.type}.${target}`)) continue;
      check(
        `foreign key ${model.name}.${fromField} -> ${field.type}.${target}`,
        foreignKeys.has(`${model.name}.${fromField}->${field.type}`),
        "no matching FOREIGN KEY constraint"
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Enum types: every enum in the Prisma schema exists as a PostgreSQL enum with
// exactly the same labels, in the same order.
// ---------------------------------------------------------------------------
for (const enumModel of dmmf.datamodel.enums) {
  const labels = (
    await client.query(
      `SELECT e.enumlabel AS label
         FROM pg_type t
         JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = $1
        ORDER BY e.enumsortorder`,
      [enumModel.name]
    )
  ).rows.map((row) => row.label);

  check(
    `enum ${enumModel.name} matches the database`,
    JSON.stringify(labels) === JSON.stringify(enumModel.values.map((value) => value.name)),
    `expected ${enumModel.values.map((v) => v.name).join(", ")}, found ${labels.join(", ") || "nothing"}`
  );
}

// ---------------------------------------------------------------------------
// Extra database-level guarantees the application relies on
// ---------------------------------------------------------------------------
check(
  "partial unique index Appointment_active_slot_key (double-booking guard)",
  indexRows.some((index) => index.indexname === "Appointment_active_slot_key")
);
for (const constraint of [
  "Appointment_time_range_check",
  "Review_rating_range_check",
  "BusinessHours_day_range_check",
  "BusinessHours_window_check",
  "WishlistItem_target_check",
]) {
  const found = await client.query(`SELECT 1 FROM pg_constraint WHERE conname = $1`, [constraint]);
  check(`check constraint ${constraint}`, found.rowCount === 1);
}

await client.end();

console.log(`\n${passed} checks passed against ${process.env.DATABASE_URL?.replace(/:\/\/.*@/, "://***@")}`);
if (problems.length) {
  console.error(`\n✘ ${problems.length} mismatch(es):\n`);
  for (const problem of problems) console.error(`   • ${problem}`);
  process.exit(1);
}
console.log("✔ the database matches prisma/schema.prisma exactly");

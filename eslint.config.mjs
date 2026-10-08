/**
 * ESLint (flat config).
 *
 * `eslint-config-next` 16 ships flat configs directly, so they are spread in
 * here instead of going through the older `FlatCompat` shim.
 */
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "prisma/migrations/**",
      "public/uploads/**",
      "scripts/offline-schema-engine.mjs",
    ],
  },
];

export default eslintConfig;

import assert from "node:assert/strict";
import test from "node:test";
import {
  businessHoursListSchema,
  businessHoursSchema,
  contentUpdateSchema,
  holidaySchema,
  serviceSchema,
} from "../src/validators/admin";
import { isValidAuthSecret } from "../src/lib/auth/config";
import { isAllowedMediaType } from "../src/lib/constants";
import { dateOnlyFromString } from "../src/lib/time";
import { safeInternalRedirectTarget } from "../src/lib/navigation";
import { serializeJsonLd } from "../src/lib/seo";
import { isManagedAvatarPublicId, isValidAvatarMediaReference } from "../src/lib/media/references";
import { escapeHtml } from "../src/lib/html";
import { registerSchema } from "../src/validators/customer";

const week = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  isOpen: dayOfWeek !== 0,
  openMinutes: 10 * 60,
  closeMinutes: 19 * 60,
  breakStartMinutes: 13 * 60,
  breakEndMinutes: 14 * 60,
}));

test("admin boolean inputs preserve an explicit false string", () => {
  const result = serviceSchema.safeParse({
    name: "Gel manicure",
    shortDescription: "A polished, long-lasting gel manicure.",
    description: "A detailed gel manicure with careful preparation and a glossy finish.",
    categoryId: "service-category",
    durationMinutes: "60",
    isActive: "false",
    isFeatured: "false",
    isAvailable: "false",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.isActive, false);
    assert.equal(result.data.isFeatured, false);
    assert.equal(result.data.isAvailable, false);
  }
});

test("booking buffer accepts zero and rejects values outside its configured range", () => {
  assert.equal(contentUpdateSchema.safeParse({ "booking.bufferMinutes": "0" }).success, true);
  assert.equal(contentUpdateSchema.safeParse({ "booking.bufferMinutes": "240" }).success, true);
  assert.equal(contentUpdateSchema.safeParse({ "booking.bufferMinutes": "241" }).success, false);
  assert.equal(contentUpdateSchema.safeParse({ "booking.bufferMinutes": "1.5" }).success, false);
});

test("admin image and URL content rejects unsafe schemes and untrusted image hosts", () => {
  assert.equal(contentUpdateSchema.safeParse({ "contact.mapEmbedUrl": "javascript:alert(1)" }).success, false);
  assert.equal(contentUpdateSchema.safeParse({ "home.hero.image": "https://example.invalid/image.jpg" }).success, false);
  assert.equal(contentUpdateSchema.safeParse({ "home.hero.image": "/seed/hero-nails.jpg" }).success, true);
  assert.equal(contentUpdateSchema.safeParse({ "home.hero.image": "https://res.cloudinary.com/demo/image/upload/x.jpg" }).success, true);
});

test("business hours require ordered opening/closing and complete in-range breaks", () => {
  assert.equal(businessHoursSchema.safeParse(week[1]).success, true);
  assert.equal(
    businessHoursSchema.safeParse({ ...week[0], isOpen: false, openMinutes: 600, closeMinutes: 600 }).success,
    false
  );
  assert.equal(
    businessHoursSchema.safeParse({ ...week[1], breakStartMinutes: 13 * 60, breakEndMinutes: undefined }).success,
    false
  );
  assert.equal(
    businessHoursSchema.safeParse({ ...week[1], breakStartMinutes: 18 * 60, breakEndMinutes: 19 * 60 + 1 }).success,
    false
  );
  assert.equal(
    businessHoursSchema.safeParse({ ...week[1], breakStartMinutes: 14 * 60, breakEndMinutes: 14 * 60 }).success,
    false
  );
});

test("business-hours lists require all seven unique weekdays", () => {
  assert.equal(businessHoursListSchema.safeParse(week).success, true);
  assert.equal(businessHoursListSchema.safeParse([...week.slice(0, 6), { ...week[6], dayOfWeek: 5 }]).success, false);
});

test("holiday and appointment date parsing reject impossible calendar dates", () => {
  assert.equal(holidaySchema.safeParse({ name: "Studio holiday", date: "2024-02-29" }).success, true);
  assert.equal(holidaySchema.safeParse({ name: "Invalid holiday", date: "2025-02-29" }).success, false);
  assert.equal(holidaySchema.safeParse({ name: "Invalid holiday", date: "2026-02-30" }).success, false);
  assert.equal(dateOnlyFromString("2026-02-30"), null);
  assert.equal(dateOnlyFromString("2026-10-09")?.toISOString(), "2026-10-09T00:00:00.000Z");
});

test("media extension and MIME type must match the requested media kind", () => {
  assert.equal(isAllowedMediaType("design.JPG", "image/jpeg", "image"), true);
  assert.equal(isAllowedMediaType("design.png", "image/jpeg", "image"), false);
  assert.equal(isAllowedMediaType("clip.mov", "video/quicktime", "video"), true);
  assert.equal(isAllowedMediaType("clip.mp4", "video/quicktime", "video"), false);
  assert.equal(isAllowedMediaType("clip.mp4", "image/jpeg", "video"), false);
});

test("profile media references stay scoped to the authenticated user's avatar folder", () => {
  const userId = "cmuser12345";
  const localId = `local:avatars/${userId}/1730000000-ab12-photo.webp`;
  const localUrl = `/uploads/avatars/${userId}/1730000000-ab12-photo.webp`;
  assert.equal(isValidAvatarMediaReference(localUrl, localId, userId), true);
  assert.equal(isValidAvatarMediaReference(localUrl, localId, "another-user"), false);
  assert.equal(isValidAvatarMediaReference(localUrl, `local:gallery/${userId}/photo.webp`, userId), false);
  assert.equal(isManagedAvatarPublicId(`avatars/${userId}/random-id`, userId), true);
  assert.equal(isManagedAvatarPublicId("avatars/another-user/random-id", userId), false);
  assert.equal(
    isValidAvatarMediaReference(
      `https://res.cloudinary.com/demo/image/upload/v123/avatars/${userId}/asset`,
      `avatars/${userId}/asset`,
      userId
    ),
    true
  );
});

test("post-action redirects reject external and scheme-relative destinations", () => {
  assert.equal(safeInternalRedirectTarget("/appointments?page=2#next"), "/appointments?page=2#next");
  assert.equal(safeInternalRedirectTarget("https://attacker.example/"), "/");
  assert.equal(safeInternalRedirectTarget("//attacker.example/"), "/");
  assert.equal(safeInternalRedirectTarget("/\\\\attacker.example/"), "/");
  assert.equal(safeInternalRedirectTarget(null, "/profile"), "/profile");
});

test("HTML escaping neutralizes user-supplied markup and quoted attributes", () => {
  assert.equal(escapeHtml(`<img src=x onerror="alert('x')">&`), "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;");
});

test("JSON-LD serialization escapes script terminators and HTML-sensitive characters", () => {
  const value = { description: "</script><script>alert(1)</script>&\u2028" };
  const serialized = serializeJsonLd(value);
  assert.equal(serialized.includes("<"), false);
  assert.equal(serialized.includes(">"), false);
  assert.equal(serialized.includes("&"), false);
  assert.deepEqual(JSON.parse(serialized), value);
});

test("password validation respects bcrypt's 72-byte limit for UTF-8 passwords", () => {
  const base = {
    firstName: "Alex",
    lastName: "Test",
    email: "alex@example.com",
    mobile: "+919876543210",
    acceptTerms: true,
  };
  assert.equal(registerSchema.safeParse({ ...base, password: `Aa1${"é".repeat(35)}`, confirmPassword: `Aa1${"é".repeat(35)}` }).success, false);
  assert.equal(registerSchema.safeParse({ ...base, password: `Aa1${"é".repeat(34)}`, confirmPassword: `Aa1${"é".repeat(34)}` }).success, true);
});

test("session secrets reject URLs, database credentials and undersized values", () => {
  assert.equal(isValidAuthSecret("x".repeat(32), {}), true);
  assert.equal(isValidAuthSecret("x".repeat(31), {}), false);
  assert.equal(isValidAuthSecret(`https://${"x".repeat(32)}`, {}), false);
  const databasePassword = "a-database-password-that-is-long-enough-for-testing-123";
  assert.equal(
    isValidAuthSecret("a-random-secret-that-is-long-enough-for-testing-123456", {
      DATABASE_URL: `postgresql://db-user:${databasePassword}@localhost:5432/aurena`,
    }),
    true
  );
  assert.equal(
    isValidAuthSecret(databasePassword, {
      DATABASE_URL: `postgresql://db-user:${databasePassword}@localhost:5432/aurena`,
    }),
    false
  );
});

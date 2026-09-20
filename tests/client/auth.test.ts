import { describe, expect, it } from "vitest";
import { safeReturnPath } from "../../lib/client/auth";

describe("safeReturnPath", () => {
  it("keeps an internal page and its filters after sign-in", () => {
    expect(safeReturnPath("/students/stu-04?skill=add-fractions")).toBe(
      "/students/stu-04?skill=add-fractions",
    );
  });

  it.each(["https://attacker.test", "//attacker.test", "/login", "/students\\evil", "not-a-path", null])(
    "falls back for unsafe return path %s",
    (value) => {
      expect(safeReturnPath(value)).toBe("/classroom");
    },
  );
});

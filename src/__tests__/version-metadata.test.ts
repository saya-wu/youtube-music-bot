import { describe, expect, test } from "bun:test";
import { getAppMetadata } from "../utils/app-metadata.ts";
import { getVersionBadgeVariant } from "../../frontend/src/utils/version.ts";

describe("version metadata", () => {
  test("should produce a semver-style build version string", () => {
    const metadata = getAppMetadata();

    expect(metadata.appVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(metadata.buildVersion).toContain(metadata.appVersion);
  });

  test("should flag frontend/backend version mismatches", () => {
    expect(getVersionBadgeVariant("1.2.3+abc1234", "1.2.3+abc1234")).toBe(
      "default",
    );
    expect(getVersionBadgeVariant("1.2.3+abc1234", "1.2.4+def5678")).toBe(
      "warning",
    );
    expect(getVersionBadgeVariant("1.2.3+abc1234", null)).toBe("secondary");
  });
});

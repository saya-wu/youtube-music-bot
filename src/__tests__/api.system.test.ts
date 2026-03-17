import { describe, expect, test } from "bun:test";
import api from "../routes/api.ts";

describe("/api/system/info", () => {
  test("should expose app version metadata", async () => {
    const response = await api.request("/system/info");

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      success: boolean;
      data: {
        appVersion: string;
        gitSha: string;
        buildVersion: string;
        environment: string;
      };
    };

    expect(payload.success).toBe(true);
    expect(payload.data.appVersion).toBeTruthy();
    expect(payload.data.gitSha).toBeTruthy();
    expect(payload.data.buildVersion).toContain(payload.data.appVersion);
    expect(payload.data.environment).toBeTruthy();
  });
});

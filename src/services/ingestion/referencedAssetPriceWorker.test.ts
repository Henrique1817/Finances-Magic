import { describe, expect, it } from "vitest";
import { floorUtcToIntervalMs } from "./timeBuckets";

describe("floorUtcToIntervalMs", () => {
  it("alinha ao bucket de 30 min em UTC", () => {
    const d = new Date("2026-04-06T14:37:22.000Z");
    const out = floorUtcToIntervalMs(d, 30 * 60 * 1000);
    expect(out.toISOString()).toBe("2026-04-06T14:30:00.000Z");
  });
});

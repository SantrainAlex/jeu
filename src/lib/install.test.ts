import { describe, expect, it } from "vitest";
import { DISMISS_DAYS, detectPlatform, isDismissed } from "./install";

describe("detectPlatform", () => {
  it("reconnaît un iPhone", () => {
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1")).toBe("ios");
  });
  it("reconnaît un iPad qui se fait passer pour un Mac", () => {
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15", 5)).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15", 0)).toBe("other");
  });
  it("reconnaît Android", () => {
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36")).toBe("android");
  });
  it("ne propose rien sur ordinateur", () => {
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36")).toBe("other");
  });
});

describe("isDismissed", () => {
  const day = 24 * 60 * 60 * 1000;
  it("reste cachée après fermeture, puis revient", () => {
    const now = 1_000 * day;
    expect(isDismissed(null, now)).toBe(false);
    expect(isDismissed(String(now - 2 * day), now)).toBe(true);
    expect(isDismissed(String(now - (DISMISS_DAYS + 1) * day), now)).toBe(false);
    expect(isDismissed("n'importe quoi", now)).toBe(false);
  });
});

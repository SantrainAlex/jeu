import { describe, expect, it } from "vitest";
import { bestPlatform, parseReport, smoothnessText, toSummaries } from "./perf";

describe("avis résolution / FPS", () => {
  it("refuse un avis incomplet ou inventé", () => {
    expect(parseReport({ platform: "ps5", resolution: "4k", fps: 60, stable: true })).toEqual({
      platform: "ps5",
      resolution: "4k",
      fps: 60,
      stable: true,
    });
    expect(parseReport({ platform: "ps5", resolution: "4k", fps: 60 })).toBeNull();
    expect(parseReport({ platform: "dreamcast", resolution: "4k", fps: 60, stable: true })).toBeNull();
    expect(parseReport({ platform: "pc", resolution: "8k" as never, fps: 60, stable: true })).toBeNull();
    expect(parseReport({ platform: "pc", resolution: "1080p", fps: 144 as never, stable: false })).toBeNull();
  });

  it("lit le résumé de la base et ignore les lignes bizarres", () => {
    const rows = [
      { platform: "ps5", votes: 12, resolution: "4k", fps: 60, stable_pct: 83 },
      { platform: "switch", votes: "3", resolution: "720p", fps: 30, stable_pct: 33.4 },
      { platform: "ps5", votes: 0, resolution: "4k", fps: 60, stable_pct: 0 },
      { platform: "n64", votes: 4, resolution: "720p", fps: 30, stable_pct: 10 },
    ];
    expect(toSummaries(rows)).toEqual([
      { platform: "ps5", resolution: "4k", fps: 60, votes: 12, stablePct: 83 },
      { platform: "switch", resolution: "720p", fps: 30, votes: 3, stablePct: 33 },
    ]);
    expect(toSummaries(null)).toEqual([]);
  });

  it("dit si le jeu est fluide et trouve la meilleure plateforme", () => {
    expect(smoothnessText(90)).toBe("Fluide");
    expect(smoothnessText(50)).toBe("Quelques ralentissements");
    expect(smoothnessText(10)).toBe("Souvent saccadé");
    const list = toSummaries([
      { platform: "ps5", votes: 5, resolution: "1440p", fps: 60, stable_pct: 80 },
      { platform: "switch", votes: 4, resolution: "720p", fps: 30, stable_pct: 50 },
      { platform: "pc", votes: 1, resolution: "4k", fps: 120, stable_pct: 100 },
    ]);
    expect(bestPlatform(list)?.platform).toBe("ps5");
    expect(bestPlatform(list.slice(0, 1))).toBeNull();
  });
});

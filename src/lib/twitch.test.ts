import { describe, expect, it } from "vitest";
import { sortStreams, toStream, type Stream } from "./twitch";

const stream = (channel: string, language = "en"): Stream => ({
  channel, name: channel, title: "", viewers: 1, language, thumbnail: "", startedAt: "",
});

describe("lives Twitch", () => {
  it("prépare la vignette au bon format", () => {
    const s = toStream({
      user_login: "zerator", user_name: "ZeratoR", title: "On joue !", viewer_count: 12345, language: "fr",
      thumbnail_url: "https://static-cdn.jtvnw.net/previews-ttv/live_user_zerator-{width}x{height}.jpg", started_at: "2026-11-25T18:00:00Z",
    });
    expect(s.thumbnail).toBe("https://static-cdn.jtvnw.net/previews-ttv/live_user_zerator-440x248.jpg");
    expect(s.channel).toBe("zerator");
    expect(s.viewers).toBe(12345);
  });
  it("met les lives en français d'abord, sans doublon, 12 au plus", () => {
    const fr = [stream("a", "fr"), stream("b", "fr")];
    const all = [stream("x"), stream("a", "fr"), ...Array.from({ length: 20 }, (_, i) => stream(`c${i}`))];
    const sorted = sortStreams(fr, all);
    expect(sorted.slice(0, 3).map((s) => s.channel)).toEqual(["a", "b", "x"]);
    expect(sorted).toHaveLength(12);
    expect(new Set(sorted.map((s) => s.channel)).size).toBe(12);
  });
});

import { generateText, streamText } from "ai";
import { describe, expect, it } from "vitest";
import { replayGenerate, replaySequence, replayStream, type RecordedGenerate } from "./replay";

// derived-from: docs (T01b notes Q6, MockLanguageModelV4 shapes). Not a real capture.
const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};
const generated = (text: string): RecordedGenerate => ({
  content: [{ type: "text", text }],
  finishReason: { unified: "stop", raw: undefined },
  usage,
  warnings: [],
});
const streamParts = [
  { type: "stream-start", warnings: [] },
  { type: "text-start", id: "t1" },
  { type: "text-delta", id: "t1", delta: "Cześć " },
  { type: "text-delta", id: "t1", delta: "świecie" },
  { type: "text-end", id: "t1" },
  { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
];

describe("replay helpers", () => {
  it("replayGenerate returns the recorded result", async () => {
    const model = replayGenerate(generated("Witaj"));
    const r = await generateText({ model, prompt: "x" });
    expect(r.text).toBe("Witaj");
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it("replayStream replays recorded stream parts in order", async () => {
    const model = replayStream(streamParts as never);
    const r = streamText({ model, prompt: "x" });
    expect(await r.text).toBe("Cześć świecie");
  });

  it("replayStream replays one recorded stream per call for an array of streams", async () => {
    const second = [
      { type: "stream-start", warnings: [] },
      { type: "text-start", id: "t2" },
      { type: "text-delta", id: "t2", delta: "drugi" },
      { type: "text-end", id: "t2" },
      { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
    ];
    const model = replayStream([streamParts, second] as never);
    expect(await streamText({ model, prompt: "x" }).text).toBe("Cześć świecie");
    expect(await streamText({ model, prompt: "x" }).text).toBe("drugi");
  });

  it("replaySequence returns one recorded result per call and then the last", async () => {
    const model = replaySequence([generated("pierwszy"), generated("drugi")]);
    expect((await generateText({ model, prompt: "x" })).text).toBe("pierwszy");
    expect((await generateText({ model, prompt: "x" })).text).toBe("drugi");
    expect((await generateText({ model, prompt: "x" })).text).toBe("drugi");
  });

  it("replayGenerate accepts a capture name and loads the file", () => {
    expect(() => replayGenerate("does-not-exist-capture")).toThrow(/does-not-exist-capture/);
  });
});

import { describe, expect, it } from "vitest";
import { createReplyStreamer } from "./reply-stream";

describe("createReplyStreamer", () => {
  it("streams LaTeX written with one backslash as LaTeX, in any chunking", () => {
    const raw = String.raw`{"action":"answer","reply":"Z: $\frac{4ab}{1}$, $a\times b$, $\sqrt{2}$\nশেষ"}`;
    for (const size of [1, 3, 7, raw.length]) {
      let out = "";
      const streamer = createReplyStreamer((text) => { out += text; });
      for (let at = 0; at < raw.length; at += size) streamer.feed(raw.slice(at, at + size));
      expect(out).toBe(String.raw`Z: $\frac{4ab}{1}$, $a\times b$, $\sqrt{2}$` + "\nশেষ");
    }
  });
});

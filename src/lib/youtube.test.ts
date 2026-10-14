import { describe, expect, it } from "vitest";
import { parseYouTubeId } from "./youtube";

describe("parseYouTubeId", () => {
  const id = "dQw4w9WgXcQ";
  it.each([
    id,
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?feature=share&v=${id}&t=42s`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://music.youtube.com/watch?v=${id}&list=RD`,
    `youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}`,
    `https://youtu.be/${id}?si=abc&t=10`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/live/${id}?feature=share`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `  https://youtu.be/${id}  `,
  ])("reads %s", (input) => expect(parseYouTubeId(input)).toBe(id));

  it.each([
    "",
    "hello",
    "https://www.youtube.com/playlist?list=PL123",
    "https://www.youtube.com/@channel",
    "https://vimeo.com/123456",
    `https://evil.com/watch?v=${id}`,
    "https://youtu.be/short",
  ])("rejects %s", (input) => expect(parseYouTubeId(input)).toBeNull());
});

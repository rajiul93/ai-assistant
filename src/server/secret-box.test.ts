import { beforeAll, describe, expect, it } from "vitest";
import { open, seal } from "./secret-box";

describe("secret box", () => {
  beforeAll(() => { process.env.AI_SETTINGS_SECRET = "test-secret"; });

  it("reads back what it sealed, and never stores it as is", () => {
    const sealed = seal("AIzaSyExampleKey1234");
    expect(sealed).not.toContain("AIza");
    expect(open(sealed)).toBe("AIzaSyExampleKey1234");
  });

  it("gives nothing for a tampered or foreign value", () => {
    const [version, iv, tag, data] = seal("secret").split(":");
    const flipped = Buffer.from(data, "base64");
    flipped[0] ^= 1;
    expect(open([version, iv, tag, flipped.toString("base64")].join(":"))).toBeNull();
    expect(open("plain-text-key")).toBeNull();
  });
});

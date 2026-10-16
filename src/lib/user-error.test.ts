import { describe, expect, it } from "vitest";
import { z } from "zod";
import { errorMessage, userError } from "./user-error";

describe("user errors", () => {
  it("reads the message from the digest when production hid it", () => {
    const sent = userError("এই ভিডিওটা আগেই যোগ করা আছে।") as Error & { digest: string };
    // What the browser gets in production: React's stand-in message, our digest kept.
    const received = Object.assign(new Error("Minified React error #441; visit https://react.dev/errors/441"), { digest: sent.digest });
    expect(errorMessage(received)).toBe("এই ভিডিওটা আগেই যোগ করা আছে।");
  });

  it("uses the message itself in development and for plain errors", () => {
    expect(errorMessage(userError("plan লাগবে"))).toBe("plan লাগবে");
    expect(errorMessage(new Error("Subject not found."))).toBe("Subject not found.");
  });

  it("falls back when there is nothing worth showing", () => {
    expect(errorMessage(new Error("Minified React error #441"), "পাঠানো গেল না।")).toBe("পাঠানো গেল না।");
    expect(errorMessage(Object.assign(new Error("Minified React error #441"), { digest: "12345" }), "x")).toBe("x");
    expect(errorMessage("oops", "x")).toBe("x");
  });

  it("carries our own Bangla zod messages, not zod's English ones", () => {
    const ours = z.object({ name: z.string().min(1, "নাম লেখো") }).safeParse({ name: "" });
    const theirs = z.object({ name: z.string().min(1) }).safeParse({ name: "" });
    expect(errorMessage(Object.assign(new Error("Minified React error #441"), { digest: (ours.error as unknown as { digest: string }).digest }))).toBe("নাম লেখো");
    expect((theirs.error as unknown as { digest?: string }).digest).toBeUndefined();
  });
});

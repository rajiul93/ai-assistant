import { describe, expect, it } from "vitest";
import { signRealtimeToken, verifyRealtimeToken } from "./realtime-token";

describe("realtime token", () => {
  const secret = "test-secret";
  it("round-trips the user id", () => expect(verifyRealtimeToken(signRealtimeToken("user1", secret), secret)).toBe("user1"));
  it("rejects another secret, a changed user and an expired token", () => {
    const token = signRealtimeToken("user1", secret, 1000, 0);
    expect(verifyRealtimeToken(token, "other", 0)).toBeNull();
    expect(verifyRealtimeToken(token.replace("user1", "user2"), secret, 0)).toBeNull();
    expect(verifyRealtimeToken(token, secret, 5000)).toBeNull();
  });
  it("rejects junk", () => {
    expect(verifyRealtimeToken(undefined, secret)).toBeNull();
    expect(verifyRealtimeToken("a.b", secret)).toBeNull();
  });
});

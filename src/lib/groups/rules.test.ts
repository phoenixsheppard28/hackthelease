import { describe, expect, it } from "vitest";
import { canAcceptInvite } from "./rules";

describe("canAcceptInvite", () => {
  const invite = { email: "student@example.com", expires_at: "2026-11-27T00:00:00Z", accepted_at: null };

  it("requires the invited email and an unexpired invitation", () => {
    expect(canAcceptInvite(invite, "STUDENT@example.com", new Date("2026-11-20"))).toBe(true);
    expect(canAcceptInvite(invite, "other@example.com", new Date("2026-11-20"))).toBe(false);
    expect(canAcceptInvite(invite, "student@example.com", new Date("2026-11-28"))).toBe(false);
    expect(canAcceptInvite({ ...invite, accepted_at: "2026-11-21T00:00:00Z" }, "student@example.com", new Date("2026-11-20"))).toBe(false);
  });
});

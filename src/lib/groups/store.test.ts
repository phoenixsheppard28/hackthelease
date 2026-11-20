import { beforeEach, describe, expect, it, vi } from "vitest";
import { acceptInvite, groupSaves, inviteToGroup } from "./store";
import { supabaseAdmin } from "@/lib/supabase/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: vi.fn() }));

const studentId = "11111111-1111-4111-8111-111111111111";
const groupId = "22222222-2222-4222-8222-222222222222";
const inviteId = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
});

describe("group access", () => {
  it("does not let a different email accept an invitation", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("housing_group_members")) return Response.json([]);
      return Response.json([{ id: inviteId, group_id: groupId, email: "invited@example.com", invited_by: studentId, expires_at: "2099-01-01T00:00:00Z", accepted_at: null }]);
    }));

    await expect(acceptInvite(studentId, "other@example.com", inviteId)).rejects.toThrow("not available");
    expect(calls.every(call => call.startsWith("GET "))).toBe(true);
  });

  it("reads saves only for the authenticated member's group", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("housing_group_members")) return Response.json([{ group_id: groupId, user_id: studentId }]);
      return Response.json(url.includes(`group_id=eq.${groupId}`) ? [{ listing_id: "home-a", saved_by: studentId }] : [{ listing_id: "other-group-home", saved_by: studentId }]);
    }));

    expect((await groupSaves(studentId))?.ids).toEqual(["home-a"]);
  });

  it("stores a pending invitation without sending email", async () => {
    vi.mocked(supabaseAdmin).mockReturnValue({ auth: { admin: { getUserById: async () => ({ data: { user: { email: "owner@example.com" } }, error: null }) } } } as never);
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push(`${method} ${url}`);
      if (url.includes("housing_group_members")) return Response.json([{ group_id: groupId, user_id: studentId }]);
      if (url.includes("housing_groups")) return Response.json([{ id: groupId, name: "Roommates", created_by: studentId }]);
      if (url.includes("housing_group_invites") && method === "POST") return Response.json([{ id: inviteId, group_id: groupId, email: "invitee@example.com", invited_by: studentId, expires_at: "2099-01-01T00:00:00Z", accepted_at: null }]);
      return Response.json([]);
    }));

    await expect(inviteToGroup(studentId, "owner@example.com", "invitee@example.com")).resolves.toEqual({ id: inviteId, email: "invitee@example.com" });
    expect(calls.some(call => call.startsWith("POST ") && call.includes("housing_group_invites"))).toBe(true);
    expect(calls.some(call => call.startsWith("DELETE "))).toBe(false);
  });

  it("finishes a join after the invitation update fails once", async () => {
    let joined = false;
    let patchCount = 0;
    vi.mocked(supabaseAdmin).mockReturnValue({ auth: { admin: { getUserById: async () => ({ data: { user: { email: "invited@example.com" } }, error: null }) } } } as never);
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("housing_group_members")) {
        if (init?.method === "POST") { joined = true; return Response.json([{ group_id: groupId, user_id: studentId }]); }
        return Response.json(joined ? [{ group_id: groupId, user_id: studentId }] : []);
      }
      if (url.includes("housing_group_invites")) {
        if (init?.method === "PATCH" && ++patchCount === 1) return new Response(null, { status: 503 });
        return Response.json([{ id: inviteId, group_id: groupId, email: "invited@example.com", invited_by: studentId, expires_at: "2099-01-01T00:00:00Z", accepted_at: null }]);
      }
      return Response.json([{ id: groupId, name: "Roommates", created_by: studentId }]);
    }));

    await expect(acceptInvite(studentId, "invited@example.com", inviteId)).rejects.toThrow();
    expect((await acceptInvite(studentId, "invited@example.com", inviteId))?.id).toBe(groupId);
  });
});

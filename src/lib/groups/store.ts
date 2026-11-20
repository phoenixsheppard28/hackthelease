import "server-only";
import { z } from "zod";
import { savedProfileSchema, type SavedProfile } from "@/lib/contracts/housing-profile";
import { supabaseAdmin } from "@/lib/supabase/server";
import { canAcceptInvite } from "./rules";

type Member = { group_id: string; user_id: string };
type Group = { id: string; name: string; created_by: string };
type Invite = { id: string; group_id: string; email: string; invited_by: string; expires_at: string; accepted_at: string | null };
type Save = { listing_id: string; saved_by: string };

async function rest<T>(table: string, query: string, init?: RequestInit): Promise<T[]> {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Group storage is not configured.");

  const response = await fetch(`${base.replace(/\/$/, "")}/rest/v1/${table}?${query}`, {
    ...init,
    headers: { apikey: key, ...(key.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${key}` }), "Content-Type": "application/json", Prefer: "return=representation", ...init?.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Group storage returned ${response.status}.`);
  const body = await response.text();
  return body ? JSON.parse(body) as T[] : [];
}

async function membership(userId: string): Promise<Member | null> {
  const [member] = await rest<Member>("housing_group_members", `select=group_id,user_id&user_id=eq.${encodeURIComponent(userId)}`);
  return member ?? null;
}

async function groupMembers(groupId: string) {
  return rest<Member>("housing_group_members", `select=group_id,user_id&group_id=eq.${encodeURIComponent(groupId)}`);
}

export async function currentGroup(userId: string) {
  const member = await membership(userId);
  if (!member) return null;
  const [group] = await rest<Group>("housing_groups", `select=id,name,created_by&id=eq.${member.group_id}`);
  if (!group) throw new Error("Group membership has no group.");

  const members = await groupMembers(group.id);
  const people = await Promise.all(members.map(async memberRow => {
    const { data, error } = await supabaseAdmin().auth.admin.getUserById(memberRow.user_id);
    if (error) throw error;
    return { id: memberRow.user_id, email: data.user?.email ?? "Unknown email" };
  }));
  const pending = await rest<Invite>("housing_group_invites", `select=id,group_id,email,invited_by,expires_at,accepted_at&group_id=eq.${group.id}&accepted_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`);

  return { ...group, members: people, pendingInvites: pending.map(invite => ({ id: invite.id, email: invite.email, expiresAt: invite.expires_at })) };
}

export async function createGroup(userId: string, email: string, name: string) {
  if (await membership(userId)) throw new Error("You already belong to a housing group.");
  const [group] = await rest<Group>("housing_groups", "select=id,name,created_by", { method: "POST", body: JSON.stringify({ name, created_by: userId }) });
  if (!group) throw new Error("Could not create the group.");

  try {
    await rest<Member>("housing_group_members", "select=group_id,user_id", { method: "POST", body: JSON.stringify({ group_id: group.id, user_id: userId }) });
  } catch (error) {
    await rest<Group>("housing_groups", `id=eq.${group.id}`, { method: "DELETE" });
    throw error;
  }

  return { ...group, members: [{ id: userId, email }] };
}

export async function renameGroup(userId: string, name: string) {
  const group = await currentGroup(userId);
  if (!group || group.created_by !== userId) throw new Error("Only the group creator can rename the group.");

  const [updated] = await rest<Group>("housing_groups", `select=id,name,created_by&id=eq.${group.id}&created_by=eq.${userId}`, { method: "PATCH", body: JSON.stringify({ name }) });
  if (!updated) throw new Error("Could not rename the group.");
  return updated;
}

export async function removeGroupMember(userId: string, memberId: string) {
  const group = await currentGroup(userId);
  if (!group || group.created_by !== userId) throw new Error("Only the group creator can remove members.");
  if (memberId === userId || !group.members.some(member => member.id === memberId)) throw new Error("This member cannot be removed.");

  await rest<Member>("housing_group_members", `group_id=eq.${group.id}&user_id=eq.${encodeURIComponent(memberId)}`, { method: "DELETE" });
}

export async function cancelGroupInvite(userId: string, inviteId: string) {
  const group = await currentGroup(userId);
  if (!group || group.created_by !== userId) throw new Error("Only the group creator can cancel invitations.");
  if (!group.pendingInvites.some(invite => invite.id === inviteId)) throw new Error("Invitation not found.");

  await rest<Invite>("housing_group_invites", `group_id=eq.${group.id}&id=eq.${encodeURIComponent(inviteId)}`, { method: "DELETE" });
}

export async function pendingInvites(email: string) {
  const invites = await rest<Invite>("housing_group_invites", `select=id,group_id,email,invited_by,expires_at,accepted_at&email=eq.${encodeURIComponent(email)}&accepted_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`);
  return Promise.all(invites.map(async invite => {
    const [group] = await rest<Group>("housing_groups", `select=id,name,created_by&id=eq.${invite.group_id}`);
    return { id: invite.id, groupId: invite.group_id, groupName: group?.name ?? "Housing group", expiresAt: invite.expires_at };
  }));
}

export async function inviteToGroup(userId: string, userEmail: string, email: string) {
  const group = await currentGroup(userId);
  if (!group) throw new Error("Create or join a group first.");
  if (email === userEmail || group.members.some(member => member.email.toLowerCase() === email)) throw new Error("This student is already in your group.");

  const recent = await rest<Invite>("housing_group_invites", `select=id&invited_by=eq.${userId}&created_at=gte.${encodeURIComponent(new Date(Date.now() - 3600000).toISOString())}`);
  if (recent.length >= 5) throw new Error("Wait before creating more invitations.");
  const existing = await rest<Invite>("housing_group_invites", `select=id,group_id,email,invited_by,expires_at,accepted_at&group_id=eq.${group.id}&email=eq.${encodeURIComponent(email)}`);
  if (existing.some(invite => canAcceptInvite(invite, email))) throw new Error("This student already has an invitation.");
  if (existing.length) await rest<Invite>("housing_group_invites", `id=eq.${existing[0].id}`, { method: "DELETE" });

  const [invite] = await rest<Invite>("housing_group_invites", "select=id,group_id,email,invited_by,expires_at,accepted_at", { method: "POST", body: JSON.stringify({ group_id: group.id, email, invited_by: userId }) });
  if (!invite) throw new Error("Could not create the invitation.");

  return { id: invite.id, email };
}

export async function acceptInvite(userId: string, email: string, inviteId: string) {
  const member = await membership(userId);
  const [invite] = await rest<Invite>("housing_group_invites", `select=id,group_id,email,invited_by,expires_at,accepted_at&id=eq.${encodeURIComponent(inviteId)}`);
  if (!invite || invite.email !== email || (member && member.group_id !== invite.group_id) || (!member && !canAcceptInvite(invite, email))) throw new Error("This invitation is not available for your email.");
  if (member && invite.accepted_at) return currentGroup(userId);

  if (!member) await rest<Member>("housing_group_members", "select=group_id,user_id", { method: "POST", body: JSON.stringify({ group_id: invite.group_id, user_id: userId }) });
  await rest<Invite>("housing_group_invites", `id=eq.${invite.id}`, { method: "PATCH", body: JSON.stringify({ accepted_at: new Date().toISOString() }) });
  return currentGroup(userId);
}

export async function groupProfiles(userId: string) {
  const member = await membership(userId);
  if (!member) return null;
  const members = await groupMembers(member.group_id);
  const ids = members.map(row => z.uuid().parse(row.user_id));
  const rows = await rest<SavedProfile & { owner_id: string }>("housing_profiles", `select=id,profile,owner_id&owner_id=in.(${ids.join(",")})&order=created_at.desc`);
  const latest = rows.filter((row, index) => rows.findIndex(candidate => candidate.owner_id === row.owner_id) === index);
  return { memberCount: members.length, profiles: savedProfileSchema.array().parse(latest), groupId: member.group_id };
}

export async function groupSaves(userId: string) {
  const member = await membership(userId);
  if (!member) return null;
  const saves = await rest<Save>("housing_group_saves", `select=listing_id,saved_by&group_id=eq.${member.group_id}`);
  return { groupId: member.group_id, ids: saves.map(save => save.listing_id) };
}

export async function setGroupSave(userId: string, listingId: string, saved: boolean) {
  const member = await membership(userId);
  if (!member) throw new Error("Join a group to save homes together.");
  if (saved) {
    const [listing] = await rest<{ id: string }>("listings", `select=id&id=eq.${listingId}&is_active=eq.true`);
    if (!listing) throw new Error("This listing is no longer available.");
    await rest<Save>("housing_group_saves", "select=listing_id,saved_by&on_conflict=group_id,listing_id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ group_id: member.group_id, listing_id: listingId, saved_by: userId }) });
  } else {
    await rest<Save>("housing_group_saves", `group_id=eq.${member.group_id}&listing_id=eq.${listingId}`, { method: "DELETE" });
  }

  return groupSaves(userId);
}

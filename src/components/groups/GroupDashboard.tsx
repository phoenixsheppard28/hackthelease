"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/onboarding/Icon";
import styles from "./GroupDashboard.module.scss";

type Group = { id: string; name: string; created_by: string; members: { id: string; email: string }[]; pendingInvites: { id: string; email: string; expiresAt: string }[] };
type Invite = { id: string; groupName: string; expiresAt: string };
export type GroupState = { group: Group | null; invites: Invite[]; studentId: string };

async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Please retry.");
  return result;
}

export function GroupDashboard() {
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const state = useQuery<GroupState>({ queryKey: ["housing-group"], queryFn: () => request("/api/groups") });
  const group = state.data?.group;
  const creator = Boolean(group && group.created_by === state.data?.studentId);

  async function act(path: string, method: string, body: unknown, success: string) {
    setPending(true);
    setMessage("");
    try {
      await request(path, method, body);
      await client.invalidateQueries({ queryKey: ["housing-group"] });
      await client.invalidateQueries({ queryKey: ["live-rank"] });
      setMessage(success);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Please retry.");
      return false;
    } finally {
      setPending(false);
    }
  }

  return <div className={styles.content}>
    {state.isPending && <p role="status">Loading your group…</p>}
    {state.isError && <p role="alert">Could not load your group. <button onClick={() => state.refetch()}>Retry</button></p>}
    {group ? <>
      {renaming ? <form className={styles.renameForm} onSubmit={async (event: FormEvent) => { event.preventDefault(); if (await act("/api/groups", "PATCH", { name }, "Group name updated.")) { setName(""); setRenaming(false); } }}>
        <input aria-label="Group name" maxLength={80} required autoFocus value={name} onChange={event => setName(event.target.value)} />
        <button disabled={pending}>Confirm</button>
        <button className={styles.cancelButton} type="button" disabled={pending} onClick={() => { setName(""); setRenaming(false); }}>Cancel</button>
      </form> : <div className={styles.nameRow}><h2>{group.name}</h2>{creator && <button className={styles.editName} type="button" aria-label="Edit group name" onClick={() => { setName(group.name); setRenaming(true); }}><Icon name="pencil" size={18} /></button>}</div>}
      <h3>Members</h3>
      <ul>{group.members.map(member => <li key={member.id}>{member.email}{creator && member.id !== state.data?.studentId && <button disabled={pending} onClick={() => act("/api/groups/members", "DELETE", { memberId: member.id }, "Member removed.")}>Remove</button>}</li>)}</ul>
      <form onSubmit={async (event: FormEvent) => { event.preventDefault(); const email = inviteEmail; if (await act("/api/groups/invite", "POST", { email }, `Invitation for ${email} is pending.`)) setInviteEmail(""); }}>
        <label htmlFor="invite-email">Invite a student by email</label>
        <div><input id="invite-email" type="email" required value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} /><button disabled={pending}>Add invitation</button></div>
      </form>
      {group.pendingInvites.length > 0 && <>
        <h3>Pending invitations</h3>
        <ul>{group.pendingInvites.map(invite => <li key={invite.id}>{invite.email} · expires {new Date(invite.expiresAt).toLocaleDateString()}{creator && <button disabled={pending} onClick={() => act("/api/groups/invite", "DELETE", { inviteId: invite.id }, "Invitation cancelled.")}>Cancel</button>}</li>)}</ul>
      </>}
    </> : state.data && <>
      {state.data.invites.map(invite => <section key={invite.id}>
        <h2>Invitation to {invite.groupName}</h2>
        <p>Expires {new Date(invite.expiresAt).toLocaleDateString()}.</p>
        <button disabled={pending} onClick={() => act("/api/groups/accept", "POST", { inviteId: invite.id }, `You joined ${invite.groupName}.`)}>Join group</button>
      </section>)}
      <h2>Start a housing group</h2>
      <form onSubmit={async (event: FormEvent) => { event.preventDefault(); if (await act("/api/groups", "POST", { name }, "Your group is ready.")) setName(""); }}>
        <label htmlFor="group-name">Group name</label>
        <div><input id="group-name" maxLength={80} required value={name} onChange={event => setName(event.target.value)} /><button disabled={pending}>Create group</button></div>
      </form>
    </>}
    {message && <p role="status">{message}</p>}
  </div>;
}

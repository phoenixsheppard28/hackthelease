"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import styles from "./GroupDashboard.module.scss";

type Group = { id: string; name: string; members: { id: string; email: string }[]; pendingInvites: { id: string; email: string; expiresAt: string }[] };
type Invite = { id: string; groupName: string; expiresAt: string };
type GroupState = { group: Group | null; invites: Invite[] };

async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Please retry.");
  return result;
}

export function GroupDashboard({ email }: { email: string }) {
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const state = useQuery<GroupState>({ queryKey: ["housing-group"], queryFn: () => request("/api/groups"), refetchInterval: 15000 });

  async function act(path: string, body: unknown, success: string) {
    setPending(true);
    setMessage("");
    try {
      await request(path, "POST", body);
      await client.invalidateQueries({ queryKey: ["housing-group"] });
      setMessage(success);
      setPending(false);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Please retry.");
      setPending(false);
      return false;
    }
  }

  async function signOut() {
    try {
      await request("/api/auth/sign-out", "POST");
      window.location.href = "/";
    } catch { setMessage("Could not sign out. Please retry."); }
  }

  return <main className={styles.page}>
    <header><Link href="/" className={styles.brand}>Hack the Lease</Link><span>{email}</span><button onClick={signOut}>Sign out</button></header>
    <div className={styles.content}>
      <h1>Your housing group</h1>
      {state.isPending && <p role="status">Loading your group…</p>}
      {state.isError && <p role="alert">Could not load your group. <button onClick={() => state.refetch()}>Retry</button></p>}
      {state.data?.group ? <section className={styles.card}>
        <h2>{state.data.group.name}</h2>
        <p>Everyone in this group sees the same ranked homes and saved list.</p>
        <h3>Members</h3>
        <ul>{state.data.group.members.map(member => <li key={member.id}>{member.email}</li>)}</ul>
        <form onSubmit={async (event: FormEvent) => { event.preventDefault(); const email = inviteEmail; if (await act("/api/groups/invite", { email }, `Invitation for ${email} is pending.`)) setInviteEmail(""); }}>
          <label htmlFor="invite-email">Invite a student by email</label>
          <div><input id="invite-email" type="email" required value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} /><button disabled={pending}>Add invitation</button></div>
          <small>No email is sent. Tell them to create an account with this address.</small>
        </form>
        {state.data.group.pendingInvites.length > 0 && <>
          <h3>Pending invitations</h3>
          <ul>{state.data.group.pendingInvites.map(invite => <li key={invite.id}>{invite.email} · expires {new Date(invite.expiresAt).toLocaleDateString()}</li>)}</ul>
        </>}
        <Link href="/">Search homes together →</Link>
      </section> : state.data && <>
        {state.data.invites.map(invite => <section className={styles.card} key={invite.id}>
          <h2>Invitation to {invite.groupName}</h2>
          <p>Expires {new Date(invite.expiresAt).toLocaleDateString()}.</p>
          <button disabled={pending} onClick={() => act("/api/groups/accept", { inviteId: invite.id }, `You joined ${invite.groupName}.`)}>Join group</button>
        </section>)}
        <section className={styles.card}>
          <h2>Create a group</h2>
          <form onSubmit={(event: FormEvent) => { event.preventDefault(); act("/api/groups", { name }, "Your group is ready."); }}>
            <label htmlFor="group-name">Group name</label>
            <div><input id="group-name" maxLength={80} required value={name} onChange={event => setName(event.target.value)} /><button disabled={pending}>Create group</button></div>
          </form>
        </section>
      </>}
      {message && <p role="status">{message}</p>}
    </div>
  </main>;
}

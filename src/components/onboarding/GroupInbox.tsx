"use client";

import Link from 'next/link';
import { useState } from 'react';
import { statusLabels, type Followup, type GroupInbox as Inbox, type InboxThread } from '@/lib/availability/contracts';
import { ListingAvailability } from './ListingAvailability';
import styles from './GroupInbox.module.scss';

type Member = { id: string; email: string };
const when = (value: string) => new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function Draft({ followup, onSent }: { followup: Followup; onSent: () => Promise<unknown> }) {
  const [body, setBody] = useState(followup.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/availability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reply', followupId: followup.id, body, approved: true }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Could not send this reply.');
      await onSent();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Please retry.'); }
    finally { setBusy(false); }
  }

  return <div className={styles.draft}>
    <p className={styles.meta}>Agent draft · Review and edit before you send</p>
    <textarea aria-label="Reply to landlord" value={body} disabled={busy || followup.status !== 'draft'} onChange={event => setBody(event.target.value)} rows={7} />
    {error && <p role="alert">{error}</p>}
    <button disabled={busy || followup.status !== 'draft' || !body.trim()} onClick={send}>{busy || followup.status === 'sending' ? 'Sending…' : 'Send reply'}</button>
  </div>;
}

function Thread({ thread, members, profileId, onChange }: { thread: InboxThread; members: Member[]; profileId: string; onChange: () => Promise<unknown> }) {
  const { inquiry, listing, replies, followups } = thread;
  const person = (id: string | null) => members.find(member => member.id === id)?.email ?? 'A group member';
  const answered = replies.length > 0;

  return <article className={styles.thread}>
    <header>
      <div>
        <Link href={`/listings/${listing.id}?profile=${encodeURIComponent(profileId)}`}>{listing.title}</Link>
        <p className={styles.meta}>{inquiry.lease_start} to {inquiry.lease_end} · Asked by {person(inquiry.requested_by)}{inquiry.is_test ? ' · Test email' : ''}</p>
      </div>
      <span className={styles.status} data-answered={answered}>{answered ? 'Landlord replied' : inquiry.status === 'draft' ? 'Draft' : 'Waiting for reply'}</span>
    </header>
    <ListingAvailability report={listing.availabilityReport} compact />
    <details className={styles.message}>
      <summary>Group → {inquiry.recipient}{inquiry.attempted_at ? ` · ${when(inquiry.attempted_at)}` : ''}</summary>
      <pre>{inquiry.body}</pre>
    </details>
    {replies.map(reply => ({ reply, followup: followups.find(item => item.reply_message_id === reply.message_id) })).map(({ reply, followup }) => <div key={reply.message_id}>
      <div className={styles.message} data-incoming>
        <p><strong>{reply.sender}</strong> · {when(reply.received_at)}</p>
        <pre>{reply.body}</pre>
        {!reply.expected_sender && <p className={styles.meta}>Unexpected sender. This reply cannot change the listing status.</p>}
        {reply.proposal && <p className={styles.proposal}>{statusLabels[reply.proposal.status]}{reply.proposal.matchesUnitAndDates ? '' : ' · Unit or dates unclear'} · “{reply.proposal.evidence}”</p>}
      </div>
      {followup?.status === 'sent' ? <div className={styles.message}>
        <p><strong>Group</strong> · Sent by {person(followup.sent_by)}{followup.sent_at ? ` · ${when(followup.sent_at)}` : ''}</p>
        <pre>{followup.body}</pre>
      </div> : followup && <Draft followup={followup} onSent={onChange} />}
    </div>)}
  </article>;
}

export function GroupInbox({ inbox, members, profileId, error, onChange }: { inbox?: Inbox; members: Member[]; profileId: string; error?: string; onChange: () => Promise<unknown> }) {
  if (error) return <div className={styles.empty} role="alert"><h2>We couldn’t load your inbox.</h2><p>{error}</p></div>;
  if (!inbox) return <div className={styles.empty}>Loading your group inbox…</div>;
  if (!inbox.groupId) return <div className={styles.empty}><h2>Start a housing group first.</h2><p>Your group shares one inbox for landlord emails. Open the account menu to start or join a group.</p></div>;

  return <section className={styles.inbox}>
    <p className={styles.meta}>{inbox.inboxEmail ? `Shared group inbox: ${inbox.inboxEmail}` : inbox.configured ? 'Your group inbox is created when you send the first email.' : 'Group email setup is pending.'} · Everyone in your group sees these conversations.</p>
    {inbox.threads.length ? inbox.threads.map(thread => <Thread key={thread.inquiry.id} thread={thread} members={members} profileId={profileId} onChange={onChange} />)
      : <div className={styles.empty}><h2>No landlord emails yet.</h2><p>Open a home and choose Check availability to ask the landlord.</p></div>}
  </section>;
}

"use client";

import { useEffect, useState } from 'react';
import { Modal } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListingMatchesResponse } from '@/lib/contracts/listing-match';
import { statusLabels, type AvailabilityView, type Confirmation, type Inquiry, type Reply } from '@/lib/availability/contracts';
import styles from './Availability.module.scss';

async function api(body: unknown) {
  const response = await fetch('/api/availability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not complete this request.');
  return data;
}
function Review({ reply, inquiryId, busy, onConfirm }: { reply: Reply; inquiryId: string; busy: boolean; onConfirm: (data: unknown) => void }) {
  const [status, setStatus] = useState<Confirmation['status']>('available');
  const [checked, setChecked] = useState(false);
  return <div className={styles.review}>
    <label>Publish availability<select value={status} onChange={event => setStatus(event.target.value as Confirmation['status'])}>
      <option value="available">Available</option><option value="unavailable">Unavailable</option><option value="renewal_undecided">Renewal undecided</option>
    </select></label>
    <label className={styles.check}><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} />I checked the sender, unit and lease dates against this reply.</label>
    <button disabled={busy || !checked} onClick={() => onConfirm({ action: 'confirm', inquiryId, messageId: reply.message_id, status, reviewedUnitAndDates: true })}>Publish confirmation</button>
  </div>;
}

function DraftEmail({ inquiry, busy, onSend }: { inquiry: Inquiry; busy: boolean; onSend: (data: unknown) => void }) {
  const [subject, setSubject] = useState(inquiry.subject);
  const [body, setBody] = useState(inquiry.body);
  return <div className={styles.draft}>
    <label>Subject<input value={subject} disabled={busy} maxLength={200} onChange={event => setSubject(event.target.value)} /></label>
    <label>Email<textarea value={body} disabled={busy} rows={10} maxLength={4000} onChange={event => setBody(event.target.value)} /></label>
    <button disabled={busy || !subject.trim() || !body.trim()} onClick={() => onSend({ action: 'send', inquiryId: inquiry.id, approved: true, email: { subject: subject.replace(/[\r\n]+/g, ' '), body } })}>Send this email</button>
  </div>;
}

export function Availability({ listingId }: { listingId: string }) {
  const client = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const view = useQuery<AvailabilityView>({ queryKey: ['availability', listingId], retry: false, refetchInterval: opened ? 15000 : false,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/availability?listingId=${listingId}`, { signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load availability.');
      return data;
    } });
  useEffect(() => {
    if (!view.data) return;
    // Refresh just the flag; do not buy new route/embedding requests for a status change.
    client.setQueriesData<ListingMatchesResponse>({ predicate: query => ['listing-evidence', 'live-rank', 'live-listing'].includes(String(query.queryKey[0])) }, previous => previous ? {
      ...previous, matches: previous.matches.map(home => home.id === listingId ? { ...home, availabilityReport: view.data!.availabilityReport } : home),
    } : previous);
  }, [client, listingId, view.data]);
  async function perform(action: unknown) {
    if (busy) return;
    setBusy(true); setError('');
    try { await api(action); return true; }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Please retry.'); return false; }
    finally { await view.refetch(); setBusy(false); }
  }
  const confirmations = view.data?.confirmations ?? [];
  return <section className={styles.availability}>
    {confirmations.map(confirmation => <p key={confirmation.id} className={styles.confirmation}>
      <strong>{Date.parse(confirmation.expires_at) < Date.now() ? 'Confirmation needs an update' : statusLabels[confirmation.status]}</strong>
      <span>{confirmation.lease_start} to {confirmation.lease_end}</span>
      <small>Reviewed {new Date(confirmation.confirmed_at).toLocaleDateString()} · Property contact reported</small>
    </p>)}
    <button onClick={() => setOpened(true)}>Ask the landlord</button>
    <Modal opened={opened} onClose={() => !busy && setOpened(false)} title="Ask the landlord" centered size={640} radius={6} closeOnEscape={!busy} closeOnClickOutside={!busy} closeButtonProps={{ disabled: busy }}>
      <div className={styles.dialog}>
        <p>Write what you want to know. We turn it into an email you can review before it is sent. Everyone in your housing group can view the conversation.</p>
        {view.isPending && <p role="status">Loading your group’s inquiries…</p>}
        {view.isError && <p role="alert">{view.error.message} <button onClick={() => view.refetch()}>Retry</button></p>}
        {view.data && !view.data.groupId && <p>Create or join a housing group from your account menu first.</p>}
        {view.data && !view.data.configured && <p role="status">Group email setup is pending.</p>}
        {view.data?.inboxEmail && <p className={styles.meta}>Shared group inbox: {view.data.inboxEmail}</p>}
        {view.data?.groupId && view.data.configured && <form onSubmit={async event => { event.preventDefault(); if (await perform({ action: 'draft', input: { listingId, question } })) setQuestion(''); }}>
          <label className={styles.question}>Your question<textarea required rows={3} maxLength={1000} placeholder="e.g. Is this available for next fall? Are utilities included?" value={question} disabled={busy} onChange={event => setQuestion(event.target.value)} /></label>
          <button disabled={busy || question.trim().length < 3}>{busy ? 'Writing email…' : 'Write email'}</button>
        </form>}
        {error && <p role="alert">{error}</p>}
        {view.data?.inquiries.map(inquiry => <article className={styles.inquiry} key={inquiry.id}>
          <h3>{inquiry.status === 'draft' ? 'Review your email' : inquiry.subject}</h3>
          <p className={styles.meta}>{inquiry.is_test ? 'Test email · ' : ''}{inquiry.status.replaceAll('_', ' ')}</p>
          <p><strong>To:</strong> {inquiry.recipient}</p>
          {inquiry.status === 'draft' ? <DraftEmail inquiry={inquiry} busy={busy} onSend={perform} />
            : <><pre>{inquiry.body}</pre><button disabled={busy} onClick={() => perform({ action: 'sync', inquiryId: inquiry.id })}>Check replies</button></>}
          {['sending','delivery_unknown'].includes(inquiry.status) && <><p className={styles.meta}>Delivery is unconfirmed. Check replies before retrying.</p><button disabled={busy || !inquiry.attempted_at || Date.now() - Date.parse(inquiry.attempted_at) >= 23 * 3600000} onClick={() => perform({ action: 'send', inquiryId: inquiry.id, approved: true })}>Retry same email</button></>}
          {view.data!.replies.filter(reply => reply.inquiry_id === inquiry.id).map(reply => <div className={styles.reply} key={reply.message_id}>
            <p><strong>{reply.sender}</strong> · {new Date(reply.received_at).toLocaleString()}</p><pre>{reply.body}</pre>
            {!reply.expected_sender && <p>Sender needs review. This reply cannot confirm availability.</p>}
            {reply.proposal && <p className={styles.proposal}>AI suggestion · {statusLabels[reply.proposal.status]}{!reply.proposal.matchesUnitAndDates ? ' · Unit or dates need clarification' : ''}<br />“{reply.proposal.evidence}”<br /><small>{inquiry.is_test ? 'Test reply. Public listing status is unchanged.' : (reply.proposal.tenantsRenewing || reply.proposal.leaseSigned || reply.proposal.status === 'available') && reply.proposal.matchesUnitAndDates && reply.expected_sender ? 'Confirmed availability, renewals and signed leases automatically update the listing flag. Older reports expire after 30 days.' : 'A reviewer must confirm other availability changes.'}</small></p>}
            {view.data!.canReview && reply.expected_sender && !inquiry.is_test && <Review reply={reply} inquiryId={inquiry.id} busy={busy} onConfirm={perform} />}
          </div>)}
        </article>)}
        {busy && <p role="status">Updating your inquiry…</p>}
      </div>
    </Modal>
  </section>;
}

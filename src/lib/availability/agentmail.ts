import 'server-only';
import { z } from 'zod';
import { AvailabilityError } from './storage';

export async function agentmail<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.AGENTMAIL_API_KEY;
  if (!key) throw new AvailabilityError('Group email is not configured yet.', 503);
  const response = await fetch(`https://api.agentmail.to/v0/${path}`, { ...init,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers },
    cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new AvailabilityError(response.status === 403 ? 'The AgentMail key is missing a required permission. Check inbox_create, inbox_read, message_send and message_read.' : 'The email provider could not complete this request. Please retry.', 503);
  return response.json();
}
export async function createGroupInbox(groupId: string) {
  return z.object({ inbox_id: z.string(), email: z.email().optional() }).parse(await agentmail('inboxes', {
    method: 'POST', body: JSON.stringify({ display_name: 'HomeWork housing group', client_id: `homework-group-${groupId}` }),
  }));
}
export const mailMessageSchema = z.object({ message_id: z.string(), thread_id: z.string(), inbox_id: z.string(),
  from: z.string(), timestamp: z.iso.datetime({ offset: true }), labels: z.array(z.string()).default([]),
  text: z.string().optional(), extracted_text: z.string().optional(), subject: z.string().optional() });
export type MailMessage = z.infer<typeof mailMessageSchema>;
export function senderAddress(from: string) { return (from.match(/<([^<>]+)>\s*$/)?.[1] ?? from).trim().toLowerCase(); }
export function safeIncoming(message: MailMessage, recipient: string) {
  return senderAddress(message.from) === recipient.toLowerCase() && message.labels.includes('received') &&
    !message.labels.some(label => ['spam','blocked','unauthenticated'].includes(label));
}

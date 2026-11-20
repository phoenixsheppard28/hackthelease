import { z } from 'zod';
import { validMailSignature } from '@/lib/availability/webhook';
import { storage } from '@/lib/availability/storage';
import { agentmail, mailMessageSchema } from '@/lib/availability/agentmail';
import { recordReply } from '@/lib/availability/service';
import type { Inquiry } from '@/lib/availability/contracts';

export const maxDuration = 60;
export async function POST(request: Request) {
  const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: 'Webhook is not configured.' }, { status: 503 });
  const body = await request.text();
  if (body.length > 1_000_000) return new Response(null, { status: 413 });
  if (!validMailSignature(body, request.headers, secret)) return new Response(null, { status: 401 });
  let event;
  try { event = z.object({ event_type: z.string(), message: z.object({ inbox_id: z.string(), thread_id: z.string(), message_id: z.string() }).optional() }).parse(JSON.parse(body)); }
  catch { return new Response(null, { status: 400 }); }
  if (event.event_type !== 'message.received' || !event.message) return new Response(null, { status: 204 });
  try {
    const { inbox_id, thread_id, message_id } = event.message;
    const [inquiry] = await storage<Inquiry[]>('availability_inquiries', `inbox_id=eq.${encodeURIComponent(inbox_id)}&thread_id=eq.${encodeURIComponent(thread_id)}`);
    if (!inquiry) return new Response(null, { status: 204 });
    const message = mailMessageSchema.parse(await agentmail(`inboxes/${encodeURIComponent(inbox_id)}/messages/${encodeURIComponent(message_id)}`));
    await recordReply(inquiry, message);
    return new Response(null, { status: 204 });
  } catch { return Response.json({ error: 'Reply processing failed. Retry delivery.' }, { status: 503 }); }
}

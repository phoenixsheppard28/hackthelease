import { z } from 'zod';
import { currentStudent } from '@/lib/supabase/auth';
import { followupInput, inquiryInput } from '@/lib/availability/contracts';
import { availabilityView, createInquiry, publishConfirmation, sendFollowup, sendInquiry, syncInquiry } from '@/lib/availability/service';
import { AvailabilityError } from '@/lib/availability/storage';

export const maxDuration = 60;
const headers = { 'Cache-Control': 'no-store' };
function failure(error: unknown) {
  return Response.json({ error: error instanceof AvailabilityError ? error.message : 'Could not complete the availability request. Please retry.' }, { status: error instanceof AvailabilityError ? error.status : 503, headers });
}
export async function GET(request: Request) {
  try {
    const student = await currentStudent();
    if (!student) return Response.json({ error: 'Sign in to check availability.' }, { status: 401, headers });
    const id = z.uuid().safeParse(new URL(request.url).searchParams.get('listingId'));
    if (!id.success) return Response.json({ error: 'Invalid listing.' }, { status: 400, headers });
    return Response.json(await availabilityView(student.id, id.data), { headers });
  } catch (error) { return failure(error); }
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('draft'), input: inquiryInput }),
  z.object({ action: z.literal('send'), inquiryId: z.uuid(), approved: z.literal(true) }),
  z.object({ action: z.literal('sync'), inquiryId: z.uuid() }),
  followupInput.extend({ action: z.literal('reply'), approved: z.literal(true) }),
  z.object({ action: z.literal('confirm'), inquiryId: z.uuid(), messageId: z.string().min(1).max(1000), status: z.enum(['available','unavailable','renewal_undecided']), reviewedUnitAndDates: z.literal(true) }),
]);
export async function POST(request: Request) {
  try {
    const student = await currentStudent();
    if (!student) return Response.json({ error: 'Sign in to check availability.' }, { status: 401, headers });
    const raw = await request.text();
    if (raw.length > 8000) return Response.json({ error: 'Request too large.' }, { status: 413, headers });
    const parsed = actionSchema.safeParse(JSON.parse(raw || 'null'));
    if (!parsed.success) return Response.json({ error: 'Check the lease dates and confirm your action.' }, { status: 400, headers });
    const data = parsed.data;
    if (data.action === 'draft') return Response.json({ inquiry: await createInquiry(student.id, data.input) }, { headers });
    if (data.action === 'send') return Response.json({ inquiry: await sendInquiry(student.id, data.inquiryId) }, { headers });
    if (data.action === 'reply') await sendFollowup(student.id, data.followupId, data.body);
    else if (data.action === 'sync') await syncInquiry(student.id, data.inquiryId);
    else await publishConfirmation(student.id, data.inquiryId, data.messageId, data.status);
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: 'Invalid request.' }, { status: 400, headers });
    return failure(error);
  }
}

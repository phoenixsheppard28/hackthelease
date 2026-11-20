import { currentStudent } from '@/lib/supabase/auth';
import { groupInbox } from '@/lib/availability/service';
import { AvailabilityError } from '@/lib/availability/storage';

const headers = { 'Cache-Control': 'no-store' };
export async function GET() {
  try {
    const student = await currentStudent();
    if (!student) return Response.json({ error: 'Sign in to view your group inbox.' }, { status: 401, headers });
    return Response.json(await groupInbox(student.id), { headers });
  } catch (error) {
    return Response.json({ error: error instanceof AvailabilityError ? error.message : 'Could not load the group inbox. Please retry.' }, { status: error instanceof AvailabilityError ? error.status : 503, headers });
  }
}

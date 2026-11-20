import { z } from "zod";
import { currentStudent } from "@/lib/supabase/auth";
import { inviteToGroup } from "@/lib/groups/store";

export async function POST(request: Request) {
  const student = await currentStudent();
  if (!student) return Response.json({ error: "Sign in to invite a student." }, { status: 401 });
  const parsed = z.object({ email: z.email().max(254) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a valid email address." }, { status: 400 });

  try {
    return Response.json({ invite: await inviteToGroup(student.id, student.email, parsed.data.email.toLowerCase()) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not create the invitation." }, { status: 400 });
  }
}

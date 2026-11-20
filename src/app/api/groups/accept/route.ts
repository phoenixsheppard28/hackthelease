import { z } from "zod";
import { currentStudent } from "@/lib/supabase/auth";
import { acceptInvite } from "@/lib/groups/store";

export async function POST(request: Request) {
  const student = await currentStudent();
  if (!student) return Response.json({ error: "Sign in to accept an invitation." }, { status: 401 });
  const parsed = z.object({ inviteId: z.uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid invitation." }, { status: 400 });

  try {
    return Response.json({ group: await acceptInvite(student.id, student.email, parsed.data.inviteId) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not join the group." }, { status: 400 });
  }
}

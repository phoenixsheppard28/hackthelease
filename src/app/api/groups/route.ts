import { z } from "zod";
import { currentStudent } from "@/lib/supabase/auth";
import { createGroup, currentGroup, pendingInvites } from "@/lib/groups/store";

export async function GET() {
  const student = await currentStudent();
  if (!student) return Response.json({ error: "Sign in to view groups." }, { status: 401 });

  try {
    const [group, invites] = await Promise.all([currentGroup(student.id), pendingInvites(student.email)]);
    return Response.json({ group, invites });
  } catch {
    return Response.json({ error: "Could not load your group." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const student = await currentStudent();
  if (!student) return Response.json({ error: "Sign in to create a group." }, { status: 401 });
  const parsed = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a group name." }, { status: 400 });

  try {
    return Response.json({ group: await createGroup(student.id, student.email, parsed.data.name) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not create the group." }, { status: 400 });
  }
}

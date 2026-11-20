import { z } from "zod";
import { currentStudent } from "@/lib/supabase/auth";
import { removeGroupMember } from "@/lib/groups/store";

export async function DELETE(request: Request) {
  const student = await currentStudent();
  if (!student) return Response.json({ error: "Sign in to remove a member." }, { status: 401 });
  const parsed = z.object({ memberId: z.uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid group member." }, { status: 400 });

  try {
    await removeGroupMember(student.id, parsed.data.memberId);
    return Response.json({ removed: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not remove the member." }, { status: 400 });
  }
}

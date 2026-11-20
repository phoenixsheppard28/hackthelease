import { z } from "zod";
import { currentStudent } from "@/lib/supabase/auth";
import { groupSaves, setGroupSave } from "@/lib/groups/store";

export async function GET() {
  const student = await currentStudent();
  if (!student) return Response.json({ error: "Sign in to view saved homes." }, { status: 401 });
  try { return Response.json(await groupSaves(student.id)); }
  catch { return Response.json({ error: "Could not load saved homes." }, { status: 503 }); }
}

export async function PUT(request: Request) {
  const student = await currentStudent();
  if (!student) return Response.json({ error: "Sign in to save homes." }, { status: 401 });
  const parsed = z.object({ listingId: z.uuid(), saved: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid saved home." }, { status: 400 });

  try { return Response.json(await setGroupSave(student.id, parsed.data.listingId, parsed.data.saved)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not update saved homes." }, { status: 400 }); }
}

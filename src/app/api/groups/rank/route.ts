import { currentStudent } from "@/lib/supabase/auth";
import { groupProfiles } from "@/lib/groups/store";
import { rankLiveGroup } from "@/lib/matching/live-ranking";
import { z } from "zod";

export async function GET(request: Request) {
  const student = await currentStudent();
  if (!student) return Response.json({ error: "Sign in to view the group ranking." }, { status: 401 });
  const rawId = new URL(request.url).searchParams.get("listingId");
  const listingId = rawId ? z.uuid().safeParse(rawId) : null;
  if (listingId && !listingId.success) return Response.json({ error: "Invalid listing." }, { status: 400 });

  try {
    const group = await groupProfiles(student.id);
    if (!group) return Response.json({ error: "Join a group first." }, { status: 404 });
    const result = await rankLiveGroup(group.profiles, group.memberCount, listingId?.data);
    if (listingId && !result.matches.length) return Response.json({ error: "This listing is no longer available." }, { status: 404 });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Could not rank homes for your group." }, { status: 503 });
  }
}

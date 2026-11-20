import { authClient } from "@/lib/supabase/auth";
import { cookies } from "next/headers";

export async function POST() {
  await (await authClient()).auth.signOut();
  (await cookies()).delete({ name: "housing_calendar_token", path: "/api/calendar" });
  return Response.json({ signedOut: true });
}

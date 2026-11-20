import { authClient } from "@/lib/supabase/auth";
import { cookies } from "next/headers";

export async function POST() {
  const { error } = await (await authClient()).auth.signOut();
  if (error) return Response.json({ error: "Could not sign out. Please try again." }, { status: 503 });

  (await cookies()).delete({ name: "housing_calendar_token", path: "/api/calendar" });
  (await cookies()).delete({ name: "housing_calendar_owner", path: "/api/calendar" });
  (await cookies()).delete({ name: "housing_calendar_user", path: "/api/calendar" });
  return Response.json({ signedOut: true });
}

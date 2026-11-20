import { authClient } from "@/lib/supabase/auth";

export async function POST() {
  const { error } = await (await authClient()).auth.signOut();
  if (error) return Response.json({ error: "Could not sign out. Please try again." }, { status: 503 });
  return Response.json({ signedOut: true });
}

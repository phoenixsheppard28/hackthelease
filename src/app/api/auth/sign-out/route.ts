import { authClient } from "@/lib/supabase/auth";

export async function POST() {
  await (await authClient()).auth.signOut();
  return Response.json({ signedOut: true });
}

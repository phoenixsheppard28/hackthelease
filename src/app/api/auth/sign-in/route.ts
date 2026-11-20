import { z } from "zod";
import { authClient } from "@/lib/supabase/auth";

export async function POST(request: Request) {
  const parsed = z.object({ email: z.email().max(254), password: z.string().min(1) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter your email and password." }, { status: 400 });

  try {
    const { error } = await (await authClient()).auth.signInWithPassword({ email: parsed.data.email.trim().toLowerCase(), password: parsed.data.password });
    if (error) return Response.json({ error: "Email or password is incorrect." }, { status: 401 });

    return Response.json({ signedIn: true });
  } catch {
    return Response.json({ error: "Could not sign in. Please retry." }, { status: 503 });
  }
}

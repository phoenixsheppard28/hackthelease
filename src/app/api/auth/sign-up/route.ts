import { z } from "zod";
import { authClient } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const parsed = z.object({ email: z.email().max(254), password: z.string().min(8).max(72) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a valid email and a password with at least 8 characters." }, { status: 400 });

  const { email, password } = parsed.data;
  try {
    const { error: createError } = await supabaseAdmin().auth.admin.createUser({ email: email.trim().toLowerCase(), password, email_confirm: true });
    if (createError) return Response.json({ error: createError.code === "email_exists" ? "An account already uses this email. Sign in instead." : "Could not create your account. Please retry." }, { status: createError.code === "email_exists" ? 409 : 503 });

    const { error: signInError } = await (await authClient()).auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (signInError) return Response.json({ error: "Account created. Sign in with your new password." }, { status: 503 });

    return Response.json({ signedIn: true });
  } catch {
    return Response.json({ error: "Could not create your account. Please retry." }, { status: 503 });
  }
}

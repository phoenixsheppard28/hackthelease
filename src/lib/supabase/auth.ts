import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function authConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase Auth is not configured.");
  return { url, key };
}

export async function authClient() {
  const { url, key } = authConfig();
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: values => {
        try { values.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* The proxy refreshes cookies for server components. */ }
      },
    },
  });
}

export async function currentStudent(): Promise<{ id: string; email: string } | null> {
  const { data, error } = await (await authClient()).auth.getUser();
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: data.user.email.toLowerCase() };
}

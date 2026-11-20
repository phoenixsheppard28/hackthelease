import "server-only";

export function calendarConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
}
export function callbackUrl(requestUrl: string) {
  return new URL("/api/calendar/callback", process.env.VERCEL_ENV === "production" ? "https://tryhomework.vercel.app" : requestUrl).toString();
}

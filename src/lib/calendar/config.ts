import "server-only";

export function calendarConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
export function callbackUrl(requestUrl: string) {
  return new URL("/api/calendar/callback", process.env.APP_BASE_URL || requestUrl).toString();
}

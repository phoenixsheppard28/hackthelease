// Process-local guardrails in addition to Google Cloud quotas. Counts only;
// no addresses or Google route content are cached here. Distributed deployments
// must enforce a project-wide quota in Google Cloud as well.
let windowStart = 0;
let used = 0;
let active = 0;
const MAX_ELEMENTS_PER_MINUTE = 1800;
const MAX_CONCURRENT = 2;

export function reserveWalkingRequest(elements: number, now = Date.now()): (() => void) | null {
  if (now - windowStart >= 60_000) { windowStart = now; used = 0; }
  if (active >= MAX_CONCURRENT || used + elements > MAX_ELEMENTS_PER_MINUTE) return null;
  used += elements; active++;
  let released = false;
  return () => { if (!released) { active--; released = true; } };
}

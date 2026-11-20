export type GroupInvite = { email: string; expires_at: string; accepted_at: string | null };

export function canAcceptInvite(invite: GroupInvite, email: string, now = new Date()) {
  return invite.email === email.trim().toLowerCase() && !invite.accepted_at && Date.parse(invite.expires_at) > now.getTime();
}

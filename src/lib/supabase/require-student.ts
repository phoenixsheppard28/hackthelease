import 'server-only';
import { currentStudent } from './auth';

// Paid-service handlers must fail closed before parsing input or starting work.
export async function requireStudent(): Promise<Response | null> {
  try {
    if (await currentStudent()) return null;
    return Response.json({ error: 'Sign in to use personalized matching and travel estimates.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Sign-in is unavailable. Please try again.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

import { z } from 'zod';
import { refreshAuthorizationError } from '@/lib/ingestion/authorize';
import { startRefresh, UnknownSourceError } from '@/lib/ingestion/refresh';
import { SourceAlreadyRunningError } from '@/lib/supabase/crawl-runs';

const RefreshRequestSchema = z.object({ sourceIds: z.array(z.uuid()).min(1).optional() });

export async function POST(request: Request) {
  const authorizationError = await refreshAuthorizationError(request);
  if (authorizationError) {
    return Response.json({ error: 'Not authorized.' }, { status: authorizationError });
  }

  const body = RefreshRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return Response.json({ error: 'Invalid refresh request.' }, { status: 400 });
  }

  try {
    const runId = await startRefresh(body.data.sourceIds);
    return Response.json({ runId }, { status: 202 });
  } catch (error) {
    if (error instanceof UnknownSourceError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof SourceAlreadyRunningError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}

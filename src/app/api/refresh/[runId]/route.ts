import { z } from "zod";
import { refreshAuthorizationError } from "@/lib/ingestion/authorize";
import { getRefreshStatus } from "@/lib/ingestion/refresh";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const authorizationError = await refreshAuthorizationError(request);
  if (authorizationError) {
    return Response.json(
      { error: "Not authorized." },
      { status: authorizationError },
    );
  }

  const runId = z.uuid().safeParse((await params).runId);
  const status = runId.success ? await getRefreshStatus(runId.data) : null;
  if (!status) {
    return Response.json({ error: "Refresh run not found." }, { status: 404 });
  }

  return Response.json(status);
}

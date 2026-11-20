import { processFirecrawlEvent } from "@/lib/ingestion/webhook";

const statusCodes = {
  unauthorized: 401,
  invalid: 400,
  duplicate: 200,
  processed: 200,
} as const;

export async function POST(request: Request) {
  const result = await processFirecrawlEvent(
    await request.text(),
    request.headers.get("x-firecrawl-signature"),
  );

  return Response.json(result, { status: statusCodes[result.status] });
}

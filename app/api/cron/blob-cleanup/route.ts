import { authorizeCronRequest } from "@/lib/cron-auth";
import { processBlobDeletionQueue } from "@/lib/blob-cleanup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = authorizeCronRequest(request);
  if (auth === "unconfigured") {
    return Response.json({ error: "Scheduled maintenance is not configured." }, { status: 503 });
  }
  if (auth !== "authorized") return Response.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const result = await processBlobDeletionQueue({ limit: 100 });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Image cleanup could not run." }, { status: 503 });
  }
}

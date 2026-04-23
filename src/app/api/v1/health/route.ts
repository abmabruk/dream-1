import { ok } from "@/lib/http/api-response";
import { getEnvIssues, hasValidEnv } from "@/lib/env";

export async function GET() {
  return ok({
    service: "dream-1",
    status: "ok",
    environmentReady: hasValidEnv(),
    envIssues: getEnvIssues(),
    timestamp: new Date().toISOString(),
  });
}

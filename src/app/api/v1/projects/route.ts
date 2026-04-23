export const dynamic = "force-dynamic";

import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { ProjectService } from "@/modules/projects/project.service";

const service = new ProjectService();

export async function GET(request: Request) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("projects:view");

    if (!access.ok) {
      return access.response;
    }

    const workDate =
      new URL(request.url).searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const projects = await service.list(access.session.factoryId, workDate);

    return ok(projects);
  });
}

export async function POST(request: Request) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("projects:manage");

    if (!access.ok) {
      return access.response;
    }

    const body = await request.json().catch(() => null);

    if (!body) {
      return fail("Request body is required", 400);
    }

    const project = await service.create(
      access.session.factoryId,
      access.session.userId,
      body
    );

    return ok(project, { status: 201 });
  });
}

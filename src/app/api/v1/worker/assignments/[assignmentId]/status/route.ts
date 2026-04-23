import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { AssignmentService } from "@/modules/production/assignment.service";

const assignmentService = new AssignmentService();

type RouteContext = {
  params: Promise<{
    assignmentId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("production:view");

    if (!access.ok) {
      return access.response;
    }

    const body = await request.json().catch(() => null);

    if (!body) {
      return fail("Request body is required", 400);
    }

    const { assignmentId } = await context.params;
    const assignment = await assignmentService.updateStatus(
      access.session.factoryId,
      access.session.userId,
      access.session.userId,
      {
        assignmentId,
        status: body.status,
        note: body.note,
      }
    );

    return ok(assignment);
  });
}

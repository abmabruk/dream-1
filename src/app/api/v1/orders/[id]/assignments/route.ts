import { fail, ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { AssignmentService } from "@/modules/production/assignment.service";

const assignmentService = new AssignmentService();

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("production:assign");

    if (!access.ok) {
      return access.response;
    }

    const body = await request.json().catch(() => null);

    if (!body) {
      return fail("Request body is required", 400);
    }

    const { id } = await context.params;
    const assignment = await assignmentService.create(access.session.factoryId, access.session.userId, {
      orderId: id,
      workerId: body.workerId,
      station: body.station,
      scheduledFor: body.scheduledFor,
      notes: body.notes,
    });

    return ok(assignment, { status: 201 });
  });
}

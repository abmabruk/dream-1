import { ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { AssignmentService } from "@/modules/production/assignment.service";

const assignmentService = new AssignmentService();

export async function GET() {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("production:view");

    if (!access.ok) {
      return access.response;
    }

    const assignments = await assignmentService.listForWorker(
      access.session.factoryId,
      access.session.userId
    );

    return ok(assignments);
  });
}

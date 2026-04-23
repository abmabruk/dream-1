import { ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { AttendanceService } from "@/modules/attendance/attendance.service";

const attendanceService = new AttendanceService();

export async function POST(request: Request) {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("production:view");

    if (!access.ok) {
      return access.response;
    }

    const body = await request.json().catch(() => ({}));
    const attendance = await attendanceService.clockOut(
      access.session.factoryId,
      access.session.userId,
      body.note
    );

    return ok(attendance);
  });
}

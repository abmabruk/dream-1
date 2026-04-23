import { ok } from "@/lib/http/api-response";
import { withRouteErrorHandling } from "@/lib/http/route";
import { requireApiPermission } from "@/modules/auth/api-guard";
import { AttendanceService } from "@/modules/attendance/attendance.service";

const attendanceService = new AttendanceService();

export async function GET() {
  return withRouteErrorHandling(async () => {
    const access = await requireApiPermission("production:view");

    if (!access.ok) {
      return access.response;
    }

    const attendance = await attendanceService.getToday(
      access.session.factoryId,
      access.session.userId
    );

    return ok(attendance);
  });
}

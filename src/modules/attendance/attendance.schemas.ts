import { z } from "zod";

export const attendanceRecordSchema = z.object({
  id: z.string(),
  date: z.string(),
  clockInAt: z.string().nullable(),
  clockOutAt: z.string().nullable(),
  note: z.string().nullable(),
});

export type AttendanceRecordItem = z.infer<typeof attendanceRecordSchema>;

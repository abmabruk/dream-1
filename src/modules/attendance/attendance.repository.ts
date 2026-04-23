import "server-only";

import { db } from "@/lib/db";
import type { AttendanceRecordItem } from "./attendance.schemas";

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export class AttendanceRepository {
  async getToday(factoryId: string, userId: string): Promise<AttendanceRecordItem | null> {
    const record = await db.attendanceRecord.findUnique({
      where: {
        factoryId_userId_date: {
          factoryId,
          userId,
          date: startOfDay(),
        },
      },
    });

    if (!record) {
      return null;
    }

    return {
      id: record.id,
      date: record.date.toISOString(),
      clockInAt: record.clockInAt?.toISOString() ?? null,
      clockOutAt: record.clockOutAt?.toISOString() ?? null,
      note: record.note,
    };
  }

  async clockIn(factoryId: string, userId: string, note?: string) {
    return db.attendanceRecord.upsert({
      where: {
        factoryId_userId_date: {
          factoryId,
          userId,
          date: startOfDay(),
        },
      },
      update: {
        clockInAt: new Date(),
        note: note || null,
        clockOutAt: null,
      },
      create: {
        factoryId,
        userId,
        date: startOfDay(),
        clockInAt: new Date(),
        note: note || null,
      },
    });
  }

  async clockOut(factoryId: string, userId: string, note?: string) {
    return db.attendanceRecord.update({
      where: {
        factoryId_userId_date: {
          factoryId,
          userId,
          date: startOfDay(),
        },
      },
      data: {
        clockOutAt: new Date(),
        note: note || undefined,
      },
    });
  }
}

import "server-only";

import { AttendanceRepository } from "./attendance.repository";

export class AttendanceService {
  constructor(private readonly repository = new AttendanceRepository()) {}

  async getToday(factoryId: string, userId: string) {
    return this.repository.getToday(factoryId, userId);
  }

  async clockIn(factoryId: string, userId: string, note?: string) {
    const existing = await this.repository.getToday(factoryId, userId);

    if (existing?.clockInAt && !existing.clockOutAt) {
      throw new Error("You have already clocked in today.");
    }

    return this.repository.clockIn(factoryId, userId, note);
  }

  async clockOut(factoryId: string, userId: string, note?: string) {
    const existing = await this.repository.getToday(factoryId, userId);

    if (!existing?.clockInAt) {
      throw new Error("You need to clock in before clocking out.");
    }

    if (existing.clockOutAt) {
      throw new Error("You have already clocked out today.");
    }

    return this.repository.clockOut(factoryId, userId, note);
  }
}

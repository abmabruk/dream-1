import { describe, it, expect, vi, beforeEach } from "vitest";

import { AttendanceService } from "./attendance.service";

const { mockGetToday, mockClockIn, mockClockOut } = vi.hoisted(() => ({
  mockGetToday: vi.fn(),
  mockClockIn: vi.fn(),
  mockClockOut: vi.fn(),
}));

vi.mock("./attendance.repository", () => ({
  AttendanceRepository: class {
    getToday = mockGetToday;
    clockIn = mockClockIn;
    clockOut = mockClockOut;
  },
}));

describe("AttendanceService", () => {
  let service: AttendanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AttendanceService();
  });

  describe("clockIn", () => {
    it("succeeds when no attendance record exists today", async () => {
      mockGetToday.mockResolvedValue(null);
      mockClockIn.mockResolvedValue({ id: "rec-1" });

      await service.clockIn("factory-1", "user-1");

      expect(mockClockIn).toHaveBeenCalledWith("factory-1", "user-1", undefined);
    });

    it("succeeds when an existing record is already clocked out (starting a new shift)", async () => {
      mockGetToday.mockResolvedValue({
        id: "rec-1",
        clockInAt: "2026-04-25T07:00:00.000Z",
        clockOutAt: "2026-04-25T12:00:00.000Z",
      });
      mockClockIn.mockResolvedValue({ id: "rec-1" });

      await service.clockIn("factory-1", "user-1");

      expect(mockClockIn).toHaveBeenCalledWith("factory-1", "user-1", undefined);
    });

    it("throws when the user is already clocked in (clockInAt set, no clockOutAt)", async () => {
      mockGetToday.mockResolvedValue({
        id: "rec-1",
        clockInAt: "2026-04-25T07:00:00.000Z",
        clockOutAt: null,
      });

      await expect(service.clockIn("factory-1", "user-1")).rejects.toThrow(
        "You have already clocked in today."
      );

      expect(mockClockIn).not.toHaveBeenCalled();
    });
  });

  describe("clockOut", () => {
    it("succeeds when the user is currently clocked in", async () => {
      mockGetToday.mockResolvedValue({
        id: "rec-1",
        clockInAt: "2026-04-25T07:00:00.000Z",
        clockOutAt: null,
      });
      mockClockOut.mockResolvedValue({ id: "rec-1" });

      await service.clockOut("factory-1", "user-1");

      expect(mockClockOut).toHaveBeenCalledWith("factory-1", "user-1", undefined);
    });

    it("throws when no attendance record exists (never clocked in)", async () => {
      mockGetToday.mockResolvedValue(null);

      await expect(service.clockOut("factory-1", "user-1")).rejects.toThrow(
        "You need to clock in before clocking out."
      );

      expect(mockClockOut).not.toHaveBeenCalled();
    });

    it("throws when the user has already clocked out", async () => {
      mockGetToday.mockResolvedValue({
        id: "rec-1",
        clockInAt: "2026-04-25T07:00:00.000Z",
        clockOutAt: "2026-04-25T15:00:00.000Z",
      });

      await expect(service.clockOut("factory-1", "user-1")).rejects.toThrow(
        "You have already clocked out today."
      );

      expect(mockClockOut).not.toHaveBeenCalled();
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createReportSearchParams,
  parseReportingQuery,
} from "./reporting.schemas";

describe("reporting query parsing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-27T08:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to the last 30 days when no range is provided", () => {
    const parsed = parseReportingQuery({});

    expect(parsed.from).toBe("2026-02-26");
    expect(parsed.to).toBe("2026-03-27");
    expect(parsed.days).toBe(30);
  });

  it("deduplicates filter values coming from arrays and comma-separated params", () => {
    const parsed = parseReportingQuery({
      from: "2026-03-01",
      to: "2026-03-03",
      orderStatus: ["QUOTED,DRAFT", "QUOTED"],
      inquiryStage: ["NEW", "NEW,CONTACTED"],
    });

    expect(parsed.filters.orderStatuses).toEqual(["QUOTED", "DRAFT"]);
    expect(parsed.filters.inquiryStages).toEqual(["NEW", "CONTACTED"]);
  });

  it("rejects ranges longer than one year", () => {
    expect(() =>
      parseReportingQuery({
        from: "2025-01-01",
        to: "2026-03-27",
      })
    ).toThrow(/366 يوماً/);
  });

  it("creates stable search params for filtered reports", () => {
    expect(
      createReportSearchParams({
        from: "2026-03-01",
        to: "2026-03-31",
        orderStatuses: ["QUOTED", "QUOTED", "APPROVED"],
        inquiryStages: ["NEW", "CONTACTED", "NEW"],
      })
    ).toBe(
      "from=2026-03-01&to=2026-03-31&orderStatus=QUOTED&orderStatus=APPROVED&inquiryStage=NEW&inquiryStage=CONTACTED"
    );
  });
});

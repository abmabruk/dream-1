import "server-only";

import { ReportingRepository } from "./reporting.repository";
import { parseReportingQuery } from "./reporting.schemas";

export class ReportingService {
  constructor(private readonly repository = new ReportingRepository()) {}

  async getOverview(
    factoryId: string,
    input: {
      from?: string | string[];
      to?: string | string[];
      orderStatus?: string | string[];
      inquiryStage?: string | string[];
    }
  ) {
    const query = parseReportingQuery(input);
    return this.repository.getOverview(factoryId, query);
  }
}

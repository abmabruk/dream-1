import "server-only";

import { DashboardRepository } from "./dashboard.repository";

export class DashboardService {
  constructor(private readonly repository = new DashboardRepository()) {}

  async getSnapshot(factoryId: string) {
    return this.repository.getSnapshot(factoryId);
  }
}

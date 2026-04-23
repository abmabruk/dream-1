import "server-only";

import { HttpError } from "@/lib/http/http-error";

import { SettingsRepository } from "./settings.repository";
import { updateFactorySettingsSchema } from "./settings.schemas";

export class SettingsService {
  constructor(private readonly repository = new SettingsRepository()) {}

  async get(factoryId: string) {
    const settings = await this.repository.getByFactory(factoryId);

    if (!settings) {
      throw new HttpError(404, "Factory settings not found.");
    }

    return settings;
  }

  async update(factoryId: string, input: unknown) {
    const parsed = updateFactorySettingsSchema.parse(input);
    const settings = await this.repository.update(factoryId, parsed);

    if (!settings) {
      throw new HttpError(404, "Factory settings not found.");
    }

    return settings;
  }
}

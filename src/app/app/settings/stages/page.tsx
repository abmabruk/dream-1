import { requirePermission } from "@/modules/auth/guards";
import { StageTemplateService } from "@/modules/projects/stage-template.service";

import { StagesAdmin } from "./stages-admin";

const stageTemplateService = new StageTemplateService();

export const dynamic = "force-dynamic";

export default async function StagesSettingsPage() {
  const session = await requirePermission("projects:manage");
  const stages = await stageTemplateService.listForFactory(session.factoryId);

  return (
    <main className="space-y-6">
      <StagesAdmin initialStages={stages} />
    </main>
  );
}

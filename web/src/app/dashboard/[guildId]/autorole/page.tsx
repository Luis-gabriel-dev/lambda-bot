import { requireGuildAdmin } from "@/lib/guards";
import { getGuildOptions } from "@/lib/discord";
import { prisma } from "@/lib/db";
import { AutoRoleForm } from "@/components/autorole-form";

export const metadata = { title: "Auto-roles" };

export default async function AutoRolePage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  await requireGuildAdmin(guildId);

  const [config, options] = await Promise.all([
    prisma.guildConfig.findUnique({ where: { guildId } }),
    getGuildOptions(guildId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Auto-roles</h1>
        <p className="text-muted-foreground text-sm">Roles given automatically when someone joins.</p>
      </div>
      <AutoRoleForm
        guildId={guildId}
        roles={options.roles}
        currentMember={config?.autoRoleId ?? ""}
        currentBot={config?.botRoleId ?? ""}
      />
    </div>
  );
}

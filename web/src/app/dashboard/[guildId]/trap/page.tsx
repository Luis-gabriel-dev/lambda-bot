import { requireGuildAdmin } from "@/lib/guards";
import { getGuildOptions } from "@/lib/discord";
import { prisma } from "@/lib/db";
import { ChannelExemptForm } from "@/components/channel-exempt-form";
import { saveTrapConfig } from "@/actions/trap";

export const metadata = { title: "Trap" };

export default async function TrapPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  await requireGuildAdmin(guildId);

  const [config, exempt, options] = await Promise.all([
    prisma.guildConfig.findUnique({ where: { guildId } }),
    prisma.trapExemptRole.findMany({ where: { guildId } }),
    getGuildOptions(guildId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Trap</h1>
        <p className="text-muted-foreground text-sm">A honeypot channel — anyone who posts there is kicked instantly.</p>
      </div>
      <ChannelExemptForm
        guildId={guildId}
        action={saveTrapConfig}
        channels={options.channels}
        roles={options.roles}
        channelLabel="Trap channel"
        channelHint="Anyone who posts here is kicked. None = disabled."
        rolesLabel="Exempt roles"
        rolesHint="These roles are NOT kicked (you and bots are always spared)."
        currentChannel={config?.trapChannelId ?? ""}
        currentRoles={exempt.map((e) => e.roleId)}
      />
    </div>
  );
}

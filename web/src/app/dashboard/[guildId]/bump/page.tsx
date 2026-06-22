import { requireGuildAdmin } from "@/lib/guards";
import { getGuildOptions } from "@/lib/discord";
import { prisma } from "@/lib/db";
import { ChannelExemptForm } from "@/components/channel-exempt-form";
import { saveBumpConfig } from "@/actions/bump";

export const metadata = { title: "Bump" };

export default async function BumpPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  await requireGuildAdmin(guildId);

  const [config, exempt, options] = await Promise.all([
    prisma.guildConfig.findUnique({ where: { guildId } }),
    prisma.bumpExemptRole.findMany({ where: { guildId } }),
    getGuildOptions(guildId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bump</h1>
        <p className="text-muted-foreground text-sm">A channel where only <code>/bump</code> is allowed — anything else is deleted.</p>
      </div>
      <ChannelExemptForm
        guildId={guildId}
        action={saveBumpConfig}
        channels={options.channels}
        roles={options.roles}
        channelLabel="Bump channel"
        channelHint="Only /bump is allowed here. None = disabled."
        rolesLabel="Allowed roles"
        rolesHint="These roles may post anything here (bots and you are always allowed)."
        currentChannel={config?.bumpChannelId ?? ""}
        currentRoles={exempt.map((e) => e.roleId)}
      />
    </div>
  );
}

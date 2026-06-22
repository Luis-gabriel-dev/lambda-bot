import { requireGuildAdmin } from "@/lib/guards";
import { getGuildOptions } from "@/lib/discord";
import { prisma } from "@/lib/db";
import { ChannelExemptForm } from "@/components/channel-exempt-form";
import { saveTicketsConfig } from "@/actions/tickets";

export const metadata = { title: "Tickets" };

export default async function TicketsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  await requireGuildAdmin(guildId);

  const [config, support, options] = await Promise.all([
    prisma.guildConfig.findUnique({ where: { guildId } }),
    prisma.ticketSupportRole.findMany({ where: { guildId } }),
    getGuildOptions(guildId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tickets</h1>
        <p className="text-muted-foreground text-sm">
          Where tickets open and who answers them. Post the panel in Discord with <code>/ticket painel</code>.
        </p>
      </div>
      <ChannelExemptForm
        guildId={guildId}
        action={saveTicketsConfig}
        channels={options.categories}
        roles={options.roles}
        channelLabel="Ticket category"
        channelHint="Category where ticket channels are created. None = no category."
        rolesLabel="Support roles"
        rolesHint="Roles that can see and answer tickets."
        currentChannel={config?.ticketCategoryId ?? ""}
        currentRoles={support.map((s) => s.roleId)}
      />
    </div>
  );
}

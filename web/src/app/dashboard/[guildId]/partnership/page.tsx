import { requireGuildAdmin } from "@/lib/guards";
import { getGuildOptions } from "@/lib/discord";
import { prisma } from "@/lib/db";
import { PartnershipForm } from "@/components/partnership-form";

export const metadata = { title: "Partnerships" };

export default async function PartnershipPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  await requireGuildAdmin(guildId);

  const [config, support, options] = await Promise.all([
    prisma.guildConfig.findUnique({ where: { guildId } }),
    prisma.partnerSupportRole.findMany({ where: { guildId } }),
    getGuildOptions(guildId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Partnerships</h1>
        <p className="text-muted-foreground text-sm">
          Partnership flow settings. Post the request panel in Discord with <code>/parceria painel</code>; set the
          transcript channel under Logs.
        </p>
      </div>
      <PartnershipForm
        guildId={guildId}
        channels={options.channels}
        categories={options.categories}
        roles={options.roles}
        currentSupportRoles={support.map((s) => s.roleId)}
        initial={{
          announceChannel: config?.partnerAnnounceChannelId ?? "",
          publicChannel: config?.partnerPublicChannelId ?? "",
          category: config?.partnerCategoryId ?? "",
          notifyRole: config?.partnerNotifyRoleId ?? "",
          imageUrl: config?.partnerImageUrl ?? "",
          welcomeText: config?.partnerWelcomeText ?? "",
        }}
      />
    </div>
  );
}

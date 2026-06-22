import { requireGuildAdmin } from "@/lib/guards";
import { getGuildOptions } from "@/lib/discord";
import { prisma } from "@/lib/db";
import { AutomodForm } from "@/components/automod-form";

export const metadata = { title: "Automod" };

export default async function AutomodPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  await requireGuildAdmin(guildId);

  const [config, exempt, options] = await Promise.all([
    prisma.automodConfig.findUnique({ where: { guildId } }),
    prisma.automodExemptRole.findMany({ where: { guildId } }),
    getGuildOptions(guildId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Automod</h1>
        <p className="text-muted-foreground text-sm">
          Toggle modules and limits. Manage the link whitelist/blacklist under Anti-link.
        </p>
      </div>
      <AutomodForm
        guildId={guildId}
        roles={options.roles}
        currentExempt={exempt.map((e) => e.roleId)}
        initial={{
          flags: {
            antiSpam: config?.antiSpam ?? false,
            antiBigMessage: config?.antiBigMessage ?? false,
            antiInvite: config?.antiInvite ?? false,
            antiMassMention: config?.antiMassMention ?? false,
            antiForward: config?.antiForward ?? false,
            antiLink: config?.antiLink ?? false,
            antiGif: config?.antiGif ?? false,
            antiRaid: config?.antiRaid ?? false,
          },
          maxMessageLength: String(config?.maxMessageLength ?? 600),
          maxMentions: String(config?.maxMentions ?? 5),
        }}
      />
    </div>
  );
}

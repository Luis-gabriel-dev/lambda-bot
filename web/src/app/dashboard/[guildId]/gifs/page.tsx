import { requireGuildAdmin } from "@/lib/guards";
import { getGuildOptions } from "@/lib/discord";
import { prisma } from "@/lib/db";
import { GifForm } from "@/components/gifs-form";

export const metadata = { title: "Anti-GIF" };

export default async function GifsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  await requireGuildAdmin(guildId);

  const [automod, allowed, options] = await Promise.all([
    prisma.automodConfig.findUnique({ where: { guildId } }),
    prisma.automodGifRole.findMany({ where: { guildId } }),
    getGuildOptions(guildId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Anti-GIF</h1>
        <p className="text-muted-foreground text-sm">Restrict who can send GIFs (e.g. boosters only).</p>
      </div>
      <GifForm
        guildId={guildId}
        roles={options.roles}
        currentEnabled={automod?.antiGif ?? false}
        currentRoles={allowed.map((r) => r.roleId)}
      />
    </div>
  );
}

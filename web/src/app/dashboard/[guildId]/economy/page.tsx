import { requireGuildAdmin } from "@/lib/guards";
import { getGuildOptions } from "@/lib/discord";
import { prisma } from "@/lib/db";
import { EconomyForm } from "@/components/economy-form";

export const metadata = { title: "Economy" };

const toStr = (v: number | null | undefined) => (v == null ? "" : String(v));

export default async function EconomyPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  await requireGuildAdmin(guildId);

  const [config, options] = await Promise.all([
    prisma.economyConfig.findUnique({ where: { guildId } }),
    getGuildOptions(guildId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Economy</h1>
        <p className="text-muted-foreground text-sm">Money drops (kurocoins). Changes apply on the next drop cycle.</p>
      </div>
      <EconomyForm
        guildId={guildId}
        channels={options.channels}
        initial={{
          dropChannelId: config?.dropChannelId ?? "",
          dropIntervalMinutes: toStr(config?.dropIntervalMinutes),
          dropMin: toStr(config?.dropMin ?? 10),
          dropMax: toStr(config?.dropMax ?? 500),
          expireSeconds: config?.expireDeleteMs ? String(Math.round(config.expireDeleteMs / 1000)) : "",
          claimedSeconds: config?.claimedDeleteMs ? String(Math.round(config.claimedDeleteMs / 1000)) : "",
        }}
      />
    </div>
  );
}

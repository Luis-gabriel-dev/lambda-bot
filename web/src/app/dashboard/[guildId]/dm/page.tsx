import { requireGuildAdmin } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { DmForm } from "@/components/dm-form";

export const metadata = { title: "Direct messages" };

export default async function DmPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  await requireGuildAdmin(guildId);

  const config = await prisma.guildConfig.findUnique({ where: { guildId } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Direct messages</h1>
        <p className="text-muted-foreground text-sm">Standardize the image on DMs the bot sends.</p>
      </div>
      <DmForm guildId={guildId} currentImage={config?.dmImageUrl ?? ""} />
    </div>
  );
}

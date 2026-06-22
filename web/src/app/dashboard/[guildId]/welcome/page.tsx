import { requireGuildAdmin } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { WelcomeForm } from "@/components/welcome-form";

export const metadata = { title: "Welcome" };

export default async function WelcomePage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  await requireGuildAdmin(guildId);

  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  const colorHex =
    config?.welcomeColor != null ? `#${config.welcomeColor.toString(16).padStart(6, "0")}` : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome messages</h1>
        <p className="text-muted-foreground text-sm">
          Greet new members. Changes are read by the bot immediately.
        </p>
      </div>
      <WelcomeForm
        guildId={guildId}
        initial={{
          welcomeChannelId: config?.welcomeChannelId ?? "",
          welcomeRulesChannelId: config?.welcomeRulesChannelId ?? "",
          welcomeColorChannelId: config?.welcomeColorChannelId ?? "",
          welcomeRoleId: config?.welcomeRoleId ?? "",
          welcomeColor: colorHex,
          welcomeImageUrl: config?.welcomeImageUrl ?? "",
          welcomeExtraText: config?.welcomeExtraText ?? "",
        }}
      />
    </div>
  );
}

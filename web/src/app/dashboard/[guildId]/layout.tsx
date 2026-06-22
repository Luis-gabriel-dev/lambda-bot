import { GuildTabs } from "@/components/guild-tabs";

export default async function GuildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  return (
    <div>
      <GuildTabs guildId={guildId} />
      {children}
    </div>
  );
}

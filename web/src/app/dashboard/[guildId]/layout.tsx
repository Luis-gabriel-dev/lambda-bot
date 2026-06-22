import { DashboardSidebar } from "@/components/dashboard-sidebar";

export default async function GuildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  return (
    <div className="flex flex-col gap-8 sm:flex-row">
      <DashboardSidebar guildId={guildId} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

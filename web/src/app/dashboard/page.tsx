import Link from "next/link";
import { getManageableGuilds } from "@/lib/guards";
import { guildIconUrl } from "@/lib/discord";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = { title: "Dashboard" };

export default async function DashboardHome() {
  const guilds = await getManageableGuilds();

  if (guilds.length === 0) {
    return (
      <div className="text-muted-foreground">
        <h1 className="text-foreground text-2xl font-semibold">Your servers</h1>
        <p className="mt-2 text-sm">
          No servers found where you are an administrator and Lambda is present. Invite the bot and make sure you have
          the <span className="text-foreground">Administrator</span> permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Your servers</h1>
        <p className="text-muted-foreground text-sm">Pick a server to configure Lambda.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {guilds.map((g) => {
          const icon = guildIconUrl(g);
          return (
            <Link key={g.id} href={`/dashboard/${g.id}/welcome`}>
              <Card className="hover:border-primary/50 transition-colors">
                <CardHeader className="flex-row items-center gap-3 space-y-0">
                  {icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={icon} alt="" className="size-10 rounded-full" />
                  ) : (
                    <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full text-sm font-medium">
                      {g.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{g.name}</CardTitle>
                    <CardDescription>Configure</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

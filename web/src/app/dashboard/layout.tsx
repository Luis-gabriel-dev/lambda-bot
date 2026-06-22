import Link from "next/link";
import { auth, signIn, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Sign in with Discord to manage the servers where Lambda is present.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={async () => {
                "use server";
                await signIn("discord", { redirectTo: "/dashboard" });
              }}
            >
              <Button type="submit" className="w-full">
                Sign in with Discord
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-border/40 border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            Lambda<span className="text-primary">.</span> <span className="text-muted-foreground font-normal">dashboard</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground hidden text-sm sm:inline">{session.user.name}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}

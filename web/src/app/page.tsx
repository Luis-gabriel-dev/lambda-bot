import Link from "next/link";
import {
  ShieldCheck,
  Coins,
  Ticket,
  Handshake,
  Camera,
  Gift,
  MessageSquareWarning,
  Dice5,
  ArrowRight,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: ShieldCheck,
    title: "Moderation",
    desc: "Warns with auto-escalation, ban / kick / mute, ban by ID and full audit logs.",
  },
  {
    icon: MessageSquareWarning,
    title: "Automod",
    desc: "Anti-spam, links, invites, mass-mention, GIF and raid protection — with exempt roles.",
  },
  {
    icon: Coins,
    title: "Economy",
    desc: "Kurocoins drops, balances, ranking, member transfers and a buyable role shop.",
  },
  {
    icon: Dice5,
    title: "Casino",
    desc: "Bet your kurocoins on the slot machine or challenge a friend to a duel.",
  },
  {
    icon: Ticket,
    title: "Tickets",
    desc: "Button panels that open private channels, with transcripts saved on close.",
  },
  {
    icon: Handshake,
    title: "Partnerships",
    desc: "A dedicated partnership flow with staff approval, announcements and public logs.",
  },
  {
    icon: Camera,
    title: "Mini-Instagram",
    desc: "Photo & video channels where every upload becomes a likeable, commentable post.",
  },
  {
    icon: Gift,
    title: "Giveaways & more",
    desc: "Timed giveaways, polls, welcome messages and fully configurable logging.",
  },
];

export default function Home() {
  return (
    <>
      <header className="border-border/40 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <span className="text-lg font-semibold tracking-tight">
            Lambda<span className="text-primary">.</span>
          </span>
          <nav className="flex items-center gap-2">
            <Link href="/commands" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Commands
            </Link>
            <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="bg-primary/10 pointer-events-none absolute -top-40 left-1/2 h-80 w-160 -translate-x-1/2 rounded-full blur-3xl" />
          <div className="mx-auto max-w-3xl px-6 py-24 text-center sm:py-32">
            <Badge variant="secondary" className="mb-5">
              All-in-one Discord bot
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-6xl">
              Run your Discord server on autopilot
            </h1>
            <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg text-pretty">
              Moderation, automod, a kurocoins economy with a casino, tickets, partnerships, a
              mini-Instagram and more — all managed from one clean dashboard.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
                Open dashboard <ArrowRight />
              </Link>
              <Link href="/commands" className={buttonVariants({ variant: "outline", size: "lg" })}>
                Browse commands
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="bg-card/50">
                <CardHeader>
                  <Icon className="text-primary mb-2 size-6" />
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-border/40 border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-sm sm:flex-row">
          <span>Lambda — built with care by Kuro ❤️</span>
          <a href="https://adastratech.dev" className="hover:text-foreground transition-colors">
            adastratech.dev
          </a>
        </div>
      </footer>
    </>
  );
}

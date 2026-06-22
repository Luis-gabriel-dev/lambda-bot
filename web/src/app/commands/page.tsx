import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata = {
  title: "Commands",
  description: "Every slash command Lambda offers, grouped by category.",
};

const groups: { title: string; commands: [string, string][] }[] = [
  {
    title: "Moderation",
    commands: [
      ["/ban", "Ban a member or a raw user ID (even if they left)."],
      ["/unban", "Revoke a ban by ID."],
      ["/kick · /mute · /unmute", "Standard moderation actions."],
      ["/warn · /grace", "Warns with auto-escalation, and forgive all warns."],
      ["/clear", "Bulk-delete messages."],
    ],
  },
  {
    title: "Economy & Casino",
    commands: [
      ["/saldo · /perfil · /ranking", "Balance, profile and the kurocoins leaderboard."],
      ["/pagar", "Transfer kurocoins to another member."],
      ["/loja · /comprar", "Buy roles with kurocoins."],
      ["/slots", "Bet on the slot machine."],
      ["/duelo", "Challenge a member to a coin duel."],
    ],
  },
  {
    title: "Community",
    commands: [
      ["/ticket", "Support ticket panels with transcripts."],
      ["/parceria", "Server partnership flow with staff approval."],
      ["/instagram", "Photo & video post channels with likes."],
      ["/sorteio · /enquete", "Giveaways and polls."],
    ],
  },
  {
    title: "Configuration (admins)",
    commands: [
      ["/boasvindas", "Welcome messages."],
      ["/automod · /links · /gifs", "Automoderation modules."],
      ["/logs", "Per-type logging channels."],
      ["/economia · /autorole · /cargo · /config", "Economy, auto-roles and role panels."],
    ],
  },
];

export default function CommandsPage() {
  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Commands</h1>
          <p className="text-muted-foreground mt-1">Everything Lambda can do, at a glance.</p>
        </div>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Back
        </Link>
      </div>

      <div className="space-y-10">
        {groups.map((group) => (
          <section key={group.title}>
            <h2 className="text-primary mb-3 text-sm font-semibold tracking-wide uppercase">{group.title}</h2>
            <ul className="divide-border/60 divide-y">
              {group.commands.map(([cmd, desc]) => (
                <li key={cmd} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-4">
                  <code className="text-foreground shrink-0 font-mono text-sm sm:w-64">{cmd}</code>
                  <span className="text-muted-foreground text-sm">{desc}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}

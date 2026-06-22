"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections: { title: string; items: [string, string][] }[] = [
  { title: "General", items: [["welcome", "Welcome"], ["autorole", "Auto-roles"], ["dm", "Direct messages"]] },
  { title: "Economy", items: [["economy", "Drops"], ["shop", "Role shop"]] },
  {
    title: "Moderation",
    items: [
      ["automod", "Automod"],
      ["links", "Anti-link"],
      ["gifs", "Anti-GIF"],
      ["trap", "Trap"],
      ["bump", "Bump"],
      ["permissions", "Permissions"],
    ],
  },
  { title: "Community", items: [["tickets", "Tickets"], ["partnership", "Partnerships"], ["instagram", "Instagram"]] },
  { title: "Server", items: [["logs", "Logs"]] },
];

export function DashboardSidebar({ guildId }: { guildId: string }) {
  const pathname = usePathname();
  return (
    <aside className="w-44 shrink-0">
      {sections.map((s) => (
        <div key={s.title} className="mb-4">
          <p className="text-muted-foreground mb-1 px-2 text-xs font-semibold tracking-wide uppercase">{s.title}</p>
          {s.items.map(([slug, label]) => {
            const href = `/dashboard/${guildId}/${slug}`;
            const active = pathname === href;
            return (
              <Link
                key={slug}
                href={href}
                className={`block rounded-md px-2 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { slug: "welcome", label: "Welcome" },
  { slug: "economy", label: "Economy" },
  { slug: "logs", label: "Logs" },
];

export function GuildTabs({ guildId }: { guildId: string }) {
  const pathname = usePathname();
  return (
    <nav className="border-border/40 mb-6 flex gap-1 border-b">
      {tabs.map((t) => {
        const href = `/dashboard/${guildId}/${t.slug}`;
        const active = pathname === href;
        return (
          <Link
            key={t.slug}
            href={href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              active
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

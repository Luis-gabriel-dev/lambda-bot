import { requireGuildAdmin } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { LinkModeForm } from "@/components/link-mode-form";
import { DomainAddForm } from "@/components/domain-add-form";
import { removeLinkDomain } from "@/actions/links";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Anti-link" };

function DomainList({
  guildId,
  list,
  domains,
}: {
  guildId: string;
  list: "white" | "black";
  domains: string[];
}) {
  if (domains.length === 0) return <p className="text-muted-foreground text-sm">No domains yet.</p>;
  return (
    <ul className="divide-border/60 divide-y">
      {domains.map((d) => (
        <li key={d} className="flex items-center justify-between gap-4 py-2 text-sm">
          <code className="font-mono">{d}</code>
          <form action={removeLinkDomain}>
            <input type="hidden" name="guildId" value={guildId} />
            <input type="hidden" name="list" value={list} />
            <input type="hidden" name="domain" value={d} />
            <Button type="submit" variant="ghost" size="sm">
              Remove
            </Button>
          </form>
        </li>
      ))}
    </ul>
  );
}

export default async function LinksPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  await requireGuildAdmin(guildId);

  const [config, whitelist, blacklist] = await Promise.all([
    prisma.automodConfig.findUnique({ where: { guildId } }),
    prisma.automodLinkWhitelist.findMany({ where: { guildId }, orderBy: { domain: "asc" } }),
    prisma.automodLinkBlacklist.findMany({ where: { guildId }, orderBy: { domain: "asc" } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Anti-link</h1>
        <p className="text-muted-foreground text-sm">
          Control which links are allowed. Enable the <strong>Links</strong> module under Automod for this to take effect.
        </p>
      </div>

      <LinkModeForm guildId={guildId} current={config?.linkMode ?? "whitelist"} />

      <section className="space-y-3">
        <h2 className="font-semibold">Allowed links (whitelist)</h2>
        <DomainAddForm guildId={guildId} list="white" />
        <DomainList guildId={guildId} list="white" domains={whitelist.map((w) => w.domain)} />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Blocked links (blacklist)</h2>
        <DomainAddForm guildId={guildId} list="black" />
        <DomainList guildId={guildId} list="black" domains={blacklist.map((b) => b.domain)} />
      </section>
    </div>
  );
}

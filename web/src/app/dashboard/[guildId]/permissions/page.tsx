import { requireGuildAdmin } from "@/lib/guards";
import { getGuildOptions } from "@/lib/discord";
import { prisma } from "@/lib/db";
import { PermissionAddForm } from "@/components/permission-add-form";
import { removePermission } from "@/actions/permissions";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Permissions" };

export default async function PermissionsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  await requireGuildAdmin(guildId);

  const [perms, options] = await Promise.all([
    prisma.commandPermission.findMany({ where: { guildId }, orderBy: [{ command: "asc" }] }),
    getGuildOptions(guildId),
  ]);
  const roleName = (id: string) => options.roles.find((r) => r.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Permissions</h1>
        <p className="text-muted-foreground text-sm">Authorize roles to use restricted commands (moderation, embed editor).</p>
      </div>

      <PermissionAddForm guildId={guildId} roles={options.roles} />

      {perms.length === 0 ? (
        <p className="text-muted-foreground text-sm">No permissions configured — only the bot owner can use restricted commands.</p>
      ) : (
        <ul className="divide-border/60 divide-y">
          {perms.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-4 py-3 text-sm">
              <span>
                <code className="font-mono">/{p.command}</code> → @ {roleName(p.roleId)}
              </span>
              <form action={removePermission}>
                <input type="hidden" name="guildId" value={guildId} />
                <input type="hidden" name="command" value={p.command} />
                <input type="hidden" name="roleId" value={p.roleId} />
                <Button type="submit" variant="ghost" size="sm">
                  Remove
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

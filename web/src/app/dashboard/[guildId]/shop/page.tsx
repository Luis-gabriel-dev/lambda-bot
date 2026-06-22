import { requireGuildAdmin } from "@/lib/guards";
import { getGuildOptions } from "@/lib/discord";
import { prisma } from "@/lib/db";
import { ShopAddForm } from "@/components/shop-add-form";
import { removeShopRole } from "@/actions/shop";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Role shop" };

export default async function ShopPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  await requireGuildAdmin(guildId);

  const [shopRoles, options] = await Promise.all([
    prisma.shopRole.findMany({ where: { guildId }, orderBy: { price: "asc" } }),
    getGuildOptions(guildId),
  ]);
  const roleName = (id: string) => options.roles.find((r) => r.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Role shop</h1>
        <p className="text-muted-foreground text-sm">Roles members can buy with kurocoins (/loja, /comprar).</p>
      </div>

      <ShopAddForm guildId={guildId} roles={options.roles} />

      {shopRoles.length === 0 ? (
        <p className="text-muted-foreground text-sm">No roles for sale yet.</p>
      ) : (
        <ul className="divide-border/60 divide-y">
          {shopRoles.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm">
                  @ {roleName(r.roleId)} — <strong>{r.price.toLocaleString("en-US")}</strong> kurocoins
                </p>
                {r.description ? <p className="text-muted-foreground truncate text-xs">{r.description}</p> : null}
              </div>
              <form action={removeShopRole}>
                <input type="hidden" name="guildId" value={guildId} />
                <input type="hidden" name="roleId" value={r.roleId} />
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

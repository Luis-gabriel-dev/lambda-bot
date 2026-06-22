"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { addShopRole } from "@/actions/shop";
import type { ActionResult } from "@/lib/action-result";
import type { Option } from "@/lib/discord";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const controlClass =
  "border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-lg border px-3 text-sm shadow-xs outline-none focus-visible:ring-3";

export function ShopAddForm({ guildId, roles }: { guildId: string; roles: Option[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(addShopRole, null);
  const lastShown = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (state && state !== lastShown.current) {
      lastShown.current = state;
      if (state.ok) toast.success(state.message);
      else toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={formAction} className="grid items-end gap-3 rounded-lg border border-border/60 p-4 sm:grid-cols-[1fr_8rem_auto]">
      <input type="hidden" name="guildId" value={guildId} />
      <div className="space-y-1.5">
        <Label htmlFor="roleId">Role</Label>
        <select id="roleId" name="roleId" className={controlClass} defaultValue="">
          <option value="" disabled>
            Pick a role…
          </option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>@ {r.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="price">Price</Label>
        <Input id="price" name="price" type="number" min={1} placeholder="500" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add"}
      </Button>
      <div className="space-y-1.5 sm:col-span-3">
        <Label htmlFor="description">Description (optional)</Label>
        <Input id="description" name="description" placeholder="Shown in the shop" />
      </div>
    </form>
  );
}

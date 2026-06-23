"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { saveAutoRoles } from "@/actions/autorole";
import type { ActionResult } from "@/lib/action-result";
import type { Option } from "@/lib/discord";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const controlClass =
  "border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-lg border px-3 text-sm shadow-xs outline-none focus-visible:ring-3";

function RoleSelect({ name, label, hint, roles, defaultValue }: { name: string; label: string; hint: string; roles: Option[]; defaultValue: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} defaultValue={defaultValue} className={controlClass}>
        <option value="">None</option>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>@ {r.name}</option>
        ))}
      </select>
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );
}

export function AutoRoleForm({
  guildId,
  roles,
  currentMember,
  currentBot,
}: {
  guildId: string;
  roles: Option[];
  currentMember: string;
  currentBot: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveAutoRoles, null);
  const lastShown = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (state && state !== lastShown.current) {
      lastShown.current = state;
      if (state.ok) toast.success(state.message);
      else toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <input type="hidden" name="guildId" value={guildId} />
      <RoleSelect name="autoRoleId" label="Member role" hint="Given to humans when they join. None = off." roles={roles} defaultValue={currentMember} />
      <RoleSelect name="botRoleId" label="Bot role" hint="Given to bots when they join. None = off." roles={roles} defaultValue={currentBot} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";
import type { Option } from "@/lib/discord";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RoleMultiSelect } from "@/components/role-multi-select";

const controlClass =
  "border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-lg border px-3 text-sm shadow-xs outline-none focus-visible:ring-3";

/** Form genérico "um canal + cargos isentos/liberados" (usado por Trap e Bump). */
export function ChannelExemptForm({
  guildId,
  action,
  channels,
  roles,
  channelLabel,
  channelHint,
  rolesLabel,
  rolesHint,
  currentChannel,
  currentRoles,
}: {
  guildId: string;
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  channels: Option[];
  roles: Option[];
  channelLabel: string;
  channelHint?: string;
  rolesLabel: string;
  rolesHint?: string;
  currentChannel: string;
  currentRoles: string[];
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(action, null);
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

      <div className="space-y-1.5">
        <Label htmlFor="channel">{channelLabel}</Label>
        <select id="channel" name="channel" defaultValue={currentChannel} className={controlClass}>
          <option value="">— None —</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}># {c.name}</option>
          ))}
        </select>
        {channelHint ? <p className="text-muted-foreground text-xs">{channelHint}</p> : null}
      </div>

      <RoleMultiSelect name="exemptRoles" label={rolesLabel} hint={rolesHint} roles={roles} selected={currentRoles} />

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

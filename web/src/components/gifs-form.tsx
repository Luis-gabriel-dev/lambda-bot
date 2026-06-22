"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { saveGifConfig } from "@/actions/gifs";
import type { ActionResult } from "@/lib/action-result";
import type { Option } from "@/lib/discord";
import { Button } from "@/components/ui/button";
import { RoleMultiSelect } from "@/components/role-multi-select";

export function GifForm({
  guildId,
  roles,
  currentEnabled,
  currentRoles,
}: {
  guildId: string;
  roles: Option[];
  currentEnabled: boolean;
  currentRoles: string[];
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveGifConfig, null);
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

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" name="antiGif" value="1" defaultChecked={currentEnabled} className="accent-primary size-4" />
        Restrict GIFs to allowed roles only
      </label>

      <RoleMultiSelect
        name="allowedRoles"
        label="Roles allowed to send GIFs"
        hint="When the restriction is on, only these roles can send GIFs."
        roles={roles}
        selected={currentRoles}
      />

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

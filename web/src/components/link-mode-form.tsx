"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { saveLinkMode } from "@/actions/links";
import type { ActionResult } from "@/lib/action-result";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const controlClass =
  "border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-lg border px-3 text-sm shadow-xs outline-none focus-visible:ring-3";

export function LinkModeForm({ guildId, current }: { guildId: string; current: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveLinkMode, null);
  const lastShown = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (state && state !== lastShown.current) {
      lastShown.current = state;
      if (state.ok) toast.success(state.message);
      else toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={formAction} className="flex max-w-md items-end gap-3">
      <input type="hidden" name="guildId" value={guildId} />
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="mode">Mode</Label>
        <select id="mode" name="mode" defaultValue={current} className={controlClass}>
          <option value="whitelist">Whitelist · block all links, allow the list</option>
          <option value="blacklist">Blacklist · allow all links, block the list</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

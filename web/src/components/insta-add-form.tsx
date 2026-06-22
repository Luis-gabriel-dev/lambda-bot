"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { addInstaChannel } from "@/actions/instagram";
import type { ActionResult } from "@/lib/action-result";
import type { Option } from "@/lib/discord";
import { Button } from "@/components/ui/button";

const controlClass =
  "border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-lg border px-3 text-sm shadow-xs outline-none focus-visible:ring-3";

export function InstaAddForm({ guildId, channels }: { guildId: string; channels: Option[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(addInstaChannel, null);
  const lastShown = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (state && state !== lastShown.current) {
      lastShown.current = state;
      if (state.ok) toast.success(state.message);
      else toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={formAction} className="flex gap-2">
      <input type="hidden" name="guildId" value={guildId} />
      <select name="channelId" defaultValue="" className={controlClass}>
        <option value="" disabled>
          Pick a channel to turn into a feed…
        </option>
        {channels.map((c) => (
          <option key={c.id} value={c.id}># {c.name}</option>
        ))}
      </select>
      <Button type="submit" disabled={pending}>
        {pending ? "…" : "Add"}
      </Button>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { saveDmImage } from "@/actions/dm";
import type { ActionResult } from "@/lib/action-result";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function DmForm({ guildId, currentImage }: { guildId: string; currentImage: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveDmImage, null);
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
        <Label htmlFor="dmImageUrl">DM banner image URL</Label>
        <Input id="dmImageUrl" name="dmImageUrl" defaultValue={currentImage} placeholder="https://…" />
        <p className="text-muted-foreground text-xs">Shown on every DM the bot sends (warnings, punishments). Empty = none.</p>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { saveEconomyConfig, type ActionResult } from "@/actions/economy";
import type { Option } from "@/lib/discord";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export interface EconomyInitial {
  dropChannelId: string;
  dropIntervalMinutes: string;
  dropMin: string;
  dropMax: string;
  expireSeconds: string;
  claimedSeconds: string;
}

const controlClass =
  "border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-lg border px-3 text-sm shadow-xs outline-none focus-visible:ring-3";

function NumberField({
  name,
  label,
  hint,
  defaultValue,
  min,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string;
  min?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" min={min} defaultValue={defaultValue} />
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

export function EconomyForm({
  guildId,
  initial,
  channels,
}: {
  guildId: string;
  initial: EconomyInitial;
  channels: Option[];
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveEconomyConfig, null);
  const lastShown = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (state && state !== lastShown.current) {
      lastShown.current = state;
      if (state.ok) toast.success(state.message);
      else toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="guildId" value={guildId} />

      <div className="space-y-1.5">
        <Label htmlFor="dropChannelId">Drop channel</Label>
        <select id="dropChannelId" name="dropChannelId" defaultValue={initial.dropChannelId} className={controlClass}>
          <option value="">None (drops disabled)</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}># {c.name}</option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">Where money drops appear. None disables drops.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <NumberField
          name="dropIntervalMinutes"
          label="Interval (minutes)"
          hint="How often a drop appears."
          defaultValue={initial.dropIntervalMinutes}
          min={1}
        />
        <NumberField name="dropMin" label="Min per drop" defaultValue={initial.dropMin} min={1} />
        <NumberField name="dropMax" label="Max per drop" defaultValue={initial.dropMax} min={1} />
        <NumberField
          name="expireSeconds"
          label="Delete expired after (s)"
          hint="0 = keep the message."
          defaultValue={initial.expireSeconds}
          min={0}
        />
        <NumberField
          name="claimedSeconds"
          label="Delete claimed after (s)"
          hint="0 = keep the message."
          defaultValue={initial.claimedSeconds}
          min={0}
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { saveAutomodConfig } from "@/actions/automod";
import type { ActionResult } from "@/lib/action-result";
import type { Option } from "@/lib/discord";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RoleMultiSelect } from "@/components/role-multi-select";

const MODULES: [string, string][] = [
  ["antiSpam", "Anti-spam (flood + repetition)"],
  ["antiBigMessage", "Anti big messages"],
  ["antiInvite", "Anti invite links"],
  ["antiMassMention", "Anti mass mention"],
  ["antiForward", "Anti forwarding"],
  ["antiLink", "Anti links"],
  ["antiGif", "Anti GIFs"],
  ["antiRaid", "Anti raid (multi-channel)"],
];

export interface AutomodInitial {
  flags: Record<string, boolean>;
  maxMessageLength: string;
  maxMentions: string;
}

export function AutomodForm({
  guildId,
  initial,
  roles,
  currentExempt,
}: {
  guildId: string;
  initial: AutomodInitial;
  roles: Option[];
  currentExempt: string[];
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveAutomodConfig, null);
  const lastShown = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (state && state !== lastShown.current) {
      lastShown.current = state;
      if (state.ok) toast.success(state.message);
      else toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="guildId" value={guildId} />

      <div className="grid gap-2 rounded-lg border border-border/60 p-4 sm:grid-cols-2">
        {MODULES.map(([key, label]) => (
          <label key={key} className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm">
            <input type="checkbox" name={key} value="1" defaultChecked={initial.flags[key] ?? false} className="accent-primary size-4" />
            {label}
          </label>
        ))}
      </div>

      <div className="grid max-w-md gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="maxMessageLength">Max message length</Label>
          <Input id="maxMessageLength" name="maxMessageLength" type="number" min={1} defaultValue={initial.maxMessageLength} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="maxMentions">Max mentions / message</Label>
          <Input id="maxMentions" name="maxMentions" type="number" min={1} defaultValue={initial.maxMentions} />
        </div>
      </div>

      <RoleMultiSelect name="exemptRoles" label="Exempt roles" hint="These roles bypass all automod." roles={roles} selected={currentExempt} />

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { saveWelcomeConfig, type ActionResult } from "@/actions/welcome";
import type { Option } from "@/lib/discord";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export interface WelcomeInitial {
  welcomeChannelId: string;
  welcomeRulesChannelId: string;
  welcomeColorChannelId: string;
  welcomeRoleId: string;
  welcomeColor: string;
  welcomeImageUrl: string;
  welcomeExtraText: string;
}

const controlClass =
  "border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-lg border px-3 text-sm shadow-xs outline-none focus-visible:ring-3";

function SelectField({
  name,
  label,
  hint,
  options,
  defaultValue,
  prefix,
}: {
  name: string;
  label: string;
  hint?: string;
  options: Option[];
  defaultValue: string;
  prefix: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} defaultValue={defaultValue} className={controlClass}>
        <option value="">None</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {prefix}
            {o.name}
          </option>
        ))}
      </select>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

function TextField({
  name,
  label,
  hint,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue} placeholder={placeholder} />
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

export function WelcomeForm({
  guildId,
  initial,
  channels,
  roles,
}: {
  guildId: string;
  initial: WelcomeInitial;
  channels: Option[];
  roles: Option[];
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveWelcomeConfig, null);
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

      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          name="welcomeChannelId"
          label="Welcome channel"
          hint="Where the welcome message is posted. None = disabled."
          options={channels}
          defaultValue={initial.welcomeChannelId}
          prefix="# "
        />
        <SelectField
          name="welcomeRoleId"
          label="Reception role"
          hint="Pinged next to the new member. Optional."
          options={roles}
          defaultValue={initial.welcomeRoleId}
          prefix="@ "
        />
        <SelectField
          name="welcomeRulesChannelId"
          label="Rules channel"
          hint="Cited in the welcome message. Optional."
          options={channels}
          defaultValue={initial.welcomeRulesChannelId}
          prefix="# "
        />
        <SelectField
          name="welcomeColorChannelId"
          label="Profile-color channel"
          hint="Cited in the message. Optional."
          options={channels}
          defaultValue={initial.welcomeColorChannelId}
          prefix="# "
        />
        <TextField
          name="welcomeColor"
          label="Embed color"
          hint="#RRGGBB. Empty = the member's avatar color."
          defaultValue={initial.welcomeColor}
          placeholder="#5865F2"
        />
        <TextField
          name="welcomeImageUrl"
          label="Image / GIF URL"
          hint="Shown in the embed. Optional."
          defaultValue={initial.welcomeImageUrl}
          placeholder="https://…"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="welcomeExtraText">Extra text</Label>
        <textarea
          id="welcomeExtraText"
          name="welcomeExtraText"
          defaultValue={initial.welcomeExtraText}
          rows={3}
          placeholder="Appended to the end of the welcome description."
          className="border-input bg-transparent focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-3"
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { saveWelcomeConfig, type ActionResult } from "@/actions/welcome";
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

function Field({
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

export function WelcomeForm({ guildId, initial }: { guildId: string; initial: WelcomeInitial }) {
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
        <Field
          name="welcomeChannelId"
          label="Welcome channel ID"
          hint="Where the welcome message is posted. Empty = disabled."
          defaultValue={initial.welcomeChannelId}
          placeholder="123456789012345678"
        />
        <Field
          name="welcomeRoleId"
          label="Reception role ID"
          hint="Pinged next to the new member. Optional."
          defaultValue={initial.welcomeRoleId}
          placeholder="123456789012345678"
        />
        <Field
          name="welcomeRulesChannelId"
          label="Rules channel ID"
          hint="Cited in the welcome message. Optional."
          defaultValue={initial.welcomeRulesChannelId}
          placeholder="123456789012345678"
        />
        <Field
          name="welcomeColorChannelId"
          label="Color channel ID"
          hint="Profile-color channel cited in the message. Optional."
          defaultValue={initial.welcomeColorChannelId}
          placeholder="123456789012345678"
        />
        <Field
          name="welcomeColor"
          label="Embed color"
          hint="#RRGGBB. Empty = the member's avatar color."
          defaultValue={initial.welcomeColor}
          placeholder="#5865F2"
        />
        <Field
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

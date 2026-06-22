"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { savePartnershipConfig } from "@/actions/partnership";
import type { ActionResult } from "@/lib/action-result";
import type { Option } from "@/lib/discord";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RoleMultiSelect } from "@/components/role-multi-select";

const controlClass =
  "border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-lg border px-3 text-sm shadow-xs outline-none focus-visible:ring-3";

export interface PartnershipInitial {
  announceChannel: string;
  publicChannel: string;
  category: string;
  notifyRole: string;
  imageUrl: string;
  welcomeText: string;
}

function Pick({ name, label, hint, options, defaultValue, prefix }: { name: string; label: string; hint?: string; options: Option[]; defaultValue: string; prefix: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} defaultValue={defaultValue} className={controlClass}>
        <option value="">— None —</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{prefix}{o.name}</option>
        ))}
      </select>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

export function PartnershipForm({
  guildId,
  initial,
  channels,
  categories,
  roles,
  currentSupportRoles,
}: {
  guildId: string;
  initial: PartnershipInitial;
  channels: Option[];
  categories: Option[];
  roles: Option[];
  currentSupportRoles: string[];
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(savePartnershipConfig, null);
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
        <Pick name="announceChannel" label="Announcement channel" hint="Where the partnership pitch is posted." options={channels} defaultValue={initial.announceChannel} prefix="# " />
        <Pick name="publicChannel" label="Public log channel" hint='The "partnership closed" embed.' options={channels} defaultValue={initial.publicChannel} prefix="# " />
        <Pick name="category" label="Ticket category" hint="Where partnership tickets open." options={categories} defaultValue={initial.category} prefix="# " />
        <Pick name="notifyRole" label="@parceria role" hint="Pinged in the announcement." options={roles} defaultValue={initial.notifyRole} prefix="@ " />
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="imageUrl">Public embed image URL</Label>
          <Input id="imageUrl" name="imageUrl" defaultValue={initial.imageUrl} placeholder="https://…" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="welcomeText">Ticket opening message</Label>
        <textarea
          id="welcomeText"
          name="welcomeText"
          defaultValue={initial.welcomeText}
          rows={3}
          placeholder="Shown when a member opens a partnership ticket. Empty = default text."
          className="border-input bg-transparent focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-3"
        />
      </div>

      <RoleMultiSelect name="supportRoles" label="Authorized roles" hint="Roles that see and confirm partnerships." roles={roles} selected={currentSupportRoles} />

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

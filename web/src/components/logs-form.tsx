"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { saveLogsConfig, type ActionResult } from "@/actions/logs";
import { LOG_TYPES } from "@/lib/log-types";
import type { Option } from "@/lib/discord";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const controlClass =
  "border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-lg border px-3 text-sm shadow-xs outline-none focus-visible:ring-3";

export function LogsForm({
  guildId,
  channels,
  initial,
}: {
  guildId: string;
  channels: Option[];
  initial: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveLogsConfig, null);
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

      <div className="grid gap-4 sm:grid-cols-2">
        {LOG_TYPES.map((t) => (
          <div key={t.key} className="space-y-1.5">
            <Label htmlFor={`log_${t.key}`}>{t.label}</Label>
            <select id={`log_${t.key}`} name={`log_${t.key}`} defaultValue={initial[t.key] ?? ""} className={controlClass}>
              <option value="">Off</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}># {c.name}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

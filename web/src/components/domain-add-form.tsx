"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { addLinkDomain } from "@/actions/links";
import type { ActionResult } from "@/lib/action-result";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function DomainAddForm({ guildId, list }: { guildId: string; list: "white" | "black" }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(addLinkDomain, null);
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
      <input type="hidden" name="list" value={list} />
      <Input name="domain" placeholder="youtube.com" className="flex-1" />
      <Button type="submit" disabled={pending}>
        {pending ? "…" : list === "white" ? "Allow" : "Block"}
      </Button>
    </form>
  );
}

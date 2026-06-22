"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireGuildAdmin } from "@/lib/guards";

export interface ActionResult {
  ok: boolean;
  message: string;
}

/** Lê um número do form; vazio = null. */
function num(formData: FormData, key: string): number | null {
  const v = String(formData.get(key) ?? "").trim();
  if (v === "") return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export async function saveEconomyConfig(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const guildId = String(formData.get("guildId") ?? "");
  await requireGuildAdmin(guildId);

  const channel = String(formData.get("dropChannelId") ?? "").trim();
  if (channel && !/^\d{17,20}$/.test(channel)) return { ok: false, message: "Invalid channel." };

  const interval = num(formData, "dropIntervalMinutes");
  const min = num(formData, "dropMin");
  const max = num(formData, "dropMax");
  const expireSeconds = num(formData, "expireSeconds");
  const claimedSeconds = num(formData, "claimedSeconds");

  if (interval !== null && interval < 1) return { ok: false, message: "Interval must be at least 1 minute." };
  if (min !== null && min < 1) return { ok: false, message: "Minimum must be at least 1." };
  if (max !== null && max < 1) return { ok: false, message: "Maximum must be at least 1." };
  if (min !== null && max !== null && max < min) return { ok: false, message: "Maximum must be ≥ minimum." };

  const data = {
    dropChannelId: channel || null,
    dropIntervalMinutes: interval,
    dropMin: min ?? 10,
    dropMax: max ?? 500,
    expireDeleteMs: expireSeconds && expireSeconds > 0 ? expireSeconds * 1000 : null,
    claimedDeleteMs: claimedSeconds && claimedSeconds > 0 ? claimedSeconds * 1000 : null,
  };

  await prisma.economyConfig.upsert({
    where: { guildId },
    create: { guildId, ...data },
    update: data,
  });

  revalidatePath(`/dashboard/${guildId}/economy`);
  return { ok: true, message: "Saved — drops use it on the next cycle." };
}

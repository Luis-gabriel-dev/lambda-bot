"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireGuildAdmin } from "@/lib/guards";
import type { ActionResult } from "@/lib/action-result";

export async function saveAutoRoles(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const guildId = String(formData.get("guildId") ?? "");
  await requireGuildAdmin(guildId);

  const member = String(formData.get("autoRoleId") ?? "").trim();
  const bot = String(formData.get("botRoleId") ?? "").trim();
  for (const v of [member, bot]) {
    if (v && !/^\d{17,20}$/.test(v)) return { ok: false, message: "Invalid role." };
  }

  const data = { autoRoleId: member || null, botRoleId: bot || null };
  await prisma.guildConfig.upsert({ where: { guildId }, create: { guildId, ...data }, update: data });

  revalidatePath(`/dashboard/${guildId}/autorole`);
  return { ok: true, message: "Saved." };
}

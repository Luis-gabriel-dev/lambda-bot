"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireGuildAdmin } from "@/lib/guards";
import { LOG_TYPE_KEYS } from "@/lib/log-types";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export async function saveLogsConfig(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const guildId = String(formData.get("guildId") ?? "");
  await requireGuildAdmin(guildId);

  const updates: { type: string; channelId: string | null }[] = [];
  for (const type of LOG_TYPE_KEYS) {
    const ch = String(formData.get(`log_${type}`) ?? "").trim();
    if (ch && !/^\d{17,20}$/.test(ch)) return { ok: false, message: `Invalid channel for "${type}".` };
    updates.push({ type, channelId: ch || null });
  }

  await prisma.$transaction(
    updates.map((u) =>
      u.channelId
        ? prisma.logChannel.upsert({
            where: { guildId_type: { guildId, type: u.type } },
            create: { guildId, type: u.type, channelId: u.channelId },
            update: { channelId: u.channelId },
          })
        : prisma.logChannel.deleteMany({ where: { guildId, type: u.type } })
    )
  );

  revalidatePath(`/dashboard/${guildId}/logs`);
  return { ok: true, message: "Saved. Logging updated." };
}

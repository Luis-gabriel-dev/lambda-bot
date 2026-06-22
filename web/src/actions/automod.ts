"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireGuildAdmin } from "@/lib/guards";
import type { ActionResult } from "@/lib/action-result";

export async function saveAutomodConfig(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const guildId = String(formData.get("guildId") ?? "");
  await requireGuildAdmin(guildId);

  const on = (key: string) => String(formData.get(key) ?? "") === "1";
  const intOr = (key: string, fallback: number) => {
    const n = Number.parseInt(String(formData.get(key) ?? "").trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  const data = {
    antiSpam: on("antiSpam"),
    antiBigMessage: on("antiBigMessage"),
    antiInvite: on("antiInvite"),
    antiMassMention: on("antiMassMention"),
    antiForward: on("antiForward"),
    antiLink: on("antiLink"),
    antiGif: on("antiGif"),
    antiRaid: on("antiRaid"),
    maxMessageLength: intOr("maxMessageLength", 600),
    maxMentions: intOr("maxMentions", 5),
  };

  await prisma.automodConfig.upsert({ where: { guildId }, create: { guildId, ...data }, update: data });

  await prisma.automodExemptRole.deleteMany({ where: { guildId } });
  const roleIds = formData.getAll("exemptRoles").map(String).filter((v) => /^\d{17,20}$/.test(v));
  if (roleIds.length) {
    await prisma.automodExemptRole.createMany({ data: roleIds.map((roleId) => ({ guildId, roleId })), skipDuplicates: true });
  }

  revalidatePath(`/dashboard/${guildId}/automod`);
  return { ok: true, message: "Saved." };
}

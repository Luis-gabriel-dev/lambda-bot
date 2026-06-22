"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireGuildAdmin } from "@/lib/guards";
import type { ActionResult } from "@/lib/action-result";

export async function saveGifConfig(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const guildId = String(formData.get("guildId") ?? "");
  await requireGuildAdmin(guildId);

  const antiGif = String(formData.get("antiGif") ?? "") === "1";
  const roleIds = formData.getAll("allowedRoles").map(String).filter((v) => /^\d{17,20}$/.test(v));

  await prisma.automodConfig.upsert({ where: { guildId }, create: { guildId, antiGif }, update: { antiGif } });
  await prisma.automodGifRole.deleteMany({ where: { guildId } });
  if (roleIds.length) {
    await prisma.automodGifRole.createMany({ data: roleIds.map((roleId) => ({ guildId, roleId })), skipDuplicates: true });
  }

  revalidatePath(`/dashboard/${guildId}/gifs`);
  return { ok: true, message: "Saved." };
}

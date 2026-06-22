"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireGuildAdmin } from "@/lib/guards";
import type { ActionResult } from "@/lib/action-result";

function roleIdsFrom(formData: FormData, key: string): string[] {
  return formData.getAll(key).map(String).filter((v) => /^\d{17,20}$/.test(v));
}

export async function saveBumpConfig(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const guildId = String(formData.get("guildId") ?? "");
  await requireGuildAdmin(guildId);

  const channel = String(formData.get("channel") ?? "").trim();
  if (channel && !/^\d{17,20}$/.test(channel)) return { ok: false, message: "Invalid channel." };
  const roleIds = roleIdsFrom(formData, "exemptRoles");

  await prisma.guildConfig.upsert({
    where: { guildId },
    create: { guildId, bumpChannelId: channel || null },
    update: { bumpChannelId: channel || null },
  });
  await prisma.bumpExemptRole.deleteMany({ where: { guildId } });
  if (roleIds.length) {
    await prisma.bumpExemptRole.createMany({ data: roleIds.map((roleId) => ({ guildId, roleId })), skipDuplicates: true });
  }

  revalidatePath(`/dashboard/${guildId}/bump`);
  return { ok: true, message: "Saved." };
}

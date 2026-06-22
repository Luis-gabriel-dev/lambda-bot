"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireGuildAdmin } from "@/lib/guards";
import type { ActionResult } from "@/lib/action-result";

// Reaproveita os nomes de campo do ChannelExemptForm: "channel" = categoria, "exemptRoles" = cargos de suporte.
export async function saveTicketsConfig(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const guildId = String(formData.get("guildId") ?? "");
  await requireGuildAdmin(guildId);

  const category = String(formData.get("channel") ?? "").trim();
  if (category && !/^\d{17,20}$/.test(category)) return { ok: false, message: "Invalid category." };
  const roleIds = formData.getAll("exemptRoles").map(String).filter((v) => /^\d{17,20}$/.test(v));

  await prisma.guildConfig.upsert({
    where: { guildId },
    create: { guildId, ticketCategoryId: category || null },
    update: { ticketCategoryId: category || null },
  });
  await prisma.ticketSupportRole.deleteMany({ where: { guildId } });
  if (roleIds.length) {
    await prisma.ticketSupportRole.createMany({ data: roleIds.map((roleId) => ({ guildId, roleId })), skipDuplicates: true });
  }

  revalidatePath(`/dashboard/${guildId}/tickets`);
  return { ok: true, message: "Saved." };
}

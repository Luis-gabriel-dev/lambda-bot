"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireGuildAdmin } from "@/lib/guards";
import type { ActionResult } from "@/lib/action-result";

const isId = (v: string) => /^\d{17,20}$/.test(v);

export async function savePartnershipConfig(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const guildId = String(formData.get("guildId") ?? "");
  await requireGuildAdmin(guildId);

  const announce = String(formData.get("announceChannel") ?? "").trim();
  const publicCh = String(formData.get("publicChannel") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const notifyRole = String(formData.get("notifyRole") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const welcomeText = String(formData.get("welcomeText") ?? "").trim().slice(0, 2000);

  for (const v of [announce, publicCh, category, notifyRole]) {
    if (v && !isId(v)) return { ok: false, message: "Invalid channel/role." };
  }
  if (imageUrl && !/^https?:\/\/.+/i.test(imageUrl)) return { ok: false, message: "Invalid image URL." };

  const roleIds = formData.getAll("supportRoles").map(String).filter(isId);

  const data = {
    partnerAnnounceChannelId: announce || null,
    partnerPublicChannelId: publicCh || null,
    partnerCategoryId: category || null,
    partnerNotifyRoleId: notifyRole || null,
    partnerImageUrl: imageUrl || null,
    partnerWelcomeText: welcomeText || null,
  };

  await prisma.guildConfig.upsert({ where: { guildId }, create: { guildId, ...data }, update: data });
  await prisma.partnerSupportRole.deleteMany({ where: { guildId } });
  if (roleIds.length) {
    await prisma.partnerSupportRole.createMany({ data: roleIds.map((roleId) => ({ guildId, roleId })), skipDuplicates: true });
  }

  revalidatePath(`/dashboard/${guildId}/partnership`);
  return { ok: true, message: "Saved." };
}

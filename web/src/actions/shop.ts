"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireGuildAdmin } from "@/lib/guards";
import type { ActionResult } from "@/lib/action-result";

export async function addShopRole(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const guildId = String(formData.get("guildId") ?? "");
  await requireGuildAdmin(guildId);

  const roleId = String(formData.get("roleId") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim().slice(0, 200) || null;
  if (!/^\d{17,20}$/.test(roleId)) return { ok: false, message: "Pick a role." };

  const price = Number.parseInt(String(formData.get("price") ?? "").trim(), 10);
  if (!Number.isFinite(price) || price < 1) return { ok: false, message: "Price must be at least 1." };

  await prisma.shopRole.upsert({
    where: { guildId_roleId: { guildId, roleId } },
    create: { guildId, roleId, price, description },
    update: { price, description },
  });

  revalidatePath(`/dashboard/${guildId}/shop`);
  return { ok: true, message: "Role saved to the shop." };
}

export async function removeShopRole(formData: FormData): Promise<void> {
  const guildId = String(formData.get("guildId") ?? "");
  await requireGuildAdmin(guildId);
  const roleId = String(formData.get("roleId") ?? "").trim();
  await prisma.shopRole.deleteMany({ where: { guildId, roleId } });
  revalidatePath(`/dashboard/${guildId}/shop`);
}

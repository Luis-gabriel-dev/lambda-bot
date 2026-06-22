"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireGuildAdmin } from "@/lib/guards";
import type { ActionResult } from "@/lib/action-result";

export async function addInstaChannel(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const guildId = String(formData.get("guildId") ?? "");
  await requireGuildAdmin(guildId);

  const channelId = String(formData.get("channelId") ?? "").trim();
  if (!/^\d{17,20}$/.test(channelId)) return { ok: false, message: "Pick a channel." };

  await prisma.instagramChannel.upsert({ where: { channelId }, create: { guildId, channelId }, update: {} });
  revalidatePath(`/dashboard/${guildId}/instagram`);
  return { ok: true, message: "Channel added." };
}

export async function removeInstaChannel(formData: FormData): Promise<void> {
  const guildId = String(formData.get("guildId") ?? "");
  await requireGuildAdmin(guildId);
  const channelId = String(formData.get("channelId") ?? "");
  await prisma.instagramChannel.deleteMany({ where: { guildId, channelId } });
  revalidatePath(`/dashboard/${guildId}/instagram`);
}

export async function saveInstaDisclaimer(formData: FormData): Promise<void> {
  const guildId = String(formData.get("guildId") ?? "");
  await requireGuildAdmin(guildId);
  const channelId = String(formData.get("channelId") ?? "");

  const image = String(formData.get("image") ?? "").trim();
  const colorRaw = String(formData.get("color") ?? "").trim();
  const color = /^#?[0-9a-fA-F]{6}$/.test(colorRaw) ? parseInt(colorRaw.replace("#", ""), 16) : null;

  await prisma.instagramChannel.updateMany({
    where: { guildId, channelId },
    data: { disclaimerImageUrl: image || null, disclaimerColor: color },
  });
  revalidatePath(`/dashboard/${guildId}/instagram`);
}

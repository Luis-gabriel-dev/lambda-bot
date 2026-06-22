"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireGuildAdmin } from "@/lib/guards";
import type { ActionResult } from "@/lib/action-result";

function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export async function saveLinkMode(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const guildId = String(formData.get("guildId") ?? "");
  await requireGuildAdmin(guildId);

  const mode = String(formData.get("mode") ?? "");
  if (mode !== "whitelist" && mode !== "blacklist") return { ok: false, message: "Invalid mode." };

  await prisma.automodConfig.upsert({ where: { guildId }, create: { guildId, linkMode: mode }, update: { linkMode: mode } });
  revalidatePath(`/dashboard/${guildId}/links`);
  return { ok: true, message: `Mode set to ${mode}.` };
}

export async function addLinkDomain(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const guildId = String(formData.get("guildId") ?? "");
  await requireGuildAdmin(guildId);

  const list = String(formData.get("list") ?? "");
  const domain = normalizeDomain(String(formData.get("domain") ?? ""));
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) return { ok: false, message: "Invalid domain (e.g. youtube.com)." };

  if (list === "white") {
    await prisma.automodLinkWhitelist.upsert({ where: { guildId_domain: { guildId, domain } }, create: { guildId, domain }, update: {} });
  } else if (list === "black") {
    await prisma.automodLinkBlacklist.upsert({ where: { guildId_domain: { guildId, domain } }, create: { guildId, domain }, update: {} });
  } else {
    return { ok: false, message: "Invalid list." };
  }

  revalidatePath(`/dashboard/${guildId}/links`);
  return { ok: true, message: `Added ${domain}.` };
}

export async function removeLinkDomain(formData: FormData): Promise<void> {
  const guildId = String(formData.get("guildId") ?? "");
  await requireGuildAdmin(guildId);
  const list = String(formData.get("list") ?? "");
  const domain = String(formData.get("domain") ?? "");
  if (list === "white") await prisma.automodLinkWhitelist.deleteMany({ where: { guildId, domain } });
  else await prisma.automodLinkBlacklist.deleteMany({ where: { guildId, domain } });
  revalidatePath(`/dashboard/${guildId}/links`);
}

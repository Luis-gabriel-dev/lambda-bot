"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireGuildAdmin } from "@/lib/guards";
import type { ActionResult } from "@/lib/action-result";

export async function saveDmImage(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const guildId = String(formData.get("guildId") ?? "");
  await requireGuildAdmin(guildId);

  const url = String(formData.get("dmImageUrl") ?? "").trim();
  if (url && !/^https?:\/\/.+/i.test(url)) return { ok: false, message: "Invalid URL." };

  await prisma.guildConfig.upsert({
    where: { guildId },
    create: { guildId, dmImageUrl: url || null },
    update: { dmImageUrl: url || null },
  });

  revalidatePath(`/dashboard/${guildId}/dm`);
  return { ok: true, message: "Saved." };
}

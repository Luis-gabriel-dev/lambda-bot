"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireGuildAdmin } from "@/lib/guards";
import { RESTRICTED_COMMANDS } from "@/lib/restricted-commands";
import type { ActionResult } from "@/lib/action-result";

export async function addPermission(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const guildId = String(formData.get("guildId") ?? "");
  await requireGuildAdmin(guildId);

  const command = String(formData.get("command") ?? "").trim().toLowerCase();
  const roleId = String(formData.get("roleId") ?? "").trim();
  if (!RESTRICTED_COMMANDS.includes(command)) return { ok: false, message: "Unknown command." };
  if (!/^\d{17,20}$/.test(roleId)) return { ok: false, message: "Pick a role." };

  await prisma.commandPermission.upsert({
    where: { guildId_command_roleId: { guildId, command, roleId } },
    create: { guildId, command, roleId },
    update: {},
  });

  revalidatePath(`/dashboard/${guildId}/permissions`);
  return { ok: true, message: `Role authorized for /${command}.` };
}

export async function removePermission(formData: FormData): Promise<void> {
  const guildId = String(formData.get("guildId") ?? "");
  await requireGuildAdmin(guildId);
  const command = String(formData.get("command") ?? "").trim();
  const roleId = String(formData.get("roleId") ?? "").trim();
  await prisma.commandPermission.deleteMany({ where: { guildId, command, roleId } });
  revalidatePath(`/dashboard/${guildId}/permissions`);
}

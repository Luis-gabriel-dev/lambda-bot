"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireGuildAdmin } from "@/lib/guards";

export interface ActionResult {
  ok: boolean;
  message: string;
}

// ID do Discord (17-20 dígitos) ou vazio.
const snowflake = z
  .string()
  .trim()
  .regex(/^\d{17,20}$/, "ID inválido")
  .or(z.literal(""));

const schema = z.object({
  guildId: z.string().regex(/^\d{17,20}$/),
  welcomeChannelId: snowflake,
  welcomeRulesChannelId: snowflake,
  welcomeColorChannelId: snowflake,
  welcomeRoleId: snowflake,
  welcomeColor: z
    .string()
    .trim()
    .regex(/^#?[0-9a-fA-F]{6}$/, "Cor inválida (#RRGGBB)")
    .or(z.literal("")),
  welcomeImageUrl: z
    .string()
    .trim()
    .regex(/^https?:\/\/.+/i, "URL inválida")
    .or(z.literal("")),
  welcomeExtraText: z.string().trim().max(1500),
});

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "");
const nullify = (v: string) => (v.length ? v : null);

export async function saveWelcomeConfig(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const guildId = str(formData, "guildId");

  // Autorização SEMPRE no servidor antes de qualquer escrita.
  await requireGuildAdmin(guildId);

  const parsed = schema.safeParse({
    guildId,
    welcomeChannelId: str(formData, "welcomeChannelId"),
    welcomeRulesChannelId: str(formData, "welcomeRulesChannelId"),
    welcomeColorChannelId: str(formData, "welcomeColorChannelId"),
    welcomeRoleId: str(formData, "welcomeRoleId"),
    welcomeColor: str(formData, "welcomeColor"),
    welcomeImageUrl: str(formData, "welcomeImageUrl"),
    welcomeExtraText: str(formData, "welcomeExtraText"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const d = parsed.data;
  const color = d.welcomeColor ? parseInt(d.welcomeColor.replace("#", ""), 16) : null;

  const data = {
    welcomeChannelId: nullify(d.welcomeChannelId),
    welcomeRulesChannelId: nullify(d.welcomeRulesChannelId),
    welcomeColorChannelId: nullify(d.welcomeColorChannelId),
    welcomeRoleId: nullify(d.welcomeRoleId),
    welcomeColor: color,
    welcomeImageUrl: nullify(d.welcomeImageUrl),
    welcomeExtraText: nullify(d.welcomeExtraText),
  };

  await prisma.guildConfig.upsert({
    where: { guildId },
    create: { guildId, ...data },
    update: data,
  });

  revalidatePath(`/dashboard/${guildId}/welcome`);
  return { ok: true, message: "Saved. The bot uses it immediately." };
}

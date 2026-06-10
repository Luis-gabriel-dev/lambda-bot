import { ColorResolvable, EmbedBuilder } from 'discord.js';

/** Paleta padrão do bot (cores oficiais do Discord). */
export const Palette = {
  success: 0x57f287,
  error: 0xed4245,
  warning: 0xfee75c,
  info: 0x5865f2
} as const;

export function successEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(Palette.success).setDescription(`✅ ${message}`);
}

export function errorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(Palette.error).setDescription(`❌ ${message}`);
}

export function warningEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(Palette.warning).setDescription(`⚠️ ${message}`);
}

export function infoEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(Palette.info).setDescription(message);
}

/**
 * Aplica uma cor ao embed com segurança. Aceita "#RRGGBB", "RRGGBB" ou nomes
 * (ex.: "Blurple"). Retorna true em sucesso, false se a cor for inválida.
 */
export function applyColor(embed: EmbedBuilder, input: string): boolean {
  const value = input.trim();
  try {
    if (/^#?[0-9a-fA-F]{6}$/.test(value)) {
      embed.setColor(parseInt(value.replace('#', ''), 16));
    } else {
      embed.setColor(value as ColorResolvable);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Aplica uma URL (imagem/thumbnail/url) com segurança, capturando o erro de
 * validação do discord.js. Retorna true em sucesso, false se inválida.
 */
export function applyUrl(setter: (url: string) => unknown, input: string): boolean {
  try {
    setter(input.trim());
    return true;
  } catch {
    return false;
  }
}

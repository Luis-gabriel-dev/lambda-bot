import { EmbedBuilder, GuildMember } from 'discord.js';
import { PNG } from 'pngjs';
import { guildConfigRepository } from '../repositories/guildConfig.repository';
import { discordTimestamp } from '../utils/formatter';

// 40 cores variadas para sortear quando não dá para usar a cor do avatar.
const WELCOME_COLORS = [
  0xe74c3c, 0xc0392b, 0xe91e63, 0xff4081, 0x9c27b0, 0x8e44ad, 0x673ab7, 0x5e35b1, 0x3f51b5, 0x3498db, 0x2980b9, 0x00bcd4,
  0x0097a7, 0x009688, 0x1abc9c, 0x16a085, 0x2ecc71, 0x27ae60, 0x4caf50, 0x8bc34a, 0xcddc39, 0xf1c40f, 0xf39c12, 0xffc107,
  0xff9800, 0xe67e22, 0xd35400, 0xff5722, 0xff7043, 0x795548, 0x9e9e9e, 0x607d8b, 0x34495e, 0x2c3e50, 0xec407a, 0xab47bc,
  0x7e57c2, 0x42a5f5, 0x26a69a, 0xd4ac0d
];

function pickRandomColor(): number {
  return WELCOME_COLORS[Math.floor(Math.random() * WELCOME_COLORS.length)]!;
}

/** Baixa o avatar (PNG) e devolve a cor predominante (ou null se falhar). */
async function dominantColorFromAvatar(url: string): Promise<number | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const png = PNG.sync.read(Buffer.from(await res.arrayBuffer()));
    const data = png.data; // RGBA

    // Histograma de cores quantizadas (ignora pixels transparentes).
    const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! < 128) continue;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.count++;
        bucket.r += r;
        bucket.g += g;
        bucket.b += b;
      } else {
        buckets.set(key, { count: 1, r, g, b });
      }
    }

    let best: { count: number; r: number; g: number; b: number } | null = null;
    for (const bucket of buckets.values()) if (!best || bucket.count > best.count) best = bucket;
    if (!best) return null;

    const r = Math.round(best.r / best.count);
    const g = Math.round(best.g / best.count);
    const b = Math.round(best.b / best.count);
    return (r << 16) | (g << 8) | b;
  } catch {
    return null;
  }
}

/**
 * Resolve a cor do embed de boas-vindas:
 * 1. cor fixa configurada → usa ela;
 * 2. senão, cor predominante do avatar do membro;
 * 3. sem foto de perfil (ou falha) → cor aleatória entre as 40.
 */
export async function resolveWelcomeColor(member: GuildMember, fixedColor?: number | null): Promise<number> {
  if (typeof fixedColor === 'number') return fixedColor;

  const hasCustomAvatar = member.avatar !== null || member.user.avatar !== null;
  if (hasCustomAvatar) {
    const dominant = await dominantColorFromAvatar(member.displayAvatarURL({ extension: 'png', size: 64 }));
    if (dominant !== null) return dominant;
  }
  return pickRandomColor();
}

export interface WelcomeOptions {
  imageUrl?: string | null;
  rulesChannelId?: string | null;
  colorChannelId?: string | null;
  /** Texto extra opcional, anexado ao fim da descrição. */
  extraText?: string | null;
  /** Cor já resolvida do embed; se ausente, sorteia uma das 40 cores. */
  color?: number;
}

/**
 * Monta a mensagem de boas-vindas: o conteúdo menciona o membro (para notificá-lo)
 * e o embed traz o avatar circular (autor) + quadrado (thumbnail), nome, usuário,
 * hora de entrada, as linhas de canais configurados e, se houver, a imagem/gif fixa.
 */
export function buildWelcome(member: GuildMember, opts: WelcomeOptions = {}): { content: string; embed: EmbedBuilder } {
  const avatar = member.user.displayAvatarURL({ size: 256 });
  const joined = member.joinedAt ?? new Date();

  const intro = `${member} acabou de chegar no servidor. Sinta-se em casa!`;
  const extra: string[] = [];
  if (opts.rulesChannelId) extra.push(`Leia as regras do servidor em <#${opts.rulesChannelId}>`);
  if (opts.colorChannelId) extra.push(`E caso queira uma cor diferente no seu perfil, você pode ir em <#${opts.colorChannelId}>`);

  // Blocos da descrição: intro → linhas de canais → texto extra custom (cada um separado por linha em branco).
  const parts = [intro];
  if (extra.length > 0) parts.push(extra.join('\n'));
  if (opts.extraText) parts.push(opts.extraText);
  const description = parts.join('\n\n');

  const embed = new EmbedBuilder()
    .setColor(opts.color ?? pickRandomColor())
    .setAuthor({ name: member.user.username, iconURL: avatar }) // avatar em círculo
    .setTitle(`Bem-vindo(a), ${member.displayName}! 🎉`)
    .setDescription(description)
    .setThumbnail(avatar) // avatar em quadrado
    .addFields(
      { name: 'Nome', value: member.displayName, inline: true },
      { name: 'Usuário', value: `@${member.user.username}`, inline: true },
      { name: 'Entrou', value: `${discordTimestamp(joined, 'F')} (${discordTimestamp(joined, 'R')})` }
    )
    .setFooter({ text: 'Feito com amor e carinho por kuro ❤️' });

  if (opts.imageUrl) embed.setImage(opts.imageUrl);

  return { content: `${member}`, embed };
}

/** Publica a mensagem de boas-vindas no canal configurado (ignora bots). */
export async function sendWelcome(member: GuildMember): Promise<void> {
  if (member.user.bot) return;

  const config = await guildConfigRepository.get(member.guild.id);
  if (!config?.welcomeChannelId) return;

  const channel = await member.guild.channels.fetch(config.welcomeChannelId).catch(() => null);
  if (!channel?.isSendable()) return;

  const color = await resolveWelcomeColor(member, config.welcomeColor);
  const { content, embed } = buildWelcome(member, {
    imageUrl: config.welcomeImageUrl,
    rulesChannelId: config.welcomeRulesChannelId,
    colorChannelId: config.welcomeColorChannelId,
    extraText: config.welcomeExtraText,
    color
  });
  await channel
    .send({ content, embeds: [embed], allowedMentions: { users: [member.id] } })
    .catch(() => undefined);
}

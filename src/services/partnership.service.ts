import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  Guild,
  GuildMember,
  Message,
  OverwriteResolvable,
  PermissionFlagsBits,
  TextChannel,
  User
} from 'discord.js';
import { GuildConfig } from '@prisma/client';
import { partnershipRepository } from '../repositories/partnership.repository';
import { dominantColor } from '../utils/imageColor';
import { Palette } from '../utils/embeds';
import { isOwner } from './permission.service';

// Links de convite de servidores (mesmo padrão do automod.service).
const INVITE_RE =
  /(?:https?:\/\/)?(?:www\.)?(?:discord(?:app)?\.com\/invite|discord\.gg|discord\.me|discord\.li|dsc\.gg|invite\.gg)\/[\w-]+/i;

const PARTNER_FOOTER = 'Feito com carinho e amor por Kuro ❤️';

/** Texto padrão do embed de boas-vindas do ticket de parceria (customizável por servidor). */
export const DEFAULT_PARTNER_WELCOME =
  'Envie aqui o **convite do seu servidor** junto com o texto de divulgação.\n\n' +
  'Assim que você mandar o convite, a equipe vai analisar e confirmar a parceria. ' +
  'Pode mandar gif e formatação à vontade — não precisa marcar `@everyone`/`@here`.';

/** É staff de parcerias? (cargo autorizado configurado ou administrador) */
export function isPartnerStaff(member: GuildMember, supportRoleIds: string[]): boolean {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return supportRoleIds.some((id) => member.roles.cache.has(id));
}

/** Cria o canal privado do ticket de parceria (visível só ao opener, à staff e ao bot). */
export async function createPartnershipChannel(
  guild: Guild,
  opener: GuildMember,
  supportRoleIds: string[],
  categoryId: string | null
): Promise<TextChannel> {
  const member = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.EmbedLinks
  ];

  const overwrites: OverwriteResolvable[] = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: opener.id, allow: member }
  ];

  const me = guild.members.me;
  if (me) overwrites.push({ id: me.id, allow: [...member, PermissionFlagsBits.ManageChannels] });

  for (const roleId of supportRoleIds) {
    if (guild.roles.cache.has(roleId)) overwrites.push({ id: roleId, allow: member });
  }

  const name = `parceria-${opener.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90);
  const parent =
    categoryId && guild.channels.cache.get(categoryId)?.type === ChannelType.GuildCategory ? categoryId : undefined;

  return guild.channels.create({ name, type: ChannelType.GuildText, parent, permissionOverwrites: overwrites });
}

/** Extrai o código de um link de convite (`discord.gg/abc` → `abc`). */
function inviteCode(url: string): string {
  return url.split('/').pop()?.split('?')[0] ?? '';
}

/**
 * Hook do messageCreate. Em canais de ticket de parceria, consome a mensagem
 * (mantém o automod fora — o pitch costuma ter @everyone/gif) e, quando o opener
 * manda um convite, salva o conteúdo e pede confirmação à staff.
 * Retorna true se a mensagem era de um canal de parceria.
 */
export async function handlePartnershipMessage(message: Message): Promise<boolean> {
  if (!message.inGuild()) return false;

  const config = await partnershipRepository.getConfig(message.guildId);

  // Canal de anúncio: parceria feita manualmente por um adm (fechada fora do bot).
  if (config?.partnerAnnounceChannelId && message.channelId === config.partnerAnnounceChannelId) {
    return handleManualAnnounce(message, config);
  }

  const ticket = await partnershipRepository.getByChannel(message.channelId);
  if (!ticket) return false;

  // Só o convite do OPENER dispara a confirmação; o resto só é "consumido".
  if (message.author.bot || message.author.id !== ticket.openerId) return true;

  const match = INVITE_RE.exec(message.content);
  if (!match) return true;

  const inviteUrl = match[0];
  let inviteServer: string | null = null;
  try {
    const invite = await message.client.fetchInvite(inviteCode(inviteUrl));
    inviteServer = invite.guild?.name ?? null;
  } catch {
    inviteServer = null;
  }

  await partnershipRepository.updateContent(message.channelId, {
    inviteUrl,
    inviteServer,
    pitchText: message.content
  });

  const supportRoleIds = await partnershipRepository.getSupportRoleIds(message.guildId);
  const embed = new EmbedBuilder()
    .setColor(Palette.info)
    .setTitle('🤝 Confirmar parceria?')
    .setDescription(
      `${message.author} enviou um convite${inviteServer ? ` do servidor **${inviteServer}**` : ''}.\n\n` +
        `Deseja **fechar a parceria** e divulgar no servidor?`
    )
    .addFields({ name: 'Convite', value: inviteUrl })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`parceria:sim:${message.channelId}`).setLabel('Sim, fechar parceria').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`parceria:nao:${message.channelId}`).setLabel('Não fechar parceria').setEmoji('✖️').setStyle(ButtonStyle.Danger)
  );

  if (message.channel.isSendable()) {
    const mention = supportRoleIds.map((id) => `<@&${id}>`).join(' ');
    await message.channel
      .send({
        content: mention || undefined,
        embeds: [embed],
        components: [row],
        allowedMentions: { roles: supportRoleIds }
      })
      .catch(() => undefined);
  }

  return true;
}

/**
 * Parceria feita "na mão": um adm posta o convite direto no canal de anúncio
 * (a parceria foi combinada na DM, fora do bot). Conta +1 para quem postou e
 * lança o embed público — sem contar a mensagem que o próprio bot posta via ticket.
 */
async function handleManualAnnounce(message: Message<true>, config: GuildConfig): Promise<boolean> {
  if (message.author.bot) return false; // o anúncio do próprio bot (via ticket) já foi contado

  const match = INVITE_RE.exec(message.content);
  if (!match) return false; // mensagem comum no canal — segue o fluxo normal

  // Só conta de quem é staff de parceria (evita contar membros aleatórios).
  const supportRoleIds = await partnershipRepository.getSupportRoleIds(message.guildId);
  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  if (!member || (!isPartnerStaff(member, supportRoleIds) && !isOwner(message.author.id))) return false;

  let inviteServer: string | null = null;
  try {
    const invite = await message.client.fetchInvite(inviteCode(match[0]));
    inviteServer = invite.guild?.name ?? null;
  } catch {
    inviteServer = null;
  }

  const count = await partnershipRepository.incrementCloser(message.guildId, message.author.id);

  const publicId = config.partnerPublicChannelId;
  const publicCh = publicId ? await message.guild.channels.fetch(publicId).catch(() => null) : null;
  if (publicCh?.isTextBased() && publicCh.isSendable()) {
    const embed = await buildPublicPartnerEmbed(message.author, message.guild, inviteServer, config.partnerImageUrl, count);
    await publicCh.send({ embeds: [embed] }).catch(() => undefined);
  }

  return true; // consome: mantém o automod fora do convite postado no canal de anúncio
}

/** Tira @everyone/@here do texto para não notificar o servidor inteiro. */
export function stripMassMentions(text: string): string {
  return text.replace(/@everyone/gi, '`@everyone`').replace(/@here/gi, '`@here`');
}

/** Embed público "fez parceria" — creditando quem aprovou (cor = avatar dele). */
export async function buildPublicPartnerEmbed(
  approver: User,
  guild: Guild,
  partnerServer: string | null,
  imageUrl: string | null,
  closedCount: number
): Promise<EmbedBuilder> {
  const avatar = approver.displayAvatarURL({ extension: 'png', size: 256 });
  const color = (await dominantColor(avatar)) ?? Palette.info;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: approver.username, iconURL: avatar })
    .setThumbnail(avatar)
    .setTitle('🤝 Nova parceria fechada!')
    .setDescription(`${approver} fechou uma parceria${partnerServer ? ` com **${partnerServer}**` : ''}.`)
    .addFields({ name: '📊 Parcerias fechadas', value: `**${closedCount}** no total`, inline: true })
    .setFooter({ text: PARTNER_FOOTER, iconURL: guild.iconURL({ size: 128 }) ?? undefined })
    .setTimestamp();

  if (imageUrl) embed.setImage(imageUrl);
  return embed;
}

function fmtDate(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19);
}

export interface PartnershipTranscriptMeta {
  openerId: string;
  openerTag: string;
  closedByTag: string;
  status: string;
  inviteUrl: string | null;
  inviteServer: string | null;
}

/** Lê as mensagens do ticket e monta o transcript .txt (com participantes + avatares). */
export async function buildPartnershipTranscript(
  channel: TextChannel,
  meta: PartnershipTranscriptMeta
): Promise<{ file: AttachmentBuilder; count: number }> {
  const messages = [];
  let lastId: string | undefined;
  for (let page = 0; page < 20; page++) {
    const batch = await channel.messages.fetch({ limit: 100, before: lastId });
    if (batch.size === 0) break;
    messages.push(...batch.values());
    lastId = batch.last()?.id;
    if (batch.size < 100) break;
  }
  messages.reverse(); // ordem cronológica

  // Participantes únicos (tag → avatar) para guardar o "icon das pessoas".
  const participants = new Map<string, string>();
  for (const m of messages) {
    if (!participants.has(m.author.tag)) participants.set(m.author.tag, m.author.displayAvatarURL({ size: 128 }));
  }

  const lines: string[] = [
    'Transcript do ticket de PARCERIA',
    `Canal: #${channel.name} (${channel.id})`,
    `Pedido por: ${meta.openerTag} (${meta.openerId})`,
    `Fechado por: ${meta.closedByTag}`,
    `Status: ${meta.status}`,
    `Servidor parceiro: ${meta.inviteServer ?? '—'}`,
    `Convite: ${meta.inviteUrl ?? '—'}`,
    `Gerado em: ${fmtDate(Date.now())} (UTC)`,
    `Mensagens: ${messages.length}`,
    '',
    'Participantes:',
    ...[...participants.entries()].map(([tag, avatar]) => `  - ${tag} — ${avatar}`),
    '='.repeat(50),
    ''
  ];

  for (const m of messages) {
    lines.push(`[${fmtDate(m.createdTimestamp)}] ${m.author.tag}: ${m.content || '[sem texto]'}`);
    for (const a of m.attachments.values()) {
      lines.push(`    ↳ anexo: ${a.name ?? 'arquivo'} — ${a.url}`);
    }
  }

  const file = new AttachmentBuilder(Buffer.from(lines.join('\n'), 'utf-8'), { name: `parceria-${channel.name}.txt` });
  return { file, count: messages.length };
}

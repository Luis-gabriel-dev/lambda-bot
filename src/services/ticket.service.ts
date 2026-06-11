import {
  AttachmentBuilder,
  ChannelType,
  Guild,
  GuildMember,
  OverwriteResolvable,
  PermissionFlagsBits,
  TextChannel
} from 'discord.js';

/** É staff de tickets? (cargo de suporte configurado ou administrador) */
export function isTicketStaff(member: GuildMember, supportRoleIds: string[]): boolean {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return supportRoleIds.some((id) => member.roles.cache.has(id));
}

/** Cria o canal privado do ticket (visível só ao opener, à staff e ao bot). */
export async function createTicketChannel(
  guild: Guild,
  opener: GuildMember,
  supportRoleIds: string[],
  categoryId: string | null
): Promise<TextChannel> {
  const member = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks];

  const overwrites: OverwriteResolvable[] = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: opener.id, allow: member }
  ];

  const me = guild.members.me;
  if (me) {
    overwrites.push({
      id: me.id,
      allow: [...member, PermissionFlagsBits.ManageChannels]
    });
  }

  for (const roleId of supportRoleIds) {
    if (guild.roles.cache.has(roleId)) overwrites.push({ id: roleId, allow: member });
  }

  const name = `ticket-${opener.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90);
  const parent =
    categoryId && guild.channels.cache.get(categoryId)?.type === ChannelType.GuildCategory ? categoryId : undefined;

  return guild.channels.create({ name, type: ChannelType.GuildText, parent, permissionOverwrites: overwrites });
}

function fmtDate(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19);
}

export interface TranscriptMeta {
  type: string;
  openerId: string;
  openerTag: string;
  closedByTag: string;
}

/** Lê todas as mensagens do canal do ticket e monta o transcript em .txt. */
export async function buildTicketTranscript(
  channel: TextChannel,
  meta: TranscriptMeta
): Promise<{ file: AttachmentBuilder; count: number; attendants: string[] }> {
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

  const lines: string[] = [
    `Transcript do ticket — ${meta.type}`,
    `Canal: #${channel.name} (${channel.id})`,
    `Aberto por: ${meta.openerTag}`,
    `Fechado por: ${meta.closedByTag}`,
    `Gerado em: ${fmtDate(Date.now())} (UTC)`,
    `Mensagens: ${messages.length}`,
    '='.repeat(50),
    ''
  ];

  const attendants = new Set<string>();
  for (const m of messages) {
    if (!m.author.bot && m.author.id !== meta.openerId) attendants.add(m.author.tag);
    lines.push(`[${fmtDate(m.createdTimestamp)}] ${m.author.tag}: ${m.content || '[sem texto]'}`);
    for (const a of m.attachments.values()) {
      lines.push(`    ↳ anexo: ${a.name ?? 'arquivo'} — ${a.url}`);
    }
  }

  const file = new AttachmentBuilder(Buffer.from(lines.join('\n'), 'utf-8'), { name: `ticket-${channel.name}.txt` });
  return { file, count: messages.length, attendants: [...attendants] };
}

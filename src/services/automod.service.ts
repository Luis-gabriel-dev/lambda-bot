import { APIEmbedField, AttachmentBuilder, EmbedBuilder, GuildMember, Message, MessageReferenceType, PermissionFlagsBits } from 'discord.js';
import { automodRepository, AutomodAllowFeature } from '../repositories/automod.repository';
import { warningRepository } from '../repositories/warning.repository';
import { buildPunishmentDM, buildStaffEmbed, escalateWarnings, sendGuildDM } from './moderation.service';
import { sendLog } from './log.service';
import { Palette } from '../utils/embeds';
import { truncate } from '../utils/formatter';

// Links de convite de servidores (discord.gg, discord.com/invite, etc.).
const INVITE_RE =
  /(?:https?:\/\/)?(?:www\.)?(?:discord(?:app)?\.com\/invite|discord\.gg|discord\.me|discord\.li|dsc\.gg|invite\.gg)\/[\w-]+/i;

// Spam.
const FLOOD_COUNT = 5;
const FLOOD_WINDOW_MS = 5_000;
const REPEAT_COUNT = 3;
const FIGURE_REPEAT_COUNT = 5; // mesma figurinha/anexo > 4 vezes...
const FIGURE_REPEAT_WINDOW_MS = 15_000; // ...em um tempo curto
const SHORT_MUTE_MS = 60_000; // 1 min
const LONG_MUTE_MS = 24 * 60 * 60 * 1000; // 1 dia
const ESCALATION_AT = 3; // 3ª ocorrência → mute longo
const OFFENSE_RESET_MS = 10 * 60 * 1000; // ocorrências zeram após 10 min sem spam

// Convites.
const INVITE_MUTE_MS = 60_000; // 1 min

// Mensagens gigantes.
const BIGMSG_LIMIT = 3; // após MAIS de 3 violações
const BIGMSG_MUTE_MS = 120_000; // 2 min
const BIGMSG_WINDOW_MS = 15 * 60 * 1000; // janela de contagem

// Menções em massa.
const MASS_MENTION_MUTE_MS = 60_000; // 1 min

// Links (anti-link com whitelist).
const LINK_WARN_AT = 4; // 4ª ocorrência → advertência
const LINK_MUTE_AT = 5; // 5ª+ → mute de 1h
const LINK_MUTE_MS = 60 * 60 * 1000; // 1 hora
const LINK_OFFENSE_RESET_MS = 10 * 60 * 1000; // ocorrências zeram após 10 min

// Anti-raid (conta hackeada / bot disfarçado disparando em vários canais).
const RAID_CHANNEL_COUNT = 4; // nº de canais distintos...
const RAID_WINDOW_MS = 10_000; // ...atingidos em até 10s → não é humano

function countMentions(content: string): number {
  const ids = content.match(/<@[!&]?\d+>/g)?.length ?? 0;
  const everyoneHere = content.match(/@(?:everyone|here)/g)?.length ?? 0;
  return ids + everyoneHere;
}

// Detecção de links: URLs com esquema/www, ou domínios "nus" com TLD.
const LINK_RE = /(?:https?:\/\/|www\.)[^\s<>]+|(?<![@\w.])(?:[a-z0-9-]+\.)+[a-z]{2,24}(?:[/:?#][^\s<>]*)?/gi;
// Extensões de arquivo comuns — para não confundir "arquivo.png", "index.html" com link.
const FILE_EXT = new Set([
  'js', 'ts', 'jsx', 'tsx', 'json', 'html', 'htm', 'css', 'scss', 'sass', 'txt', 'md', 'py', 'rb', 'go', 'rs', 'java', 'kt',
  'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'sh', 'bat', 'ps1', 'yml', 'yaml', 'xml', 'toml', 'ini', 'env', 'lock', 'png', 'jpg',
  'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'mp3', 'wav', 'ogg', 'mp4', 'mov', 'avi', 'mkv', 'webm', 'zip', 'rar', '7z',
  'tar', 'gz', 'exe', 'dll', 'msi', 'apk', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'sql', 'db', 'log'
]);

/** Normaliza um domínio (tira esquema, www, caminho e porta). Retorna null se inválido. */
export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
  s = s.split(/[/?#]/)[0]!.split(':')[0]!;
  return /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(s) ? s : null;
}

/** Extrai os domínios (hosts) dos links de uma mensagem, ignorando nomes de arquivo. */
function extractHosts(content: string): string[] {
  const matches = content.match(LINK_RE);
  if (!matches) return [];
  const hosts: string[] = [];
  for (const token of matches) {
    const hadScheme = /^(?:https?:\/\/|www\.)/i.test(token);
    let host = token.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
    host = host.split(/[/?#]/)[0]!.split(':')[0]!;
    if (!host.includes('.')) continue;
    if (!hadScheme && FILE_EXT.has(host.split('.').pop()!)) continue; // parece nome de arquivo
    hosts.push(host);
  }
  return hosts;
}

/** Retorna o domínio da lista que corresponde ao host (igual ou subdomínio), ou null. */
function matchDomain(host: string, domains: string[]): string | null {
  for (const domain of domains) if (host === domain || host.endsWith(`.${domain}`)) return domain;
  return null;
}

type LinkCheck =
  | { type: 'ok' }
  | { type: 'blocked' } // há um link fora de qualquer lista permitida
  | { type: 'wrongChannel'; domain: string; channelIds: string[] }; // permitido, mas não neste canal

interface LinkRules {
  roleDomains: string[]; // domínios liberados pelos cargos do membro (valem em qualquer canal)
  globalDomains: string[]; // whitelist global
  domainChannels: Map<string, string[]>; // domínio → canais onde é permitido (subconjunto da whitelist)
  channelId: string;
  parentId: string | null;
}

/** Avalia os links da mensagem. "blocked" tem prioridade sobre "wrongChannel". */
function checkLinks(content: string, rules: LinkRules): LinkCheck {
  let wrong: { domain: string; channelIds: string[] } | null = null;
  for (const host of extractHosts(content)) {
    if (matchDomain(host, rules.roleDomains)) continue; // cargo libera em qualquer canal
    const domain = matchDomain(host, rules.globalDomains);
    if (!domain) return { type: 'blocked' };
    const channels = rules.domainChannels.get(domain);
    if (channels && channels.length > 0) {
      const here = channels.includes(rules.channelId) || (rules.parentId !== null && channels.includes(rules.parentId));
      if (!here && !wrong) wrong = { domain, channelIds: channels };
    }
  }
  return wrong ? { type: 'wrongChannel', ...wrong } : { type: 'ok' };
}

/** Há na mensagem algum link cujo domínio está na blacklist? */
function hasBlacklistedLink(content: string, blacklist: string[]): boolean {
  if (blacklist.length === 0) return false;
  return extractHosts(content).some((host) => matchDomain(host, blacklist) !== null);
}

/** Sufixo do aviso conforme a ocorrência (3ª avisa, 4ª warn, 5ª+ mute). */
function linkOffenseSuffix(offense: number): string {
  if (offense === LINK_WARN_AT - 1) return '\n⚠️ Se mandar de novo, na próxima você receberá uma **advertência**.';
  if (offense === LINK_WARN_AT) return '\nVocê recebeu uma **advertência**.';
  if (offense >= LINK_MUTE_AT) return '\nVocê foi **silenciado por 1 hora**.';
  return '';
}

// GIFs: links de tenor/giphy/gfycat, URLs .gif/.gifv, anexos .gif ou embeds gifv.
const GIF_RE = /\b(?:tenor\.com|giphy\.com|gfycat\.com)\b|https?:\/\/\S+\.gifv?\b/i;
function messageHasGif(message: Message<true>): boolean {
  if (GIF_RE.test(message.content)) return true;
  for (const attachment of message.attachments.values()) {
    if ((attachment.contentType ?? '').startsWith('image/gif') || /\.gifv?$/i.test(attachment.name ?? '')) return true;
  }
  return message.embeds.some((embed) => embed.data.type === 'gifv');
}

/** É um encaminhamento vindo de FORA (outro servidor ou DM)? Forwards do próprio servidor são liberados. */
function isForeignForward(message: Message<true>): boolean {
  const forwarded = message.reference?.type === MessageReferenceType.Forward || message.messageSnapshots.size > 0;
  if (!forwarded) return false;
  // reference.guildId = servidor de origem (undefined = DM). Bloqueia só se não for o servidor atual.
  return message.reference?.guildId !== message.guildId;
}

interface SpamState {
  timestamps: number[];
  recentContents: string[];
  mediaSignatures: { sig: string; time: number }[];
  offenseCount: number;
  lastOffense: number;
}
const spamMap = new Map<string, SpamState>();
const linkOffenseMap = new Map<string, { count: number; last: number }>();
const raidMap = new Map<string, { message: Message<true>; time: number }[]>();

/** Conta ocorrências de link não permitido por usuário (com janela de reset). */
function registerLinkOffense(message: Message<true>): number {
  const key = `${message.guildId}:${message.author.id}`;
  const now = Date.now();
  const state = linkOffenseMap.get(key);
  if (!state || now - state.last > LINK_OFFENSE_RESET_MS) {
    linkOffenseMap.set(key, { count: 1, last: now });
    return 1;
  }
  state.count += 1;
  state.last = now;
  return state.count;
}

/** "Assinatura" de figurinhas/anexos da mensagem (null se for só texto). */
function mediaSignature(message: Message<true>): string | null {
  if (message.stickers.size > 0) return `sticker:${[...message.stickers.keys()].sort().join(',')}`;
  if (message.attachments.size > 0) {
    return `file:${[...message.attachments.values()].map((a) => `${a.name}:${a.size}`).sort().join(',')}`;
  }
  return null;
}
const bigMessageMap = new Map<string, { count: number; last: number }>();

function isExempt(member: GuildMember, exemptRoleIds: string[]): boolean {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return exemptRoleIds.some((id) => member.roles.cache.has(id));
}

async function isChannelAllowed(message: Message<true>, feature: AutomodAllowFeature): Promise<boolean> {
  const allowed = await automodRepository.getAllowedChannels(message.guildId, feature);
  if (allowed.length === 0) return false;
  if (allowed.includes(message.channelId)) return true;
  const parentId = message.channel.parentId;
  return parentId ? allowed.includes(parentId) : false;
}

async function deleteWithNotice(message: Message<true>, text: string): Promise<void> {
  await message.delete().catch(() => undefined);
  if (message.channel.isSendable()) {
    const notice = await message.channel.send(`${message.author}, ${text}`).catch(() => null);
    if (notice) setTimeout(() => void notice.delete().catch(() => undefined), 12_000);
  }
}

/** Registra um warn, aplica um mute, avisa por DM e loga em #log-de-punições. */
async function applyMuteWarn(
  message: Message<true>,
  member: GuildMember | null,
  opts: { warnReason: string; muteMs: number; logTitle: string; logFields: APIEmbedField[] }
): Promise<void> {
  await warningRepository.add(message.guildId, message.author.id, message.client.user.id, opts.warnReason).catch(() => undefined);
  const total = await warningRepository.count(message.guildId, message.author.id).catch(() => 0);

  // O warn conta para a escalada (4 → mute de 1 dia, 8 → ban). Se ela agir, não aplica o mute base.
  const escalation = await escalateWarnings(message.guild, message.author, total).catch(() => null);

  const fields: APIEmbedField[] = [...opts.logFields];
  if (escalation) {
    fields.push({ name: 'Escalonamento', value: `${total} advertências — ${escalation}` });
  } else if (member?.moderatable) {
    const until = new Date(Date.now() + opts.muteMs);
    await member.timeout(opts.muteMs, opts.warnReason).catch(() => undefined);
    const dm = buildPunishmentDM({
      guildName: message.guild.name,
      guildIcon: message.guild.iconURL({ size: 256 }),
      action: 'silenciado',
      color: Palette.warning,
      reason: opts.warnReason,
      until
    });
    await sendGuildDM(member, message.guildId, dm);
  }

  const log = new EmbedBuilder()
    .setColor(Palette.warning)
    .setTitle(opts.logTitle)
    .setThumbnail(message.author.displayAvatarURL({ size: 256 }))
    .addFields({ name: 'Usuário', value: `${message.author} \`${message.author.tag}\``, inline: true }, ...fields)
    .setTimestamp();
  await sendLog(message.guild, 'punicoes', log);
}

/** Penalidade do anti-link: warn na 4ª ocorrência, warn + mute de 1h na 5ª+. */
async function applyLinkPenalty(message: Message<true>, member: GuildMember | null, offenseCount: number): Promise<void> {
  const reason = 'Links não permitidos (automod)';
  await warningRepository.add(message.guildId, message.author.id, message.client.user.id, reason).catch(() => undefined);
  const total = await warningRepository.count(message.guildId, message.author.id).catch(() => 0);
  const escalation = await escalateWarnings(message.guild, message.author, total).catch(() => null);

  const fields: APIEmbedField[] = [{ name: 'Ocorrência', value: `${offenseCount}ª`, inline: true }];
  if (escalation) {
    fields.push({ name: 'Escalonamento', value: `${total} advertências — ${escalation}` });
  } else if (offenseCount >= LINK_MUTE_AT && member?.moderatable) {
    const until = new Date(Date.now() + LINK_MUTE_MS);
    await member.timeout(LINK_MUTE_MS, reason).catch(() => undefined);
    const dm = buildPunishmentDM({
      guildName: message.guild.name,
      guildIcon: message.guild.iconURL({ size: 256 }),
      action: 'silenciado',
      color: Palette.warning,
      reason,
      until
    });
    await sendGuildDM(member, message.guildId, dm);
    fields.push({ name: 'Punição', value: 'mute de 1h', inline: true });
  } else {
    fields.push({ name: 'Punição', value: 'advertência', inline: true });
  }

  const log = new EmbedBuilder()
    .setColor(Palette.warning)
    .setTitle('🤖 Automod: link não permitido')
    .setThumbnail(message.author.displayAvatarURL({ size: 256 }))
    .addFields({ name: 'Usuário', value: `${message.author} \`${message.author.tag}\``, inline: true }, ...fields)
    .setTimestamp();
  await sendLog(message.guild, 'punicoes', log);
}

/**
 * Apaga o link e avisa. A 3ª ocorrência vai SÓ na DM (privado); as demais ficam no
 * chat público (auto-apagam). Da 4ª em diante aplica advertência/mute.
 */
async function handleBlockedLink(message: Message<true>, member: GuildMember | null, offense: number, baseText: string): Promise<void> {
  if (offense === LINK_WARN_AT - 1) {
    await message.delete().catch(() => undefined);
    const cap = baseText.charAt(0).toUpperCase() + baseText.slice(1);
    const dm = buildStaffEmbed(message.guild.name, message.guild.iconURL({ size: 256 }), {
      title: '🔗 Aviso sobre links',
      description: `${cap}\n\n⚠️ Se enviar **mais um** link não permitido, você receberá uma **advertência** — e, continuando, pode ser **silenciado**.`,
      color: Palette.warning
    });
    await sendGuildDM(message.author, message.guildId, dm);
    return;
  }

  await deleteWithNotice(message, `${baseText}${linkOffenseSuffix(offense)}`);
  if (offense >= LINK_WARN_AT) await applyLinkPenalty(message, member, offense);
}

/** Conta violações de mensagem gigante por usuário (com janela de reset). */
function registerBigMessage(message: Message<true>): number {
  const key = `${message.guildId}:${message.author.id}`;
  const now = Date.now();
  const state = bigMessageMap.get(key);
  if (!state || now - state.last > BIGMSG_WINDOW_MS) {
    bigMessageMap.set(key, { count: 1, last: now });
    return 1;
  }
  state.count += 1;
  state.last = now;
  return state.count;
}

async function punishSpam(message: Message<true>, member: GuildMember | null, offenseCount: number): Promise<void> {
  const now = Date.now();
  const longMute = offenseCount >= ESCALATION_AT;

  // Apaga o burst de mensagens recentes do usuário no canal.
  const recent = await message.channel.messages.fetch({ limit: 20 }).catch(() => null);
  if (recent) {
    const burst = recent.filter((m) => m.author.id === message.author.id && now - m.createdTimestamp < 12_000);
    if (burst.size > 0) await message.channel.bulkDelete(burst, true).catch(() => undefined);
  }

  await applyMuteWarn(message, member, {
    warnReason: 'Spam / flood (automod)',
    muteMs: longMute ? LONG_MUTE_MS : SHORT_MUTE_MS,
    logTitle: '🤖 Automod: spam',
    logFields: [
      { name: 'Punição', value: longMute ? 'mute de 1 dia' : 'mute de 1 min', inline: true },
      { name: 'Ocorrência', value: `${offenseCount}ª`, inline: true }
    ]
  });
}

async function checkSpam(message: Message<true>, member: GuildMember | null): Promise<void> {
  const key = `${message.guildId}:${message.author.id}`;
  const now = Date.now();
  const state = spamMap.get(key) ?? { timestamps: [], recentContents: [], mediaSignatures: [], offenseCount: 0, lastOffense: 0 };
  state.mediaSignatures ??= [];

  state.timestamps = state.timestamps.filter((t) => now - t < FLOOD_WINDOW_MS);
  state.timestamps.push(now);
  const flood = state.timestamps.length >= FLOOD_COUNT;

  const content = message.content.trim();
  let repetition = false;
  if (content.length > 0) {
    state.recentContents.push(content);
    if (state.recentContents.length > REPEAT_COUNT) state.recentContents.shift();
    repetition = state.recentContents.length === REPEAT_COUNT && state.recentContents.every((c) => c === content);
  }

  // Mesma figurinha/anexo repetido em tempo curto (> 4 vezes).
  const sig = mediaSignature(message);
  let figureRepeat = false;
  if (sig) {
    state.mediaSignatures = state.mediaSignatures.filter((m) => now - m.time < FIGURE_REPEAT_WINDOW_MS);
    state.mediaSignatures.push({ sig, time: now });
    figureRepeat = state.mediaSignatures.filter((m) => m.sig === sig).length >= FIGURE_REPEAT_COUNT;
  }

  if (!flood && !repetition && !figureRepeat) {
    spamMap.set(key, state);
    return;
  }

  state.timestamps = [];
  state.recentContents = [];
  state.mediaSignatures = [];
  if (now - state.lastOffense > OFFENSE_RESET_MS) state.offenseCount = 0;
  state.offenseCount += 1;
  state.lastOffense = now;
  spamMap.set(key, state);

  await punishSpam(message, member, state.offenseCount);
}

/** Loga as mensagens apagadas no anti-raid (conteúdo + anexos reenviados) em #log-de-mensagens. */
async function logRaidMessages(guild: Message<true>['guild'], author: Message<true>['author'], entries: { message: Message<true> }[]): Promise<void> {
  const files: AttachmentBuilder[] = [];
  const lines: string[] = [];
  for (const { message } of entries) {
    const content = message.content?.trim();
    const atts = [...message.attachments.values()];
    lines.push(`**<#${message.channelId}>**: ${content ? truncate(content, 200) : '*(sem texto)*'}${atts.length > 0 ? ` — ${atts.length} anexo(s)` : ''}`);
    for (const att of atts) {
      if (files.length >= 10) break;
      files.push(new AttachmentBuilder(att.url, { name: att.name ?? 'anexo' }));
    }
  }

  const embed = new EmbedBuilder()
    .setColor(Palette.error)
    .setTitle('🗑️ Mensagens apagadas (anti-raid)')
    .setThumbnail(author.displayAvatarURL({ size: 256 }))
    .setDescription(`Autor: ${author} \`${author.tag}\`\n\n${truncate(lines.join('\n'), 4000)}`)
    .setTimestamp();
  await sendLog(guild, 'mensagens', embed, files.length > 0 ? files : undefined);
}

/** Disparo em vários canais → kick imediato, apaga tudo e loga (mensagens + punição). */
async function punishRaid(message: Message<true>, member: GuildMember | null, entries: { message: Message<true>; time: number }[]): Promise<void> {
  const guild = message.guild;
  const channels = new Set(entries.map((e) => e.message.channelId));
  const reason = `Disparo em ${channels.size} canais em segundos (anti-raid — provável conta comprometida/bot)`;

  // 1) Avisa por DM antes do kick.
  if (member) {
    const dm = buildPunishmentDM({
      guildName: guild.name,
      guildIcon: guild.iconURL({ size: 256 }),
      action: 'expulso',
      color: Palette.error,
      reason,
      note: 'Isso parece atividade de conta comprometida. Se foi você, troque sua senha e ative a verificação em duas etapas antes de voltar.'
    });
    await sendGuildDM(member, message.guildId, dm);
  }

  // 2) Loga as mensagens apagadas (antes de apagar, enquanto os anexos existem).
  await logRaidMessages(guild, message.author, entries).catch(() => undefined);

  // 3) Apaga as mensagens (agrupadas por canal).
  const byChannel = new Map<string, string[]>();
  for (const { message: msg } of entries) {
    const list = byChannel.get(msg.channelId) ?? [];
    list.push(msg.id);
    byChannel.set(msg.channelId, list);
  }
  for (const [channelId, ids] of byChannel) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (channel?.isTextBased() && 'bulkDelete' in channel) await channel.bulkDelete(ids, true).catch(() => undefined);
  }

  // 4) Kick.
  let kicked = false;
  if (member?.kickable) {
    await member.kick(reason).catch(() => undefined);
    kicked = true;
  }

  // 5) Loga a punição.
  const log = new EmbedBuilder()
    .setColor(Palette.error)
    .setTitle('🚨 Anti-raid: disparo em vários canais')
    .setThumbnail(message.author.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'Usuário', value: `${message.author} \`${message.author.tag}\``, inline: true },
      { name: 'Ação', value: kicked ? 'expulso (kick)' : '⚠️ não consegui expulsar', inline: true },
      { name: 'Canais atingidos', value: `${channels.size}`, inline: true },
      { name: 'Mensagens apagadas', value: `${entries.length}`, inline: true }
    )
    .setTimestamp();
  await sendLog(guild, 'punicoes', log);
}

/** Executa todos os módulos de automod em uma mensagem. */
export async function runAutomod(message: Message): Promise<void> {
  if (!message.inGuild()) return;
  if (message.author.id === message.client.user.id || message.author.system) return;

  const config = await automodRepository.getConfig(message.guildId);
  if (
    !config ||
    (!config.antiSpam &&
      !config.antiBigMessage &&
      !config.antiInvite &&
      !config.antiMassMention &&
      !config.antiForward &&
      !config.antiLink &&
      !config.antiGif &&
      !config.antiRaid)
  ) {
    return;
  }

  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  const exemptRoleIds = await automodRepository.getExemptRoleIds(message.guildId);
  if (member && isExempt(member, exemptRoleIds)) return;

  // 0) Anti-raid: mesma pessoa disparando em vários canais em segundos → kick + purge + log.
  if (config.antiRaid) {
    const key = `${message.guildId}:${message.author.id}`;
    const now = Date.now();
    const entries = (raidMap.get(key) ?? []).filter((e) => now - e.time < RAID_WINDOW_MS);
    entries.push({ message, time: now });
    raidMap.set(key, entries);
    if (new Set(entries.map((e) => e.message.channelId)).size >= RAID_CHANNEL_COUNT) {
      raidMap.delete(key);
      await punishRaid(message, member, entries);
      return;
    }
  }

  // 1) Convites de outros servidores → apaga + warn + mute de 1 min.
  if (config.antiInvite && INVITE_RE.test(message.content) && !(await isChannelAllowed(message, 'invite'))) {
    await deleteWithNotice(message, 'links de convite de outros servidores não são permitidos aqui.');
    await applyMuteWarn(message, member, {
      warnReason: 'Envio de convite de outro servidor (automod)',
      muteMs: INVITE_MUTE_MS,
      logTitle: '🤖 Automod: convite',
      logFields: [{ name: 'Punição', value: 'mute de 1 min', inline: true }]
    });
    return;
  }

  // 2) GIFs restritos a cargos (ex.: booster). Roda quando o anti-GIF OU o anti-link está ligado,
  //    para que quem tem cargo liberado de GIF nunca seja barrado pelo anti-link.
  if ((config.antiGif || config.antiLink) && messageHasGif(message)) {
    const channelOk = await isChannelAllowed(message, 'gif');
    const gifRoles = channelOk ? [] : await automodRepository.getGifRoleIds(message.guildId);
    const allowed = channelOk || (!!member && gifRoles.some((id) => member.roles.cache.has(id)));
    if (config.antiGif && !allowed) {
      await deleteWithNotice(message, 'apenas membros com cargo autorizado podem enviar GIFs aqui.');
      return;
    }
    if (allowed) return; // pode enviar GIF → não deixa o anti-link reprocessar o link do GIF
    // (anti-GIF desligado e sem permissão → segue para o anti-link, tratado como link comum)
  }

  // 3) Anti-link. Dois modos: "blacklist" (libera tudo, bloqueia a lista) ou
  //    "whitelist" (bloqueia tudo, libera whitelist global + cargos + canais).
  if (config.antiLink && !(await isChannelAllowed(message, 'link'))) {
    if (config.linkMode === 'blacklist') {
      const blacklist = await automodRepository.getLinkBlacklist(message.guildId);
      if (hasBlacklistedLink(message.content, blacklist)) {
        await handleBlockedLink(message, member, registerLinkOffense(message), 'esse link está na lista de **bloqueados** deste servidor.');
        return;
      }
    } else {
      // Modo whitelist: considera liberações por cargo ("*" = todos) + whitelist global + restrição por canal.
      const roleMap = await automodRepository.getLinkRoles(message.guildId);
      let allowAll = false;
      const roleDomains: string[] = [];
      if (member && roleMap.size > 0) {
        for (const roleId of member.roles.cache.keys()) {
          const domains = roleMap.get(roleId);
          if (!domains) continue;
          if (domains.includes('*')) {
            allowAll = true;
            break;
          }
          roleDomains.push(...domains);
        }
      }

      if (!allowAll) {
        const check = checkLinks(message.content, {
          roleDomains,
          globalDomains: await automodRepository.getLinkWhitelist(message.guildId),
          domainChannels: await automodRepository.getDomainChannelMap(message.guildId),
          channelId: message.channelId,
          parentId: message.channel.parentId ?? null
        });

        // Link permitido, mas no canal errado → apaga e informa no chat onde pode enviar (sem punir).
        if (check.type === 'wrongChannel') {
          const onde = check.channelIds.map((id) => `<#${id}>`).join(', ');
          await deleteWithNotice(message, `links de \`${check.domain}\` só podem ser enviados em: ${onde}.`);
          return;
        }

        // Link fora de qualquer lista → apaga + avisa; 3ª na DM, demais no chat; 4ª = warn, 5ª+ = mute.
        if (check.type === 'blocked') {
          await handleBlockedLink(message, member, registerLinkOffense(message), 'esse link não está na lista de **permitidos** do servidor. Veja com **/links permitidos**.');
          return;
        }
      }
    }
  }

  // 4) Encaminhamento (forward) de fora (outro servidor/DM) → apaga. Forwards internos são liberados.
  if (config.antiForward && isForeignForward(message) && !(await isChannelAllowed(message, 'forward'))) {
    await deleteWithNotice(message, 'mensagens encaminhadas de outros servidores/DMs não são permitidas aqui.');
    return;
  }

  // 5) Menções em massa → apaga + warn + mute de 1 min.
  if (
    config.antiMassMention &&
    countMentions(message.content) > config.maxMentions &&
    !(await isChannelAllowed(message, 'massmention'))
  ) {
    await deleteWithNotice(message, `menções em massa não são permitidas aqui (limite: ${config.maxMentions}).`);
    await applyMuteWarn(message, member, {
      warnReason: 'Menção em massa (automod)',
      muteMs: MASS_MENTION_MUTE_MS,
      logTitle: '🤖 Automod: menção em massa',
      logFields: [{ name: 'Punição', value: 'mute de 1 min', inline: true }]
    });
    return;
  }

  // 6) Mensagens gigantes → apaga; após mais de 3 violações, warn + mute de 2 min.
  if (config.antiBigMessage && message.content.length > config.maxMessageLength && !(await isChannelAllowed(message, 'bigmessage'))) {
    await deleteWithNotice(message, `mensagens muito longas (acima de ${config.maxMessageLength} caracteres) não são permitidas aqui.`);
    const violations = registerBigMessage(message);
    if (violations > BIGMSG_LIMIT) {
      await applyMuteWarn(message, member, {
        warnReason: 'Mensagens longas em excesso (automod)',
        muteMs: BIGMSG_MUTE_MS,
        logTitle: '🤖 Automod: mensagens longas',
        logFields: [
          { name: 'Punição', value: 'mute de 2 min', inline: true },
          { name: 'Violações', value: `${violations}`, inline: true }
        ]
      });
    }
    return;
  }

  // 7) Spam / flood (pulado em canais/categorias liberados).
  if (config.antiSpam && !(await isChannelAllowed(message, 'spam'))) await checkSpam(message, member);
}

import { APIEmbedField, EmbedBuilder, GuildMember, Message, MessageReferenceType, PermissionFlagsBits } from 'discord.js';
import { automodRepository, AutomodAllowFeature } from '../repositories/automod.repository';
import { warningRepository } from '../repositories/warning.repository';
import { buildPunishmentDM, escalateWarnings } from './moderation.service';
import { sendLog } from './log.service';
import { Palette } from '../utils/embeds';

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

function countMentions(content: string): number {
  const ids = content.match(/<@[!&]?\d+>/g)?.length ?? 0;
  const everyoneHere = content.match(/@(?:everyone|here)/g)?.length ?? 0;
  return ids + everyoneHere;
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
    if (notice) setTimeout(() => void notice.delete().catch(() => undefined), 6_000);
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
    await member.send({ embeds: [dm] }).catch(() => undefined);
  }

  const log = new EmbedBuilder()
    .setColor(Palette.warning)
    .setTitle(opts.logTitle)
    .setThumbnail(message.author.displayAvatarURL({ size: 256 }))
    .addFields({ name: 'Usuário', value: `${message.author} \`${message.author.tag}\``, inline: true }, ...fields)
    .setTimestamp();
  await sendLog(message.guild, 'punicoes', log);
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
      !config.antiForward)
  ) {
    return;
  }

  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  const exemptRoleIds = await automodRepository.getExemptRoleIds(message.guildId);
  if (member && isExempt(member, exemptRoleIds)) return;

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

  // 2) Encaminhamento (forward) de fora (outro servidor/DM) → apaga. Forwards internos são liberados.
  if (config.antiForward && isForeignForward(message) && !(await isChannelAllowed(message, 'forward'))) {
    await deleteWithNotice(message, 'mensagens encaminhadas de outros servidores/DMs não são permitidas aqui.');
    return;
  }

  // 3) Menções em massa → apaga + warn + mute de 1 min.
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

  // 4) Mensagens gigantes → apaga; após mais de 3 violações, warn + mute de 2 min.
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

  // 5) Spam / flood (pulado em canais/categorias liberados).
  if (config.antiSpam && !(await isChannelAllowed(message, 'spam'))) await checkSpam(message, member);
}

import {
  ActionRowBuilder,
  AnyThreadChannel,
  APIEmbedField,
  Attachment,
  AttachmentBuilder,
  AuditLogEvent,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Client,
  ComponentType,
  ContainerBuilder,
  EmbedBuilder,
  Guild,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  Message,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  PartialMessage,
  PermissionFlagsBits,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThumbnailBuilder
} from 'discord.js';
import { InstaPost } from '@prisma/client';
import { instagramRepository } from '../repositories/instagram.repository';
import { errorEmbed, infoEmbed, Palette, successEmbed } from '../utils/embeds';
import { formatBrDateTime, truncate } from '../utils/formatter';
import { sendLog } from './log.service';
import { findAuditExecutor } from '../utils/auditLog';
import { dominantColor } from '../utils/imageColor';
import { logger } from '../core/logger';

const INSTA_COLOR = 0xe1306c; // rosa estilo Instagram
const IMAGE_RE = /\.(png|jpe?g|gif|webp)$/i;
const VIDEO_RE = /\.(mp4|mov|webm|mkv|avi|m4v)$/i;

interface MediaDesc {
  url: string;
  isVideo: boolean;
  name: string;
  size?: number;
}

function isVideoAttachment(a: Attachment): boolean {
  return (a.contentType?.startsWith('video/') ?? false) || VIDEO_RE.test(a.name ?? '');
}

/** Acha a primeira imagem OU vídeo nos anexos da mensagem. */
function findMedia(message: Message): Attachment | undefined {
  return message.attachments.find(
    (a) =>
      a.contentType?.startsWith('image/') ||
      a.contentType?.startsWith('video/') ||
      IMAGE_RE.test(a.name ?? '') ||
      VIDEO_RE.test(a.name ?? '')
  );
}

function mediaFromAttachment(a: Attachment): MediaDesc {
  const video = isVideoAttachment(a);
  return { url: a.url, isVideo: video, name: a.name ?? (video ? 'video.mp4' : 'foto.png'), size: a.size };
}

/** Extrai a mídia de um post (card V2: MediaGallery; embed antigo: setImage; ou anexo). */
function extractPostMedia(message: Message | PartialMessage): MediaDesc | null {
  const galleryUrl = findMediaUrl(message);
  if (galleryUrl) {
    const name = galleryUrl.split('?')[0]!.split('/').pop() || 'post.png';
    return { url: galleryUrl, isVideo: VIDEO_RE.test(name), name };
  }
  const embedImage = message.embeds[0]?.image?.url;
  if (embedImage) return { url: embedImage, isVideo: false, name: 'post.png' };
  const att = message.attachments.first();
  return att ? mediaFromAttachment(att) : null;
}

/** Embed explicando como funciona o mural (usado no /instagram e no botão ℹ️). */
export function buildDisclaimerEmbed(opts: { imageUrl?: string | null; color?: number | null; guildIcon?: string | null } = {}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(opts.color ?? INSTA_COLOR)
    .setTitle('Canal do instagram, como funciona? 📸🎬')
    .setDescription(
      'Envie uma **foto ou vídeo** neste canal e o bot transforma em um **post** no estilo do instagram.\n\n' +
        '**📝 Como postar:**\n' +
        '• Escreva um **texto** junto da mídia (vira a **legenda** do post) — opcional.\n' +
        '• Escolha a **foto ou vídeo** e envie.\n' +
        '• No aviso de confirmação, clique em **📝 Adicionar título** se quiser dar um **título** ao post (opcional).\n' +
        '• Clique em **✅ Confirmar** para publicar.\n\n' +
        '**Botões do post:**\n' +
        '• ***❤️ Curtir*** = clique para curtir ou descurtir\n' +
        '• ***💬 Comentar*** = abra a thread do post para comentar\n' +
        '• ***👥 Curtidas*** = veja quem curtiu\n' +
        '• ***ℹ️ Como funciona*** = mostra este aviso\n' +
        '• ***🗑️ Apagar*** = o autor (ou um administrador) pode remover o post\n\n' +
        '⚠️ Você só pode postar **fotos ou vídeos** nesta área. Mensagens sem foto/vídeo são apagadas automaticamente pelo bot ⚠️'
    )
    .setFooter({ text: 'Feito com amor e carinho por Kuro ❤️', iconURL: opts.guildIcon ?? undefined });
  if (opts.imageUrl) embed.setImage(opts.imageUrl);
  return embed;
}

/** Atualiza o contador quando comentários são apagados na thread (e apaga a thread se ficar vazia). */
export async function handleThreadCommentsRemoved(client: Client, threadId: string, count: number): Promise<void> {
  const post = await instagramRepository.getPostByThread(threadId);
  if (!post) return;
  const newCount = await instagramRepository.decrementComments(post.id, count);

  if (newCount === 0) {
    const guild = client.guilds.cache.get(post.guildId);
    const thread = guild ? await guild.channels.fetch(threadId).catch(() => null) : null;
    await thread?.delete().catch(() => undefined);
    await instagramRepository.setThread(post.id, null);
  }

  await refreshPostButtons(client, post, newCount);
}

/** Linha de botões do post — todos só com ícone (uniformes em PC e mobile). Contagens ficam no texto. */
function buildPostButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('insta:like').setEmoji('❤️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('insta:comment').setEmoji('💬').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('insta:likers').setEmoji('👥').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('insta:info').setEmoji('ℹ️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('insta:delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  );
}

const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

/** Monta o card (Components V2) do post: Autor(a)+avatar → título → legenda → linha → mídia → data → botões. */
function buildPostContainer(opts: {
  authorId: string;
  avatarUrl: string;
  title: string | null;
  caption: string | null;
  mediaRef: string; // attachment://nome
  likeCount: number;
  commentCount: number;
  serverName: string;
  createdAt: Date;
  color: number;
}): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(opts.color);

  const header: string[] = [`**Autor(a):** <@${opts.authorId}>`];
  if (opts.title) header.push(`## ${opts.title}`);
  if (opts.caption) header.push(opts.caption);
  // Section: texto à esquerda + avatar quadrado no canto superior direito.
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(truncate(header.join('\n'), 4000)))
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(opts.avatarUrl))
  );

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(opts.mediaRef)));

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# ❤️ ${opts.likeCount}  💬 ${opts.commentCount}  •  📅 ${formatBrDateTime(opts.createdAt)}`)
  );
  container.addActionRowComponents(buildPostButtons());
  // Rodapé: nome do servidor, abaixo dos botões.
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${opts.serverName}`));
  return container;
}

/** Lê a URL (já resolvida pelo Discord) da mídia dentro do MediaGallery de um card V2. */
function findMediaUrl(message: Message | PartialMessage): string | null {
  for (const top of message.components ?? []) {
    const children = (top as { components?: unknown[] }).components;
    if (!Array.isArray(children)) continue;
    for (const child of children) {
      const c = child as { type?: number; items?: { media?: { url?: string } }[] };
      if (c.type === ComponentType.MediaGallery && typeof c.items?.[0]?.media?.url === 'string') {
        return c.items[0]!.media!.url!;
      }
    }
  }
  return null;
}

/** Reconstrói o card do post (curtidas/comentários). Posts antigos (embed) só atualizam os botões. */
async function editPostComponents(message: Message, post: InstaPost, likeCount: number, commentCount: number): Promise<void> {
  if (message.flags.has(MessageFlags.IsComponentsV2)) {
    // Em cards V2 a mídia fica no MediaGallery (não em message.attachments). Lê a URL e re-upa,
    // pois o edit precisa fornecer o anexo referenciado por attachment://.
    const mediaUrl = findMediaUrl(message);
    const attName = (mediaUrl ? mediaUrl.split('?')[0]!.split('/').pop() || 'post.png' : 'post.png').replace(/[^\w.\-]+/g, '_');
    const user = await message.client.users.fetch(post.authorId).catch(() => null);
    const container = buildPostContainer({
      authorId: post.authorId,
      avatarUrl: user?.displayAvatarURL({ size: 256 }) ?? DEFAULT_AVATAR,
      title: post.title,
      caption: post.caption,
      mediaRef: `attachment://${attName}`,
      likeCount,
      commentCount,
      serverName: message.guild?.name ?? '',
      createdAt: post.createdAt,
      color: post.color ?? INSTA_COLOR
    });
    const files = mediaUrl ? [new AttachmentBuilder(mediaUrl, { name: attName })] : [];
    await message
      .edit({ components: [container], files, flags: MessageFlags.IsComponentsV2 })
      .catch((err) => logger.error('[instagram] Falha ao atualizar card V2:', err));
  } else {
    await message.edit({ components: [buildPostButtons()] }).catch((err) => logger.error('[instagram] Falha ao atualizar botões:', err));
  }
}

// Confirmações pendentes (orig msg id → timeout de auto-cancelamento) e títulos digitados.
const pendingConfirmations = new Map<string, ReturnType<typeof setTimeout>>();
const pendingTitles = new Map<string, string>();
const CONFIRM_TIMEOUT_MS = 60_000;

function confirmationEmbed(title?: string) {
  const base = 'Confirme que deseja publicar esta mídia no mural. *(expira em 60s)*';
  return infoEmbed(title ? `${base}\n\n📝 **Título:** ${truncate(title, 240)}` : base);
}

function confirmationRow(msgId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`insta:confirm:${msgId}`).setEmoji('✅').setLabel('Confirmar postagem').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`insta:title:${msgId}`).setEmoji('📝').setLabel('Adicionar título').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`insta:cancel:${msgId}`).setEmoji('✖️').setLabel('Cancelar').setStyle(ButtonStyle.Danger)
  );
}

/** Pede confirmação antes de transformar a mídia em post (anti-spam). */
async function requestConfirmation(message: Message<true>, media: Attachment): Promise<void> {
  if (!message.channel.isSendable()) return;

  const prompt = await message.channel
    .send({ content: `${message.author}`, embeds: [confirmationEmbed()], components: [confirmationRow(message.id)] })
    .catch(() => null);
  if (!prompt) return;

  const timeout = setTimeout(() => {
    pendingConfirmations.delete(message.id);
    pendingTitles.delete(message.id);
    // Salva a mídia não confirmada no #log-instagram antes de apagar.
    void logInstagram(
      message.guild,
      '⏳ Mídia não confirmada (expirou em 60s)',
      0xfaa61a,
      [{ name: 'Autor(a)', value: `${message.author} \`${message.author.tag}\``, inline: true }],
      mediaFromAttachment(media)
    );
    void message.delete().catch(() => undefined);
    void prompt.delete().catch(() => undefined);
  }, CONFIRM_TIMEOUT_MS);
  pendingConfirmations.set(message.id, timeout);
}

/** Botão "Adicionar título" → abre o modal (pré-preenchido se já houver título). */
export async function handleTitle(interaction: ButtonInteraction): Promise<void> {
  const msgId = interaction.customId.split(':')[2];
  if (!msgId) return;
  const input = new TextInputBuilder()
    .setCustomId('titulo')
    .setLabel('Título do post (deixe vazio para remover)')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(240)
    .setRequired(false);
  const existing = pendingTitles.get(msgId);
  if (existing) input.setValue(existing);
  const modal = new ModalBuilder()
    .setCustomId(`insta:titlemodal:${msgId}`)
    .setTitle('Título do post')
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

/** Modal do título → guarda e atualiza o aviso de confirmação. */
export async function handleTitleModal(interaction: ModalSubmitInteraction): Promise<void> {
  const msgId = interaction.customId.split(':')[2];
  if (!msgId) return;
  const title = interaction.fields.getTextInputValue('titulo').trim();
  if (title) pendingTitles.set(msgId, title);
  else pendingTitles.delete(msgId);

  if (interaction.isFromMessage()) {
    await interaction
      .update({ embeds: [confirmationEmbed(title || undefined)], components: [confirmationRow(msgId)] })
      .catch(() => undefined);
  } else {
    await interaction.reply({ embeds: [infoEmbed(title ? 'Título definido.' : 'Título removido.')], flags: MessageFlags.Ephemeral });
  }
}

/** Cria o post: reposta a mídia como post do bot, abre a thread sob demanda e apaga a original. */
async function createPost(message: Message<true>, media: Attachment, title: string | null): Promise<void> {
  if (!message.channel.isSendable()) return;

  const video = isVideoAttachment(media);
  const ext = (media.name?.split('.').pop() || (video ? 'mp4' : 'png')).toLowerCase().replace(/[^a-z0-9]/g, '') || (video ? 'mp4' : 'png');
  const safeName = `post.${ext}`;
  const file = new AttachmentBuilder(media.url, { name: safeName });
  const caption = message.content?.trim() || null;
  // Cor do card = cor predominante (foto: a imagem; vídeo: o 1º frame via proxy do Discord).
  const color = (await dominantColor(media.url)) ?? null;

  // Card Components V2 (mesmo formato para foto e vídeo), com a mídia DENTRO da estrutura.
  const container = buildPostContainer({
    authorId: message.author.id,
    avatarUrl: message.author.displayAvatarURL({ size: 256 }),
    title,
    caption,
    mediaRef: `attachment://${safeName}`,
    likeCount: 0,
    commentCount: 0,
    serverName: message.guild.name,
    createdAt: message.createdAt,
    color: color ?? INSTA_COLOR
  });
  const postMsg = await message.channel.send({ components: [container], files: [file], flags: MessageFlags.IsComponentsV2 });

  // Thread é criada sob demanda (no 1º comentário) para não deixar threads vazias.
  await instagramRepository.createPost(message.guildId, message.channelId, postMsg.id, null, message.author.id, title, caption, color);

  // Salva o post no #log-instagram assim que é publicado.
  const fields: APIEmbedField[] = [
    { name: 'Autor(a)', value: `${message.author} \`${message.author.tag}\``, inline: true },
    { name: 'Canal', value: `<#${message.channelId}>`, inline: true }
  ];
  if (title) fields.push({ name: 'Título', value: truncate(title, 256) });
  if (caption) fields.push({ name: 'Legenda', value: truncate(caption, 1024) });
  await logInstagram(message.guild, video ? '🎬 Vídeo publicado no mural' : '📸 Foto publicada no mural', INSTA_COLOR, fields, mediaFromAttachment(media));

  await message.delete().catch(() => undefined);
}

/** Reedita os botões de um post (após curtida/comentário) com as contagens atuais. */
async function refreshPostButtons(client: Client, post: InstaPost, commentCount: number): Promise<void> {
  const guild = client.guilds.cache.get(post.guildId);
  const channel = guild ? await guild.channels.fetch(post.channelId).catch(() => null) : null;
  if (!channel?.isTextBased()) return;
  const msg = await channel.messages.fetch(post.messageId).catch(() => null);
  if (!msg) return;
  const likeCount = await instagramRepository.countLikes(post.id);
  await editPostComponents(msg, post, likeCount, commentCount);
}

/**
 * Processa mensagens no canal do Instagram e comentários nas threads de posts.
 * Retorna true se a mensagem foi "consumida" pelo mural (virou post ou foi apagada),
 * para que o automod/atividade não a processem de novo.
 */
export async function handleInstagramMessage(message: Message): Promise<boolean> {
  if (!message.inGuild() || message.author.bot) return false;

  // Comentário numa thread de post → conta e atualiza o botão (segue sendo moderado normalmente).
  if (message.channel.isThread()) {
    const post = await instagramRepository.getPostByThread(message.channel.id);
    if (post) {
      const count = await instagramRepository.incrementComments(post.id);
      await refreshPostButtons(message.client, post, count);
    }
    return false;
  }

  if (!(await instagramRepository.isInstaChannel(message.guildId, message.channelId))) return false;

  const sendNotice = async (text: string): Promise<void> => {
    await message.delete().catch(() => undefined);
    if (message.channel.isSendable()) {
      const notice = await message.channel.send(`${message.author}, ${text}`).catch(() => null);
      if (notice) setTimeout(() => void notice.delete().catch(() => undefined), 8_000);
    }
  };

  const mediaList = [...message.attachments.values()].filter(
    (a) => a.contentType?.startsWith('image/') || a.contentType?.startsWith('video/') || IMAGE_RE.test(a.name ?? '') || VIDEO_RE.test(a.name ?? '')
  );

  // Várias mídias de uma vez → bloqueia e pede uma por vez.
  if (mediaList.length > 1) {
    await sendNotice('envie **uma mídia por vez** — mande uma foto ou vídeo de cada vez para virar um post. 🙂');
    return true;
  }

  const media = mediaList[0];
  if (!media) {
    await sendNotice('você só pode postar **fotos ou vídeos** nesta área. Envie uma mídia para criar um post. 📸🎬');
    return true;
  }

  await requestConfirmation(message, media);
  return true;
}

// ---- Handlers de botão ----

export async function handleLike(interaction: ButtonInteraction): Promise<void> {
  const post = await instagramRepository.getPostByMessage(interaction.message.id);
  if (!post) {
    await interaction.reply({ embeds: [errorEmbed('Post não encontrado.')], flags: MessageFlags.Ephemeral });
    return;
  }
  const liked = await instagramRepository.toggleLike(post.id, interaction.user.id);
  const likeCount = await instagramRepository.countLikes(post.id);
  await editPostComponents(interaction.message, post, likeCount, post.commentCount);
  await interaction.reply({
    embeds: [liked ? successEmbed('Você curtiu este post ❤️') : infoEmbed('Você removeu sua curtida.')],
    flags: MessageFlags.Ephemeral
  });
}

export async function handleLikers(interaction: ButtonInteraction): Promise<void> {
  const post = await instagramRepository.getPostByMessage(interaction.message.id);
  if (!post) {
    await interaction.reply({ embeds: [errorEmbed('Post não encontrado.')], flags: MessageFlags.Ephemeral });
    return;
  }
  const userIds = await instagramRepository.getLikers(post.id);
  const embed =
    userIds.length === 0
      ? infoEmbed('Ninguém curtiu este post ainda.')
      : infoEmbed(`**Curtidas (${userIds.length}):**\n${truncate(userIds.map((id) => `<@${id}>`).join(', '), 4000)}`);
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

export async function handleComment(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const post = await instagramRepository.getPostByMessage(interaction.message.id);
  if (!post) {
    await interaction.reply({ embeds: [errorEmbed('Post não encontrado.')], flags: MessageFlags.Ephemeral });
    return;
  }

  // Garante a thread (criada sob demanda; reaproveita a existente se houver).
  let thread: AnyThreadChannel | null = null;
  if (post.threadId) {
    const fetched = await interaction.guild.channels.fetch(post.threadId).catch(() => null);
    if (fetched?.isThread()) thread = fetched;
  }
  if (!thread) {
    thread = interaction.message.thread ?? (await interaction.message.startThread({ name: 'Comentários' }).catch(() => null));
  }
  if (!thread) {
    await interaction.reply({ embeds: [errorEmbed('Não consegui abrir a thread de comentários.')], flags: MessageFlags.Ephemeral });
    return;
  }
  if (post.threadId !== thread.id) await instagramRepository.setThread(post.id, thread.id);

  await interaction.reply({ embeds: [infoEmbed(`Comente na thread: <#${thread.id}>`)], flags: MessageFlags.Ephemeral });
}

export async function handleInfo(interaction: ButtonInteraction): Promise<void> {
  const { imageUrl, color } = await instagramRepository.getDisclaimerConfig(interaction.channelId);
  await interaction.reply({
    embeds: [buildDisclaimerEmbed({ imageUrl, color, guildIcon: interaction.guild?.iconURL({ size: 128 }) ?? null })],
    flags: MessageFlags.Ephemeral
  });
}

/**
 * Anexa a mídia ao embed de log de forma confiável: baixa os bytes e re-upa (salva de vez).
 * Imagem vai dentro do embed (setImage); vídeo é anexado e toca abaixo do embed.
 * Se o download falhar, cai em referência direta (imagem) ou link (vídeo).
 */
async function attachMediaToLog(embed: EmbedBuilder, media: MediaDesc | null): Promise<AttachmentBuilder[]> {
  if (!media) {
    embed.addFields({ name: 'Mídia', value: '*(indisponível)*' });
    return [];
  }
  const safeName = media.name.replace(/[^\w.\-]+/g, '_') || (media.isVideo ? 'video.mp4' : 'foto.png');
  try {
    const res = await fetch(media.url);
    if (res.ok) {
      const file = new AttachmentBuilder(Buffer.from(await res.arrayBuffer()), { name: safeName });
      if (!media.isVideo) embed.setImage(`attachment://${safeName}`);
      return [file];
    }
  } catch {
    /* segue para o fallback */
  }
  if (media.isVideo) embed.addFields({ name: '🎬 Vídeo', value: `[abrir vídeo](${media.url})` });
  else embed.setImage(media.url);
  return [];
}

/** Loga um evento do mural no #log-instagram, salvando a mídia quando possível. */
async function logInstagram(guild: Guild, title: string, color: number, fields: APIEmbedField[], media: MediaDesc | null): Promise<void> {
  const embed = new EmbedBuilder().setColor(color).setTitle(title).addFields(...fields).setTimestamp();
  const files = await attachMediaToLog(embed, media);
  await sendLog(guild, 'instagram', embed, files.length > 0 ? files : undefined);
}

export async function handleDelete(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const post = await instagramRepository.getPostByMessage(interaction.message.id);
  if (!post) {
    await interaction.reply({ embeds: [errorEmbed('Post não encontrado.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const isAuthor = post.authorId === interaction.user.id;
  const isAdmin = interaction.memberPermissions.has(PermissionFlagsBits.Administrator);
  if (!isAuthor && !isAdmin) {
    await interaction.reply({
      embeds: [errorEmbed('Só o autor do post ou um administrador pode apagá-lo.')],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await interaction.reply({ embeds: [successEmbed('Post apagado.')], flags: MessageFlags.Ephemeral }).catch(() => undefined);

  // Salva a foto/vídeo apagado no #log-instagram. Re-busca a mensagem para ter URLs frescas.
  const liveMsg = await interaction.message.fetch().catch(() => interaction.message);
  await logInstagram(
    interaction.guild,
    '🗑️ Post do mural apagado',
    Palette.error,
    [
      { name: 'Autor(a)', value: `<@${post.authorId}>`, inline: true },
      { name: 'Apagado por', value: `${interaction.user} \`${interaction.user.tag}\``, inline: true }
    ],
    extractPostMedia(liveMsg)
  );

  if (post.threadId) {
    const thread = await interaction.guild.channels.fetch(post.threadId).catch(() => null);
    await thread?.delete().catch(() => undefined);
  }
  // Apaga o registro ANTES da mensagem para o messageDelete não logar de novo.
  await instagramRepository.deletePost(post.id);
  await interaction.message.delete().catch(() => undefined);
}

/**
 * Quando a mensagem de um post é apagada direto (não pelo botão 🗑️) — ex.: um mod
 * apagando a mensagem do bot — salva a foto no #log-de-mensagens e limpa o registro.
 * Retorna true se a mensagem era de fato um post do mural.
 */
export async function handlePostMessageDeleted(client: Client, message: Message<boolean> | PartialMessage): Promise<boolean> {
  if (!message.guild) return false;
  const post = await instagramRepository.getPostByMessage(message.id);
  if (!post) return false;

  const guild = message.guild;
  const executor = await findAuditExecutor(guild, AuditLogEvent.MessageDelete, client.user?.id ?? '').catch(() => null);

  const fields: APIEmbedField[] = [{ name: 'Autor(a)', value: `<@${post.authorId}>`, inline: true }];
  if (executor) fields.push({ name: 'Apagado por', value: `${executor} \`${executor.tag}\``, inline: true });
  await logInstagram(guild, '🗑️ Post do mural apagado', Palette.error, fields, extractPostMedia(message));

  if (post.threadId) {
    const thread = await guild.channels.fetch(post.threadId).catch(() => null);
    await thread?.delete().catch(() => undefined);
  }
  await instagramRepository.deletePost(post.id);
  return true;
}

export async function handleConfirm(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild() || !interaction.channel) return;
  const origId = interaction.customId.split(':')[2];
  if (!origId) return;

  const original = await interaction.channel.messages.fetch(origId).catch(() => null);
  if (!original?.inGuild()) {
    const t = pendingConfirmations.get(origId);
    if (t) clearTimeout(t);
    pendingConfirmations.delete(origId);
    await interaction.update({ embeds: [errorEmbed('Esta foto expirou ou não está mais disponível.')], components: [] }).catch(() => undefined);
    return;
  }
  if (interaction.user.id !== original.author.id) {
    await interaction.reply({ embeds: [errorEmbed('Só quem enviou a foto pode confirmar a postagem.')], flags: MessageFlags.Ephemeral });
    return;
  }
  const media = findMedia(original);
  if (!media) {
    await interaction.update({ embeds: [errorEmbed('Mídia não encontrada.')], components: [] }).catch(() => undefined);
    return;
  }

  const t = pendingConfirmations.get(origId);
  if (t) clearTimeout(t);
  pendingConfirmations.delete(origId);
  const title = pendingTitles.get(origId) ?? null;
  pendingTitles.delete(origId);

  await interaction.deferUpdate().catch(() => undefined);
  await createPost(original, media, title); // cria o post e apaga a mídia original
  await interaction.message.delete().catch(() => undefined); // remove o aviso de confirmação
}

export async function handleCancel(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.channel) return;
  const origId = interaction.customId.split(':')[2];
  if (!origId) return;

  const original = await interaction.channel.messages.fetch(origId).catch(() => null);
  if (original && interaction.user.id !== original.author.id) {
    await interaction.reply({ embeds: [errorEmbed('Só quem enviou a foto pode cancelar.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const t = pendingConfirmations.get(origId);
  if (t) clearTimeout(t);
  pendingConfirmations.delete(origId);
  pendingTitles.delete(origId);

  await interaction.deferUpdate().catch(() => undefined);

  // Salva a mídia cancelada no #log-instagram antes de apagar.
  if (original?.inGuild()) {
    const media = findMedia(original);
    if (media) {
      await logInstagram(
        original.guild,
        '✖️ Postagem cancelada',
        0xfaa61a,
        [{ name: 'Autor(a)', value: `${original.author} \`${original.author.tag}\``, inline: true }],
        mediaFromAttachment(media)
      );
    }
  }

  await original?.delete().catch(() => undefined);
  await interaction.message.delete().catch(() => undefined);
}

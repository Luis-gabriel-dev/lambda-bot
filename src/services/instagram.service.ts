import {
  ActionRowBuilder,
  AnyThreadChannel,
  Attachment,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Message,
  MessageFlags,
  PermissionFlagsBits
} from 'discord.js';
import { InstaPost } from '@prisma/client';
import { instagramRepository } from '../repositories/instagram.repository';
import { errorEmbed, infoEmbed, Palette, successEmbed } from '../utils/embeds';
import { formatBrDateTime, truncate } from '../utils/formatter';
import { sendLog } from './log.service';

const INSTA_COLOR = 0xe1306c; // rosa estilo Instagram
const IMAGE_RE = /\.(png|jpe?g|gif|webp)$/i;

/** Embed explicando como funciona o mural (usado no /instagram e no botão ℹ️). */
export function buildDisclaimerEmbed(imageUrl?: string | null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(INSTA_COLOR)
    .setTitle('Canal do instagram, como funciona? 📸')
    .setDescription(
      'Envie uma foto neste canal e o bot transforma em um **post** no estilo do instagram com:\n\n' +
        '• ***❤️ Curtir*** = clique para curtir ou descurtir\n' +
        '• ***💬 Comentar*** = abra a thread do post para comentar\n' +
        '• ***👥 Curtidas*** = veja quem curtiu\n' +
        '• ***ℹ️ Como funciona*** = mostra este aviso\n' +
        '• ***🗑️ Apagar*** = o autor (ou um administrador) pode remover o post\n\n' +
        '⚠️ Você só pode postar fotos nesta área. Mensagens sem imagem são apagadas automaticamente pelo bot ⚠️'
    )
    .setFooter({ text: 'Feito com amor e carinho por Kuro ❤️' });
  if (imageUrl) embed.setImage(imageUrl);
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

/** Monta a linha de botões do post (curtir, comentar, ver curtidas, info, apagar). */
function buildPostButtons(likeCount: number, commentCount: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('insta:like').setEmoji('❤️').setLabel(`${likeCount}`).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('insta:comment').setEmoji('💬').setLabel(`Comentar (${commentCount})`).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('insta:likers').setEmoji('👥').setLabel('Curtidas').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('insta:info').setEmoji('ℹ️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('insta:delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  );
}

// Confirmações pendentes (orig msg id → timeout de auto-cancelamento).
const pendingConfirmations = new Map<string, ReturnType<typeof setTimeout>>();
const CONFIRM_TIMEOUT_MS = 60_000;

/** Pede confirmação antes de transformar a foto em post (anti-spam). */
async function requestConfirmation(message: Message<true>): Promise<void> {
  if (!message.channel.isSendable()) return;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`insta:confirm:${message.id}`).setEmoji('✅').setLabel('Confirmar postagem').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`insta:cancel:${message.id}`).setEmoji('✖️').setLabel('Cancelar').setStyle(ButtonStyle.Danger)
  );
  const prompt = await message.channel
    .send({
      content: `${message.author}`,
      embeds: [infoEmbed('Confirme que deseja publicar esta foto no mural. *(expira em 60s)*')],
      components: [row]
    })
    .catch(() => null);
  if (!prompt) return;

  const timeout = setTimeout(() => {
    pendingConfirmations.delete(message.id);
    void message.delete().catch(() => undefined);
    void prompt.delete().catch(() => undefined);
  }, CONFIRM_TIMEOUT_MS);
  pendingConfirmations.set(message.id, timeout);
}

/** Cria o post: reposta a imagem como embed do bot, abre a thread de comentários e apaga a original. */
async function createPost(message: Message<true>, image: Attachment): Promise<void> {
  if (!message.channel.isSendable()) return;

  const ext = (image.name?.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const safeName = `post.${ext}`;
  const file = new AttachmentBuilder(image.url, { name: safeName });

  const embed = new EmbedBuilder()
    .setColor(INSTA_COLOR)
    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ size: 128 }) })
    .setImage(`attachment://${safeName}`)
    .addFields(
      { name: 'Autor(a)', value: `<@${message.author.id}>`, inline: true },
      { name: 'Postado em', value: formatBrDateTime(message.createdAt), inline: true }
    );
  const caption = message.content?.trim();
  if (caption) embed.setDescription(truncate(caption, 2000));

  const postMsg = await message.channel.send({
    embeds: [embed],
    components: [buildPostButtons(0, 0)],
    files: [file]
  });

  // Thread é criada sob demanda (no 1º comentário) para não deixar threads vazias.
  await instagramRepository.createPost(message.guildId, message.channelId, postMsg.id, null, message.author.id);
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
  await msg.edit({ components: [buildPostButtons(likeCount, commentCount)] }).catch(() => undefined);
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

  const image = message.attachments.find(
    (a) => a.contentType?.startsWith('image/') || IMAGE_RE.test(a.name ?? '')
  );
  if (!image) {
    await message.delete().catch(() => undefined);
    if (message.channel.isSendable()) {
      const notice = await message.channel
        .send(`${message.author}, você só pode postar **fotos** nesta área. Envie uma imagem para criar um post. 📸`)
        .catch(() => null);
      if (notice) setTimeout(() => void notice.delete().catch(() => undefined), 8_000);
    }
    return true;
  }

  await requestConfirmation(message);
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
  await interaction.message
    .edit({ components: [buildPostButtons(likeCount, post.commentCount)] })
    .catch(() => undefined);
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
  const imageUrl = await instagramRepository.getDisclaimerImageUrl(interaction.channelId);
  await interaction.reply({ embeds: [buildDisclaimerEmbed(imageUrl)], flags: MessageFlags.Ephemeral });
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

  // Salva a foto apagada no #log-de-mensagens (antes de apagar a mensagem, enquanto a URL é válida).
  const photo = interaction.message.attachments.first();
  const logEmbed = new EmbedBuilder()
    .setColor(Palette.error)
    .setTitle('🗑️ Post do mural apagado')
    .addFields(
      { name: 'Autor(a)', value: `<@${post.authorId}>`, inline: true },
      { name: 'Apagado por', value: `${interaction.user} \`${interaction.user.tag}\``, inline: true }
    )
    .setTimestamp();
  const files: AttachmentBuilder[] = [];
  if (photo) {
    const safeName = (photo.name ?? 'foto').replace(/[^\w.\-]+/g, '_');
    files.push(new AttachmentBuilder(photo.url, { name: safeName }));
    logEmbed.setImage(`attachment://${safeName}`);
  }
  await sendLog(interaction.guild, 'mensagens', logEmbed, files);

  if (post.threadId) {
    const thread = await interaction.guild.channels.fetch(post.threadId).catch(() => null);
    await thread?.delete().catch(() => undefined);
  }
  await interaction.message.delete().catch(() => undefined);
  await instagramRepository.deletePost(post.id);
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
  const image = original.attachments.find((a) => a.contentType?.startsWith('image/') || IMAGE_RE.test(a.name ?? ''));
  if (!image) {
    await interaction.update({ embeds: [errorEmbed('Foto não encontrada.')], components: [] }).catch(() => undefined);
    return;
  }

  const t = pendingConfirmations.get(origId);
  if (t) clearTimeout(t);
  pendingConfirmations.delete(origId);

  await interaction.deferUpdate().catch(() => undefined);
  await createPost(original, image); // cria o post e apaga a foto original
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

  await interaction.deferUpdate().catch(() => undefined);
  await original?.delete().catch(() => undefined);
  await interaction.message.delete().catch(() => undefined);
}

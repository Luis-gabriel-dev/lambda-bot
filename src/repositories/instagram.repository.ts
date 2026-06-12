import { InstaPost } from '@prisma/client';
import { prisma } from '../core/database';

// Cache dos IDs de canal do Instagram por servidor (lido a cada mensagem) — invalidado nas escritas.
const channelIdsCache = new Map<string, string[]>();

async function loadChannelIds(guildId: string): Promise<string[]> {
  if (channelIdsCache.has(guildId)) return channelIdsCache.get(guildId)!;
  const rows = await prisma.instagramChannel.findMany({ where: { guildId }, select: { channelId: true } });
  const ids = rows.map((r) => r.channelId);
  channelIdsCache.set(guildId, ids);
  return ids;
}

export const instagramRepository = {
  // ---- Canais ----
  getChannelIds: loadChannelIds,

  async isInstaChannel(guildId: string, channelId: string): Promise<boolean> {
    return (await loadChannelIds(guildId)).includes(channelId);
  },

  async addChannel(guildId: string, channelId: string): Promise<void> {
    await prisma.instagramChannel.upsert({ where: { channelId }, create: { guildId, channelId }, update: { guildId } });
    channelIdsCache.delete(guildId);
  },

  async removeChannel(guildId: string, channelId: string): Promise<boolean> {
    const result = await prisma.instagramChannel.deleteMany({ where: { guildId, channelId } });
    channelIdsCache.delete(guildId);
    return result.count > 0;
  },

  async setDisclaimerImage(channelId: string, imageUrl: string | null): Promise<void> {
    await prisma.instagramChannel.update({ where: { channelId }, data: { disclaimerImageUrl: imageUrl } }).catch(() => undefined);
  },

  async getDisclaimerImageUrl(channelId: string): Promise<string | null> {
    const channel = await prisma.instagramChannel.findUnique({ where: { channelId } });
    return channel?.disclaimerImageUrl ?? null;
  },

  // ---- Posts ----
  async createPost(
    guildId: string,
    channelId: string,
    messageId: string,
    threadId: string | null,
    authorId: string
  ): Promise<InstaPost> {
    return prisma.instaPost.create({ data: { guildId, channelId, messageId, threadId, authorId } });
  },

  async getPostByMessage(messageId: string): Promise<InstaPost | null> {
    return prisma.instaPost.findUnique({ where: { messageId } });
  },

  async getPostByThread(threadId: string): Promise<InstaPost | null> {
    return prisma.instaPost.findUnique({ where: { threadId } });
  },

  async setThread(postId: number, threadId: string | null): Promise<void> {
    await prisma.instaPost.update({ where: { id: postId }, data: { threadId } }).catch(() => undefined);
  },

  async incrementComments(postId: number): Promise<number> {
    const post = await prisma.instaPost.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });
    return post.commentCount;
  },

  /** Diminui o contador de comentários (com piso em 0). Retorna o novo total. */
  async decrementComments(postId: number, count: number): Promise<number> {
    const post = await prisma.instaPost.findUnique({ where: { id: postId } });
    if (!post) return 0;
    const newCount = Math.max(0, post.commentCount - count);
    await prisma.instaPost.update({ where: { id: postId }, data: { commentCount: newCount } });
    return newCount;
  },

  async deletePost(postId: number): Promise<void> {
    await prisma.instaPost.delete({ where: { id: postId } }).catch(() => undefined);
  },

  // ---- Curtidas ----
  async toggleLike(postId: number, userId: string): Promise<boolean> {
    const existing = await prisma.instaLike.findUnique({ where: { postId_userId: { postId, userId } } });
    if (existing) {
      await prisma.instaLike.delete({ where: { id: existing.id } });
      return false;
    }
    await prisma.instaLike.create({ data: { postId, userId } });
    return true;
  },

  async countLikes(postId: number): Promise<number> {
    return prisma.instaLike.count({ where: { postId } });
  },

  async getLikers(postId: number): Promise<string[]> {
    const rows = await prisma.instaLike.findMany({ where: { postId }, select: { userId: true } });
    return rows.map((r) => r.userId);
  }
};

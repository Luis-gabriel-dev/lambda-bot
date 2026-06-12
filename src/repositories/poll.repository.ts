import { Poll, PollOption } from '@prisma/client';
import { prisma } from '../core/database';

export type PollWithOptions = Poll & { options: PollOption[] };
export type VoteResult = 'added' | 'changed' | 'removed';

export interface CreatePollInput {
  guildId: string;
  channelId: string;
  messageId: string;
  question: string;
  color: number | null;
  imageUrl: string | null;
  endsAt: Date | null;
  deleteAfterMs: number | null;
  options: string[];
}

/** Acesso às enquetes, opções e votos. */
export const pollRepository = {
  async create(data: CreatePollInput): Promise<PollWithOptions> {
    return prisma.poll.create({
      data: {
        guildId: data.guildId,
        channelId: data.channelId,
        messageId: data.messageId,
        question: data.question,
        color: data.color,
        imageUrl: data.imageUrl,
        endsAt: data.endsAt,
        deleteAfterMs: data.deleteAfterMs,
        options: { create: data.options.map((text, idx) => ({ idx, text })) }
      },
      include: { options: true }
    });
  },

  async getByMessage(messageId: string): Promise<PollWithOptions | null> {
    return prisma.poll.findUnique({ where: { messageId }, include: { options: true } });
  },

  /** Registra/altera/remove o voto (escolha única). Retorna o que aconteceu. */
  async vote(pollId: number, userId: string, idx: number): Promise<VoteResult> {
    const existing = await prisma.pollVote.findUnique({ where: { pollId_userId: { pollId, userId } } });
    if (existing) {
      if (existing.idx === idx) {
        await prisma.pollVote.delete({ where: { id: existing.id } });
        return 'removed';
      }
      await prisma.pollVote.update({ where: { id: existing.id }, data: { idx } });
      return 'changed';
    }
    await prisma.pollVote.create({ data: { pollId, userId, idx } });
    return 'added';
  },

  /** Contagem de votos por opção (idx → total). */
  async counts(pollId: number): Promise<Map<number, number>> {
    const grouped = await prisma.pollVote.groupBy({ by: ['idx'], where: { pollId }, _count: { idx: true } });
    const map = new Map<number, number>();
    for (const row of grouped) map.set(row.idx, row._count.idx);
    return map;
  },

  async close(pollId: number, deleteAt: Date | null): Promise<void> {
    await prisma.poll.update({ where: { id: pollId }, data: { closed: true, deleteAt } });
  },

  /** Enquetes que devem ser auto-encerradas (tempo venceu e ainda abertas). */
  async dueCloses(now: Date): Promise<PollWithOptions[]> {
    return prisma.poll.findMany({ where: { closed: false, endsAt: { lte: now } }, include: { options: true } });
  },

  /** Enquetes encerradas que já passaram do horário de exclusão. */
  async dueDeletes(now: Date): Promise<Poll[]> {
    return prisma.poll.findMany({ where: { closed: true, deleteAt: { lte: now } } });
  },

  async delete(pollId: number): Promise<void> {
    await prisma.poll.delete({ where: { id: pollId } }).catch(() => undefined);
  }
};

import { Client, EmbedBuilder } from 'discord.js';
import { warnPenaltyRepository } from '../repositories/warnPenalty.repository';
import { warningRepository } from '../repositories/warning.repository';
import { buildStaffEmbed, sendGuildDM } from '../services/moderation.service';
import { sendLog } from '../services/log.service';
import { Palette } from '../utils/embeds';
import { logger } from '../core/logger';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // checa a cada 5 minutos

async function runPenalties(client: Client): Promise<void> {
  const now = new Date();

  // 1) Avisar quem teve o silenciamento encerrado (e que começou o prazo de reset).
  for (const penalty of await warnPenaltyRepository.dueMuteEnd(now)) {
    const guild = client.guilds.cache.get(penalty.guildId);
    const user = await client.users.fetch(penalty.userId).catch(() => null);
    if (guild && user) {
      const dm = buildStaffEmbed(guild.name, guild.iconURL({ size: 256 }), {
        title: 'Seu silenciamento acabou',
        description:
          'Seu silenciamento por acúmulo de advertências terminou. A partir de agora você tem **7 dias** sem ' +
          'receber novas advertências para que elas sejam **zeradas**. Caso receba **4** advertências novamente, ' +
          'você será **banido** do servidor.\n\nEvite quebrar as regras do servidor caso queira se manter nele.',
        color: Palette.info
      });
      await sendGuildDM(user, guild.id, dm);
    }
    await warnPenaltyRepository.markMuteNotified(penalty.id);
  }

  // 2) Zerar advertências após o prazo de 1 semana.
  for (const penalty of await warnPenaltyRepository.dueReset(now)) {
    const removed = await warningRepository.clear(penalty.guildId, penalty.userId);
    const guild = client.guilds.cache.get(penalty.guildId);
    const user = await client.users.fetch(penalty.userId).catch(() => null);

    if (guild && user && removed > 0) {
      const dm = buildStaffEmbed(guild.name, guild.iconURL({ size: 256 }), {
        title: 'Advertências zeradas',
        description: 'Suas advertências no servidor foram **zeradas**. Continue seguindo as regras!',
        color: Palette.success
      });
      await sendGuildDM(user, guild.id, dm);

      const log = new EmbedBuilder()
        .setColor(Palette.success)
        .setTitle('♻️ Advertências zeradas (automático)')
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: 'Usuário', value: `${user} \`${user.tag}\``, inline: true },
          { name: 'Removidas', value: `${removed}`, inline: true }
        )
        .setTimestamp();
      await sendLog(guild, 'moderacao', log);
    }

    await warnPenaltyRepository.remove(penalty.id);
  }
}

/** Agenda o processamento das penalidades de advertências: roda ao iniciar e a cada 5 min. */
export function scheduleWarnPenalties(client: Client): void {
  void runPenalties(client).catch((err) => logger.error('Erro no job de penalidades:', err));
  setInterval(() => void runPenalties(client).catch((err) => logger.error('Erro no job de penalidades:', err)), CHECK_INTERVAL_MS);
}

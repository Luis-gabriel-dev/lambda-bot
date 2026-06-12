import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { errorEmbed, Palette, successEmbed } from '../../utils/embeds';
import { buildStaffEmbed } from '../../services/moderation.service';
import { sendLog } from '../../services/log.service';
import { warningRepository } from '../../repositories/warning.repository';
import { warnPenaltyRepository } from '../../repositories/warnPenalty.repository';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('grace')
    .setDescription('Perdoa um membro: remove todas as advertências e zera as punições.')
    .addUserOption((opt) => opt.setName('usuario').setDescription('Membro a perdoar.').setRequired(true)),

  restricted: true,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const user = interaction.options.getUser('usuario', true);

    // Só funciona se a pessoa tiver advertências.
    const total = await warningRepository.count(interaction.guildId, user.id);
    if (total === 0) {
      await interaction.reply({
        embeds: [errorEmbed(`**${user.tag}** não tem advertências para perdoar.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // Limpa advertências + cancela o ciclo de penalidade pendente.
    await warningRepository.clear(interaction.guildId, user.id);
    await warnPenaltyRepository.removeForUser(interaction.guildId, user.id);

    // Se estiver de castigo (timeout), remove também — perdão completo.
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    let unmuted = false;
    if (member?.isCommunicationDisabled() && member.moderatable) {
      await member.timeout(null, `Grace por ${interaction.user.tag}`).catch(() => undefined);
      unmuted = true;
    }

    // Avisa o membro por DM.
    const dm = buildStaffEmbed(interaction.guild.name, interaction.guild.iconURL({ size: 256 }), {
      title: 'Você recebeu um perdão',
      description:
        'Todas as suas advertências foram **removidas** e suas punições foram zeradas. Comece do zero! 🌱\n\n' +
        'Continue seguindo as regras do servidor.',
      color: Palette.success
    });
    await member?.send({ embeds: [dm] }).catch(() => undefined);

    // Log na moderação.
    const log = new EmbedBuilder()
      .setColor(Palette.success)
      .setTitle('🌱 Grace (perdão de advertências)')
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Usuário', value: `${user} \`${user.tag}\``, inline: true },
        { name: 'Por', value: `${interaction.user}`, inline: true },
        { name: 'Advertências removidas', value: `${total}`, inline: true }
      )
      .setTimestamp();
    await sendLog(interaction.guild, 'moderacao', log);

    const extra = unmuted ? ' O silenciamento também foi removido.' : '';
    await interaction.reply({
      embeds: [successEmbed(`**${user.tag}** foi perdoado — ${total} advertência(s) removida(s) e punições zeradas.${extra}`)],
      flags: MessageFlags.Ephemeral
    });
  }
};

export default command;

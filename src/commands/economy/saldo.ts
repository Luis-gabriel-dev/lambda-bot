import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { errorEmbed } from '../../utils/embeds';
import { economyRepository } from '../../repositories/economy.repository';
import { CURRENCY, GOLD } from '../../services/economy.service';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('saldo')
    .setDescription('Mostra rapidamente quantos kurocoins você tem.')
    .addUserOption((opt) => opt.setName('usuario').setDescription('Ver o saldo de outra pessoa.').setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const user = interaction.options.getUser('usuario') ?? interaction.user;
    const wallet = await economyRepository.getWallet(interaction.guildId, user.id);
    const balance = (wallet?.balance ?? 0).toLocaleString('pt-BR');
    const isSelf = user.id === interaction.user.id;
    const linha = isSelf ? `Você tem **${balance}** ${CURRENCY} no servidor.` : `**${user.username}** tem **${balance}** ${CURRENCY} no servidor.`;

    const embed = new EmbedBuilder()
      .setColor(GOLD)
      .setDescription(`${linha}\n\n💰 *kurocoins* é a moeda do servidor — colete nos drops e veja o ranking com **/ranking**.`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .setFooter({ text: 'Feito com amor por kuro ❤️' });

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;

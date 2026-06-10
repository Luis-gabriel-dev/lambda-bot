import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { errorEmbed, Palette } from '../../utils/embeds';
import { discordTimestamp } from '../../utils/formatter';

const command: Command = {
  data: new SlashCommandBuilder().setName('serverinfo').setDescription('Mostra informações do servidor.'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const { guild } = interaction;
    const channels = guild.channels.cache;
    const text = channels.filter((c) => c.type === ChannelType.GuildText).size;
    const voice = channels.filter((c) => c.type === ChannelType.GuildVoice).size;

    const embed = new EmbedBuilder()
      .setColor(Palette.info)
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: 'Dono', value: `<@${guild.ownerId}>`, inline: true },
        { name: 'ID', value: guild.id, inline: true },
        { name: 'Membros', value: `${guild.memberCount}`, inline: true },
        { name: 'Canais', value: `${channels.size} (💬 ${text} · 🔊 ${voice})`, inline: true },
        { name: 'Cargos', value: `${guild.roles.cache.size}`, inline: true },
        { name: 'Emojis', value: `${guild.emojis.cache.size}`, inline: true },
        { name: 'Boosts', value: `Nível ${guild.premiumTier} (${guild.premiumSubscriptionCount ?? 0})`, inline: true },
        {
          name: 'Criado em',
          value: `${discordTimestamp(guild.createdAt, 'D')} (${discordTimestamp(guild.createdAt, 'R')})`
        }
      );

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;

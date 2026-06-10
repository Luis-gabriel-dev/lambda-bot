import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';

const command: Command = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Mostra a latência do bot.'),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply({ content: '🏓 Medindo...', flags: MessageFlags.Ephemeral });
    const reply = await interaction.fetchReply();
    const roundtrip = reply.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply(
      `🏓 Pong! Latência: \`${roundtrip}ms\` · WebSocket: \`${Math.round(interaction.client.ws.ping)}ms\``
    );
  }
};

export default command;

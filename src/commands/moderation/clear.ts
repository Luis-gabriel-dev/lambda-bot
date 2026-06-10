import {
  ChatInputCommandInteraction,
  Message,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { Command } from '../../interfaces/Command';
import { errorEmbed, successEmbed } from '../../utils/embeds';

const BATCH = 100; // limite do Discord por chamada de bulkDelete
const MAX_FETCH_PAGES = 50; // teto de segurança ao paginar com filtro de usuário (50 * 100 = 5000 msgs varridas)

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Apaga mensagens recentes do canal (de todas as pessoas, com menos de 14 dias).')
    .addIntegerOption((opt) =>
      opt
        .setName('quantidade')
        .setDescription('Quantas mensagens apagar (1 a 1000).')
        .setMinValue(1)
        .setMaxValue(1000)
        .setRequired(true)
    )
    .addUserOption((opt) =>
      opt.setName('usuario').setDescription('Apagar apenas mensagens deste usuário.').setRequired(false)
    ),

  restricted: true,

  async execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.channel;
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      await interaction.reply({
        embeds: [errorEmbed('Este comando só pode ser usado em um canal de texto de servidor.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!interaction.appPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({
        embeds: [errorEmbed('Eu não tenho a permissão **Gerenciar Mensagens** neste canal.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const amount = interaction.options.getInteger('quantidade', true);
    const target = interaction.options.getUser('usuario');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let deleted = 0;

    if (target) {
      // Pagina o histórico coletando só as mensagens do alvo, até atingir `amount`.
      const collected: Message[] = [];
      let lastId: string | undefined;
      for (let page = 0; page < MAX_FETCH_PAGES && collected.length < amount; page++) {
        const batch = await channel.messages.fetch({ limit: 100, before: lastId });
        if (batch.size === 0) break;
        for (const msg of batch.values()) {
          if (msg.author.id === target.id) {
            collected.push(msg);
            if (collected.length >= amount) break;
          }
        }
        lastId = batch.last()?.id;
        if (batch.size < 100) break; // chegou ao início do canal
      }

      for (let i = 0; i < collected.length; i += BATCH) {
        const result = await channel.bulkDelete(collected.slice(i, i + BATCH), true);
        deleted += result.size;
      }
    } else {
      // Apaga em lotes de 100 até atingir `amount` ou esgotar o que é apagável.
      let remaining = amount;
      while (remaining > 0) {
        const take = Math.min(BATCH, remaining);
        const result = await channel.bulkDelete(take, true);
        deleted += result.size;
        if (result.size < take) break; // canal esvaziou ou bateu no limite de 14 dias
        remaining -= result.size;
      }
    }

    const scope = target ? ` de ${target}` : '';
    if (deleted === 0) {
      await interaction.editReply({
        embeds: [errorEmbed('Nenhuma mensagem foi apagada (podem ter mais de 14 dias).')]
      });
      return;
    }

    const note = deleted < amount ? '\n*(o restante pode ter mais de 14 dias e não pode ser apagado em massa.)*' : '';
    await interaction.editReply({ embeds: [successEmbed(`${deleted} mensagem(ns)${scope} apagada(s).${note}`)] });
  }
};

export default command;

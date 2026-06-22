import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../interfaces/Command';
import { errorEmbed } from '../../utils/embeds';
import { economyRepository } from '../../repositories/economy.repository';
import { CURRENCY } from '../../services/economy.service';
import { spinSlots } from '../../services/casino.service';

const MIN_BET = 10;
const n = (v: number) => v.toLocaleString('pt-BR');

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('Aposta kurocoins na caça-níquel. 🎰')
    .addIntegerOption((opt) =>
      opt.setName('aposta').setDescription(`Quanto apostar (mínimo ${MIN_BET}).`).setMinValue(MIN_BET).setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ embeds: [errorEmbed('Este comando só pode ser usado em um servidor.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const aposta = interaction.options.getInteger('aposta', true);

    // Debita a aposta de forma atômica (não cobra sem saldo).
    const { ok, balance } = await economyRepository.spend(interaction.guildId, interaction.user.id, aposta);
    if (!ok) {
      await interaction.reply({
        embeds: [errorEmbed(`Saldo insuficiente. Você tem **${n(balance)}** ${CURRENCY} e tentou apostar **${n(aposta)}**.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const { reels, multiplier } = spinSlots();
    const payout = Math.floor(aposta * multiplier);

    let finalBalance = balance;
    if (payout > 0) {
      const wallet = await economyRepository.giveBalance(interaction.guildId, interaction.user.id, payout);
      finalBalance = wallet.balance;
    }

    const net = payout - aposta;
    const won = net > 0;
    const drew = payout > 0 && net <= 0; // recuperou parte (par com multiplicador baixo)

    const embed = new EmbedBuilder()
      .setColor(won ? 0x2ecc71 : drew ? 0xf1c40f : 0xe74c3c)
      .setTitle('🎰 Caça-níquel')
      .setDescription(
        `## ▶️ ${reels.join('  ')} ◀️\n\n` +
          (payout > 0
            ? won
              ? `🎉 Você **ganhou** ${n(net)} ${CURRENCY}! *(recebeu ${n(payout)} de uma aposta de ${n(aposta)})*`
              : `😬 Quase! Você recuperou ${n(payout)} de ${n(aposta)} ${CURRENCY}.`
            : `💸 Você **perdeu** ${n(aposta)} ${CURRENCY}. Mais sorte na próxima!`)
      )
      .addFields({ name: '💰 Saldo', value: `**${n(finalBalance)}** ${CURRENCY}`, inline: true })
      .setFooter({ text: `Jogado por ${interaction.user.username}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;

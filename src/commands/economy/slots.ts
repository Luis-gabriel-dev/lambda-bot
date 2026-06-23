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

    // Quantas vezes a pessoa já jogou define a chance (alta no começo, despenca depois).
    const playNumber = await economyRepository.bumpSlotsPlayed(interaction.guildId, interaction.user.id);
    const { reels, multiplier } = spinSlots(playNumber - 1);
    const payout = Math.floor(aposta * multiplier);

    let finalBalance = balance;
    if (payout > 0) {
      const wallet = await economyRepository.giveBalance(interaction.guildId, interaction.user.id, payout);
      finalBalance = wallet.balance;
    }

    const net = payout - aposta;
    const won = payout > 0;

    // GIF e auto-deleção configuráveis (/economia slotgif, /economia slotsautodeletar).
    const [gifs, config] = await Promise.all([
      economyRepository.listSlotGifs(interaction.guildId),
      economyRepository.getConfig(interaction.guildId)
    ]);
    const gif = gifs.length > 0 ? gifs[Math.floor(Math.random() * gifs.length)]! : null;

    const embed = new EmbedBuilder()
      .setColor(won ? 0x2ecc71 : 0xe74c3c)
      .setTitle('Jogo de apostas do Kuro ⚫')
      .setDescription(
        `## ${reels.join('  ')}\n\n` +
          (won
            ? `Você **ganhou** ${n(net)} ${CURRENCY} 🎉! *(recebeu ${n(payout)} de uma aposta de ${n(aposta)})*`
            : `Você **perdeu** ${n(aposta)} ${CURRENCY}. Mais sorte na próxima! 💸`)
      )
      .addFields({ name: 'Saldo 💰', value: `**${n(finalBalance)}** ${CURRENCY}`, inline: true })
      .setFooter({ text: `Jogado por ${interaction.user.username}` })
      .setTimestamp();
    if (gif) embed.setImage(gif);

    await interaction.reply({ embeds: [embed] });

    // Apaga a mensagem depois do tempo configurado (se houver).
    if (config?.slotsDeleteMs && config.slotsDeleteMs > 0) {
      setTimeout(() => void interaction.deleteReply().catch(() => undefined), config.slotsDeleteMs);
    }
  }
};

export default command;

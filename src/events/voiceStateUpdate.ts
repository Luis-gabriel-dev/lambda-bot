import { Client, EmbedBuilder } from 'discord.js';
import { Event } from '../interfaces/Event';
import { Palette } from '../utils/embeds';
import { sendLog } from '../services/log.service';

const event: Event<'voiceStateUpdate'> = {
  name: 'voiceStateUpdate',
  async execute(_client: Client, oldState, newState) {
    const member = newState.member ?? oldState.member;
    if (!member) return;

    const oldId = oldState.channelId;
    const newId = newState.channelId;
    const who = `${member.user} \`${member.user.tag}\``;

    // -------- Mudança de canal: entrar / sair / mudar de call --------
    if (oldId !== newId) {
      const embed = new EmbedBuilder().setThumbnail(member.user.displayAvatarURL({ size: 256 })).setTimestamp();

      if (!oldId && newId) {
        embed
          .setColor(Palette.success)
          .setTitle('🔊 Entrou em call')
          .addFields({ name: 'Usuário', value: who }, { name: 'Canal', value: `<#${newId}>` });
      } else if (oldId && !newId) {
        embed
          .setColor(Palette.warning)
          .setTitle('🔇 Saiu da call')
          .addFields({ name: 'Usuário', value: who }, { name: 'Canal', value: `<#${oldId}>` });
      } else if (oldId && newId) {
        embed
          .setColor(Palette.info)
          .setTitle('🔀 Mudou de call')
          .addFields(
            { name: 'Usuário', value: who },
            { name: 'De', value: `<#${oldId}>`, inline: true },
            { name: 'Para', value: `<#${newId}>`, inline: true }
          );
      }

      await sendLog(newState.guild, 'calls', embed);
      return;
    }

    // -------- Mesmo canal: mic / fone ligados ou desligados --------
    if (!newId) return;

    const changes: string[] = [];
    let anyOff = false;
    let anyOn = false;

    // Deafen (fone) — também muta o mic, então tem prioridade para evitar log duplicado.
    const deafChanged = oldState.selfDeaf !== newState.selfDeaf;
    if (deafChanged) {
      if (newState.selfDeaf) {
        changes.push('🎧 Desativou o fone de ouvido');
        anyOff = true;
      } else {
        changes.push('🎧 Ativou o fone de ouvido');
        anyOn = true;
      }
    }

    // Mute (mic) — ignorado se foi só efeito colateral do deafen.
    if (!deafChanged && oldState.selfMute !== newState.selfMute) {
      if (newState.selfMute) {
        changes.push('🎙️ Desligou o microfone');
        anyOff = true;
      } else {
        changes.push('🎙️ Ligou o microfone');
        anyOn = true;
      }
    }

    // Mute/deafen aplicados por um moderador (server mute/deaf) — toggles independentes.
    if (oldState.serverMute !== newState.serverMute) {
      if (newState.serverMute) {
        changes.push('🔇 Mutado por um moderador');
        anyOff = true;
      } else {
        changes.push('🔊 Desmutado por um moderador');
        anyOn = true;
      }
    }
    if (oldState.serverDeaf !== newState.serverDeaf) {
      if (newState.serverDeaf) {
        changes.push('🎧 Ensurdecido por um moderador');
        anyOff = true;
      } else {
        changes.push('🎧 Desensurdecido por um moderador');
        anyOn = true;
      }
    }

    if (changes.length === 0) return; // outras mudanças (stream/vídeo) são ignoradas

    const color = anyOff && !anyOn ? Palette.warning : anyOn && !anyOff ? Palette.success : Palette.info;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('🎚️ Estado de voz')
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .setDescription(`${who}\n${changes.join('\n')}`)
      .addFields({ name: 'Canal', value: `<#${newId}>` })
      .setTimestamp();

    await sendLog(newState.guild, 'calls', embed);
  }
};

export default event;

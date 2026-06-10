import { Collection } from 'discord.js';
import { Command as BotCommand } from '../interfaces/Command';
import { Component as BotComponent } from '../interfaces/Component';

// Estende o Client do discord.js com nossas coleções de comandos e componentes,
// para que interaction.client.commands / .components fiquem tipados em qualquer lugar.
// Os imports são aliasados porque o discord.js já exporta um tipo `Component`.
declare module 'discord.js' {
  interface Client {
    commands: Collection<string, BotCommand>;
    components: Collection<string, BotComponent>;
  }
}

export {};

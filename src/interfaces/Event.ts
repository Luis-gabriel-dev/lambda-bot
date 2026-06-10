import { Client, ClientEvents } from 'discord.js';

/**
 * Contrato de um evento do gateway. Cada arquivo em events/ exporta um default deste tipo.
 * O client é passado como primeiro argumento, seguido dos argumentos nativos do evento.
 */
export interface Event<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute(client: Client, ...args: ClientEvents[K]): Promise<void> | void;
}

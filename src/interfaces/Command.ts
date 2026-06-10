import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder
} from 'discord.js';
import { Component } from './Component';

/** Builder de slash command em qualquer um de seus formatos (com/sem opções/subcomandos). */
export type CommandData =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder;

/** Contrato de um comando slash. Cada arquivo em commands/ exporta um default deste tipo. */
export interface Command {
  /** Definição do slash command (nome, descrição, opções). */
  data: CommandData;
  /**
   * Comando restrito: só o dono ou membros com um cargo autorizado (via /permissao)
   * podem usar. Enquanto nenhum cargo for configurado no servidor, só o dono usa.
   */
  restricted?: boolean;
  /** Handlers de botões/modais/menus que pertencem a este comando (roteados por prefixo do customId). */
  components?: Component[];
  /** Lógica executada quando o comando é chamado. */
  execute(interaction: ChatInputCommandInteraction): Promise<void> | void;
}

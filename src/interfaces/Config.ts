/** Configuração validada do bot, carregada a partir do .env em core/config.ts. */
export interface Config {
  /** Token do bot (Developer Portal → Bot → Reset Token). */
  token: string;
  /** Application ID (Developer Portal → General Information). */
  clientId: string;
  /** ID do servidor onde os comandos de guild são registrados. */
  guildId: string;
  /** ID do dono do bot — bypassa todas as checagens de permissão. */
  ownerId: string;
}

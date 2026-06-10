import 'dotenv/config';
import { Config } from '../interfaces/Config';

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Variável de ambiente ausente: ${name}. Verifique seu arquivo .env.`);
  }
  return value;
}

/** Configuração validada na inicialização — falha cedo e com mensagem clara se faltar algo. */
export const config: Config = {
  token: required('DISCORD_TOKEN'),
  clientId: required('CLIENT_ID'),
  guildId: required('GUILD_ID'),
  ownerId: required('OWNER_ID')
};

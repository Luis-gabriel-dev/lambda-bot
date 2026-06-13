import { ChatInputCommandInteraction, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { config } from '../core/config';
import { Command } from '../interfaces/Command';
import { commandPermissionRepository } from '../repositories/commandPermission.repository';

/** É o dono do bot? (bypassa todas as checagens) */
export function isOwner(userId: string): boolean {
  return userId === config.ownerId;
}

/** Pode mexer em configurações do servidor? (dono do bot ou administrador) */
export function isAdminOrOwner(userId: string, memberPermissions: Readonly<PermissionsBitField> | null): boolean {
  return isOwner(userId) || (memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false);
}

export interface AccessResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Resolve se quem chamou pode executar o comando:
 * 1. Dono → sempre permitido.
 * 2. Comando não-restrito → permitido para todos.
 * 3. Comando restrito → exige um cargo configurado via /permissao. Sem cargo
 *    configurado no servidor, ninguém além do dono pode usar.
 */
export async function resolveAccess(
  interaction: ChatInputCommandInteraction,
  command: Command
): Promise<AccessResult> {
  if (isOwner(interaction.user.id)) return { allowed: true };
  if (!command.restricted) return { allowed: true };

  if (!interaction.inCachedGuild()) {
    return { allowed: false, reason: 'Este comando só pode ser usado em um servidor.' };
  }

  const denied = 'Você não tem permissão para usar este comando.';
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;

  const roleIds = await commandPermissionRepository.getRoleIds(interaction.guildId, command.data.name);
  if (roleIds.length === 0) {
    // Para o usuário comum é só falta de permissão; para o admin, mostramos a dica de como liberar.
    return {
      allowed: false,
      reason: isAdmin
        ? 'Este comando ainda não foi liberado para nenhum cargo. Use `/permissao add` para autorizar um cargo.'
        : denied
    };
  }

  if (!interaction.member.roles.cache.hasAny(...roleIds)) {
    return { allowed: false, reason: denied };
  }

  return { allowed: true };
}

import { GuildMember } from 'discord.js';

/**
 * Valida se `executor` pode moderar `target` pela hierarquia de cargos
 * (não considera as permissões do bot — isso é checado via member.bannable/kickable).
 *
 * Retorna uma mensagem de erro (em PT) se a ação não for permitida, ou null se estiver tudo certo.
 */
export function checkHierarchy(executor: GuildMember, target: GuildMember): string | null {
  if (target.id === executor.id) {
    return 'Você não pode usar este comando em si mesmo.';
  }
  if (target.id === executor.guild.ownerId) {
    return 'Não é possível moderar o dono do servidor.';
  }
  const executorIsOwner = executor.id === executor.guild.ownerId;
  if (!executorIsOwner && executor.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
    return 'Esse membro tem um cargo igual ou superior ao seu.';
  }
  return null;
}

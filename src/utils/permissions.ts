import { PermissionResolvable, PermissionsBitField } from 'discord.js';

/** Nomes legíveis das permissões que estão faltando (para mensagens de erro). */
export function missingPermissionNames(
  current: Readonly<PermissionsBitField> | null,
  required: PermissionResolvable[]
): string[] {
  if (!current) return required.map((p) => new PermissionsBitField(p).toArray().join(', '));
  return required
    .filter((p) => !current.has(p))
    .map((p) => new PermissionsBitField(p).toArray().join(', '));
}

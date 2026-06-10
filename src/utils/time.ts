const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000
};

/**
 * Converte uma string de duração ("10s", "5m", "2h", "1d") em milissegundos.
 * Retorna null se o formato for inválido.
 */
export function parseDuration(input: string): number | null {
  const match = /^(\d+)\s*(s|m|h|d)$/i.exec(input.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  return amount * UNIT_MS[unit]!;
}

/** Formata milissegundos em texto legível (ex.: "1d 2h 30m"). */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '0s';
  const parts: string[] = [];
  const days = Math.floor(ms / UNIT_MS.d!);
  const hours = Math.floor((ms % UNIT_MS.d!) / UNIT_MS.h!);
  const minutes = Math.floor((ms % UNIT_MS.h!) / UNIT_MS.m!);
  const seconds = Math.floor((ms % UNIT_MS.m!) / UNIT_MS.s!);
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds) parts.push(`${seconds}s`);
  return parts.join(' ');
}

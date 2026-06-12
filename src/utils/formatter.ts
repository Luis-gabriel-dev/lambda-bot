type TimestampStyle = 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R';

/** Gera um timestamp dinâmico do Discord (ex.: `<t:1700000000:R>`). */
export function discordTimestamp(date: Date, style: TimestampStyle = 'R'): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

/** Trunca um texto adicionando reticências, respeitando o limite informado. */
export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Formata uma data no fuso de Brasília como "DD/MM/AAAA às HH:MM:SS". */
export function formatBrDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} às ${get('hour')}:${get('minute')}:${get('second')}`;
}

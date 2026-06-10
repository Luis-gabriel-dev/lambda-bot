type TimestampStyle = 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R';

/** Gera um timestamp dinâmico do Discord (ex.: `<t:1700000000:R>`). */
export function discordTimestamp(date: Date, style: TimestampStyle = 'R'): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

/** Trunca um texto adicionando reticências, respeitando o limite informado. */
export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

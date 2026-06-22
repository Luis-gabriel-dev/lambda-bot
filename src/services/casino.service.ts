/**
 * Lógica dos jogos de aposta (kurocoins). Sem estado/banco aqui — só o "motor"
 * dos jogos; o dinheiro é tratado nos comandos via economyRepository.
 */

// Símbolos da caça-níquel: maior weight = mais comum; payout = multiplicador da TRINCA (3 iguais).
// Números calibrados pra casa levar uma leve vantagem — fáceis de ajustar aqui.
export interface SlotSymbol {
  emoji: string;
  weight: number;
  payout: number;
}

export const SLOT_SYMBOLS: SlotSymbol[] = [
  { emoji: '🍒', weight: 30, payout: 5 },
  { emoji: '🍋', weight: 25, payout: 8 },
  { emoji: '🔔', weight: 20, payout: 12 },
  { emoji: '⭐', weight: 13, payout: 20 },
  { emoji: '💎', weight: 8, payout: 40 },
  { emoji: '7️⃣', weight: 4, payout: 100 }
];

/** Multiplicador quando saem exatamente DOIS iguais (consolação). */
export const SLOT_PAIR_MULTIPLIER = 1.2;

function pickSymbol(): SlotSymbol {
  const total = SLOT_SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * total;
  for (const sym of SLOT_SYMBOLS) {
    r -= sym.weight;
    if (r < 0) return sym;
  }
  return SLOT_SYMBOLS[0]!;
}

export interface SlotResult {
  reels: [string, string, string];
  /** Multiplicador da aposta (0 = perdeu, ex.: 1.2 par, 5+ trinca). */
  multiplier: number;
}

/** Gira a caça-níquel e devolve os 3 símbolos + o multiplicador da aposta. */
export function spinSlots(): SlotResult {
  const picks = [pickSymbol(), pickSymbol(), pickSymbol()];
  const [a, b, c] = picks.map((p) => p.emoji) as [string, string, string];

  let multiplier = 0;
  if (a === b && b === c) {
    multiplier = picks[0]!.payout; // trinca
  } else if (a === b || b === c || a === c) {
    multiplier = SLOT_PAIR_MULTIPLIER; // par
  }

  return { reels: [a, b, c], multiplier };
}

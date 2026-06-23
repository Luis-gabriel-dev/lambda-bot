/**
 * Caça-níquel "viciante": a chance de vitória é ALTA no começo e DESPENCA depois
 * de ~8 jogadas (a contagem por jogador fica no banco — Wallet.slotsPlayed).
 * Assim a pessoa ganha cedo (fisga) e vira sumidouro depois. Números fáceis de ajustar aqui.
 */

const SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'];

function randomSymbol(): string {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]!;
}

/**
 * Chance de vitória conforme quantas vezes a pessoa JÁ jogou antes desta.
 * Começo: ~70% caindo até ~45% nas primeiras 8 jogadas. Depois: 1% a 10% (raro).
 */
export function slotsWinChance(playsBefore: number): number {
  if (playsBefore < 8) return Math.max(0.45, 0.7 - playsBefore * 0.035);
  return 0.01 + Math.random() * 0.09;
}

/** Multiplicador de uma vitória — na maioria pequeno, raramente alto. */
function winMultiplier(): number {
  const r = Math.random();
  if (r < 0.7) return 1.5;
  if (r < 0.92) return 2.5;
  if (r < 0.98) return 5;
  return 12;
}

export interface SlotResult {
  reels: [string, string, string];
  /** Multiplicador da aposta (0 = perdeu). */
  multiplier: number;
}

/** Gira a caça-níquel. A vitória é decidida pela chance (que cai com o tempo). */
export function spinSlots(playsBefore: number): SlotResult {
  const win = Math.random() < slotsWinChance(playsBefore);

  if (!win) {
    // Três símbolos diferentes (derrota visível).
    const a = randomSymbol();
    let b = randomSymbol();
    while (b === a) b = randomSymbol();
    let c = randomSymbol();
    while (c === a || c === b) c = randomSymbol();
    return { reels: [a, b, c], multiplier: 0 };
  }

  const multiplier = winMultiplier();

  if (multiplier <= 1.5) {
    // Par (dois iguais) — vitória pequena.
    const s = randomSymbol();
    let o = randomSymbol();
    while (o === s) o = randomSymbol();
    const i = Math.floor(Math.random() * 3); // posição aleatória do símbolo diferente
    const reels: [string, string, string] = [i === 0 ? o : s, i === 1 ? o : s, i === 2 ? o : s];
    return { reels, multiplier };
  }

  // Trinca — vitória maior.
  const s = randomSymbol();
  return { reels: [s, s, s], multiplier };
}

// Tipos de log do bot (as KEYS precisam bater com LOG_TYPES do bot em src/services/log.service.ts).
export const LOG_TYPES: { key: string; label: string }[] = [
  { key: "punicoes", label: "Punishments" },
  { key: "bans", label: "Bans" },
  { key: "entrada", label: "Member joins" },
  { key: "saida", label: "Member leaves" },
  { key: "mensagens", label: "Messages" },
  { key: "calls", label: "Voice / calls" },
  { key: "tickets", label: "Tickets" },
  { key: "audit", label: "Message audit" },
  { key: "moderacao", label: "Moderation" },
  { key: "cargos", label: "Roles" },
  { key: "servidor", label: "Server (emojis, channels…)" },
  { key: "instagram", label: "Instagram" },
  { key: "parcerias", label: "Partnerships" },
];

export const LOG_TYPE_KEYS = LOG_TYPES.map((t) => t.key);

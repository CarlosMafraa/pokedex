/**
 * Borda do hexágono de status. O máximo absoluto é 255 (HP da Blissey), mas
 * quase todos os stats ficam entre 40 e 130: com 255 tudo parecia "fraco".
 * Pouquíssimos passam de 180 — esses encostam na borda, com o número exato.
 */
export const HEXAGON_SCALE = 180;

/** Ordem dos eixos no sentido horário a partir do topo, como nos jogos. */
export const STAT_ORDER = [
  'hp',
  'attack',
  'defense',
  'speed',
  'special-defense',
  'special-attack',
] as const;

/** Rótulos curtos em pt-BR para os stats. */
export const STAT_LABELS: Record<string, string> = {
  hp: 'HP',
  attack: 'Ataque',
  defense: 'Defesa',
  'special-attack': 'Ataque Esp.',
  'special-defense': 'Defesa Esp.',
  speed: 'Velocidade',
};

/** Rótulos curtos para as pontas do hexágono (o espaço lateral é apertado). */
export const STAT_SHORT_LABELS: Record<string, string> = {
  ...STAT_LABELS,
  'special-attack': 'Atq. Esp.',
  'special-defense': 'Def. Esp.',
};

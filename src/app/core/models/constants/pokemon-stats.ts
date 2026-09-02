/** Maior valor base possível de um status (HP da Blissey = 255). */
export const MAX_BASE_STAT = 255;

/** Cores das barras de status, na ordem em que a PokéAPI devolve os stats. */
export const STAT_COLORS: string[] = [
  '#ff5959', // hp
  '#f5ac78', // attack
  '#fae078', // defense
  '#9db7f5', // special-attack
  '#a7db8d', // special-defense
  '#fa92b2', // speed
];

/** Rótulos curtos em pt-BR para os stats. */
export const STAT_LABELS: Record<string, string> = {
  hp: 'HP',
  attack: 'Ataque',
  defense: 'Defesa',
  'special-attack': 'Ataque Esp.',
  'special-defense': 'Defesa Esp.',
  speed: 'Velocidade',
};

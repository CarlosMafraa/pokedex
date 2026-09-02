export interface Generation {
  label: string;
  /** Primeiro número nacional da geração. */
  start: number;
  /** Último número nacional da geração. */
  end: number;
}

/** Faixas do número nacional por geração (Gen I–IX). */
export const GENERATIONS: readonly Generation[] = [
  { label: 'Geração I', start: 1, end: 151 },
  { label: 'Geração II', start: 152, end: 251 },
  { label: 'Geração III', start: 252, end: 386 },
  { label: 'Geração IV', start: 387, end: 493 },
  { label: 'Geração V', start: 494, end: 649 },
  { label: 'Geração VI', start: 650, end: 721 },
  { label: 'Geração VII', start: 722, end: 809 },
  { label: 'Geração VIII', start: 810, end: 905 },
  { label: 'Geração IX', start: 906, end: 1025 },
];

export function generationOf(id: number): Generation | undefined {
  return GENERATIONS.find((gen) => id >= gen.start && id <= gen.end);
}

export function generationSize(gen: Generation): number {
  return gen.end - gen.start + 1;
}

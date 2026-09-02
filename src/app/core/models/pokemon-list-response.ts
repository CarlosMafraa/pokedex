import { PokemonListItem } from './pokemon-list-item';

export interface PokemonListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: PokemonListItem[];
}

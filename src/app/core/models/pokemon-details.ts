import { PokemonListItem } from './pokemon-list-item';
import { PokemonAbility } from './pokemon-ability';
import { PokemonStat } from './pokemon-stat';
import { PokemonType } from './pokemon-type';

export interface PokemonDetails {
  id: number;
  name: string;
  height: number;
  weight: number;
  base_experience: number;
  species: PokemonListItem;
  abilities: PokemonAbility[];
  stats: PokemonStat[];
  types: PokemonType[];
}

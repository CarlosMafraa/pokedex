import { PokemonListItem } from './pokemon-list-item';

/** Resposta de `/type/{nome}`: todos os Pokémon daquele tipo numa só requisição. */
export interface PokemonTypeResponse {
  pokemon: {
    slot: number;
    pokemon: PokemonListItem;
  }[];
}

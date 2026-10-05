/**
 * Item leve da grade da Pokédex, derivado da resposta de lista da PokéAPI
 * sem nenhuma requisição extra: o id sai da própria URL e a arte é montada
 * a partir dele. Os tipos vêm de um mapa embutido no app
 * (`assets/data/pokemon-types.json`), sem requisição por Pokémon.
 */
export interface PokemonListEntry {
  id: number;
  name: string;
  artworkUrl: string;
  /** Arte reduzida para o card (ver `environment.thumbnailProxyUrl`). */
  thumbnailUrl: string;
  types?: string[];
}

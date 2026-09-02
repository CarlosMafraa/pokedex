/**
 * Item leve da grade da Pokédex, derivado da resposta de lista da PokéAPI
 * sem nenhuma requisição extra: o id sai da própria URL e a arte é montada
 * a partir dele. Os tipos são preenchidos de forma preguiçosa quando o card
 * entra na viewport.
 */
export interface PokemonListEntry {
  id: number;
  name: string;
  artworkUrl: string;
  animatedSpriteUrl: string;
  types?: string[];
}

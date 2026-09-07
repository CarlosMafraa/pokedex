export const environment = {
  production: false,
  pokeApiBaseUrl: 'https://pokeapi.co/api/v2',
  /**
   * Artes e sprites vêm do repositório PokeAPI/sprites servido pelo jsDelivr
   * (`/gh/`), que é feito para produção: sem rate limit, cache permanente e
   * failover — ao contrário de `raw.githubusercontent.com`, que tem limites.
   * Usamos `@master` porque o repo não tem releases; o jsDelivr cacheia refs de
   * branch por ~12 h, o que é aceitável para assets cujo caminho quase não muda.
   */
  artworkBaseUrl:
    'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork',
  animatedSpriteBaseUrl:
    'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/versions/generation-v/black-white/animated',
};

export const environment = {
  production: false,
  pokeApiBaseUrl: 'https://pokeapi.co/api/v2',
  /**
   * Artes e sprites vêm do repositório PokeAPI/sprites servido pelo jsDelivr
   * (`/gh/`), que é feito para produção: sem rate limit, cache permanente e
   * failover — ao contrário de `raw.githubusercontent.com`, que tem limites.
   * Fixado num commit (o repo não tem releases): com um sha, o jsDelivr serve
   * com cache de 1 ano; com `@master` o cache era de ~12 h e o Lighthouse
   * acusava "cache lifetimes" curtos. Para atualizar, troque o sha.
   */
  artworkBaseUrl:
    'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@a3a1432e688ea028f12c51371d5253037cb9f17b/sprites/pokemon/other/official-artwork',
  /**
   * Miniaturas dos cards: a arte oficial tem ~200 KB (475 px) para ser exibida
   * em 96 px. O wsrv.nl redimensiona para 192 px (nítido em tela 2x) em WebP,
   * ~9 KB, com cache de 1 ano. Se falhar, o card cai para a arte original.
   */
  thumbnailProxyUrl: 'https://wsrv.nl/',
  animatedSpriteBaseUrl:
    'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@a3a1432e688ea028f12c51371d5253037cb9f17b/sprites/pokemon/versions/generation-v/black-white/animated',
};

export const environment = {
  production: true,
  pokeApiBaseUrl: 'https://pokeapi.co/api/v2',
  /** Ver nota em `environment.ts` sobre o jsDelivr `/gh/` e o commit fixado. */
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

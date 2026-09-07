/**
 * Contraparte do public/404.html (padrão "spa-github-pages"): o GitHub Pages
 * serve o 404.html para rotas profundas; ele redireciona para `/?/rota` e este
 * script reconstrói a URL original antes do Angular inicializar.
 *
 * Arquivo externo (não inline) para permitir uma CSP estrita: `script-src 'self'`.
 */
(function () {
  var l = window.location;
  if (l.search[1] === '/') {
    var decoded = l.search
      .slice(1)
      .split('&')
      .map(function (s) {
        return s.replace(/~and~/g, '&');
      })
      .join('?');
    window.history.replaceState(null, null, l.pathname.slice(0, -1) + decoded + l.hash);
  }
})();

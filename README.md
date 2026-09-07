# Pokédex

[![Deploy to GitHub Pages](https://github.com/CarlosMafraa/pokedex/actions/workflows/deploy.yml/badge.svg)](https://github.com/CarlosMafraa/pokedex/actions/workflows/deploy.yml)
[![CI](https://github.com/CarlosMafraa/pokedex/actions/workflows/ci.yml/badge.svg)](https://github.com/CarlosMafraa/pokedex/actions/workflows/ci.yml)

Pokédex em Angular 20 (standalone + signals) consumindo a [PokéAPI](https://pokeapi.co/).
Permite navegar por todas as gerações, buscar por nome/número, filtrar por tipo e abrir
o detalhe de cada Pokémon (arte oficial, descrição, geração, status).

🔗 **Demo:** https://carlosmafraa.github.io/pokedex/

## ✨ Recursos

- Grade com cores por tipo, arte oficial e sprite animado no hover
- Scroll infinito por todas as gerações (não só os 151)
- Busca por nome/número + filtro por tipo (em tempo real sobre a lista carregada)
- Detalhe em rota própria (`/pokemon/:nome`) — link compartilhável
- Modo claro/escuro persistente (segue o sistema por padrão)
- Cache em IndexedDB (funciona offline após a primeira visita; em falha de rede
  serve o último dado conhecido — *stale-if-error*)
- Fonte auto-hospedada (`@fontsource`), CDN de imagens no jsDelivr, CSP restrita

## 🛠️ Stack

- **Angular** 20 · standalone components, signals, control flow
- **PrimeNG** 20 + tema Aura · **PrimeIcons**
- **TypeScript** 5.9 · **RxJS** 7
- **ESLint** (angular-eslint) + **Prettier**
- **Karma/Jasmine** (unitários) · **Playwright** (e2e)

## ⚙️ Pré-requisitos

- **Node** 22.12+ (ou 20.19+ / 24+) — versão fixada em [`.nvmrc`](.nvmrc) (`nvm use`)
- **npm** 10+

## 🚀 Começando

```bash
git clone https://github.com/CarlosMafraa/pokedex.git
cd pokedex
npm install
npm start           # http://localhost:4200
```

## 📜 Scripts

| Script | Descrição |
|---|---|
| `npm start` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (`dist/pokedex`) |
| `npm test` | Testes unitários (Karma, modo watch) |
| `npm run test:ci` | Unitários headless com cobertura |
| `npm run e2e` | Testes end-to-end (Playwright) · `e2e:ui` abre o runner |
| `npm run lint` | ESLint |
| `npm run format` | Prettier (escreve) · `format:check` só valida |

## 📂 Estrutura

```
src/app/
  core/       services (API + cache + store + tema), models, constantes
  features/   pokedex (lista), pokemon-card, pokemon-detail (dialog em rota)
  shared/     pipes, directives
e2e/          testes Playwright
```

## 🌐 Deploy

Push em `master` dispara o workflow [`deploy.yml`](.github/workflows/deploy.yml), que
faz o build com `baseHref=/pokedex/` (mesmo nome do repositório) e publica em
GitHub Pages (`actions/deploy-pages`). O [`public/404.html`](public/404.html) +
[`public/spa-redirect.js`](public/spa-redirect.js) reconstroem rotas profundas
(padrão *spa-github-pages*).

> **Ao renomear o repositório ou usar domínio próprio**, ajuste em conjunto:
> `baseHref` em [`angular.json`](angular.json), o `pathSegmentsToKeep` em
> `public/404.html`, e as URLs `og:image`/`og:url` em [`src/index.html`](src/index.html).

## ⚠️ Limitações conhecidas

- **Dados de geração estáticos.** As faixas de número nacional e o teto `#1025`
  ficam em [`pokemon-generations.ts`](src/app/core/models/constants/pokemon-generations.ts).
  Pokémon de gerações futuras aparecem sob o rótulo "Outros" até a constante ser
  atualizada — falha segura, não quebra a navegação.
- **`content-visibility` na grade.** Em engines sem suporte (Safari &lt; 18) o
  atributo é ignorado sem prejuízo visual; nesses browsers o Ctrl+F pode não
  encontrar cards ainda não renderizados.
- **PokéAPI / jsDelivr** não têm SLA. O app mitiga com cache de 24 h, *retry*,
  timeout de 15 s e *stale-if-error*, mas uma indisponibilidade prolongada de
  ambos deixa a Pokédex sem dados novos.

## 🙏 Créditos

Dados e sprites de [PokéAPI](https://pokeapi.co/) e do repositório
[PokeAPI/sprites](https://github.com/PokeAPI/sprites). Pokémon © Nintendo / Game Freak /
The Pokémon Company — projeto sem fins lucrativos, para fins de estudo.

## 👤 Autor

**Carlos Mafra** — [carlosfgmafra@gmail.com](mailto:carlosfgmafra@gmail.com)

## 📄 Licença

[MIT](LICENSE)

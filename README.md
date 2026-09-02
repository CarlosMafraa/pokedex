# Pokédex

[![Deploy to GitHub Pages](https://github.com/CarlosMafraa/pokedex/actions/workflows/deploy.yml/badge.svg)](https://github.com/CarlosMafraa/pokedex/actions/workflows/deploy.yml)
[![CI](https://github.com/CarlosMafraa/pokedex/actions/workflows/ci.yml/badge.svg)](https://github.com/CarlosMafraa/pokedex/actions/workflows/ci.yml)

Pokédex em Angular 19 (standalone + signals) consumindo a [PokéAPI](https://pokeapi.co/).
Permite navegar por todas as gerações, buscar por nome/número, filtrar por tipo e abrir
o detalhe de cada Pokémon (arte oficial, descrição, geração, status).

🔗 **Demo:** https://carlosmafraa.github.io/pokedex/

## ✨ Recursos

- Grade com cores por tipo, arte oficial e sprite animado no hover
- Scroll infinito por todas as gerações (não só os 151)
- Busca por nome/número + filtro por tipo (em tempo real sobre a lista carregada)
- Detalhe em rota própria (`/pokemon/:nome`) — link compartilhável
- Modo claro/escuro persistente (segue o sistema por padrão)
- Cache em IndexedDB (funciona offline após a primeira visita)

## 🛠️ Stack

- **Angular** 19 · standalone components, signals, control flow, `@defer`
- **PrimeNG** 19 + tema Aura · **PrimeIcons**
- **TypeScript** 5.7 · **RxJS** 7
- **ESLint** (angular-eslint) + **Prettier**
- **Karma/Jasmine** (unitários) · **Playwright** (e2e)

## ⚙️ Pré-requisitos

- **Node** 22 (LTS) — versão fixada em [`.nvmrc`](.nvmrc) (`nvm use`)
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
GitHub Pages. O [`public/404.html`](public/404.html) + script no `index.html`
reconstroem rotas profundas (padrão *spa-github-pages*).

## 🙏 Créditos

Dados e sprites de [PokéAPI](https://pokeapi.co/) e do repositório
[PokeAPI/sprites](https://github.com/PokeAPI/sprites). Pokémon © Nintendo / Game Freak /
The Pokémon Company — projeto sem fins lucrativos, para fins de estudo.

## 👤 Autor

**Carlos Mafra** — [carlosfgmafra@gmail.com](mailto:carlosfgmafra@gmail.com)

## 📄 Licença

[MIT](LICENSE)

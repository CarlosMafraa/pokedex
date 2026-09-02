import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('@features/pokedex/pokedex.component').then((m) => m.PokedexComponent),
    children: [
      {
        path: 'pokemon/:name',
        loadComponent: () =>
          import('@features/pokemon-detail/pokemon-detail.component').then(
            (m) => m.PokemonDetailComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgOptimizedImage } from '@angular/common';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { MessageService } from 'primeng/api';
import { PokemonStore } from '@core/services/pokemon-store';
import { ThemeService } from '@core/services/theme.service';
import { PokemonCardComponent } from '@features/pokemon-card/pokemon-card.component';
import { InViewportDirective } from '@shared/directives/in-viewport.directive';
import { POKEMON_TYPES, POKEMON_TYPE_LABELS } from '@core/models/constants/pokemon-types';

@Component({
  selector: 'app-pokedex',
  standalone: true,
  imports: [
    RouterOutlet,
    FormsModule,
    NgOptimizedImage,
    Button,
    InputText,
    MultiSelect,
    PokemonCardComponent,
    InViewportDirective,
  ],
  templateUrl: './pokedex.component.html',
  styleUrl: './pokedex.component.scss',
})
export class PokedexComponent implements OnInit {
  readonly store = inject(PokemonStore);
  readonly theme = inject(ThemeService);
  private readonly messages = inject(MessageService);

  readonly query = signal('');
  readonly selectedTypes = signal<string[]>([]);

  readonly typeOptions = POKEMON_TYPES.map((name) => ({
    value: name,
    label: POKEMON_TYPE_LABELS[name],
  }));

  private lastError: string | null = null;
  private readonly typing$ = new Subject<string>();

  constructor() {
    this.typing$.pipe(debounceTime(350), takeUntilDestroyed()).subscribe((value) => {
      void this.store.search(value, { quiet: true });
    });

    effect(() => {
      const error = this.store.error();
      if (error && error !== this.lastError) {
        this.messages.add({
          severity: error === 'not-found' ? 'warn' : 'error',
          summary: error === 'not-found' ? 'Não encontrado' : 'Erro de rede',
          detail:
            error === 'not-found'
              ? 'Nenhum Pokémon com esse nome ou número.'
              : 'Não foi possível falar com a PokéAPI. Tente novamente.',
          life: 4000,
        });
      }
      this.lastError = error;
    });
  }

  ngOnInit(): void {
    if (this.store.entries().length === 0) {
      void this.store.loadFirstPage();
    }
  }

  /** Enter no campo: dispara a busca exata na hora (com feedback de erro). */
  submitSearch(): void {
    void this.store.search(this.query());
  }

  onQueryInput(value: string): void {
    this.query.set(value);
    this.store.setFilterText(value); // filtro local instantâneo
    this.typing$.next(value); // busca exata na API, debounced e silenciosa
  }

  clearSearch(): void {
    this.query.set('');
    this.selectedTypes.set([]);
    this.typing$.next(''); // cancela qualquer busca debounced pendente
    this.store.clearFilters();
  }

  onTypesChange(types: string[]): void {
    this.selectedTypes.set(types);
    this.store.setTypeFilters(types);
  }

  loadMore(): void {
    void this.store.loadMore();
  }
}

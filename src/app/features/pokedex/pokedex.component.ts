import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
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
import { ScreenIntroComponent } from './screen-intro/screen-intro.component';
import { GenerationTabsComponent } from './generation-tabs/generation-tabs.component';
import { PokemonCardComponent } from '@features/pokemon-card/pokemon-card.component';
import { POKEMON_TYPES, POKEMON_TYPE_LABELS } from '@core/models/constants/pokemon-types';

/** Tempo mínimo da pokébola na tela, para a animação ser vista mesmo com cache. */
const INTRO_MIN_MS = 900;
/** Duração das metades da tela se abrindo (ver ScreenIntroComponent). */
const INTRO_OPEN_MS = 900;
/** Quanto tempo os cards ficam entrando em sequência depois de trocar de aba. */
const TAB_REVEAL_MS = 900;

const pad = (n: number) => String(n).padStart(3, '0');

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
    ScreenIntroComponent,
    GenerationTabsComponent,
  ],
  templateUrl: './pokedex.component.html',
  styleUrl: './pokedex.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PokedexComponent implements OnInit {
  readonly store = inject(PokemonStore);
  readonly theme = inject(ThemeService);
  private readonly messages = inject(MessageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Cards entrando em sequência logo após trocar de aba. */
  readonly tabReveal = signal(false);
  private tabRevealTimer: ReturnType<typeof setTimeout> | undefined;

  /** Título da tela: a geração da aba, ou o aviso de que a busca vale para todas. */
  readonly screenTitle = computed(() => {
    if (this.store.searchingAllGenerations()) {
      return 'Busca em todas as gerações';
    }
    const gen = this.store.generation();
    return `${gen.label} · #${pad(gen.start)}–#${pad(gen.end)}`;
  });

  /**
   * Carregamento só dentro da tela: ela começa vermelha com a pokébola, espera a
   * lista chegar (e um tempo mínimo para a animação ser vista) e então se abre,
   * com os cards entrando em sequência. Voltando de outra rota com a lista em
   * memória, pula direto para a grade.
   */
  readonly intro = signal<'closed' | 'opening' | 'done'>(
    this.store.entries().length ? 'done' : 'closed',
  );

  readonly query = signal('');
  readonly selectedTypes = signal<string[]>([]);

  readonly typeOptions = POKEMON_TYPES.map((name) => ({
    value: name,
    label: POKEMON_TYPE_LABELS[name],
  }));

  private lastError: string | null = null;
  private readonly typing$ = new Subject<string>();

  constructor() {
    const startedAt = performance.now();
    let scheduled = false;
    effect(() => {
      const ready =
        !this.store.loading() && (this.store.entries().length > 0 || !!this.store.error());
      if (this.intro() !== 'closed' || !ready || scheduled) {
        return;
      }
      scheduled = true;
      const wait = Math.max(0, INTRO_MIN_MS - (performance.now() - startedAt));
      setTimeout(() => {
        this.intro.set('opening');
        setTimeout(() => this.intro.set('done'), INTRO_OPEN_MS);
      }, wait);
    });

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
    // ?gen=3 abre direto na Geração III (link compartilhado ou F5)
    const gen = Number(this.route.snapshot.queryParamMap.get('gen'));
    if (gen) {
      this.store.setGeneration(gen - 1);
    }
    if (this.store.entries().length === 0) {
      void this.store.loadAll();
    }
  }

  selectGeneration(index: number): void {
    if (index === this.store.genIndex()) {
      return;
    }
    this.store.setGeneration(index);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { gen: index + 1 },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.tabReveal.set(true);
    clearTimeout(this.tabRevealTimer);
    this.tabRevealTimer = setTimeout(() => this.tabReveal.set(false), TAB_REVEAL_MS);
  }

  /** Enter no campo: dispara a busca exata na hora (com feedback de erro). */
  submitSearch(): void {
    void this.store.search(this.query());
  }

  /** Botão "Tentar de novo" da falha de carga inicial. */
  retryInitialLoad(): void {
    void this.store.loadAll();
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
}

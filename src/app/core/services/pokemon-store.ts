import { computed, inject, Injectable, signal } from '@angular/core';
import { PokemonService } from './pokemon.service';
import { PokemonListEntry } from '@core/models/pokemon-list-entry';
import { PokemonDetails } from '@core/models/pokemon-details';
import { PokemonSpecies } from '@core/models/pokemon-species';
import {
  Generation,
  GENERATIONS,
  generationOf,
  generationSize,
} from '@core/models/constants/pokemon-generations';

export type PokedexError = 'network' | 'not-found' | null;

export interface PokedexSection {
  /** Rótulo da geração; `null` quando é uma lista filtrada/buscada (sem divisão). */
  label: string | null;
  entries: PokemonListEntry[];
}

/**
 * Estado central da Pokédex. A navegação carrega uma geração inteira por vez
 * (a primeira são os 151 da Geração I) e a grade é dividida por geração, já
 * que não há outra forma de identificar em que geração o usuário está.
 */
@Injectable({ providedIn: 'root' })
export class PokemonStore {
  private readonly api = inject(PokemonService);

  private readonly _entries = signal<PokemonListEntry[]>([]);
  private readonly _loadedGens = signal(0);
  private readonly _loading = signal(false);
  private readonly _loadingMore = signal(false);
  private readonly _error = signal<PokedexError>(null);
  private readonly _filterText = signal('');
  private readonly _typeFilters = signal<string[]>([]);
  /** Resultado de uma busca exata na API (nome/número fora da lista carregada). */
  private readonly _searchResult = signal<PokemonListEntry | null>(null);

  private readonly _selected = signal<PokemonDetails | undefined>(undefined);
  private readonly _selectedSpecies = signal<PokemonSpecies | undefined>(undefined);
  private readonly _detailLoading = signal(false);

  readonly entries = this._entries.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly loadingMore = this._loadingMore.asReadonly();
  readonly error = this._error.asReadonly();
  readonly filterText = this._filterText.asReadonly();
  readonly typeFilters = this._typeFilters.asReadonly();
  readonly isSearchResult = computed(() => this._searchResult() !== null);
  readonly selected = this._selected.asReadonly();
  readonly selectedSpecies = this._selectedSpecies.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();

  private readonly _hasFilter = computed(
    () => this._filterText().trim() !== '' || this._typeFilters().length > 0,
  );

  /** Lista plana visível (resultado de busca, ou navegação filtrada por texto/tipo). */
  readonly visibleEntries = computed(() => {
    const hit = this._searchResult();
    if (hit) {
      return [hit];
    }
    const term = this._filterText().trim().toLowerCase();
    const types = this._typeFilters();
    return this._entries().filter((entry) => {
      const matchesText =
        !term || entry.name.toLowerCase().includes(term) || String(entry.id) === term;
      const matchesType =
        types.length === 0 || (entry.types ?? []).some((type) => types.includes(type));
      return matchesText && matchesType;
    });
  });

  /** Grade dividida por geração quando navegando; uma seção só quando filtrando/buscando. */
  readonly visibleSections = computed<PokedexSection[]>(() => {
    const flat = this.visibleEntries();
    if (this._searchResult() || this._hasFilter()) {
      return flat.length ? [{ label: null, entries: flat }] : [];
    }
    const sections: PokedexSection[] = [];
    for (const entry of flat) {
      const label = generationOf(entry.id)?.label ?? 'Outros';
      const last = sections.at(-1);
      if (last && last.label === label) {
        last.entries.push(entry);
      } else {
        sections.push({ label, entries: [entry] });
      }
    }
    return sections;
  });

  /** Próxima geração ainda não carregada (para o rótulo do botão "carregar mais"). */
  readonly nextGeneration = computed<Generation | null>(
    () => GENERATIONS[this._loadedGens()] ?? null,
  );

  readonly hasMore = computed(
    () =>
      !this._searchResult() &&
      this._filterText().trim() === '' &&
      this._loadedGens() < GENERATIONS.length,
  );

  readonly isEmpty = computed(
    () => !this._loading() && !this._error() && this.visibleEntries().length === 0,
  );

  async loadFirstPage(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    this._searchResult.set(null);
    try {
      const gen = GENERATIONS[0];
      const page = await this.api.getPage(generationSize(gen), gen.start - 1);
      this._entries.set(page.entries);
      this._loadedGens.set(1);
    } catch {
      this._error.set('network');
      this._entries.set([]);
      this._loadedGens.set(0);
    } finally {
      this._loading.set(false);
    }
  }

  async loadMore(): Promise<void> {
    if (this._loadingMore() || !this.hasMore()) {
      return;
    }
    const gen = GENERATIONS[this._loadedGens()];
    this._loadingMore.set(true);
    try {
      const page = await this.api.getPage(generationSize(gen), gen.start - 1);
      this._entries.update((current) => [...current, ...page.entries]);
      this._loadedGens.update((n) => n + 1);
      if (this._typeFilters().length > 0) {
        void this.hydrateAllTypes();
      }
    } catch {
      this._error.set('network');
    } finally {
      this._loadingMore.set(false);
    }
  }

  setFilterText(text: string): void {
    this._filterText.set(text);
  }

  setTypeFilters(types: string[]): void {
    this._typeFilters.set(types);
    if (types.length > 0) {
      void this.hydrateAllTypes();
    }
  }

  /**
   * Filtro por texto: instantâneo sobre a lista carregada. Se nada casar
   * localmente, tenta uma busca exata na API (nome/número). `quiet` evita
   * o toast de erro — usado enquanto o usuário ainda está digitando.
   */
  async search(term: string, opts: { quiet?: boolean } = {}): Promise<void> {
    const trimmed = term.trim().toLowerCase();
    this._filterText.set(trimmed);
    if (!opts.quiet) {
      this._error.set(null);
    }

    if (!trimmed) {
      this._searchResult.set(null);
      this._error.set(null);
      return;
    }

    const localHit = this._entries().some(
      (entry) => entry.name.toLowerCase().includes(trimmed) || String(entry.id) === trimmed,
    );
    if (localHit) {
      this._searchResult.set(null);
      this._error.set(null);
      return;
    }

    if (!opts.quiet) {
      this._loading.set(true);
    }
    try {
      const details = await this.api.getDetails(trimmed);
      this._searchResult.set({
        id: details.id,
        name: details.name,
        artworkUrl: this.api.artworkUrl(details.id),
        animatedSpriteUrl: this.api.animatedSpriteUrl(details.id),
        types: details.types.map((type) => type.type.name),
      });
      this._error.set(null);
    } catch {
      this._searchResult.set(null);
      if (!opts.quiet) {
        this._error.set('not-found');
      }
    } finally {
      if (!opts.quiet) {
        this._loading.set(false);
      }
    }
  }

  clearFilters(): void {
    this._filterText.set('');
    this._typeFilters.set([]);
    this._searchResult.set(null);
    this._error.set(null);
  }

  /** Preenche os tipos de um item de forma preguiçosa (chamado quando o card aparece). */
  async hydrateTypes(id: number): Promise<void> {
    const entry = this._entries().find((item) => item.id === id);
    if (!entry || entry.types) {
      return;
    }
    try {
      const details = await this.api.getDetails(id);
      const types = details.types.map((type) => type.type.name);
      this._entries.update((current) =>
        current.map((item) => (item.id === id ? { ...item, types } : item)),
      );
    } catch {
      // tipos são enfeite; falha silenciosa mantém o card utilizável
    }
  }

  private async hydrateAllTypes(): Promise<void> {
    const pending = this._entries().filter((entry) => !entry.types);
    await Promise.allSettled(pending.map((entry) => this.hydrateTypes(entry.id)));
  }

  async select(idOrName: number | string): Promise<void> {
    this._detailLoading.set(true);
    this._selected.set(undefined);
    this._selectedSpecies.set(undefined);
    try {
      const details = await this.api.getDetails(idOrName);
      this._selected.set(details);
      try {
        this._selectedSpecies.set(await this.api.getSpecies(details.species.name));
      } catch {
        this._selectedSpecies.set(undefined);
      }
    } catch {
      this._error.set('network');
    } finally {
      this._detailLoading.set(false);
    }
  }

  closeDetail(): void {
    this._selected.set(undefined);
    this._selectedSpecies.set(undefined);
  }
}

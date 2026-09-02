import { computed, inject, Injectable, signal } from '@angular/core';
import { PokemonService } from './pokemon.service';
import { PokemonListEntry } from '@core/models/pokemon-list-entry';
import { PokemonDetails } from '@core/models/pokemon-details';
import { PokemonSpecies } from '@core/models/pokemon-species';

export const PAGE_SIZE = 60;

export type PokedexError = 'network' | 'not-found' | null;

/**
 * Estado central da Pokédex: lista paginada, filtros (texto + tipo) e o
 * Pokémon selecionado para o detalhe. Os componentes só leem signals e
 * chamam métodos — nenhuma requisição fica espalhada pelos componentes.
 */
@Injectable({ providedIn: 'root' })
export class PokemonStore {
  private readonly api = inject(PokemonService);

  private readonly _entries = signal<PokemonListEntry[]>([]);
  private readonly _total = signal(0);
  private readonly _loading = signal(false);
  private readonly _loadingMore = signal(false);
  private readonly _error = signal<PokedexError>(null);
  private readonly _filterText = signal('');
  private readonly _typeFilters = signal<string[]>([]);
  private readonly _isSearchResult = signal(false);

  private readonly _selected = signal<PokemonDetails | undefined>(undefined);
  private readonly _selectedSpecies = signal<PokemonSpecies | undefined>(undefined);
  private readonly _detailLoading = signal(false);

  readonly entries = this._entries.asReadonly();
  readonly total = this._total.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly loadingMore = this._loadingMore.asReadonly();
  readonly error = this._error.asReadonly();
  readonly filterText = this._filterText.asReadonly();
  readonly typeFilters = this._typeFilters.asReadonly();
  readonly isSearchResult = this._isSearchResult.asReadonly();
  readonly selected = this._selected.asReadonly();
  readonly selectedSpecies = this._selectedSpecies.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();

  /** Lista visível após aplicar filtro de texto e de tipo sobre o que já foi carregado. */
  readonly visibleEntries = computed(() => {
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

  /**
   * "Carregar mais" só aparece quando estamos navegando a lista: nada de
   * paginação durante uma busca por texto ou um resultado de busca exata
   * (aí a paginação não tem relação com o que está na tela).
   */
  readonly hasMore = computed(
    () =>
      !this._isSearchResult() &&
      this._filterText().trim() === '' &&
      this._entries().length < this._total(),
  );

  readonly isEmpty = computed(
    () => !this._loading() && !this._error() && this.visibleEntries().length === 0,
  );

  async loadFirstPage(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    this._isSearchResult.set(false);
    try {
      const page = await this.api.getPage(PAGE_SIZE, 0);
      this._entries.set(page.entries);
      this._total.set(page.total);
    } catch {
      this._error.set('network');
      this._entries.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  async loadMore(): Promise<void> {
    if (this._loadingMore() || !this.hasMore()) {
      return;
    }
    this._loadingMore.set(true);
    try {
      const page = await this.api.getPage(PAGE_SIZE, this._entries().length);
      this._entries.update((current) => [...current, ...page.entries]);
      this._total.set(page.total);
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
   * Busca exata por nome ou número quando o filtro local não encontra nada.
   * Com o campo vazio, volta para a listagem paginada.
   */
  async search(term: string): Promise<void> {
    const trimmed = term.trim().toLowerCase();
    this._filterText.set(trimmed);
    this._error.set(null);

    if (!trimmed) {
      await this.loadFirstPage();
      return;
    }

    const localHit = this._entries().some(
      (entry) => entry.name.toLowerCase().includes(trimmed) || String(entry.id) === trimmed,
    );
    if (localHit) {
      this._isSearchResult.set(false);
      return;
    }

    this._loading.set(true);
    try {
      const details = await this.api.getDetails(trimmed);
      const entry: PokemonListEntry = {
        id: details.id,
        name: details.name,
        artworkUrl: this.api.artworkUrl(details.id),
        animatedSpriteUrl: this.api.animatedSpriteUrl(details.id),
        types: details.types.map((type) => type.type.name),
      };
      this._entries.set([entry]);
      this._isSearchResult.set(true);
    } catch {
      this._error.set('not-found');
      this._entries.set([]);
      this._isSearchResult.set(true);
    } finally {
      this._loading.set(false);
    }
  }

  clearFilters(): void {
    this._filterText.set('');
    this._typeFilters.set([]);
    if (this._isSearchResult()) {
      void this.loadFirstPage();
    }
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

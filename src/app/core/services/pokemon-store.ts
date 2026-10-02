import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { PokemonService } from './pokemon.service';
import { PokemonListEntry } from '@core/models/pokemon-list-entry';
import { PokemonDetails } from '@core/models/pokemon-details';
import { PokemonSpecies } from '@core/models/pokemon-species';
import { Generation, GENERATIONS } from '@core/models/constants/pokemon-generations';

export type PokedexError = 'network' | 'not-found' | null;

/** Último número nacional coberto pela Pokédex (fim da Geração IX). */
const NATIONAL_DEX_SIZE = GENERATIONS[GENERATIONS.length - 1].end;

/**
 * Estado central da Pokédex. A lista dos 1025 Pokémon (só nome e número, ~10 KB
 * comprimida) vem em uma única requisição; as abas de geração apenas filtram
 * essa lista por faixa de número, então trocar de aba é instantâneo. As artes
 * continuam carregando sob demanda, só para os cards visíveis.
 */
@Injectable({ providedIn: 'root' })
export class PokemonStore {
  private readonly api = inject(PokemonService);

  private readonly _entries = signal<PokemonListEntry[]>([]);
  private readonly _genIndex = signal(0);
  private readonly _loading = signal(false);
  private readonly _error = signal<PokedexError>(null);
  private readonly _filterText = signal('');
  private readonly _typeFilters = signal<string[]>([]);
  /** União dos ids nacionais dos tipos selecionados; `null` = sem filtro de tipo. */
  private readonly _typeMemberIds = signal<Set<number> | null>(null);
  private readonly _typeLoading = signal(false);
  private typeFilterToken = 0;
  /** Resultado de uma busca exata na API (nome/número fora da lista carregada). */
  private readonly _searchResult = signal<PokemonListEntry | null>(null);

  private readonly _selected = signal<PokemonDetails | undefined>(undefined);
  private readonly _selectedSpecies = signal<PokemonSpecies | undefined>(undefined);
  private readonly _detailLoading = signal(false);
  private readonly _detailError = signal<PokedexError>(null);

  readonly entries = this._entries.asReadonly();
  readonly genIndex = this._genIndex.asReadonly();
  readonly generation = computed<Generation>(() => GENERATIONS[this._genIndex()]);
  readonly loading = this._loading.asReadonly();
  readonly typeLoading = this._typeLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly filterText = this._filterText.asReadonly();
  readonly typeFilters = this._typeFilters.asReadonly();
  readonly isSearchResult = computed(() => this._searchResult() !== null);
  readonly selected = this._selected.asReadonly();
  readonly selectedSpecies = this._selectedSpecies.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();
  readonly detailError = this._detailError.asReadonly();

  /** Busca por texto ativa: vale para todas as gerações, não só a aba aberta. */
  readonly searchingAllGenerations = computed(
    () => this._searchResult() !== null || this._filterText().trim() !== '',
  );

  /**
   * Cards visíveis. Com texto na busca, procura em todas as gerações; sem texto,
   * mostra a geração da aba. O filtro de tipo vale nos dois casos.
   */
  readonly visibleEntries = computed(() => {
    const hit = this._searchResult();
    if (hit) {
      return [hit];
    }
    const term = this._filterText().trim().toLowerCase();
    const typeIds = this._typeMemberIds();
    const gen = this.generation();
    return this._entries().filter((entry) => {
      const inScope = term
        ? entry.name.toLowerCase().includes(term) || String(entry.id) === term
        : entry.id >= gen.start && entry.id <= gen.end;
      return inScope && (!typeIds || typeIds.has(entry.id));
    });
  });

  readonly isEmpty = computed(
    () =>
      !this._loading() &&
      !this._typeLoading() &&
      !this._error() &&
      this.visibleEntries().length === 0,
  );

  /** Lista completa da Pokédex nacional (uma requisição; cacheada pelo serviço). */
  async loadAll(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    this._searchResult.set(null);
    try {
      const page = await this.api.getPage(NATIONAL_DEX_SIZE, 0);
      this._entries.set(page.entries);
    } catch {
      this._error.set('network');
      this._entries.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  /** Troca a aba de geração (índice 0–8; fora da faixa é ignorado). */
  setGeneration(index: number): void {
    if (Number.isInteger(index) && index >= 0 && index < GENERATIONS.length) {
      this._genIndex.set(index);
    }
  }

  setFilterText(text: string): void {
    this._filterText.set(text);
  }

  /**
   * Filtro por tipo: uma requisição a `/type/{nome}` por tipo selecionado
   * (resultado em cache), unindo os ids. Como a lista inteira já está em
   * memória, não precisa carregar mais nada. Só o pedido mais recente vale.
   */
  setTypeFilters(types: string[]): void {
    this._typeFilters.set(types);
    const token = ++this.typeFilterToken;

    if (types.length === 0) {
      this._typeMemberIds.set(null);
      this._typeLoading.set(false);
      return;
    }

    this._typeLoading.set(true);
    void (async () => {
      try {
        const sets = await Promise.all(types.map((type) => this.api.getTypeMemberIds(type)));
        if (token !== this.typeFilterToken) {
          return;
        }
        const union = new Set<number>();
        for (const set of sets) {
          for (const id of set) {
            union.add(id);
          }
        }
        this._typeMemberIds.set(union);
        this._error.set(null);
      } catch {
        if (token === this.typeFilterToken) {
          this._error.set('network');
        }
      } finally {
        if (token === this.typeFilterToken) {
          this._typeLoading.set(false);
        }
      }
    })();
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
    this._typeMemberIds.set(null);
    this._typeLoading.set(false);
    this.typeFilterToken++;
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

  async select(idOrName: number | string): Promise<void> {
    this._detailLoading.set(true);
    this._detailError.set(null);
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
    } catch (error) {
      this._detailError.set(
        error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'network',
      );
    } finally {
      this._detailLoading.set(false);
    }
  }

  closeDetail(): void {
    this._selected.set(undefined);
    this._selectedSpecies.set(undefined);
    this._detailError.set(null);
    this._detailLoading.set(false);
  }
}

import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
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
  readonly loading = this._loading.asReadonly();
  readonly loadingMore = this._loadingMore.asReadonly();
  readonly typeLoading = this._typeLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly filterText = this._filterText.asReadonly();
  readonly typeFilters = this._typeFilters.asReadonly();
  readonly isSearchResult = computed(() => this._searchResult() !== null);
  readonly selected = this._selected.asReadonly();
  readonly selectedSpecies = this._selectedSpecies.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();
  readonly detailError = this._detailError.asReadonly();

  /** Lista plana visível (resultado de busca, ou navegação filtrada por texto/tipo). */
  readonly visibleEntries = computed(() => {
    const hit = this._searchResult();
    if (hit) {
      return [hit];
    }
    const term = this._filterText().trim().toLowerCase();
    const typeIds = this._typeMemberIds();
    return this._entries().filter((entry) => {
      const matchesText =
        !term || entry.name.toLowerCase().includes(term) || String(entry.id) === term;
      const matchesType = !typeIds || typeIds.has(entry.id);
      return matchesText && matchesType;
    });
  });

  /** Grade dividida por geração quando navegando; uma seção só quando filtrando/buscando. */
  readonly visibleSections = computed<PokedexSection[]>(() => {
    const flat = this.visibleEntries();
    // Enquanto os ids do filtro de tipo ainda não chegaram, mantém a divisão
    // por geração para não piscar a lista inteira sem cabeçalhos.
    const filtering =
      this._searchResult() || this._filterText().trim() !== '' || this._typeMemberIds() !== null;
    if (filtering) {
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
      this._typeMemberIds() === null &&
      this._loadedGens() < GENERATIONS.length,
  );

  readonly isEmpty = computed(
    () =>
      !this._loading() &&
      !this._typeLoading() &&
      !this._error() &&
      this.visibleEntries().length === 0,
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
    this._error.set(null);
    try {
      const page = await this.api.getPage(generationSize(gen), gen.start - 1);
      this._entries.update((current) => [...current, ...page.entries]);
      this._loadedGens.update((n) => n + 1);
    } catch {
      this._error.set('network');
    } finally {
      this._loadingMore.set(false);
    }
  }

  setFilterText(text: string): void {
    this._filterText.set(text);
  }

  /**
   * Filtro por tipo: uma requisição a `/type/{nome}` por tipo selecionado
   * (resultado em cache), unindo os ids. Em seguida carrega as gerações que
   * ainda faltam e contêm algum Pokémon do filtro, para o usuário ver o
   * conjunto completo sem clicar em "carregar mais". Só o pedido mais recente
   * é aplicado.
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
        await this.loadGensCovering(union, token);
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
   * Carrega em sequência as gerações ainda não carregadas até a última que
   * contém algum id de `ids`, mantendo `_loadedGens` contíguo. Aborta se o
   * filtro mudar no meio (token). O estado de carregamento fica por conta do
   * `_typeLoading` do chamador ({@link setTypeFilters}) — não usa `_loadingMore`,
   * que é o lock do botão "carregar mais" (escondido sob filtro de tipo).
   */
  private async loadGensCovering(ids: Set<number>, token: number): Promise<void> {
    let lastGenIdx = -1;
    for (const id of ids) {
      const idx = GENERATIONS.findIndex((gen) => id >= gen.start && id <= gen.end);
      if (idx > lastGenIdx) {
        lastGenIdx = idx;
      }
    }

    while (this._loadedGens() <= lastGenIdx && this._loadedGens() < GENERATIONS.length) {
      if (token !== this.typeFilterToken) {
        return;
      }
      const gen = GENERATIONS[this._loadedGens()];
      const page = await this.api.getPage(generationSize(gen), gen.start - 1);
      if (token !== this.typeFilterToken) {
        return;
      }
      this._entries.update((current) => [...current, ...page.entries]);
      this._loadedGens.update((n) => n + 1);
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

import { TestBed } from '@angular/core/testing';
import { PokemonStore } from './pokemon-store';
import { PokemonService } from './pokemon.service';
import { PokemonListEntry } from '@core/models/pokemon-list-entry';

function entry(id: number, name: string, types?: string[]): PokemonListEntry {
  return { id, name, artworkUrl: `${id}.png`, animatedSpriteUrl: `${id}.gif`, types };
}

describe('PokemonStore', () => {
  let store: PokemonStore;
  let api: jasmine.SpyObj<PokemonService>;

  beforeEach(() => {
    api = jasmine.createSpyObj<PokemonService>('PokemonService', [
      'getPage',
      'getDetails',
      'getSpecies',
      'artworkUrl',
      'animatedSpriteUrl',
    ]);
    api.artworkUrl.and.callFake((id) => `${id}.png`);
    api.animatedSpriteUrl.and.callFake((id) => `${id}.gif`);

    TestBed.configureTestingModule({
      providers: [PokemonStore, { provide: PokemonService, useValue: api }],
    });
    store = TestBed.inject(PokemonStore);
  });

  it('loadFirstPage popula entries e total', async () => {
    api.getPage.and.resolveTo({
      total: 3,
      entries: [entry(1, 'bulbasaur'), entry(4, 'charmander')],
    });

    await store.loadFirstPage();

    expect(store.entries().length).toBe(2);
    expect(store.total()).toBe(3);
    expect(store.hasMore()).toBeTrue();
  });

  it('visibleEntries filtra por texto', async () => {
    api.getPage.and.resolveTo({
      total: 2,
      entries: [entry(1, 'bulbasaur'), entry(25, 'pikachu')],
    });
    await store.loadFirstPage();

    store.setFilterText('pika');
    expect(store.visibleEntries().map((e) => e.name)).toEqual(['pikachu']);

    store.setFilterText('25');
    expect(store.visibleEntries().map((e) => e.name)).toEqual(['pikachu']);
  });

  it('visibleEntries filtra por tipo quando os tipos já estão carregados', async () => {
    api.getPage.and.resolveTo({
      total: 2,
      entries: [entry(1, 'bulbasaur', ['grass']), entry(4, 'charmander', ['fire'])],
    });
    await store.loadFirstPage();

    store.setTypeFilters(['fire']);
    expect(store.visibleEntries().map((e) => e.name)).toEqual(['charmander']);
  });

  it('search cai para busca exata na API quando não há match local', async () => {
    api.getPage.and.resolveTo({ total: 1, entries: [entry(1, 'bulbasaur')] });
    await store.loadFirstPage();

    api.getDetails.and.resolveTo({
      id: 130,
      name: 'gyarados',
      types: [{ slot: 1, type: { name: 'water', url: '' } }],
    } as never);

    await store.search('gyarados');

    expect(api.getDetails).toHaveBeenCalledWith('gyarados');
    expect(store.visibleEntries().map((e) => e.name)).toEqual(['gyarados']);
    expect(store.isSearchResult()).toBeTrue();
    expect(store.hasMore()).toBeFalse();
  });

  it('filtro local instantâneo não chama a API', async () => {
    api.getPage.and.resolveTo({
      total: 2,
      entries: [entry(1, 'bulbasaur'), entry(25, 'pikachu')],
    });
    await store.loadFirstPage();

    await store.search('pika');

    expect(api.getDetails).not.toHaveBeenCalled();
    expect(store.isSearchResult()).toBeFalse();
    expect(store.visibleEntries().map((e) => e.name)).toEqual(['pikachu']);
  });

  it('search silencioso (quiet) não seta erro nem toast', async () => {
    api.getPage.and.resolveTo({ total: 0, entries: [] });
    await store.loadFirstPage();
    api.getDetails.and.rejectWith(new Error('404'));

    await store.search('missingno', { quiet: true });
    expect(store.error()).toBeNull();

    await store.search('missingno');
    expect(store.error()).toBe('not-found');
    expect(store.visibleEntries()).toEqual([]);
  });
});

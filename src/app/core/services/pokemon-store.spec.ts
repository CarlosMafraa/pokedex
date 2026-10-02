import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { PokemonStore } from './pokemon-store';
import { PokemonService } from './pokemon.service';
import { PokemonListEntry } from '@core/models/pokemon-list-entry';

function entry(id: number, name: string, types?: string[]): PokemonListEntry {
  return { id, name, artworkUrl: `${id}.png`, types };
}

/** Deixa a IIFE assíncrona de setTypeFilters resolver por completo. */
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('PokemonStore', () => {
  let store: PokemonStore;
  let api: jasmine.SpyObj<PokemonService>;

  beforeEach(() => {
    api = jasmine.createSpyObj<PokemonService>('PokemonService', [
      'getPage',
      'getDetails',
      'getSpecies',
      'getTypeMemberIds',
      'artworkUrl',
    ]);
    api.artworkUrl.and.callFake((id) => `${id}.png`);
    api.getTypeMemberIds.and.resolveTo(new Set<number>());

    TestBed.configureTestingModule({
      providers: [PokemonStore, { provide: PokemonService, useValue: api }],
    });
    store = TestBed.inject(PokemonStore);
  });

  /** Lista com um Pokémon de algumas gerações diferentes. */
  const national = [
    entry(1, 'bulbasaur', ['grass']),
    entry(4, 'charmander', ['fire']),
    entry(25, 'pikachu', ['electric']),
    entry(155, 'cyndaquil', ['fire']),
    entry(252, 'treecko', ['grass']),
  ];

  async function loaded() {
    api.getPage.and.resolveTo({ total: 1025, entries: national });
    await store.loadAll();
  }

  it('loadAll pede a lista nacional inteira de uma vez (limit 1025, offset 0)', async () => {
    await loaded();
    expect(api.getPage).toHaveBeenCalledOnceWith(1025, 0);
    expect(store.entries().length).toBe(5);
  });

  it('a aba de geração filtra por faixa de número, sem nova requisição', async () => {
    await loaded();
    expect(store.generation().label).toBe('Geração I');
    expect(store.visibleEntries().map((e) => e.name)).toEqual([
      'bulbasaur',
      'charmander',
      'pikachu',
    ]);

    store.setGeneration(1);
    expect(store.visibleEntries().map((e) => e.name)).toEqual(['cyndaquil']);
    store.setGeneration(2);
    expect(store.visibleEntries().map((e) => e.name)).toEqual(['treecko']);
    expect(api.getPage).toHaveBeenCalledTimes(1);
  });

  it('setGeneration ignora índices fora da faixa', async () => {
    await loaded();
    store.setGeneration(4);
    store.setGeneration(9);
    store.setGeneration(-1);
    store.setGeneration(1.5);
    expect(store.genIndex()).toBe(4);
  });

  it('falha na carga marca erro de rede e retentativa limpa', async () => {
    api.getPage.and.rejectWith(new Error('rede'));
    await store.loadAll();
    expect(store.error()).toBe('network');

    await loaded();
    expect(store.error()).toBeNull();
    expect(store.entries().length).toBe(5);
  });

  it('busca por texto vale para todas as gerações, não só a aba aberta', async () => {
    await loaded();
    store.setGeneration(2); // aba III
    store.setFilterText('cynda');
    expect(store.searchingAllGenerations()).toBeTrue();
    expect(store.visibleEntries().map((e) => e.name)).toEqual(['cyndaquil']);

    store.setFilterText('25');
    expect(store.visibleEntries().map((e) => e.name)).toEqual(['pikachu']);

    store.setFilterText('');
    expect(store.searchingAllGenerations()).toBeFalse();
    expect(store.visibleEntries().map((e) => e.name)).toEqual(['treecko']);
  });

  it('filtro de tipo vale dentro da aba (uma requisição a /type/{nome})', async () => {
    await loaded();
    api.getTypeMemberIds.and.resolveTo(new Set([4, 155]));
    store.setTypeFilters(['fire']);
    await flushMicrotasks();

    expect(api.getTypeMemberIds).toHaveBeenCalledOnceWith('fire');
    expect(store.visibleEntries().map((e) => e.name)).toEqual(['charmander']);
    store.setGeneration(1);
    expect(store.visibleEntries().map((e) => e.name)).toEqual(['cyndaquil']);
    // nenhuma lista extra: tudo já estava em memória
    expect(api.getPage).toHaveBeenCalledTimes(1);

    store.setTypeFilters([]);
    expect(store.visibleEntries().map((e) => e.name)).toEqual(['cyndaquil']);
  });

  it('setTypeFilters aplica só o pedido mais recente (race)', async () => {
    await loaded();
    api.getTypeMemberIds.and.callFake((type) =>
      Promise.resolve(type === 'fire' ? new Set([4]) : new Set([1])),
    );

    store.setTypeFilters(['fire']);
    store.setTypeFilters(['grass']);
    await flushMicrotasks();

    expect(store.visibleEntries().map((e) => e.name)).toEqual(['bulbasaur']);
  });

  it('search cai para busca exata na API quando não há match local', async () => {
    await loaded();
    api.getDetails.and.resolveTo({
      id: 10034,
      name: 'charizard-mega-x',
      types: [{ slot: 1, type: { name: 'fire', url: '' } }],
    } as never);

    await store.search('charizard-mega-x');

    expect(api.getDetails).toHaveBeenCalledWith('charizard-mega-x');
    expect(store.visibleEntries().map((e) => e.name)).toEqual(['charizard-mega-x']);
    expect(store.isSearchResult()).toBeTrue();
  });

  it('filtro local instantâneo não chama a API', async () => {
    await loaded();
    await store.search('pika');

    expect(api.getDetails).not.toHaveBeenCalled();
    expect(store.isSearchResult()).toBeFalse();
    expect(store.visibleEntries().map((e) => e.name)).toEqual(['pikachu']);
  });

  it('search silencioso (quiet) não seta erro nem toast', async () => {
    await loaded();
    api.getDetails.and.rejectWith(new Error('404'));

    await store.search('missingno', { quiet: true });
    expect(store.error()).toBeNull();

    await store.search('missingno');
    expect(store.error()).toBe('not-found');
    expect(store.visibleEntries()).toEqual([]);
  });

  it('select distingue 404 (not-found) de falha de rede', async () => {
    api.getDetails.and.rejectWith(new HttpErrorResponse({ status: 404, statusText: 'Not Found' }));
    await store.select('missingno');
    expect(store.detailError()).toBe('not-found');

    api.getDetails.and.rejectWith(new HttpErrorResponse({ status: 0, statusText: 'Unknown' }));
    await store.select('pikachu');
    expect(store.detailError()).toBe('network');
  });

  it('select bem-sucedido limpa o detailError e closeDetail zera o estado', async () => {
    api.getDetails.and.resolveTo({
      id: 25,
      name: 'pikachu',
      species: { name: 'pikachu', url: '' },
      types: [],
    } as never);
    api.getSpecies.and.rejectWith(new Error('sem species'));

    await store.select('pikachu');
    expect(store.detailError()).toBeNull();
    expect(store.selected()?.name).toBe('pikachu');

    store.closeDetail();
    expect(store.selected()).toBeUndefined();
    expect(store.detailError()).toBeNull();
  });
});

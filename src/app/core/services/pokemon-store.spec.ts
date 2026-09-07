import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { PokemonStore } from './pokemon-store';
import { PokemonService } from './pokemon.service';
import { PokemonListEntry } from '@core/models/pokemon-list-entry';

function entry(id: number, name: string, types?: string[]): PokemonListEntry {
  return { id, name, artworkUrl: `${id}.png`, animatedSpriteUrl: `${id}.gif`, types };
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
      'animatedSpriteUrl',
    ]);
    api.artworkUrl.and.callFake((id) => `${id}.png`);
    api.animatedSpriteUrl.and.callFake((id) => `${id}.gif`);
    api.getTypeMemberIds.and.resolveTo(new Set<number>());

    TestBed.configureTestingModule({
      providers: [PokemonStore, { provide: PokemonService, useValue: api }],
    });
    store = TestBed.inject(PokemonStore);
  });

  it('loadFirstPage carrega a Geração I (limit 151, offset 0) e ainda há mais', async () => {
    api.getPage.and.resolveTo({
      total: 1302,
      entries: [entry(1, 'bulbasaur'), entry(4, 'charmander')],
    });

    await store.loadFirstPage();

    expect(api.getPage).toHaveBeenCalledWith(151, 0);
    expect(store.entries().length).toBe(2);
    expect(store.hasMore()).toBeTrue();
    expect(store.nextGeneration()?.label).toBe('Geração II');
  });

  it('loadMore carrega a próxima geração (Gen II: limit 100, offset 151)', async () => {
    api.getPage.and.resolveTo({ total: 1302, entries: [entry(1, 'bulbasaur')] });
    await store.loadFirstPage();

    api.getPage.and.resolveTo({ total: 1302, entries: [entry(152, 'chikorita')] });
    await store.loadMore();

    expect(api.getPage).toHaveBeenCalledWith(100, 151);
    expect(store.entries().map((e) => e.id)).toEqual([1, 152]);
  });

  it('loadMore que falha e depois dá certo limpa o erro (não fica preso)', async () => {
    api.getPage.and.resolveTo({ total: 1302, entries: [entry(1, 'bulbasaur')] });
    await store.loadFirstPage();

    api.getPage.and.rejectWith(new Error('rede'));
    await store.loadMore();
    expect(store.error()).toBe('network');

    api.getPage.and.resolveTo({ total: 1302, entries: [entry(152, 'chikorita')] });
    await store.loadMore();
    expect(store.error()).toBeNull();
    expect(store.entries().map((e) => e.id)).toEqual([1, 152]);
  });

  it('visibleSections divide a lista navegada por geração', async () => {
    api.getPage.and.resolveTo({
      total: 1302,
      entries: [entry(1, 'bulbasaur'), entry(151, 'mew'), entry(152, 'chikorita')],
    });
    await store.loadFirstPage();
    api.getPage.and.resolveTo({ total: 1302, entries: [entry(152, 'chikorita')] });
    await store.loadMore();

    const labels = store.visibleSections().map((s) => s.label);
    expect(labels).toEqual(['Geração I', 'Geração II']);
  });

  it('com filtro ativo a grade vira uma seção só (sem divisão por geração)', async () => {
    api.getPage.and.resolveTo({
      total: 1302,
      entries: [entry(1, 'bulbasaur', ['grass']), entry(4, 'charmander', ['fire'])],
    });
    await store.loadFirstPage();

    api.getTypeMemberIds.and.resolveTo(new Set([4]));
    store.setTypeFilters(['fire']);
    await flushMicrotasks();

    const sections = store.visibleSections();
    expect(sections.length).toBe(1);
    expect(sections[0].label).toBeNull();
    expect(sections[0].entries.map((e) => e.name)).toEqual(['charmander']);
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

  it('filtra por tipo com uma requisição a /type/{nome} (união dos ids)', async () => {
    api.getPage.and.resolveTo({
      total: 2,
      entries: [entry(1, 'bulbasaur'), entry(4, 'charmander')],
    });
    await store.loadFirstPage();

    api.getTypeMemberIds.and.resolveTo(new Set([4, 6]));
    store.setTypeFilters(['fire']);
    await flushMicrotasks();

    expect(api.getTypeMemberIds).toHaveBeenCalledOnceWith('fire');
    expect(api.getDetails).not.toHaveBeenCalled();
    expect(store.visibleEntries().map((e) => e.name)).toEqual(['charmander']);
    expect(store.hasMore()).toBeFalse(); // filtro de tipo esconde o "carregar mais"

    store.setTypeFilters([]);
    expect(store.visibleEntries().map((e) => e.name)).toEqual(['bulbasaur', 'charmander']);
  });

  it('filtro por tipo carrega as gerações que faltam até o último match', async () => {
    api.getPage.and.callFake((limit: number, offset: number) =>
      Promise.resolve(
        offset === 0
          ? { total: 1302, entries: [entry(4, 'charmander')] }
          : { total: 1302, entries: [entry(155, 'cyndaquil')] },
      ),
    );
    await store.loadFirstPage();

    // 155 é da Geração II (152–251), ainda não carregada
    api.getTypeMemberIds.and.resolveTo(new Set([4, 155]));
    store.setTypeFilters(['fire']);
    await flushMicrotasks();

    expect(api.getPage).toHaveBeenCalledWith(100, 151);
    expect(store.entries().map((e) => e.id)).toEqual([4, 155]);
    expect(store.visibleEntries().map((e) => e.name)).toEqual(['charmander', 'cyndaquil']);
  });

  it('setTypeFilters aplica só o pedido mais recente (race)', async () => {
    api.getPage.and.resolveTo({
      total: 3,
      entries: [entry(1, 'bulbasaur'), entry(4, 'charmander'), entry(7, 'squirtle')],
    });
    await store.loadFirstPage();

    api.getTypeMemberIds.and.callFake((type) =>
      Promise.resolve(type === 'fire' ? new Set([4]) : new Set([7])),
    );

    store.setTypeFilters(['fire']);
    store.setTypeFilters(['water']);
    await flushMicrotasks();

    expect(store.visibleEntries().map((e) => e.name)).toEqual(['squirtle']);
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

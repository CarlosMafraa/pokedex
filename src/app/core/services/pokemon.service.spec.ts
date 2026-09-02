import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { idFromUrl, PokemonService } from './pokemon.service';
import { CacheService } from './cache.service';

/** Cache em memória para não tocar no IndexedDB durante os testes. */
class InMemoryCache {
  private store = new Map<string, unknown>();
  get<T>(key: string) {
    return Promise.resolve((this.store.get(key) as T) ?? null);
  }
  peek<T>(key: string) {
    return this.get<T>(key);
  }
  set<T>(key: string, data: T) {
    this.store.set(key, data);
    return Promise.resolve();
  }
  remove(key: string) {
    this.store.delete(key);
    return Promise.resolve();
  }
  clearAll() {
    this.store.clear();
    return Promise.resolve();
  }
  has(key: string) {
    return Promise.resolve(this.store.has(key));
  }
}

describe('PokemonService', () => {
  let service: PokemonService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PokemonService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CacheService, useClass: InMemoryCache },
      ],
    });
    service = TestBed.inject(PokemonService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  /** Deixa a leitura assíncrona do cache resolver antes do disparo do HTTP. */
  const flush = async () => {
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
  };

  it('idFromUrl extrai o id nacional da URL', () => {
    expect(idFromUrl('https://pokeapi.co/api/v2/pokemon/25/')).toBe(25);
    expect(idFromUrl('https://pokeapi.co/api/v2/pokemon/150')).toBe(150);
  });

  it('getPage monta a URL com limit/offset e deriva id + artes', async () => {
    const promise = service.getPage(2, 0);
    await flush();
    const req = httpMock.expectOne('https://pokeapi.co/api/v2/pokemon?limit=2&offset=0');
    expect(req.request.method).toBe('GET');
    req.flush({
      count: 1302,
      results: [
        { name: 'bulbasaur', url: 'https://pokeapi.co/api/v2/pokemon/1/' },
        { name: 'ivysaur', url: 'https://pokeapi.co/api/v2/pokemon/2/' },
      ],
    });

    const page = await promise;
    expect(page.total).toBe(1302);
    expect(page.entries[0]).toEqual(jasmine.objectContaining({ id: 1, name: 'bulbasaur' }));
    expect(page.entries[0].artworkUrl).toContain('/official-artwork/1.png');
  });

  it('a segunda chamada idêntica vem do cache, sem novo HTTP', async () => {
    const first = service.getDetails('pikachu');
    await flush();
    httpMock
      .expectOne('https://pokeapi.co/api/v2/pokemon/pikachu')
      .flush({ id: 25, name: 'pikachu' });
    await first;

    const second = service.getDetails('pikachu');
    await flush();
    httpMock.expectNone('https://pokeapi.co/api/v2/pokemon/pikachu');
    await second;
  });
});

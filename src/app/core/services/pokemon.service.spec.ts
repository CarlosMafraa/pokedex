import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { idFromUrl, PokemonService } from './pokemon.service';
import { CacheService } from './cache.service';

/** Cache em memória para não tocar no IndexedDB durante os testes. */
class InMemoryCache {
  private fresh = new Map<string, unknown>();
  private stale = new Map<string, unknown>();
  get<T>(key: string) {
    return Promise.resolve((this.fresh.get(key) as T) ?? null);
  }
  peek<T>(key: string) {
    return this.get<T>(key);
  }
  peekStale<T>(key: string) {
    return Promise.resolve((this.fresh.get(key) ?? this.stale.get(key) ?? null) as T | null);
  }
  set<T>(key: string, data: T) {
    this.fresh.set(key, data);
    return Promise.resolve();
  }
  remove(key: string) {
    this.fresh.delete(key);
    this.stale.delete(key);
    return Promise.resolve();
  }
  clearAll() {
    this.fresh.clear();
    this.stale.clear();
    return Promise.resolve();
  }
  has(key: string) {
    return Promise.resolve(this.fresh.has(key));
  }
  /** Helper de teste: transforma um item válido em vencido (só via peekStale). */
  expire(key: string) {
    if (this.fresh.has(key)) {
      this.stale.set(key, this.fresh.get(key));
      this.fresh.delete(key);
    }
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

  // `ignoreCancelled`: o operador `timeout` cancela a requisição pendurada.
  afterEach(() => httpMock.verify({ ignoreCancelled: true }));

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

  it('repete uma vez em falha transitória (5xx) e resolve na segunda', fakeAsync(() => {
    let result: unknown;
    void service.getDetails('pikachu').then((r) => (result = r));
    tick(); // leitura do cache

    httpMock
      .expectOne('https://pokeapi.co/api/v2/pokemon/pikachu')
      .flush('boom', { status: 503, statusText: 'Service Unavailable' });
    tick(500); // espera do retry

    httpMock
      .expectOne('https://pokeapi.co/api/v2/pokemon/pikachu')
      .flush({ id: 25, name: 'pikachu' });
    tick();

    expect(result).toEqual(jasmine.objectContaining({ id: 25 }));
  }));

  it('não repete em 404 — erro de cliente propaga na hora', fakeAsync(() => {
    let error: unknown;
    void service.getDetails('missingno').catch((e) => (error = e));
    tick();

    httpMock
      .expectOne('https://pokeapi.co/api/v2/pokemon/missingno')
      .flush('not found', { status: 404, statusText: 'Not Found' });
    tick(500);

    httpMock.expectNone('https://pokeapi.co/api/v2/pokemon/missingno');
    expect((error as HttpErrorResponse).status).toBe(404);
  }));

  it('timeout: aborta requisição pendurada e rejeita com TimeoutError', fakeAsync(() => {
    let error: unknown;
    void service.getDetails('snorlax').catch((e) => (error = e));
    tick();

    httpMock.expectOne('https://pokeapi.co/api/v2/pokemon/snorlax'); // servidor não responde
    tick(15_000); // dispara o timeout
    tick(500); // espera do retry (TimeoutError é transitório)

    httpMock.expectOne('https://pokeapi.co/api/v2/pokemon/snorlax'); // 2ª tentativa, também pendura
    tick(15_000);
    tick();

    expect((error as { name?: string })?.name).toBe('TimeoutError');
  }));

  it('stale-if-error: serve o item vencido quando o fetch falha', fakeAsync(() => {
    const cache = TestBed.inject(CacheService) as unknown as InMemoryCache;

    let first: unknown;
    void service.getDetails('pikachu').then((v) => (first = v));
    tick();
    httpMock
      .expectOne('https://pokeapi.co/api/v2/pokemon/pikachu')
      .flush({ id: 25, name: 'pikachu' });
    tick();
    expect(first).toEqual(jasmine.objectContaining({ id: 25 }));

    cache.expire('pokemon_details_pikachu');

    let second: unknown;
    void service.getDetails('pikachu').then((v) => (second = v));
    tick();
    httpMock
      .expectOne('https://pokeapi.co/api/v2/pokemon/pikachu')
      .flush('down', { status: 503, statusText: 'Service Unavailable' });
    tick(500);
    httpMock
      .expectOne('https://pokeapi.co/api/v2/pokemon/pikachu')
      .flush('down', { status: 503, statusText: 'Service Unavailable' });
    tick();

    expect(second).toEqual(jasmine.objectContaining({ id: 25 }));
  }));

  it('descrição pt-BR: baixa o JSON uma vez e devolve null para id sem tradução', async () => {
    const first = service.getFlavorTextPtBr(6);
    httpMock
      .expectOne('assets/i18n/flavor-pt-br.json')
      .flush({ '6': 'Cospe fogo quente o bastante para derreter rochas.' });

    expect(await first).toBe('Cospe fogo quente o bastante para derreter rochas.');
    // segunda chamada usa o JSON já carregado (nenhuma requisição nova)
    expect(await service.getFlavorTextPtBr(9999)).toBeNull();
  });

  it('descrição pt-BR: se o JSON falhar, devolve null e tenta de novo depois', async () => {
    const failed = service.getFlavorTextPtBr(6);
    httpMock
      .expectOne('assets/i18n/flavor-pt-br.json')
      .flush('offline', { status: 0, statusText: 'Unknown Error' });
    expect(await failed).toBeNull();

    const retried = service.getFlavorTextPtBr(6);
    httpMock.expectOne('assets/i18n/flavor-pt-br.json').flush({ '6': 'ok' });
    expect(await retried).toBe('ok');
  });
});

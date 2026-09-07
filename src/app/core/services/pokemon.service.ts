import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { lastValueFrom, retry, timeout, timer } from 'rxjs';
import { environment } from '@env/environment';
import { PokemonListResponse } from '@core/models/pokemon-list-response';
import { PokemonListEntry } from '@core/models/pokemon-list-entry';
import { PokemonDetails } from '@core/models/pokemon-details';
import { PokemonSpecies } from '@core/models/pokemon-species';
import { PokemonTypeResponse } from '@core/models/pokemon-type-response';
import { CacheService } from './cache.service';

export interface PokemonPage {
  entries: PokemonListEntry[];
  total: number;
}

/** Extrai o id nacional da URL de recurso da PokéAPI (`.../pokemon/25/`). */
export function idFromUrl(url: string): number {
  const match = /\/(\d+)\/?$/.exec(url);
  return match ? Number(match[1]) : NaN;
}

/** Aborta uma requisição pendurada (sem resposta do servidor) após este tempo. */
const HTTP_TIMEOUT_MS = 15_000;

/**
 * Repete uma vez, com 500 ms de intervalo, mas só para falhas transitórias
 * (rede, 5xx ou timeout). Um 4xx (ex.: 404 de nome inexistente) propaga na hora.
 */
function retryTransient<T>() {
  return retry<T>({
    count: 1,
    delay: (error) => {
      if (error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500) {
        throw error;
      }
      return timer(500);
    },
  });
}

@Injectable({
  providedIn: 'root',
})
export class PokemonService {
  private readonly baseUrl = environment.pokeApiBaseUrl;
  private readonly http = inject(HttpClient);
  private readonly cache = inject(CacheService);

  public artworkUrl(id: number): string {
    return `${environment.artworkBaseUrl}/${id}.png`;
  }

  public animatedSpriteUrl(id: number): string {
    return `${environment.animatedSpriteBaseUrl}/${id}.gif`;
  }

  /**
   * Página da lista já normalizada em {@link PokemonListEntry}: id e artes são
   * derivados sem nenhuma requisição extra por Pokémon. Itens com URL malformada
   * (id não numérico) são descartados para não gerar arte quebrada.
   */
  public async getPage(limit: number, offset: number): Promise<PokemonPage> {
    const response = await this.getRawList(limit, offset);
    return {
      total: response.count,
      entries: response.results
        .map((item) => {
          const id = idFromUrl(item.url);
          return {
            id,
            name: item.name,
            artworkUrl: this.artworkUrl(id),
            animatedSpriteUrl: this.animatedSpriteUrl(id),
          };
        })
        .filter((entry) => Number.isFinite(entry.id)),
    };
  }

  public async getRawList(limit: number, offset: number): Promise<PokemonListResponse> {
    return this.cached(`pokemon_list_${limit}_${offset}`, () =>
      this.httpGet<PokemonListResponse>(`${this.baseUrl}/pokemon?limit=${limit}&offset=${offset}`),
    );
  }

  public async getDetails(value: string | number): Promise<PokemonDetails> {
    const key = String(value).toLowerCase();
    return this.cached(`pokemon_details_${key}`, () =>
      this.httpGet<PokemonDetails>(`${this.baseUrl}/pokemon/${key}`),
    );
  }

  public async getSpecies(value: string | number): Promise<PokemonSpecies> {
    const key = String(value).toLowerCase();
    return this.cached(`pokemon_species_${key}`, () =>
      this.httpGet<PokemonSpecies>(`${this.baseUrl}/pokemon-species/${key}`),
    );
  }

  /**
   * Ids nacionais de todos os Pokémon de um tipo, numa única requisição. Só a
   * lista de ids é cacheada — a resposta bruta de `/type` é grande e não é usada.
   */
  public async getTypeMemberIds(type: string): Promise<Set<number>> {
    const key = String(type).toLowerCase();
    const ids = await this.cached(`pokemon_type_ids_${key}`, async () => {
      const response = await this.httpGet<PokemonTypeResponse>(`${this.baseUrl}/type/${key}`);
      return response.pokemon
        .map((member) => idFromUrl(member.pokemon.url))
        .filter(Number.isFinite);
    });
    return new Set(ids);
  }

  public clearCache(): void {
    void this.cache.clearAll();
  }

  /**
   * GET com timeout (aborta conexão pendurada) e retry-1× para falhas
   * transitórias. O timeout fica dentro do retry, então cada tentativa ganha
   * o seu; um `TimeoutError` é tratado como transitório e propaga se persistir.
   */
  private httpGet<T>(url: string): Promise<T> {
    return lastValueFrom(
      this.http.get<T>(url).pipe(timeout({ each: HTTP_TIMEOUT_MS }), retryTransient<T>()),
    );
  }

  /**
   * Cache-first. Em falha do fetch, cai para o item vencido se houver
   * ("stale-if-error") — melhor mostrar dado antigo do que erro.
   */
  private async cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const hit = await this.cache.get<T>(key);
    if (hit != null) {
      return hit;
    }
    try {
      const fresh = await fetcher();
      await this.cache.set(key, fresh);
      return fresh;
    } catch (error) {
      const stale = await this.cache.peekStale<T>(key);
      if (stale != null) {
        return stale;
      }
      throw error;
    }
  }
}

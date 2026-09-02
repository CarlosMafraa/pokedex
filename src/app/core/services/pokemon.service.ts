import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { PokemonListResponse } from '@core/models/pokemon-list-response';
import { PokemonListEntry } from '@core/models/pokemon-list-entry';
import { PokemonDetails } from '@core/models/pokemon-details';
import { PokemonSpecies } from '@core/models/pokemon-species';
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
   * derivados sem nenhuma requisição extra por Pokémon.
   */
  public async getPage(limit: number, offset: number): Promise<PokemonPage> {
    const response = await this.getRawList(limit, offset);
    return {
      total: response.count,
      entries: response.results.map((item) => {
        const id = idFromUrl(item.url);
        return {
          id,
          name: item.name,
          artworkUrl: this.artworkUrl(id),
          animatedSpriteUrl: this.animatedSpriteUrl(id),
        };
      }),
    };
  }

  public async getRawList(limit: number, offset: number): Promise<PokemonListResponse> {
    return this.cached(`pokemon_list_${limit}_${offset}`, () =>
      lastValueFrom(
        this.http.get<PokemonListResponse>(
          `${this.baseUrl}/pokemon?limit=${limit}&offset=${offset}`,
        ),
      ),
    );
  }

  public async getDetails(value: string | number): Promise<PokemonDetails> {
    const key = String(value).toLowerCase();
    return this.cached(`pokemon_details_${key}`, () =>
      lastValueFrom(this.http.get<PokemonDetails>(`${this.baseUrl}/pokemon/${key}`)),
    );
  }

  public async getSpecies(value: string | number): Promise<PokemonSpecies> {
    const key = String(value).toLowerCase();
    return this.cached(`pokemon_species_${key}`, () =>
      lastValueFrom(this.http.get<PokemonSpecies>(`${this.baseUrl}/pokemon-species/${key}`)),
    );
  }

  public clearCache(): void {
    void this.cache.clearAll();
  }

  private async cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const hit = await this.cache.get<T>(key);
    if (hit) {
      return hit;
    }
    const fresh = await fetcher();
    await this.cache.set(key, fresh);
    return fresh;
  }
}

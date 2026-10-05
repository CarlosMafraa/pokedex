import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { PokemonListEntry } from '@core/models/pokemon-list-entry';
import { PokedexNumberPipe } from '@shared/pipes/pokedex-number.pipe';

const PLACEHOLDER_IMAGE = 'assets/favicon/pokebola.png';

@Component({
  selector: 'app-pokemon-card',
  standalone: true,
  imports: [RouterLink, TitleCasePipe, PokedexNumberPipe],
  templateUrl: './pokemon-card.component.html',
  styleUrl: './pokemon-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PokemonCardComponent {
  readonly entry = input.required<PokemonListEntry>();
  /** Card na primeira tela: carrega a arte já, sem esperar o lazy-loading. */
  readonly eager = input(false);
  /** Entre os primeiros (candidatos a LCP): pede a arte com prioridade alta. */
  readonly priority = input(false);

  /** 0 = miniatura (leve), 1 = arte original, 2 = pokébola (nada carregou). */
  private readonly fallback = signal(0);
  /** Até a arte chegar, o card mostra uma pokébola apagada no lugar. */
  readonly artworkLoaded = signal(false);

  readonly artworkFailed = computed(() => this.fallback() >= 2);

  readonly primaryType = computed(() => this.entry().types?.[0] ?? null);

  readonly currentImage = computed(() => {
    const e = this.entry();
    return [e.thumbnailUrl, e.artworkUrl, PLACEHOLDER_IMAGE][this.fallback()];
  });

  /**
   * Miniatura em 96 px para telas 1x e 192 px para 2x; só vale enquanto a
   * miniatura é a fonte (na reserva — arte original/pokébola — não há srcset).
   */
  readonly srcset = computed(() => {
    if (this.fallback() !== 0) {
      return null;
    }
    const thumb = this.entry().thumbnailUrl;
    return `${thumb.replace('&w=192', '&w=96')} 1x, ${thumb} 2x`;
  });

  onArtworkError(): void {
    this.fallback.update((step) => Math.min(step + 1, 2));
  }
}

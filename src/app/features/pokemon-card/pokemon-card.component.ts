import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { PokemonListEntry } from '@core/models/pokemon-list-entry';
import { PokemonStore } from '@core/services/pokemon-store';
import { PokedexNumberPipe } from '@shared/pipes/pokedex-number.pipe';
import { InViewportDirective } from '@shared/directives/in-viewport.directive';

const PLACEHOLDER_IMAGE = 'assets/favicon/pokebola.png';

@Component({
  selector: 'app-pokemon-card',
  standalone: true,
  imports: [RouterLink, TitleCasePipe, PokedexNumberPipe, InViewportDirective],
  templateUrl: './pokemon-card.component.html',
  styleUrl: './pokemon-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PokemonCardComponent {
  private readonly store = inject(PokemonStore);

  readonly entry = input.required<PokemonListEntry>();

  readonly hovered = signal(false);
  readonly artworkFailed = signal(false);
  /** Os GIFs da Gen V não existem para boa parte dos Pokémon a partir do #650. */
  readonly animatedFailed = signal(false);

  /** Respeita "reduzir movimento": não troca para o GIF ao passar o mouse. */
  private readonly reduceMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  readonly primaryType = computed(() => this.entry().types?.[0] ?? null);

  /**
   * Ordem de preferência: GIF no hover (se existir) → arte oficial → GIF como
   * fallback da arte → pokébola local quando nenhuma das duas carrega.
   */
  readonly currentImage = computed(() => {
    const e = this.entry();
    const wantsAnimated = this.hovered() && !this.reduceMotion;
    if (wantsAnimated && !this.animatedFailed()) {
      return e.animatedSpriteUrl;
    }
    if (!this.artworkFailed()) {
      return e.artworkUrl;
    }
    if (!this.animatedFailed()) {
      return e.animatedSpriteUrl;
    }
    return PLACEHOLDER_IMAGE;
  });

  readonly showingAnimated = computed(() => this.currentImage() === this.entry().animatedSpriteUrl);
  readonly showingPlaceholder = computed(() => this.currentImage() === PLACEHOLDER_IMAGE);

  onVisible(): void {
    void this.store.hydrateTypes(this.entry().id);
  }

  onImageError(failedSrc: string): void {
    const e = this.entry();
    if (failedSrc === e.animatedSpriteUrl) {
      this.animatedFailed.set(true);
    } else if (failedSrc === e.artworkUrl) {
      this.artworkFailed.set(true);
    }
  }
}

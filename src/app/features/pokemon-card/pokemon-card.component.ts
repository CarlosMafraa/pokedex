import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { PokemonListEntry } from '@core/models/pokemon-list-entry';
import { PokemonStore } from '@core/services/pokemon-store';
import { PokedexNumberPipe } from '@shared/pipes/pokedex-number.pipe';
import { InViewportDirective } from '@shared/directives/in-viewport.directive';

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

  /** Respeita "reduzir movimento": não troca para o GIF ao passar o mouse. */
  private readonly reduceMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  readonly primaryType = computed(() => this.entry().types?.[0] ?? null);

  readonly showingAnimated = computed(
    () => this.artworkFailed() || (this.hovered() && !this.reduceMotion),
  );

  readonly currentImage = computed(() => {
    const e = this.entry();
    if (this.showingAnimated()) {
      return e.animatedSpriteUrl;
    }
    return e.artworkUrl;
  });

  onVisible(): void {
    void this.store.hydrateTypes(this.entry().id);
  }

  onArtworkError(): void {
    this.artworkFailed.set(true);
  }
}

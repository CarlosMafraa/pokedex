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

  readonly primaryType = computed(() => this.entry().types?.[0] ?? null);

  readonly currentImage = computed(() => {
    const e = this.entry();
    if (this.artworkFailed() || this.hovered()) {
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

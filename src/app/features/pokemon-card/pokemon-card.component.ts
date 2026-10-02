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

  readonly artworkFailed = signal(false);
  /** Até a arte chegar, o card mostra uma pokébola apagada no lugar. */
  readonly artworkLoaded = signal(false);

  readonly primaryType = computed(() => this.entry().types?.[0] ?? null);

  /** Arte oficial; se ela não carregar, uma pokébola discreta no lugar. */
  readonly currentImage = computed(() =>
    this.artworkFailed() ? PLACEHOLDER_IMAGE : this.entry().artworkUrl,
  );

  onVisible(): void {
    void this.store.hydrateTypes(this.entry().id);
  }

  onArtworkError(): void {
    this.artworkFailed.set(true);
  }
}

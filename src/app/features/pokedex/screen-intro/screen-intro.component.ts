import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PokeballComponent } from '@shared/components/pokeball/pokeball.component';

/**
 * Carregamento da tela da Pokédex: duas metades vermelhas com a pokébola na
 * emenda. Com `open`, as metades deslizam para cima/baixo revelando os cards.
 */
@Component({
  selector: 'app-screen-intro',
  standalone: true,
  imports: [PokeballComponent],
  template: `
    <div class="half half--top"></div>
    <div class="half half--bottom"></div>
    <app-pokeball class="ball" [size]="96" [wobble]="!open()" />
  `,
  styleUrl: './screen-intro.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'status',
    'aria-label': 'Carregando Pokédex',
    '[class.screen-intro--open]': 'open()',
  },
})
export class ScreenIntroComponent {
  readonly open = input(false);
}

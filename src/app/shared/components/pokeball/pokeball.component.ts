import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Pokébola em CSS puro, usada nas telas de carregamento. Balança como numa
 * captura (desligado com "reduzir movimento"). Decorativa: quem usa informa o
 * estado de carregamento com texto/role="status".
 */
@Component({
  selector: 'app-pokeball',
  standalone: true,
  template: `<span class="ball" [class.ball--wobble]="wobble()" aria-hidden="true">
    <span class="ball__button"></span>
  </span>`,
  styleUrl: './pokeball.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--size.px]': 'size()' },
})
export class PokeballComponent {
  readonly size = input(72);
  readonly wobble = input(true);
}

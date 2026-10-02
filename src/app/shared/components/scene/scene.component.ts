import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ThemeService } from '@core/services/theme.service';

/**
 * Paisagem atrás do aparelho. Na troca de tema o sol se põe atrás das colinas
 * (direita) e só então a lua nasce (esquerda) — e o inverso ao amanhecer.
 * Céu, paisagem, estrelas e nuvens fazem cross-fade em sincronia.
 */
@Component({
  selector: 'app-scene',
  standalone: true,
  templateUrl: './scene.component.html',
  styleUrl: './scene.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneComponent {
  private readonly theme = inject(ThemeService);

  readonly dark = computed(() => this.theme.isDark());

  /** Só anima depois da primeira troca — a carga inicial já nasce no lugar. */
  readonly animating = signal(false);

  constructor() {
    let previous = this.theme.isDark();
    effect(() => {
      const dark = this.theme.isDark();
      if (dark !== previous) {
        previous = dark;
        this.animating.set(true);
      }
    });
  }
}

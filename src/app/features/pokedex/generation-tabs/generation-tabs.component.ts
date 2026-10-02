import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { GENERATIONS } from '@core/models/constants/pokemon-generations';

const pad = (n: number) => String(n).padStart(3, '0');

/**
 * Abas de geração (I–IX) no estilo dos botões do aparelho. Seguem o padrão
 * WAI-ARIA de tabs: só a aba ativa entra no Tab; setas, Home e End trocam de
 * aba (ativação automática, já que a troca é instantânea).
 */
@Component({
  selector: 'app-generation-tabs',
  standalone: true,
  templateUrl: './generation-tabs.component.html',
  styleUrl: './generation-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenerationTabsComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Índice da geração ativa (0–8). */
  readonly selected = input.required<number>();
  /** id do painel controlado pelas abas. */
  readonly panelId = input.required<string>();
  /** Busca por texto ativa: ela vale para todas as gerações, então as abas ficam apagadas. */
  readonly dimmed = input(false);

  readonly selectGeneration = output<number>();

  readonly tabs = GENERATIONS.map((gen, index) => ({
    index,
    roman: gen.label.replace('Geração ', ''),
    label: gen.label,
    range: `#${pad(gen.start)}–#${pad(gen.end)}`,
  }));

  constructor() {
    // No celular a fileira rola de lado: mantém a aba ativa à vista (ex.: link
    // com ?gen=9). Mexe só no scroll horizontal da fileira, nunca no da página.
    afterRenderEffect(() => {
      const list = this.host.nativeElement.querySelector<HTMLElement>('[role="tablist"]');
      const tab = list?.querySelector<HTMLElement>(`#${this.tabId(this.selected())}`);
      if (!list || !tab) {
        return;
      }
      const left = tab.offsetLeft - list.offsetLeft;
      const right = left + tab.offsetWidth;
      if (left < list.scrollLeft) {
        list.scrollLeft = left - 8;
      } else if (right > list.scrollLeft + list.clientWidth) {
        list.scrollLeft = right - list.clientWidth + 8;
      }
    });
  }

  tabId(index: number): string {
    return `gen-tab-${index}`;
  }

  onKeydown(event: KeyboardEvent): void {
    const last = this.tabs.length - 1;
    const current = this.selected();
    const next =
      event.key === 'ArrowRight'
        ? current === last
          ? 0
          : current + 1
        : event.key === 'ArrowLeft'
          ? current === 0
            ? last
            : current - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) {
      return;
    }
    event.preventDefault();
    this.selectGeneration.emit(next);
    this.host.nativeElement.querySelector<HTMLElement>(`#${this.tabId(next)}`)?.focus();
  }
}

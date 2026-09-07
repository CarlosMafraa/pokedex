import {
  booleanAttribute,
  Directive,
  ElementRef,
  inject,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  output,
} from '@angular/core';

/**
 * Emite `inViewport` quando o elemento entra na área visível.
 *
 * - Padrão: dispara uma única vez e para de observar (ex.: carregar os dados de
 *   um card quando ele aparece).
 * - Com `appInViewportRepeat`: dispara toda vez que o elemento reentra na
 *   viewport. Como o IntersectionObserver só notifica em transições, um
 *   sentinela de scroll infinito carrega uma página por vez, sem encadear
 *   várias cargas enquanto continua visível.
 */
@Directive({
  selector: '[appInViewport]',
  standalone: true,
})
export class InViewportDirective implements OnInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private observer?: IntersectionObserver;

  @Input({ alias: 'appInViewportRepeat', transform: booleanAttribute }) repeat = false;

  readonly inViewport = output<void>();

  ngOnInit(): void {
    if (typeof IntersectionObserver === 'undefined') {
      this.emit();
      return;
    }

    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            this.emit();
          }
        },
        { rootMargin: '200px' },
      );
      this.observer.observe(this.host.nativeElement);
    });
  }

  private emit(): void {
    if (!this.repeat) {
      this.observer?.disconnect();
      this.observer = undefined;
    }
    this.zone.run(() => this.inViewport.emit());
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}

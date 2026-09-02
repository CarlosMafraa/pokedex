import { Directive, ElementRef, inject, NgZone, OnDestroy, OnInit, output } from '@angular/core';

/**
 * Emite `inViewport` uma única vez, quando o elemento entra na área visível.
 * Usado para carregar dados de um card só quando ele aparece na tela.
 */
@Directive({
  selector: '[appInViewport]',
  standalone: true,
})
export class InViewportDirective implements OnInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private observer?: IntersectionObserver;

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
    this.observer?.disconnect();
    this.observer = undefined;
    this.zone.run(() => this.inViewport.emit());
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}

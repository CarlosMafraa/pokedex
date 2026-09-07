import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { InViewportDirective } from './in-viewport.directive';

/** Fake de IntersectionObserver dirigível: os testes disparam enter/leave. */
class FakeIO {
  static instances: FakeIO[] = [];
  disconnected = false;
  constructor(private readonly cb: IntersectionObserverCallback) {
    FakeIO.instances.push(this);
  }
  observe(): void {
    /* nada; os testes chamam fire() */
  }
  unobserve(): void {
    /* nada */
  }
  disconnect(): void {
    this.disconnected = true;
  }
  fire(isIntersecting: boolean): void {
    if (this.disconnected) {
      return;
    }
    this.cb([{ isIntersecting } as IntersectionObserverEntry], this as never);
  }
  static last(): FakeIO {
    return FakeIO.instances[FakeIO.instances.length - 1];
  }
}

@Component({
  standalone: true,
  imports: [InViewportDirective],
  template: `<div appInViewport (inViewport)="hits = hits + 1"></div>`,
})
class OnceHostComponent {
  hits = 0;
}

@Component({
  standalone: true,
  imports: [InViewportDirective],
  template: `<div appInViewport appInViewportRepeat (inViewport)="hits = hits + 1"></div>`,
})
class RepeatHostComponent {
  hits = 0;
}

describe('InViewportDirective', () => {
  let originalIO: typeof IntersectionObserver;

  beforeEach(() => {
    originalIO = window.IntersectionObserver;
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeIO;
    FakeIO.instances = [];
  });

  afterEach(() => {
    (
      window as unknown as { IntersectionObserver: typeof IntersectionObserver }
    ).IntersectionObserver = originalIO;
  });

  it('padrão: emite uma vez e desconecta o observador', () => {
    const fixture = TestBed.createComponent(OnceHostComponent);
    fixture.detectChanges();

    FakeIO.last().fire(true);
    FakeIO.last().fire(false);
    FakeIO.last().fire(true);

    expect(fixture.componentInstance.hits).toBe(1);
    expect(FakeIO.last().disconnected).toBeTrue();
  });

  it('repeat: emite a cada reentrada, sem encadear enquanto continua visível', () => {
    const fixture = TestBed.createComponent(RepeatHostComponent);
    fixture.detectChanges();
    const io = FakeIO.last();

    io.fire(true);
    expect(fixture.componentInstance.hits).toBe(1);

    // continua visível: o IntersectionObserver real não re-notifica sem transição
    io.fire(false);
    io.fire(true);
    expect(fixture.componentInstance.hits).toBe(2);

    io.fire(false);
    io.fire(true);
    expect(fixture.componentInstance.hits).toBe(3);

    expect(io.disconnected).toBeFalse();
  });

  it('emite na hora quando não há IntersectionObserver', () => {
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = undefined;
    const fixture = TestBed.createComponent(OnceHostComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.hits).toBe(1);
  });
});

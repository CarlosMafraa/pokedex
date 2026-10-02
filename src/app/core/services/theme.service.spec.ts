import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  const root = document.documentElement;

  // a classe vive no <html> real: outros specs que trocam o tema podem deixá-la
  const reset = () => root.classList.remove('theme-transition', 'app-dark');
  beforeEach(reset);
  afterEach(reset);

  it('liga a transição de cores só durante a troca feita pelo usuário', fakeAsync(() => {
    const theme = TestBed.inject(ThemeService);
    TestBed.tick();
    expect(root.classList.contains('theme-transition')).toBe(false);

    theme.toggle();
    TestBed.tick();
    expect(root.classList.contains('theme-transition')).toBe(true);

    tick(1300);
    expect(root.classList.contains('theme-transition')).toBe(false);
  }));
});

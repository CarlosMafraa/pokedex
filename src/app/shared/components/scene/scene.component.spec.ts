import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SceneComponent } from './scene.component';
import { ThemeService } from '@core/services/theme.service';

describe('SceneComponent', () => {
  let fixture: ComponentFixture<SceneComponent>;
  let theme: ThemeService;
  const root = () => fixture.nativeElement.querySelector('.scene') as HTMLElement;

  afterEach(() => document.documentElement.classList.remove('theme-transition', 'app-dark'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SceneComponent] }).compileComponents();
    theme = TestBed.inject(ThemeService);
    fixture = TestBed.createComponent(SceneComponent);
    fixture.detectChanges();
  });

  it('não anima na carga inicial (a cena já nasce no tema atual)', () => {
    expect(root().classList.contains('scene--animated')).toBe(false);
    expect(root().classList.contains('scene--night')).toBe(theme.isDark());
  });

  it('anima a troca e marca a direção (anoitecer / amanhecer)', () => {
    const startDark = theme.isDark();

    theme.toggle();
    fixture.detectChanges();
    expect(root().classList.contains('scene--animated')).toBe(true);
    expect(root().classList.contains(startDark ? 'scene--to-day' : 'scene--to-night')).toBe(true);

    theme.toggle();
    fixture.detectChanges();
    expect(root().classList.contains(startDark ? 'scene--to-night' : 'scene--to-day')).toBe(true);
  });

  it('é decorativa: fica fora da árvore de acessibilidade', () => {
    expect(root().getAttribute('aria-hidden')).toBe('true');
  });
});

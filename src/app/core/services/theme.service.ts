import { effect, Injectable, signal } from '@angular/core';

type ThemeMode = 'light' | 'dark';
const STORAGE_KEY = 'pokedex-theme';
const DARK_CLASS = 'app-dark';
const TRANSITION_CLASS = 'theme-transition';
/** Um pouco acima de --theme-duration (styles.scss) para a transição terminar. */
const TRANSITION_MS = 1300;

/**
 * Controla o modo claro/escuro. A escolha do usuário é persistida em
 * localStorage; sem escolha, segue o `prefers-color-scheme` do sistema.
 * O seletor `.app-dark` casa com o `darkModeSelector` do preset Aura.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _mode = signal<ThemeMode>(this.initialMode());
  readonly mode = this._mode.asReadonly();
  readonly isDark = () => this._mode() === 'dark';

  constructor() {
    effect(() => {
      const dark = this._mode() === 'dark';
      document.documentElement.classList.toggle(DARK_CLASS, dark);
      try {
        localStorage.setItem(STORAGE_KEY, this._mode());
      } catch {
        // modo privado / storage bloqueado: só não persiste
      }
    });
  }

  private transitionTimer: ReturnType<typeof setTimeout> | undefined;

  toggle(): void {
    // Liga a transição de cores só durante a troca feita pelo usuário.
    const root = document.documentElement;
    root.classList.add(TRANSITION_CLASS);
    clearTimeout(this.transitionTimer);
    this.transitionTimer = setTimeout(() => root.classList.remove(TRANSITION_CLASS), TRANSITION_MS);

    this._mode.update((mode) => (mode === 'dark' ? 'light' : 'dark'));
  }

  private initialMode(): ThemeMode {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch {
      // ignora
    }
    const prefersDark =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }
}

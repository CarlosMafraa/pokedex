import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PokemonCardComponent } from './pokemon-card.component';
import { PokemonListEntry } from '@core/models/pokemon-list-entry';

const entry: PokemonListEntry = {
  id: 25,
  name: 'pikachu',
  artworkUrl: 'https://example.test/25.png',
  thumbnailUrl: 'https://example.test/25?url=x&w=192&output=webp',
  types: ['electric'],
};

describe('PokemonCardComponent', () => {
  let fixture: ComponentFixture<PokemonCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PokemonCardComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(PokemonCardComponent);
    fixture.componentRef.setInput('entry', entry);
    fixture.detectChanges();
  });

  it('cria o componente', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('mostra a miniatura leve, sem trocar no hover', () => {
    const component = fixture.componentInstance;
    const card = fixture.nativeElement.querySelector('.card') as HTMLElement;

    expect(component.currentImage()).toBe(entry.thumbnailUrl);
    card.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    expect(component.currentImage()).toBe(entry.thumbnailUrl);
  });

  it('se a miniatura falhar usa a arte original, e só então a pokébola', () => {
    const component = fixture.componentInstance;
    const img = () => fixture.nativeElement.querySelector('.card__art img') as HTMLImageElement;

    component.onArtworkError();
    fixture.detectChanges();
    expect(component.currentImage()).toBe(entry.artworkUrl);
    expect(img().classList.contains('card__art-img--placeholder')).toBe(false);

    component.onArtworkError();
    fixture.detectChanges();
    expect(component.currentImage()).toContain('pokebola.png');
    expect(img().classList.contains('card__art-img--placeholder')).toBe(true);
  });

  it('reserva o espaço da arte (width/height) para não deslocar o layout', () => {
    const img = fixture.nativeElement.querySelector('.card__art img') as HTMLImageElement;
    expect(img.getAttribute('width')).toBe('96');
    expect(img.getAttribute('height')).toBe('96');
  });

  it('miniatura com srcset 1x/2x, e sem srcset quando cai para a reserva', () => {
    const img = () => fixture.nativeElement.querySelector('.card__art img') as HTMLImageElement;
    expect(img().getAttribute('srcset')).toBe(
      'https://example.test/25?url=x&w=96&output=webp 1x, https://example.test/25?url=x&w=192&output=webp 2x',
    );
    fixture.componentInstance.onArtworkError();
    fixture.detectChanges();
    expect(img().getAttribute('srcset')).toBeNull();
  });

  it('primeiros cards carregam já e com prioridade; os demais são lazy', () => {
    const img = () => fixture.nativeElement.querySelector('.card__art img') as HTMLImageElement;
    expect(img().getAttribute('loading')).toBe('lazy');
    expect(img().getAttribute('fetchpriority')).toBeNull();
    fixture.componentRef.setInput('eager', true);
    fixture.componentRef.setInput('priority', true);
    fixture.detectChanges();
    expect(img().getAttribute('loading')).toBe('eager');
    expect(img().getAttribute('fetchpriority')).toBe('high');
  });

  it('a cor do card vem do tipo já presente no item (sem requisição)', () => {
    const card = fixture.nativeElement.querySelector('.card') as HTMLElement;
    expect(card.classList.contains('type-electric')).toBe(true);
  });
});

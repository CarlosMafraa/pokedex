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

  it('mostra a arte oficial, sem trocar no hover', () => {
    const component = fixture.componentInstance;
    const card = fixture.nativeElement.querySelector('.card') as HTMLElement;

    expect(component.currentImage()).toBe(entry.artworkUrl);
    card.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    expect(component.currentImage()).toBe(entry.artworkUrl);
  });

  it('mostra a pokébola quando a arte não carrega', () => {
    const component = fixture.componentInstance;
    component.onArtworkError();
    fixture.detectChanges();

    expect(component.currentImage()).toContain('pokebola.png');
    const img = fixture.nativeElement.querySelector('.card__art img') as HTMLImageElement;
    expect(img.classList.contains('card__art-img--placeholder')).toBe(true);
  });
});

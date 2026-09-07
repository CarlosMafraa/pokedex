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
  animatedSpriteUrl: 'https://example.test/25.gif',
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

  it('mostra a arte oficial por padrão e o sprite animado no hover', () => {
    const component = fixture.componentInstance;
    const img = () => fixture.nativeElement.querySelector('.card__art img') as HTMLImageElement;

    expect(component.currentImage()).toBe(entry.artworkUrl);
    expect(img().classList.contains('card__art-img--animated')).toBe(false);

    component.hovered.set(true);
    fixture.detectChanges();

    expect(component.currentImage()).toBe(entry.animatedSpriteUrl);
    // o sprite animado recebe a classe que normaliza seu tamanho
    expect(img().classList.contains('card__art-img--animated')).toBe(true);
  });

  it('cai para o sprite animado se a arte falhar', () => {
    const component = fixture.componentInstance;
    component.onArtworkError();
    expect(component.currentImage()).toBe(entry.animatedSpriteUrl);
  });
});

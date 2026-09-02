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
    expect(component.currentImage()).toBe(entry.artworkUrl);
    component.hovered.set(true);
    expect(component.currentImage()).toBe(entry.animatedSpriteUrl);
  });

  it('cai para o sprite animado se a arte falhar', () => {
    const component = fixture.componentInstance;
    component.onArtworkError();
    expect(component.currentImage()).toBe(entry.animatedSpriteUrl);
  });
});

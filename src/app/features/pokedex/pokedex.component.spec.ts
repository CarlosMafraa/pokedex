import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { PokedexComponent } from './pokedex.component';
import { PokemonStore } from '@core/services/pokemon-store';

describe('PokedexComponent', () => {
  let fixture: ComponentFixture<PokedexComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PokedexComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        MessageService,
      ],
    }).compileComponents();

    spyOn(TestBed.inject(PokemonStore), 'loadFirstPage').and.resolveTo();
    fixture = TestBed.createComponent(PokedexComponent);
    fixture.detectChanges();
  });

  it('cria o componente', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});

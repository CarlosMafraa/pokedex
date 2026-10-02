import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { convertToParamMap } from '@angular/router';
import { PokemonDetailComponent } from './pokemon-detail.component';
import { PokemonStore } from '@core/services/pokemon-store';

describe('PokemonDetailComponent', () => {
  let fixture: ComponentFixture<PokemonDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PokemonDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ name: 'pikachu' })) },
        },
      ],
    }).compileComponents();

    spyOn(TestBed.inject(PokemonStore), 'select').and.resolveTo();
    fixture = TestBed.createComponent(PokemonDetailComponent);
    fixture.detectChanges();
  });

  it('cria o componente e pede o Pokémon da rota', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(TestBed.inject(PokemonStore).select).toHaveBeenCalledWith('pikachu');
  });

  it('alterna entre arte e GIF, e volta para a arte se o GIF falhar', () => {
    const c = fixture.componentInstance;
    expect(c.showAnimated()).toBe(false);

    c.toggleAnimated();
    expect(c.showAnimated()).toBe(true);

    c.hasAnimated.set(true);
    c.onAnimatedError();
    expect(c.showAnimated()).toBe(false);
    expect(c.hasAnimated()).toBe(false);
  });

  it('traduz as habilidades e formata as desconhecidas', () => {
    const c = fixture.componentInstance;
    expect(c.abilityLabel('blaze')).toBe('Chama');
    expect(c.abilityLabel('solar-power')).toBe('Energia Solar');
    expect(c.abilityLabel('habilidade-nova')).toBe('Habilidade Nova');
  });

  it('converte altura e peso de dm/hg para m/kg', () => {
    expect(fixture.componentInstance.heightInMeters(7)).toBe(0.7);
    expect(fixture.componentInstance.weightInKg(69)).toBe(6.9);
  });
});

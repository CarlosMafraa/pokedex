import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatHexagonComponent } from './stat-hexagon.component';
import { PokemonStat } from '@core/models/pokemon-stat';

const stat = (name: string, base_stat: number): PokemonStat => ({
  base_stat,
  effort: 0,
  stat: { name, url: '' },
});

// Charizard, na ordem em que a PokéAPI devolve
const charizard = [
  stat('hp', 78),
  stat('attack', 84),
  stat('defense', 78),
  stat('special-attack', 109),
  stat('special-defense', 85),
  stat('speed', 100),
];

describe('StatHexagonComponent', () => {
  let fixture: ComponentFixture<StatHexagonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StatHexagonComponent] }).compileComponents();
    fixture = TestBed.createComponent(StatHexagonComponent);
    fixture.componentRef.setInput('stats', charizard);
    fixture.detectChanges();
  });

  it('ordena os eixos como nos jogos (HP no topo, sentido horário)', () => {
    expect(fixture.componentInstance.vertices().map((v) => v.key)).toEqual([
      'hp',
      'attack',
      'defense',
      'speed',
      'special-defense',
      'special-attack',
    ]);
  });

  it('soma o total', () => {
    expect(fixture.componentInstance.total()).toBe(534);
  });

  it('valores acima da escala encostam na borda, mas o número fica exato', () => {
    fixture.componentRef.setInput('stats', [stat('hp', 255)]);
    const hp = fixture.componentInstance.vertices()[0];
    expect(hp.value).toBe(255);
    // HP aponta para cima: na borda = centro (146) - raio (100)
    expect(hp.y).toBeCloseTo(46, 5);
  });

  it('expõe uma tabela para leitores de tela', () => {
    const rows = fixture.nativeElement.querySelectorAll('table tr');
    expect(rows.length).toBe(7);
  });
});

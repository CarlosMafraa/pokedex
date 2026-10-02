import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PokemonStat } from '@core/models/pokemon-stat';
import {
  HEXAGON_SCALE,
  STAT_LABELS,
  STAT_ORDER,
  STAT_SHORT_LABELS,
} from '@core/models/constants/pokemon-stats';

interface Vertex {
  key: string;
  label: string;
  shortLabel: string;
  value: number;
  /** ponto do polígono de dados */
  x: number;
  y: number;
  /** posição do rótulo (nome) e do valor, fora do hexágono */
  lx: number;
  labelY: number;
  valueY: number;
  anchor: 'start' | 'middle' | 'end';
}

const CX = 160;
const CY = 146;
const R = 100;
const LABEL_GAP = 16;
const RINGS = [1 / 3, 2 / 3, 1];

function polar(ratio: number, index: number, radius = R): [number, number] {
  // eixo 0 (HP) aponta para cima; os demais seguem no sentido horário, de 60° em 60°
  const angle = (Math.PI / 3) * index;
  return [CX + radius * ratio * Math.sin(angle), CY - radius * ratio * Math.cos(angle)];
}

const fmt = (n: number) => n.toFixed(1);
const toPoints = (pts: [number, number][]) => pts.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' ');

/**
 * Hexágono de status no estilo dos jogos (Sword/Shield): um eixo por stat, com
 * o valor escrito na ponta. Escala até {@link HEXAGON_SCALE}; acima disso o
 * ponto encosta na borda, mas o número continua exato.
 */
@Component({
  selector: 'app-stat-hexagon',
  standalone: true,
  templateUrl: './stat-hexagon.component.html',
  styleUrl: './stat-hexagon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatHexagonComponent {
  readonly stats = input.required<PokemonStat[]>();

  readonly center = { x: CX, y: CY };

  readonly rings = RINGS.map((r) => toPoints(STAT_ORDER.map((_, i) => polar(r, i))));
  readonly spokes = STAT_ORDER.map((_, i) => polar(1, i));

  readonly vertices = computed<Vertex[]>(() => {
    const byName = new Map(this.stats().map((s) => [s.stat.name, s.base_stat]));
    return STAT_ORDER.map((key, i) => {
      const value = byName.get(key) ?? 0;
      const [x, y] = polar(Math.min(value, HEXAGON_SCALE) / HEXAGON_SCALE, i);
      const [lx, ly] = polar(1, i, R + LABEL_GAP);
      const anchor = i === 0 || i === 3 ? 'middle' : i < 3 ? 'start' : 'end';
      // no eixo do topo o par nome/valor sobe inteiro, para não cobrir o ponto
      const shift = i === 0 ? -16 : 0;
      const labelY = ly - 3 + shift;
      const valueY = ly + 15 + shift;
      return {
        key,
        label: STAT_LABELS[key] ?? key,
        shortLabel: STAT_SHORT_LABELS[key] ?? key,
        value,
        x,
        y,
        lx,
        labelY,
        valueY,
        anchor,
      };
    });
  });

  readonly polygon = computed(() => toPoints(this.vertices().map((v) => [v.x, v.y])));

  readonly total = computed(() => this.vertices().reduce((sum, v) => sum + v.value, 0));
}

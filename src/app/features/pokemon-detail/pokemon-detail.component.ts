import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { Dialog } from 'primeng/dialog';
import { ProgressBar } from 'primeng/progressbar';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { PokemonStore } from '@core/services/pokemon-store';
import { PokemonService } from '@core/services/pokemon.service';
import { PokedexNumberPipe } from '@shared/pipes/pokedex-number.pipe';
import { MAX_BASE_STAT, STAT_COLORS, STAT_LABELS } from '@core/models/constants/pokemon-stats';
import { POKEMON_TYPE_LABELS, PokemonType } from '@core/models/constants/pokemon-types';

const GENERATION_LABELS: Record<string, string> = {
  'generation-i': 'Geração I',
  'generation-ii': 'Geração II',
  'generation-iii': 'Geração III',
  'generation-iv': 'Geração IV',
  'generation-v': 'Geração V',
  'generation-vi': 'Geração VI',
  'generation-vii': 'Geração VII',
  'generation-viii': 'Geração VIII',
  'generation-ix': 'Geração IX',
};

@Component({
  selector: 'app-pokemon-detail',
  standalone: true,
  imports: [
    DecimalPipe,
    TitleCasePipe,
    Dialog,
    ProgressBar,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    PokedexNumberPipe,
  ],
  templateUrl: './pokemon-detail.component.html',
  styleUrl: './pokemon-detail.component.scss',
})
export class PokemonDetailComponent {
  private readonly store = inject(PokemonStore);
  private readonly api = inject(PokemonService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly statColors = STAT_COLORS;
  readonly visible = signal(true);

  readonly pokemon = this.store.selected;
  readonly species = this.store.selectedSpecies;
  readonly loading = this.store.detailLoading;

  private readonly routeName = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('name'))),
    { initialValue: null },
  );

  readonly artwork = computed(() => {
    const p = this.pokemon();
    return p ? this.api.artworkUrl(p.id) : '';
  });

  readonly typeBadges = computed(() =>
    (this.pokemon()?.types ?? []).map((t) => ({
      name: t.type.name,
      label: POKEMON_TYPE_LABELS[t.type.name as PokemonType] ?? t.type.name,
    })),
  );

  readonly primaryType = computed(() => this.pokemon()?.types?.[0]?.type.name ?? 'normal');

  readonly flavorText = computed(() => {
    const entries = this.species()?.flavor_text_entries ?? [];
    const pick =
      entries.find((e) => e.language.name === 'pt' || e.language.name === 'pt-BR') ??
      entries.find((e) => e.language.name === 'en');
    return pick?.flavor_text.replace(/\s+/g, ' ').trim() ?? '';
  });

  readonly generationLabel = computed(() => {
    const gen = this.species()?.generation?.name;
    return gen ? (GENERATION_LABELS[gen] ?? gen) : '';
  });

  constructor() {
    effect(() => {
      const name = this.routeName();
      if (name) {
        void this.store.select(name);
      }
    });
  }

  statLabel(name: string): string {
    return STAT_LABELS[name] ?? name;
  }

  statPercent(baseStat: number): number {
    return Math.min(100, (baseStat / MAX_BASE_STAT) * 100);
  }

  heightInMeters(height: number | undefined): number {
    return (height ?? 0) / 10;
  }

  weightInKg(weight: number | undefined): number {
    return (weight ?? 0) / 10;
  }

  close(): void {
    this.visible.set(false);
    this.store.closeDetail();
    void this.router.navigate(['..'], { relativeTo: this.route });
  }
}

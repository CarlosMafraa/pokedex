import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { Dialog } from 'primeng/dialog';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { PokemonStore } from '@core/services/pokemon-store';
import { PokemonService } from '@core/services/pokemon.service';
import { PokedexNumberPipe } from '@shared/pipes/pokedex-number.pipe';
import { StatHexagonComponent } from './stat-hexagon/stat-hexagon.component';
import { PokeballComponent } from '@shared/components/pokeball/pokeball.component';
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
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    PokedexNumberPipe,
    StatHexagonComponent,
    PokeballComponent,
  ],
  templateUrl: './pokemon-detail.component.html',
  styleUrl: './pokemon-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PokemonDetailComponent implements OnDestroy {
  private readonly store = inject(PokemonStore);
  private readonly api = inject(PokemonService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly dialogRef = viewChild(Dialog);
  private closing = false;

  readonly visible = signal(true);
  readonly activeTab = signal<'sobre' | 'status'>('sobre');

  readonly pokemon = this.store.selected;
  readonly species = this.store.selectedSpecies;
  readonly loading = this.store.detailLoading;
  readonly detailError = this.store.detailError;

  private readonly routeName = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('name'))),
    { initialValue: null },
  );

  readonly artwork = computed(() => {
    const p = this.pokemon();
    return p ? this.api.artworkUrl(p.id) : '';
  });

  /**
   * Sprite animado (Gen V). No celular não há hover nos cards, então é aqui que
   * ele aparece: um botão alterna arte ↔ GIF. Só existe para parte dos Pokémon
   * (falta a partir do #650), por isso testamos antes de oferecer o botão.
   */
  readonly animatedUrl = computed(() => {
    const p = this.pokemon();
    return p ? this.api.animatedSpriteUrl(p.id) : '';
  });
  readonly hasAnimated = signal(false);
  readonly showAnimated = signal(false);
  /** A arte chegou: o Pokémon "sai da pokébola" (até lá, a pokébola balança). */
  readonly artReady = signal(false);

  readonly typeBadges = computed(() =>
    (this.pokemon()?.types ?? []).map((t) => ({
      name: t.type.name,
      label: POKEMON_TYPE_LABELS[t.type.name as PokemonType] ?? t.type.name,
    })),
  );

  readonly primaryType = computed(() => this.pokemon()?.types?.[0]?.type.name ?? 'normal');

  /** Descrição em pt-BR: `undefined` enquanto carrega, `null` se não houver tradução. */
  readonly flavorPtBr = signal<string | null | undefined>(undefined);

  readonly flavorText = computed(() => {
    const pt = this.flavorPtBr();
    if (pt === undefined) {
      return '';
    }
    if (pt) {
      return pt;
    }
    // sem tradução para este id: cai para o texto em inglês da PokéAPI
    const entry = this.species()?.flavor_text_entries.find((e) => e.language.name === 'en');
    return (
      entry?.flavor_text
        .replace(/\u00ad\s*/g, '')
        .replace(/\s+/g, ' ')
        .trim() ?? ''
    );
  });

  readonly generationLabel = computed(() => {
    const gen = this.species()?.generation?.name;
    return gen ? (GENERATION_LABELS[gen] ?? gen) : '';
  });

  /** Nome acessível do diálogo (o cabeçalho do PrimeNG está desativado). */
  readonly dialogTitle = computed(() => {
    const p = this.pokemon();
    if (p) {
      return `${p.name.charAt(0).toUpperCase()}${p.name.slice(1)} — detalhes`;
    }
    return this.detailError() ? 'Detalhe indisponível' : 'Carregando Pokémon';
  });

  constructor() {
    effect(() => {
      const name = this.routeName();
      if (name) {
        void this.store.select(name);
      }
    });

    effect((onCleanup) => {
      const id = this.pokemon()?.id;
      this.flavorPtBr.set(undefined);
      if (id === undefined) {
        return;
      }
      let current = true;
      void this.api.getFlavorTextPtBr(id).then((text) => current && this.flavorPtBr.set(text));
      onCleanup(() => (current = false));
    });

    // Ao trocar de Pokémon: volta para a arte e verifica se existe GIF.
    effect((onCleanup) => {
      const url = this.animatedUrl();
      this.showAnimated.set(false);
      this.hasAnimated.set(false);
      this.artReady.set(false);
      if (!url) {
        return;
      }
      const probe = new Image();
      probe.onload = () => this.hasAnimated.set(true);
      probe.src = url;
      onCleanup(() => (probe.onload = null));
    });

    // O cabeçalho do PrimeNG está desativado; damos um nome acessível ao
    // role="dialog" à mão e o mantemos em dia com o estado (carregando/erro/nome).
    effect(() => this.syncDialogAria());
  }

  ngOnDestroy(): void {
    this.store.closeDetail();
  }

  syncDialogAria(): void {
    this.dialogRef()?.container?.setAttribute('aria-label', this.dialogTitle());
  }

  /** Nova tentativa após falha de rede no carregamento do detalhe. */
  retry(): void {
    const name = this.routeName();
    if (name) {
      void this.store.select(name);
    }
  }

  toggleAnimated(): void {
    this.showAnimated.update((on) => !on);
  }

  /** O GIF existia no teste mas falhou ao exibir: volta para a arte. */
  onAnimatedError(): void {
    if (this.showAnimated()) {
      this.showAnimated.set(false);
      this.hasAnimated.set(false);
    }
  }

  heightInMeters(height: number | undefined): number {
    return (height ?? 0) / 10;
  }

  weightInKg(weight: number | undefined): number {
    return (weight ?? 0) / 10;
  }

  /** Fechar tem três gatilhos (botão, ESC, clique na máscara → `visibleChange`);
   *  a guarda evita navegar duas vezes quando dois deles disparam juntos. */
  close(): void {
    if (this.closing) {
      return;
    }
    this.closing = true;
    this.visible.set(false);
    this.store.closeDetail();
    void this.router.navigate(['..'], { relativeTo: this.route, queryParamsHandling: 'preserve' });
  }
}

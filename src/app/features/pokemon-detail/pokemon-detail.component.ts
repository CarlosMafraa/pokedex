import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { Dialog } from 'primeng/dialog';
import { PokemonStore } from '@core/services/pokemon-store';
import { PokemonService } from '@core/services/pokemon.service';
import { PokedexNumberPipe } from '@shared/pipes/pokedex-number.pipe';
import { StatHexagonComponent } from './stat-hexagon/stat-hexagon.component';
import { PokeballComponent } from '@shared/components/pokeball/pokeball.component';
import { POKEMON_TYPE_LABELS, PokemonType } from '@core/models/constants/pokemon-types';
import { ABILITY_LABELS } from '@core/models/constants/pokemon-abilities';

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

type DetailTab = 'sobre' | 'status';

/** A partir desta largura o detalhe vira cartão em duas colunas. */
const WIDE_QUERY = typeof matchMedia === 'function' ? '(min-width: 760px)' : null;
/** Duração da troca animada entre Sobre e Status no painel do celular. */
const TAB_ANIM_MS = 320;
const TAB_ANIM_EASING = 'cubic-bezier(0.3, 0, 0.2, 1)';

/** Menores tamanhos aceitos ao encaixar o detalhe na tela (ver fitToViewport). */
const MIN_ART_PX = 64;
const MIN_HEX_PX = 150;
/** Altura do hexágono em relação à largura (viewBox 320×290 + linha do total). */
const HEX_HEIGHT_RATIO = 0.95;

/** Quanto arrastar o painel para baixo (px) para fechar. */
const SHEET_CLOSE_DRAG_PX = 110;

@Component({
  selector: 'app-pokemon-detail',
  standalone: true,
  imports: [
    DecimalPipe,
    TitleCasePipe,
    Dialog,
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
  readonly activeTab = signal<DetailTab>('sobre');
  readonly tabs: { value: DetailTab; label: string }[] = [
    { value: 'sobre', label: 'Sobre' },
    { value: 'status', label: 'Status' },
  ];

  /**
   * Desktop: cartão em duas colunas, tudo visível. Celular: painel que sobe de
   * baixo, com o seletor Sobre | Status (não cabe tudo junto).
   */
  readonly wide = signal(WIDE_QUERY ? matchMedia(WIDE_QUERY).matches : true);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** Encaixe na tela agendado para o próximo frame (ver fitToViewport). */
  private fitFrame = 0;
  /** Durante a troca animada de aba o encaixe espera (mediria tamanhos intermediários). */
  private tabAnimating = false;
  private readonly scheduleFit = () => {
    cancelAnimationFrame(this.fitFrame);
    this.fitFrame = requestAnimationFrame(() => {
      if (!this.tabAnimating) {
        this.fitToViewport();
      }
    });
  };

  /** Arrastar o puxador do painel para baixo fecha o detalhe. */
  private drag: { startY: number; sheet: HTMLElement } | null = null;

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
    if (WIDE_QUERY) {
      const query = matchMedia(WIDE_QUERY);
      const onChange = (event: MediaQueryListEvent) => this.wide.set(event.matches);
      query.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => query.removeEventListener('change', onChange));
    }

    // Encaixa o detalhe na tela sempre que o tamanho real do conteúdo muda
    // (texto chegando, fonte carregando, troca de aba) ou a janela muda.
    const scheduleFit = this.scheduleFit;
    const observer = new ResizeObserver(scheduleFit);
    let observed: Element[] = [];
    afterRenderEffect(() => {
      this.pokemon();
      this.activeTab();
      this.wide();
      const targets = Array.from(
        this.host.nativeElement.querySelectorAll('.detail, .detail__info'),
      );
      if (targets.some((el, i) => el !== observed[i]) || targets.length !== observed.length) {
        observer.disconnect();
        targets.forEach((el) => observer.observe(el));
        observed = targets;
      }
      scheduleFit();
    });
    window.addEventListener('resize', scheduleFit);
    inject(DestroyRef).onDestroy(() => {
      observer.disconnect();
      cancelAnimationFrame(this.fitFrame);
      window.removeEventListener('resize', scheduleFit);
    });

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

  /**
   * O detalhe não deve rolar. Zera os ajustes, mede quanto o conteúdo natural
   * passa do espaço e encolhe primeiro a arte (só no painel do celular, na aba
   * Sobre) e depois o hexágono, até os mínimos. É idempotente: rodar de novo
   * com o mesmo conteúdo dá o mesmo resultado, então o ResizeObserver para.
   */
  private fitToViewport(): void {
    const root = this.host.nativeElement;
    const content = root.querySelector<HTMLElement>('.pokemon-detail__content');
    const detail = root.querySelector<HTMLElement>('.detail');
    if (!content || !detail) {
      return;
    }
    detail.style.removeProperty('--art-size');
    detail.style.removeProperty('--hex-width');
    let over = content.scrollHeight - content.clientHeight;
    if (over <= 0) {
      return;
    }

    const art = root.querySelector<HTMLElement>('.detail__art-wrap');
    if (art && !this.wide() && this.activeTab() === 'sobre') {
      const current = art.offsetHeight;
      const next = Math.max(MIN_ART_PX, current - over);
      detail.style.setProperty('--art-size', `${next}px`);
      over -= current - next;
    }

    // <svg> não tem offsetWidth; o retângulo do svg não sofre a animação
    const hex = root.querySelector<SVGSVGElement>('app-stat-hexagon .hex__chart');
    if (over > 0 && hex) {
      const width = hex.getBoundingClientRect().width;
      const next = Math.max(MIN_HEX_PX, Math.floor(width - over / HEX_HEIGHT_RATIO) - 2);
      detail.style.setProperty('--hex-width', `${next}px`);
    }
  }

  /** Setas trocam entre Sobre e Status (padrão WAI-ARIA de tabs). */
  onSegmentKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    const next: DetailTab = this.activeTab() === 'sobre' ? 'status' : 'sobre';
    this.selectTab(next);
    document.getElementById(`detail-tab-${next}`)?.focus();
  }

  /**
   * Troca Sobre ↔ Status com transição: a área da arte anima a altura, a arte
   * escala do tamanho antigo para o novo (FLIP: o layout já é o final, a
   * animação é só visual) e o conteúdo novo entra com fade. O encaixe na tela
   * roda antes, sobre o layout final, e fica pausado durante a animação.
   */
  selectTab(next: DetailTab): void {
    if (next === this.activeTab()) {
      return;
    }
    const root = this.host.nativeElement;
    const hero = root.querySelector<HTMLElement>('.detail__hero');
    const art = root.querySelector<HTMLElement>('.detail__art-wrap');
    const animate =
      !this.wide() &&
      !!hero &&
      !!art &&
      typeof hero.animate === 'function' &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animate) {
      this.activeTab.set(next);
      return;
    }

    const heroFrom = hero.getBoundingClientRect().height;
    const artFrom = art.offsetHeight;
    this.tabAnimating = true;
    this.activeTab.set(next);

    afterNextRender(
      () => {
        this.fitToViewport(); // layout final antes de animar
        const heroTo = hero.getBoundingClientRect().height;
        const artTo = art.offsetHeight;
        const options = { duration: TAB_ANIM_MS, easing: TAB_ANIM_EASING };

        // altura da área da arte (sem crescer pelo flex enquanto anima)
        const heroAnim = hero.animate(
          [
            { height: `${heroFrom}px`, flexGrow: 0, overflow: 'hidden' },
            { height: `${heroTo}px`, flexGrow: 0, overflow: 'hidden' },
          ],
          options,
        );
        // a arte acompanha o centro da área sozinha; aqui só o tamanho
        if (artTo > 0 && artFrom !== artTo) {
          art.animate([{ transform: `scale(${artFrom / artTo})` }, { transform: 'none' }], options);
        }
        root.querySelector(next === 'sobre' ? '.detail__about' : '.detail__stats')?.animate(
          [
            { opacity: 0, transform: 'translateY(8px)' },
            { opacity: 1, transform: 'none' },
          ],
          options,
        );

        const done = () => {
          this.tabAnimating = false;
          this.scheduleFit();
        };
        heroAnim.finished.then(done, done);
      },
      { injector: this.injector },
    );
  }

  onHandleDown(event: PointerEvent): void {
    const handle = event.currentTarget as HTMLElement;
    const sheet = handle.closest<HTMLElement>('.p-dialog');
    if (!sheet) {
      return;
    }
    handle.setPointerCapture(event.pointerId);
    sheet.style.transition = 'none';
    this.drag = { startY: event.clientY, sheet };
  }

  onHandleMove(event: PointerEvent): void {
    if (this.drag) {
      const dy = Math.max(0, event.clientY - this.drag.startY);
      this.drag.sheet.style.transform = `translateY(${dy}px)`;
    }
  }

  onHandleUp(event: PointerEvent): void {
    if (!this.drag) {
      return;
    }
    const { startY, sheet } = this.drag;
    this.drag = null;
    if (event.clientY - startY > SHEET_CLOSE_DRAG_PX) {
      this.close();
      return;
    }
    // não arrastou o bastante: volta ao lugar
    sheet.style.transition = 'transform 0.2s ease';
    sheet.style.transform = '';
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

  /** Nome da habilidade em pt-BR; desconhecida cai para o slug formatado ("solar-power" → "Solar Power"). */
  abilityLabel(slug: string): string {
    return ABILITY_LABELS[slug] ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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

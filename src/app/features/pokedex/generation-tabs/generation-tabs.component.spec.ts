import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GenerationTabsComponent } from './generation-tabs.component';

describe('GenerationTabsComponent', () => {
  let fixture: ComponentFixture<GenerationTabsComponent>;
  let emitted: number[];

  const tabs = () =>
    Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]')) as HTMLElement[];
  const press = (key: string) =>
    fixture.nativeElement
      .querySelector('[aria-selected="true"]')
      .dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenerationTabsComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(GenerationTabsComponent);
    fixture.componentRef.setInput('selected', 0);
    fixture.componentRef.setInput('panelId', 'painel');
    emitted = [];
    fixture.componentInstance.selectGeneration.subscribe((i) => emitted.push(i));
    fixture.detectChanges();
  });

  it('renderiza as 9 gerações com só a ativa no Tab', () => {
    expect(tabs().map((t) => t.textContent?.trim())).toEqual([
      'I',
      'II',
      'III',
      'IV',
      'V',
      'VI',
      'VII',
      'VIII',
      'IX',
    ]);
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs()[0].tabIndex).toBe(0);
    expect(tabs()[1].tabIndex).toBe(-1);
    expect(tabs()[0].getAttribute('aria-controls')).toBe('painel');
  });

  it('setas, Home e End trocam de aba (com volta ao início/fim)', () => {
    press('ArrowRight');
    press('ArrowLeft'); // de I vai para IX
    press('End');
    press('Home');
    press('a'); // outras teclas não fazem nada
    expect(emitted).toEqual([1, 8, 8, 0]);
  });

  it('clique emite a geração escolhida', () => {
    tabs()[4].click();
    expect(emitted).toEqual([4]);
  });
});

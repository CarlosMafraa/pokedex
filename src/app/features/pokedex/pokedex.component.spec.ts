import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
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

    spyOn(TestBed.inject(PokemonStore), 'loadAll').and.resolveTo();
    fixture = TestBed.createComponent(PokedexComponent);
    fixture.detectChanges();
  });

  it('cria o componente', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('retryInitialLoad refaz a carga inicial (não a busca vazia)', () => {
    const store = TestBed.inject(PokemonStore);
    (store.loadAll as jasmine.Spy).calls.reset();
    const search = spyOn(store, 'search');

    fixture.componentInstance.retryInitialLoad();

    expect(store.loadAll).toHaveBeenCalledTimes(1);
    expect(search).not.toHaveBeenCalled();
  });

  it('trocar de aba muda a geração e grava ?gen= no endereço', () => {
    const store = TestBed.inject(PokemonStore);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    fixture.componentInstance.selectGeneration(2);

    expect(store.genIndex()).toBe(2);
    expect(navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining({ queryParams: { gen: 3 }, replaceUrl: true }),
    );
    expect(fixture.componentInstance.screenTitle()).toBe('Geração III · #252–#386');
  });
});

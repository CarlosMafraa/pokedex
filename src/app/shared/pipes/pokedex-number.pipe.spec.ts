import { PokedexNumberPipe } from './pokedex-number.pipe';

describe('PokedexNumberPipe', () => {
  const pipe = new PokedexNumberPipe();

  it('preenche com zeros à esquerda', () => {
    expect(pipe.transform(1)).toBe('#001');
    expect(pipe.transform(25)).toBe('#025');
    expect(pipe.transform(150)).toBe('#150');
  });

  it('não trunca números com mais dígitos', () => {
    expect(pipe.transform(1025)).toBe('#1025');
  });

  it('trata valores ausentes', () => {
    expect(pipe.transform(null)).toBe('#—');
    expect(pipe.transform(undefined)).toBe('#—');
    expect(pipe.transform(NaN)).toBe('#—');
  });
});

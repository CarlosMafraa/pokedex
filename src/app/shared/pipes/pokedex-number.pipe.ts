import { Pipe, PipeTransform } from '@angular/core';

/** Formata o número nacional como `#001`, `#025`, `#150`. */
@Pipe({
  name: 'pokedexNumber',
  standalone: true,
})
export class PokedexNumberPipe implements PipeTransform {
  transform(id: number | null | undefined, digits = 3): string {
    if (id == null || Number.isNaN(id)) {
      return '#—';
    }
    return `#${String(id).padStart(digits, '0')}`;
  }
}

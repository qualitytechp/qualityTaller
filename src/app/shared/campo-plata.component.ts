import { Component, computed, input, model } from '@angular/core';
import { aNumero, plata } from '../core/formato';

/** Campo para escribir plata: muestra "$120.000" mientras se escribe y entrega el número. */
@Component({
  selector: 'qt-campo-plata',
  template: `
    <input
      class="input input-money"
      [class.grande]="grande()"
      [id]="campoId()"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      placeholder="$0"
      [value]="texto()"
      (input)="escribir($event)"
    />
  `,
  styles: `
    .grande {
      font-size: 28px;
      font-weight: 800;
      min-height: 62px;
    }
  `,
})
export class CampoPlataComponent {
  readonly valor = model(0);
  readonly campoId = input<string>();
  readonly grande = input(false);
  protected readonly texto = computed(() => (this.valor() ? plata(this.valor()) : ''));

  escribir(e: Event): void {
    const campo = e.target as HTMLInputElement;
    const n = Math.min(aNumero(campo.value), 999_999_999);
    this.valor.set(n);
    // Si el número no cambió (ej. se escribió una letra), igual se limpia el campo.
    campo.value = n ? plata(n) : '';
  }
}

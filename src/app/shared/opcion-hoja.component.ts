import { Component, input } from '@angular/core';

/** Fila tocable dentro de una hoja inferior: nombre, detalle y precio a la derecha. */
@Component({
  selector: 'button[qt-opcion]',
  host: { class: 'card-sm card-tap row', type: 'button' },
  template: `
    <div class="grow">
      <div class="nombre">{{ nombre() }}</div>
      @if (meta()) {
        <div class="meta" [style.color]="metaColor()">{{ meta() }}</div>
      }
    </div>
    @if (precio()) {
      <div class="display precio">{{ precio() }}</div>
    }
  `,
  styles: `
    :host {
      min-height: 64px;
    }
    .nombre {
      font-size: 15.5px;
      font-weight: 600;
      line-height: 1.3;
    }
    .meta {
      font-size: 12.5px;
      margin-top: 3px;
    }
    .precio {
      font-size: 17px;
      white-space: nowrap;
    }
  `,
})
export class OpcionHojaComponent {
  readonly nombre = input.required<string>();
  readonly meta = input('');
  readonly metaColor = input('var(--gray-500)');
  readonly precio = input('');
}

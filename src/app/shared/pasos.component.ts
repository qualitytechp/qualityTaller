import { Component, computed, input } from '@angular/core';

/** Barra de avance de un paso a paso ("Paso N de 4"). */
@Component({
  selector: 'qt-pasos',
  template: `
    <div class="barra">
      @for (p of segmentos(); track $index) {
        <div class="tramo" [class.hecho]="p"></div>
      }
    </div>
    <div class="cabeza">
      <div class="titulo">{{ titulo() }}</div>
      <div class="cuenta">Paso {{ paso() }} de {{ total() }}</div>
    </div>
    @if (ayuda()) {
      <div class="ayuda">{{ ayuda() }}</div>
    }
  `,
  styles: `
    :host {
      display: block;
      position: sticky;
      top: var(--header-h);
      z-index: 20;
      background: var(--gray-50);
      padding: 14px 16px 12px;
    }
    .barra {
      display: flex;
      gap: 6px;
    }
    .tramo {
      flex: 1;
      height: 6px;
      border-radius: 999px;
      background: var(--border-default);
    }
    .tramo.hecho {
      background: var(--red-600);
    }
    .cabeza {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin: 12px 0 4px;
      gap: 10px;
    }
    .titulo {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 26px;
      text-transform: uppercase;
      letter-spacing: 0.01em;
      line-height: 1.1;
    }
    .cuenta {
      font-size: 12px;
      font-weight: 600;
      color: var(--gray-500);
      white-space: nowrap;
    }
    .ayuda {
      font-size: 14px;
      color: var(--gray-500);
      line-height: 1.35;
    }
  `,
})
export class PasosComponent {
  readonly paso = input.required<number>();
  readonly total = input(4);
  readonly titulo = input.required<string>();
  readonly ayuda = input('');
  protected readonly segmentos = computed(() => Array.from({ length: this.total() }, (_, i) => i < this.paso()));
}

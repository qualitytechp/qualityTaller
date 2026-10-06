import { Component, computed, input } from '@angular/core';
import { ESTADOS } from '../core/estados';
import type { EstadoOrden } from '../core/models';

/** Pastilla de estado: siempre color y texto. */
@Component({
  selector: 'qt-estado',
  template: `<span class="badge" [style.background]="info().bg" [style.color]="info().fg">{{ info().label }}</span>`,
})
export class EstadoComponent {
  readonly estado = input.required<EstadoOrden>();
  protected readonly info = computed(() => ESTADOS[this.estado()]);
}

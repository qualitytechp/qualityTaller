import { Component, inject } from '@angular/core';
import { UiService } from '../core/ui.service';

@Component({
  selector: 'qt-aviso',
  template: `
    @if (ui.aviso()) {
      <div class="aviso" role="status">{{ ui.aviso() }}</div>
    }
  `,
  styles: `
    /* Arriba y sin recibir toques: nunca tapa la acción principal, que va abajo. */
    .aviso {
      position: fixed;
      top: calc(var(--header-h) + env(safe-area-inset-top, 0px) + 10px);
      pointer-events: none;
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - 32px);
      max-width: 398px;
      background: var(--zinc-900);
      color: var(--white);
      padding: 14px 16px;
      border-radius: 14px;
      font-size: 14px;
      z-index: 50;
      animation: qtUp 0.18s ease-out;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }
  `,
})
export class AvisoComponent {
  protected readonly ui = inject(UiService);
}

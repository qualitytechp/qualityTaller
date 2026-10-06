import { Component, inject } from '@angular/core';
import { UiService } from '../core/ui.service';

/** Modal centrado para confirmar antes de cobrar, borrar, rechazar o cerrar la caja. */
@Component({
  selector: 'qt-confirmacion',
  template: `
    @if (ui.confirmacion(); as c) {
      <div class="fondo">
        <div class="caja" role="alertdialog" aria-modal="true">
          <div class="titulo">{{ c.titulo }}</div>
          <div class="texto">{{ c.texto }}</div>
          <button
            type="button"
            class="btn btn-lg"
            [class.btn-primary]="c.tono !== 'verde'"
            [class.btn-success]="c.tono === 'verde'"
            (click)="c.responder(true)"
          >
            {{ c.si }}
          </button>
          <button type="button" class="btn btn-outline" (click)="c.responder(false)">Cancelar</button>
        </div>
      </div>
    }
  `,
  styles: `
    .fondo {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      z-index: 48;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .caja {
      width: 100%;
      max-width: 340px;
      background: var(--white);
      border-radius: 20px;
      padding: 22px;
      animation: qtUp 0.18s ease-out;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .titulo {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 22px;
      line-height: 1.2;
    }
    .texto {
      font-size: 15px;
      color: var(--gray-600);
      line-height: 1.45;
      margin-bottom: 10px;
    }
  `,
})
export class ConfirmacionComponent {
  protected readonly ui = inject(UiService);
}

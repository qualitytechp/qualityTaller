import { Component, input, output, signal } from '@angular/core';

/** Teclado grande de 4 dígitos, cómodo con las manos sucias o con guantes. */
@Component({
  selector: 'qt-teclado-pin',
  template: `
    <div class="puntos" [class.error]="error()">
      @for (i of [0, 1, 2, 3]; track i) {
        <span class="punto" [class.lleno]="pin().length > i"></span>
      }
    </div>
    <div class="teclas">
      @for (t of teclas; track t) {
        @if (t === '') {
          <span></span>
        } @else if (t === '⌫') {
          <button type="button" class="tecla borrar" aria-label="Borrar" (click)="borrar()">⌫</button>
        } @else {
          <button type="button" class="tecla" (click)="tocar(t)">{{ t }}</button>
        }
      }
    </div>
  `,
  styles: `
    .puntos {
      display: flex;
      justify-content: center;
      gap: 18px;
      margin: 8px 0 28px;
    }
    .puntos.error {
      animation: qtShake 0.35s;
    }
    .punto {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid var(--gray-400);
    }
    .punto.lleno {
      background: var(--red-600);
      border-color: var(--red-600);
    }
    .error .punto {
      border-color: var(--red-600);
    }
    .teclas {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .tecla {
      min-height: 68px;
      border-radius: 16px;
      border: 1px solid var(--border-default);
      background: var(--white);
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 30px;
      color: var(--gray-900);
    }
    .tecla:active {
      background: var(--gray-100);
    }
    .borrar {
      font-family: var(--font-sans);
      font-size: 24px;
      color: var(--gray-600);
    }
  `,
})
export class TecladoPinComponent {
  /** Se pone en true un momento para sacudir los puntos cuando el PIN es incorrecto. */
  readonly error = input(false);
  readonly completo = output<string>();

  protected readonly teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  protected readonly pin = signal('');

  tocar(d: string): void {
    if (this.pin().length >= 4) return;
    const nuevo = this.pin() + d;
    this.pin.set(nuevo);
    if (nuevo.length === 4) {
      // Deja ver el cuarto punto antes de avisar.
      setTimeout(() => {
        this.completo.emit(nuevo);
        this.pin.set('');
      }, 120);
    }
  }

  borrar(): void {
    this.pin.update((p) => p.slice(0, -1));
  }
}

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { pedirAlmacenamientoPersistente } from './core/db';
import { AvisoComponent } from './shared/aviso.component';
import { ConfirmacionComponent } from './shared/confirmacion.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AvisoComponent, ConfirmacionComponent],
  template: `
    <div class="app">
      <router-outlet />
      <qt-aviso />
      <qt-confirmacion />
    </div>
  `,
  styles: `
    :host {
      display: flex;
      justify-content: center;
      min-height: 100vh;
      min-height: 100dvh;
    }
    .app {
      width: 100%;
      max-width: var(--app-max);
      min-height: 100vh;
      min-height: 100dvh;
      background: var(--gray-50);
      position: relative;
      overflow-x: hidden;
      box-shadow: 0 0 70px rgba(0, 0, 0, 0.22);
      padding-bottom: calc(180px + var(--safe-bottom));
    }
  `,
})
export class App {
  constructor() {
    // Que iOS no borre los datos del taller cuando falte espacio.
    pedirAlmacenamientoPersistente();
  }
}

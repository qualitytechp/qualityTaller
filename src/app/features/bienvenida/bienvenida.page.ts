import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type { Rol } from '../../core/models';
import { ROL_LABEL } from '../../core/sesion.service';
import { PIN_EJEMPLO, PersonaNueva, TallerService } from '../../core/taller.service';
import { UiService } from '../../core/ui.service';
import { PasosComponent } from '../../shared/pasos.component';

const TITULOS = ['Tu taller', '¿Quién eres?', '¿Quién más trabaja?', '¿Cómo arrancas?'];
const AYUDAS = [
  'El nombre sale en los recibos y en los mensajes de WhatsApp.',
  'Eres el administrador: ves todo. Tu PIN de 4 números es para entrar a la app.',
  'Cada persona entra con su propio PIN. Así queda quién hizo cada cosa. Puedes saltarte este paso.',
  'Empieza con el taller vacío o pruébalo primero con datos de ejemplo.',
];

const pinValido = (p: string) => /^\d{4}$/.test(p);

/** Primera vez que se abre la app en este celular. */
@Component({
  selector: 'qt-bienvenida',
  imports: [FormsModule, PasosComponent],
  template: `
    <header class="marca">Quality<span>Taller</span></header>
    <qt-pasos [paso]="paso()" [titulo]="titulos[paso() - 1]" [ayuda]="ayudas[paso() - 1]" />

    <div class="page stack-12">
      @switch (paso()) {
        @case (1) {
          <div class="card">
            <label class="label" for="taller">Nombre del taller <span class="req">*</span></label>
            <input id="taller" class="input" [(ngModel)]="nombreTaller" placeholder="QualityTaller" autocomplete="organization" />
          </div>
        }
        @case (2) {
          <div class="card stack-12">
            <div>
              <label class="label" for="admin">Tu nombre <span class="req">*</span></label>
              <input id="admin" class="input" [(ngModel)]="adminNombre" placeholder="Nombre y apellido" autocomplete="name" />
            </div>
            <div class="grid-2">
              <div>
                <label class="label" for="pin1">PIN <span class="req">*</span></label>
                <input id="pin1" class="input pin" type="password" inputmode="numeric" maxlength="4" [(ngModel)]="adminPin" placeholder="••••" autocomplete="new-password" />
              </div>
              <div>
                <label class="label" for="pin2">Repítelo <span class="req">*</span></label>
                <input id="pin2" class="input pin" type="password" inputmode="numeric" maxlength="4" [(ngModel)]="adminPin2" placeholder="••••" autocomplete="new-password" />
              </div>
            </div>
          </div>
        }
        @case (3) {
          @for (p of otros(); track $index) {
            <div class="card-sm row">
              <div class="avatar">{{ p.nombre.charAt(0).toUpperCase() }}</div>
              <div class="grow">
                <div class="t-strong">{{ p.nombre }}</div>
                <div class="muted">{{ roles[p.rol] }} · PIN ••••</div>
              </div>
              <button type="button" class="btn-icon" aria-label="Quitar" (click)="quitar($index)">✕</button>
            </div>
          }
          @if (agregando()) {
            <div class="card stack-12">
              <div>
                <label class="label" for="nombre">Nombre <span class="req">*</span></label>
                <input id="nombre" class="input" [(ngModel)]="nuevoNombre" placeholder="Nombre" />
              </div>
              <div>
                <span class="label">Qué hace</span>
                <div class="row">
                  <button type="button" class="seg" [class.on]="nuevoRol() === 'mostrador'" (click)="nuevoRol.set('mostrador')">Mostrador</button>
                  <button type="button" class="seg" [class.on]="nuevoRol() === 'mecanico'" (click)="nuevoRol.set('mecanico')">Mecánico</button>
                </div>
              </div>
              <div>
                <label class="label" for="pinN">Su PIN de 4 números <span class="req">*</span></label>
                <input id="pinN" class="input pin" type="password" inputmode="numeric" maxlength="4" [(ngModel)]="nuevoPin" placeholder="••••" autocomplete="new-password" />
              </div>
              @if (faltaNuevo()) {
                <div class="action-bar-msg">{{ faltaNuevo() }}</div>
              }
              <button type="button" class="btn btn-dark" [class.is-off]="!!faltaNuevo()" (click)="agregar()">Agregar a {{ nuevoNombre().trim() || 'esta persona' }}</button>
            </div>
          } @else {
            <button type="button" class="btn btn-add" (click)="agregando.set(true)">+ Agregar una persona</button>
          }
        }
        @case (4) {
          <button type="button" class="choice" [class.on]="arranque() === 'vacio'" (click)="arranque.set('vacio')">
            <div class="grow">
              <div class="t-strong grande">Empezar con el taller vacío</div>
              <div class="muted">Para trabajar de verdad desde hoy.</div>
            </div>
          </button>
          @if (arranque() === 'vacio') {
            <button type="button" class="choice chica" [class.on]="catalogo()" (click)="catalogo.set(!catalogo())">
              <span class="check" [class.on]="catalogo()">✓</span>
              <div class="grow">Cargar un catálogo de 12 servicios con precios sugeridos. Se pueden cambiar después.</div>
            </button>
          }
          <button type="button" class="choice" [class.on]="arranque() === 'ejemplo'" (click)="arranque.set('ejemplo')">
            <div class="grow">
              <div class="t-strong grande">Probar con datos de ejemplo</div>
              <div class="muted">Clientes, bicis y órdenes en todos los estados para conocer la app.</div>
            </div>
          </button>
          @if (arranque() === 'ejemplo' && faltanDePrueba()) {
            <div class="card-sm muted">
              Se crean personas de prueba: Sandra (mostrador, PIN {{ pinEjemplo.mostrador }}) y Julián Cardona (mecánico, PIN {{ pinEjemplo.mecanico }}).
            </div>
          }
        }
      }
    </div>

    <div class="action-bar">
      @if (falta()) {
        <div class="action-bar-msg">{{ falta() }}</div>
      }
      <div class="row">
        @if (paso() > 1) {
          <button type="button" class="btn btn-outline btn-lg atras" (click)="paso.set(paso() - 1)">Atrás</button>
        }
        <button type="button" class="btn btn-primary btn-lg" [class.is-off]="!!falta() || guardando()" (click)="siguiente()">
          {{ paso() === 4 ? (guardando() ? 'Creando…' : 'Crear el taller') : paso() === 3 && !otros().length ? 'Saltar' : 'Continuar' }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .marca {
      position: sticky;
      top: 0;
      z-index: 30;
      background: var(--black);
      color: var(--white);
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 24px;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      padding: 14px 16px;
      padding-top: calc(14px + env(safe-area-inset-top, 0px));
      min-height: var(--header-h);
    }
    .marca span {
      color: var(--red-600);
    }
    .pin {
      font-family: var(--font-display);
      font-size: 24px;
      letter-spacing: 0.3em;
    }
    .grande {
      font-size: 16px;
    }
    .chica {
      min-height: 56px;
      font-size: 14px;
      color: var(--gray-700);
    }
    .check {
      width: 26px;
      height: 26px;
      flex: 0 0 auto;
      border-radius: 8px;
      border: 2px solid var(--border-strong);
      color: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
    }
    .check.on {
      background: var(--red-600);
      border-color: var(--red-600);
      color: var(--white);
    }
    .atras {
      flex: 0 0 96px;
      width: 96px;
    }
  `,
})
export class BienvenidaPage {
  private readonly tallerSrv = inject(TallerService);
  private readonly router = inject(Router);
  private readonly ui = inject(UiService);

  protected readonly titulos = TITULOS;
  protected readonly ayudas = AYUDAS;
  protected readonly roles = ROL_LABEL;
  protected readonly pinEjemplo = PIN_EJEMPLO;

  protected readonly paso = signal(1);
  protected readonly nombreTaller = signal('');
  protected readonly adminNombre = signal('');
  protected readonly adminPin = signal('');
  protected readonly adminPin2 = signal('');
  protected readonly otros = signal<PersonaNueva[]>([]);
  protected readonly agregando = signal(false);
  protected readonly nuevoNombre = signal('');
  protected readonly nuevoRol = signal<Rol>('mecanico');
  protected readonly nuevoPin = signal('');
  protected readonly arranque = signal<'vacio' | 'ejemplo'>('vacio');
  protected readonly catalogo = signal(true);
  protected readonly guardando = signal(false);

  protected readonly faltanDePrueba = computed(
    () => !this.otros().some((p) => p.rol === 'mostrador') || !this.otros().some((p) => p.rol === 'mecanico'),
  );

  protected readonly faltaNuevo = computed(() => {
    if (!this.nuevoNombre().trim()) return 'Escribe el nombre';
    if (!pinValido(this.nuevoPin())) return 'El PIN son 4 números';
    return '';
  });

  protected readonly falta = computed(() => {
    switch (this.paso()) {
      case 1:
        return this.nombreTaller().trim() ? '' : 'Escribe el nombre del taller';
      case 2:
        if (!this.adminNombre().trim()) return 'Escribe tu nombre';
        if (!pinValido(this.adminPin())) return 'El PIN son 4 números';
        if (this.adminPin() !== this.adminPin2()) return 'Los dos PIN no son iguales';
        return '';
      case 3:
        return this.agregando() ? 'Termina de agregar a la persona o quítala' : '';
      default:
        return '';
    }
  });

  agregar(): void {
    if (this.faltaNuevo()) return;
    this.otros.update((l) => [...l, { nombre: this.nuevoNombre().trim(), rol: this.nuevoRol(), pin: this.nuevoPin() }]);
    this.nuevoNombre.set('');
    this.nuevoPin.set('');
    this.agregando.set(false);
  }

  quitar(i: number): void {
    this.otros.update((l) => l.filter((_, j) => j !== i));
  }

  async siguiente(): Promise<void> {
    if (this.falta()) {
      this.ui.avisar(this.falta());
      return;
    }
    if (this.paso() < 4) {
      this.paso.update((p) => p + 1);
      window.scrollTo(0, 0);
      return;
    }
    if (this.guardando()) return;
    this.guardando.set(true);
    try {
      await this.tallerSrv.configurar({
        nombreTaller: this.nombreTaller(),
        admin: { nombre: this.adminNombre(), rol: 'admin', pin: this.adminPin() },
        otros: this.otros(),
        arranque: this.arranque(),
        catalogoSugerido: this.catalogo(),
      });
      this.router.navigateByUrl('/');
    } catch (e) {
      console.error(e);
      this.ui.avisar('No se pudo crear el taller. Intenta otra vez.');
      this.guardando.set(false);
    }
  }
}

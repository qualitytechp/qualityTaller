import { Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { ActivatedRoute, NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { SesionService } from '../core/sesion.service';
import { UiService } from '../core/ui.service';
import { BarraInferiorComponent } from './barra-inferior.component';
import { CabeceraComponent } from './cabecera.component';

/** Datos que cada ruta declara para armar la cabecera y la barra inferior. */
export interface DatosPantalla {
  titulo?: string;
  logo?: boolean;
  atras?: boolean;
  barra?: 'principal' | 'mecanico';
}

/** Marco de todas las pantallas con sesión: cabecera negra, contenido y barra inferior. */
@Component({
  selector: 'qt-marco',
  imports: [RouterOutlet, CabeceraComponent, BarraInferiorComponent],
  template: `
    <qt-cabecera
      [titulo]="ui.titulo() ?? datos().titulo ?? ''"
      [logo]="!!datos().logo"
      [atras]="atras()"
      (volver)="volver()"
    />
    <main>
      <router-outlet />
    </main>
    @if (barra(); as b) {
      <qt-barra-inferior [tipo]="b" />
    }
  `,
})
export class MarcoComponent {
  protected readonly ui = inject(UiService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly sesion = inject(SesionService);
  private navegaciones = 0;

  protected readonly datos = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => {
        this.navegaciones++;
        return this.datosActuales();
      }),
    ),
    { initialValue: this.datosActuales() },
  );

  constructor() {
    // El título dinámico es de la pantalla anterior: se borra antes de que la nueva lo ponga.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        // Cambiar solo los filtros o la pestaña (?tab=…) no cambia de pantalla: el título se queda.
        const ruta = (u: string) => u.split(/[?#]/)[0];
        if (ruta(e.url) !== ruta(this.router.url)) this.ui.titulo.set(null);
      });
  }

  /**
   * El mecánico ve su barra en sus pantallas. Si otra persona entra a una pantalla del mecánico
   * (desde Más), no ve esa barra sino la flecha para volver.
   */
  protected readonly barra = computed<'principal' | 'mecanico' | null>(() => {
    const b = this.datos().barra;
    if (this.sesion.esMecanico()) return b ? 'mecanico' : null;
    return b === 'principal' ? 'principal' : null;
  });

  protected readonly atras = computed(() => !!this.datos().atras || (!this.sesion.esMecanico() && this.datos().barra === 'mecanico'));

  private datosActuales(): DatosPantalla {
    // El árbol ya resuelto: la ruta hija todavía no está activa cuando se crea el marco.
    let r = this.ruta.snapshot;
    while (r.firstChild) r = r.firstChild;
    return r.data as DatosPantalla;
  }

  volver(): void {
    if (this.navegaciones > 1) this.location.back();
    else this.router.navigateByUrl('/');
  }
}

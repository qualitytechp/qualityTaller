import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ROL_LABEL, ROL_VE, SesionService } from '../../core/sesion.service';

/** Perfil del mecánico: quién está usando el celular y el botón para cambiar de persona. */
@Component({
  selector: 'qt-perfil',
  template: `
    <div class="page stack-12">
      <div class="card-dark">
        <div class="eyebrow">Estás trabajando como</div>
        <div class="display nombre">{{ sesion.persona()?.nombre }}</div>
        <div class="rol">{{ rol() }}</div>
      </div>
      <div class="card texto">{{ ve() }}</div>
      <button type="button" class="btn btn-primary btn-lg" (click)="cambiar()">Cambiar de persona</button>
    </div>
  `,
  styles: `
    .nombre {
      font-size: 40px;
      margin-top: 8px;
      text-transform: uppercase;
    }
    .rol {
      color: var(--zinc-400);
      margin-top: 6px;
    }
    .texto {
      font-size: 14px;
      color: var(--gray-600);
      line-height: 1.45;
    }
  `,
})
export class PerfilPage {
  protected readonly sesion = inject(SesionService);
  private readonly router = inject(Router);
  protected readonly rol = computed(() => ROL_LABEL[this.sesion.rol() ?? 'mecanico']);
  protected readonly ve = computed(() => ROL_VE[this.sesion.rol() ?? 'mecanico']);

  cambiar(): void {
    this.router.navigateByUrl('/entrar');
  }
}

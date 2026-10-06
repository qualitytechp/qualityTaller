import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { db } from './db';
import type { Rol } from './models';
import { SesionService } from './sesion.service';

/** Sin taller configurado va a la bienvenida; sin persona, a escoger quién es. */
export const sesionGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const sesion = inject(SesionService);
  if (!(await db.taller.get('taller'))) return router.parseUrl('/bienvenida');
  if (await sesion.cargar()) return true;
  return router.parseUrl('/entrar');
};

/** La bienvenida solo se muestra la primera vez. */
export const primeraVezGuard: CanActivateFn = async () => {
  if (await db.taller.get('taller')) return inject(Router).parseUrl('/');
  return true;
};

/** Limita una pantalla a ciertos roles; los demás vuelven a su pantalla de inicio. */
export function rolGuard(...roles: Rol[]): CanActivateFn {
  return () => {
    const sesion = inject(SesionService);
    const rol = sesion.rol();
    if (rol && roles.includes(rol)) return true;
    return inject(Router).parseUrl(rol === 'mecanico' ? '/mis-trabajos' : '/inicio');
  };
}

/** Pantalla de arranque según el rol. */
export const inicioPorRolGuard: CanActivateFn = () => {
  const rol = inject(SesionService).rol();
  return inject(Router).parseUrl(rol === 'mecanico' ? '/mis-trabajos' : '/inicio');
};

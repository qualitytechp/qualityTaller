import { Injectable, inject } from '@angular/core';
import { db } from './db';
import type { Persona, Rol, Taller } from './models';
import { SesionService } from './sesion.service';
import { TEXTO_LISTO, TEXTO_RECIBO, cargarEjemplo, serviciosSugeridos } from './semilla';

export interface PersonaNueva {
  nombre: string;
  rol: Rol;
  pin: string;
}

export interface ConfiguracionInicial {
  nombreTaller: string;
  admin: PersonaNueva;
  otros: PersonaNueva[];
  arranque: 'vacio' | 'ejemplo';
  catalogoSugerido: boolean;
}

/** Personas de prueba que se crean con los datos de ejemplo si no se agregaron otras. */
export const PIN_EJEMPLO = { mostrador: '1111', mecanico: '2222' };

@Injectable({ providedIn: 'root' })
export class TallerService {
  private readonly sesion = inject(SesionService);

  taller(): Promise<Taller | undefined> {
    return db.taller.get('taller');
  }

  /** Primera configuración del celular: el taller, las personas con su PIN y los datos de arranque. */
  async configurar(c: ConfiguracionInicial): Promise<void> {
    const taller: Taller = {
      id: 'taller',
      nombre: c.nombreTaller.trim(),
      garantiaDias: 30,
      textoRecibo: TEXTO_RECIBO,
      textoListo: TEXTO_LISTO,
      siguienteOrden: 1001,
      siguienteVenta: 2001,
      creado: Date.now(),
    };
    await db.taller.put(taller);

    const admin = await this.sesion.crearPersona(c.admin);
    const otros: Persona[] = [];
    for (const p of c.otros) otros.push(await this.sesion.crearPersona(p));

    if (c.arranque === 'ejemplo') {
      const mostrador =
        otros.find((p) => p.rol === 'mostrador') ??
        (await this.sesion.crearPersona({ nombre: 'Sandra', rol: 'mostrador', pin: PIN_EJEMPLO.mostrador }));
      const mecanico =
        otros.find((p) => p.rol === 'mecanico') ??
        (await this.sesion.crearPersona({ nombre: 'Julián Cardona', rol: 'mecanico', pin: PIN_EJEMPLO.mecanico }));
      await cargarEjemplo({ mostrador, mecanico });
    } else if (c.catalogoSugerido) {
      await db.servicios.bulkPut(serviciosSugeridos());
    }

    await this.sesion.entrar(admin.id, c.admin.pin);
  }
}

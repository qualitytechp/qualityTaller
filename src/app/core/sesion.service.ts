import { Injectable, computed, signal } from '@angular/core';
import { db, nuevoId } from './db';
import type { Evento, Persona, Rol } from './models';

const CLAVE_SESION = 'qt.persona';

export const ROL_LABEL: Record<Rol, string> = {
  admin: 'Administrador',
  mostrador: 'Mostrador',
  mecanico: 'Mecánico',
};

export const ROL_VE: Record<Rol, string> = {
  admin: 'Todo: la plata, los costos, los reportes y la configuración.',
  mostrador: 'Recibe, cotiza, cobra y entrega. No ve costos de compra ni utilidad.',
  mecanico: 'Solo sus trabajos, pedir repuestos y subir fotos. No ve plata.',
};

/** El PIN se guarda con un resumen SHA-256, nunca en claro. */
export async function resumenPin(pin: string, sal: string): Promise<string> {
  const texto = sal + ':' + pin;
  if (globalThis.crypto?.subtle) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
    return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Sin HTTPS (probando por IP local) no hay crypto.subtle: resumen simple de respaldo.
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = (h * 33) ^ texto.charCodeAt(i);
  return 'x' + (h >>> 0).toString(16);
}

@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly _persona = signal<Persona | null>(null);
  private cargada = false;

  readonly persona = this._persona.asReadonly();
  readonly rol = computed<Rol | null>(() => this._persona()?.rol ?? null);
  readonly esAdmin = computed(() => this.rol() === 'admin');
  readonly esMecanico = computed(() => this.rol() === 'mecanico');
  /** El mecánico no ve plata. */
  readonly vePlata = computed(() => this.rol() === 'admin' || this.rol() === 'mostrador');
  /** Solo el administrador ve costos de compra y utilidad. */
  readonly veCostos = computed(() => this.rol() === 'admin');

  /** Recupera a la última persona que entró en este celular. */
  async cargar(): Promise<Persona | null> {
    if (this.cargada) return this._persona();
    this.cargada = true;
    let id: string | null = null;
    try {
      id = localStorage.getItem(CLAVE_SESION);
    } catch {
      id = null;
    }
    if (id) {
      const p = await db.personas.get(id);
      if (p?.activo) this._persona.set(p);
    }
    return this._persona();
  }

  async entrar(personaId: string, pin: string): Promise<boolean> {
    const p = await db.personas.get(personaId);
    if (!p || !p.activo) return false;
    if ((await resumenPin(pin, p.id)) !== p.pinHash) return false;
    this._persona.set(p);
    try {
      localStorage.setItem(CLAVE_SESION, p.id);
    } catch {
      /* sin almacenamiento: la sesión dura mientras la app esté abierta */
    }
    return true;
  }

  /** Vuelve a leer a la persona actual (por si se editó su nombre o su rol). */
  async recargar(): Promise<void> {
    const id = this._persona()?.id;
    if (!id) return;
    const p = await db.personas.get(id);
    if (p?.activo) this._persona.set(p);
    else this.salir();
  }

  salir(): void {
    this._persona.set(null);
    try {
      localStorage.removeItem(CLAVE_SESION);
    } catch {
      /* nada que borrar */
    }
  }

  async crearPersona(datos: { nombre: string; rol: Rol; pin: string; comision?: number }): Promise<Persona> {
    const id = nuevoId();
    const persona: Persona = {
      id,
      nombre: datos.nombre.trim(),
      rol: datos.rol,
      pinHash: await resumenPin(datos.pin, id),
      activo: true,
      comision: datos.comision ?? (datos.rol === 'mecanico' ? 15 : 0),
      creado: Date.now(),
    };
    await db.personas.put(persona);
    return persona;
  }

  /** "Sandra · Mostrador": así queda en el historial. */
  firma(): string {
    const p = this._persona();
    return p ? p.nombre + ' · ' + ROL_LABEL[p.rol] : 'Sistema';
  }

  /** Arma una entrada de historial con quién y a qué hora. */
  evento(que: string, quien?: string): Evento {
    return { en: Date.now(), personaId: quien ? undefined : this._persona()?.id, quien: quien ?? this.firma(), que };
  }
}

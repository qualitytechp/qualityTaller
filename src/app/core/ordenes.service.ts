import { Injectable, inject } from '@angular/core';
import { db, nuevoId } from './db';
import { deFechaYHora, plata } from './formato';
import {
  fuenteDe,
  type Bici,
  type Cliente,
  type EstadoOrden,
  type Item,
  type MedioPago,
  type MomentoFoto,
  type Orden,
  type Prioridad,
  type Tarea,
  type TipoBici,
} from './models';
import { SesionService } from './sesion.service';

/** Lo que se va llenando al recibir una bici. Se guarda como borrador mientras tanto. */
export interface BorradorRecibir {
  paso: number;
  clienteId: string | null;
  nuevoCliente: boolean;
  nombre: string;
  celular: string;
  cedula: string;
  correo: string;
  biciId: string | null;
  nuevaBici: boolean;
  marca: string;
  modelo: string;
  tipo: TipoBici;
  color: string;
  talla: string;
  serie: string;
  fotoBiciId: string | null;
  reportado: string;
  fotos: string[];
  accesorios: string[];
  otroAccesorio: string;
  golpes: string;
  fecha: string;
  hora: string;
  prioridad: Prioridad;
  mecanicoId: string | null;
  adelanto: number;
  medioAdelanto: MedioPago;
}

export const CLAVE_BORRADOR = 'borrador.recibir';

// ───────── Cuentas de una orden ─────────

export function subtotal(items: Item[]): number {
  return items.reduce((s, i) => s + i.precio * i.cantidad, 0);
}

export function manoDeObra(items: Item[]): number {
  return subtotal(items.filter((i) => i.tipo === 'servicio'));
}

export function totalOrden(o: Pick<Orden, 'items' | 'descuento'>): number {
  return Math.max(0, subtotal(o.items) - (o.descuento || 0));
}

export function saldoOrden(o: Pick<Orden, 'items' | 'descuento' | 'adelanto'>): number {
  return Math.max(0, totalOrden(o) - (o.adelanto || 0));
}

/** Estados en los que la fecha prometida todavía corre. */
const PROMESA_ABIERTA: EstadoOrden[] = ['recibida', 'diagnostico', 'cotizacion', 'aprobada', 'reparacion', 'repuesto'];

export function estaTarde(o: Orden, ahora = Date.now()): boolean {
  return PROMESA_ABIERTA.includes(o.estado) && o.prometida < ahora;
}

/** Cuándo quedó lista (para "lista desde hace N días"). */
export function listaDesde(o: Orden): number {
  if (o.listaEn) return o.listaEn;
  const ev = [...o.historial].reverse().find((e) => /lista/i.test(e.que));
  return ev?.en ?? o.prometida;
}

/** Qué se le está haciendo: los servicios, o si no hay, el diagnóstico o lo que dijo el cliente. */
export function queSeLeHace(o: Orden): string {
  const serv = o.items.filter((i) => i.tipo === 'servicio').map((i) => i.nombre);
  if (serv.length) return serv.join(' · ');
  return o.diagnostico || o.reportado;
}

function faseDe(e: EstadoOrden): 'diagnostico' | 'trabajo' | 'cerrada' {
  if (e === 'recibida' || e === 'diagnostico' || e === 'cotizacion') return 'diagnostico';
  if (e === 'aprobada' || e === 'reparacion' || e === 'repuesto' || e === 'lista') return 'trabajo';
  return 'cerrada';
}

/**
 * Lista de tareas del mecánico. Si la orden no trae una, se arma con los servicios
 * (en reparación) o con los pasos del diagnóstico.
 */
export function tareasDe(o: Orden): Tarea[] {
  if (o.tareas?.length) return o.tareas;
  if (o.estado === 'recibida' || o.estado === 'diagnostico') {
    return ['Revisar la bici completa', 'Anotar el diagnóstico', 'Tomar fotos de lo encontrado'].map((texto) => ({ texto, hecha: false }));
  }
  const servicios = o.items.filter((i) => i.tipo === 'servicio').map((i) => i.nombre);
  return [...(servicios.length ? servicios : ['Hacer el trabajo']), 'Prueba en ruta'].map((texto) => ({ texto, hecha: false }));
}

/** Momento de una foto nueva según en qué va la orden. */
export function momentoPara(estado: EstadoOrden): MomentoFoto {
  if (estado === 'recibida' || estado === 'diagnostico' || estado === 'cotizacion') return 'Diagnóstico';
  if (estado === 'lista' || estado === 'entregada') return 'Después';
  return 'Durante';
}

@Injectable({ providedIn: 'root' })
export class OrdenesService {
  private readonly sesion = inject(SesionService);

  /**
   * Cambia una orden y deja constancia en el historial de quién lo hizo y a qué hora.
   * `quien` se usa cuando no es la persona del celular (ej. "Cliente").
   */
  async actualizar(numero: string, que: string, cambios: Partial<Orden> = {}, quien?: string): Promise<void> {
    await db.transaction('rw', [db.ordenes, db.repuestos], async () => {
      const o = await db.ordenes.get(numero);
      if (!o) throw new Error('No existe la orden ' + numero);
      // Si cambian los ítems, el inventario se mueve en la misma transacción.
      if (cambios.items) await this.moverInventario(o.items, cambios.items);
      // Rechazada: los repuestos apartados vuelven al inventario (la orden conserva el detalle).
      if (cambios.estado === 'rechazada' && o.estado !== 'rechazada') await this.moverInventario(o.items, []);
      // Al pasar del diagnóstico a la reparación, las tareas del diagnóstico ya no sirven.
      if (cambios.estado && !('tareas' in cambios) && faseDe(cambios.estado) !== faseDe(o.estado)) cambios = { ...cambios, tareas: undefined };
      await db.ordenes.put({
        ...o,
        ...cambios,
        historial: [...o.historial, this.sesion.evento(que, quien)],
        actualizada: Date.now(),
      });
    });
  }

  /**
   * Ajusta las existencias según la diferencia entre los ítems de antes y los de ahora:
   * lo que se agrega sale del inventario y lo que se quita vuelve.
   */
  private async moverInventario(antes: Item[], despues: Item[]): Promise<void> {
    const delta = new Map<string, number>();
    const sumar = (items: Item[], signo: number) => {
      for (const i of items) {
        if (i.tipo === 'repuesto' && i.refId) delta.set(i.refId, (delta.get(i.refId) ?? 0) + signo * i.cantidad);
      }
    };
    sumar(despues, 1);
    sumar(antes, -1);
    const ahora = Date.now();
    for (const [id, d] of delta) {
      if (!d) continue;
      const r = await db.repuestos.get(id);
      if (!r) continue;
      await db.repuestos.put({ ...r, cantidad: Math.max(0, r.cantidad - d), ultimaSalida: d > 0 ? ahora : r.ultimaSalida });
    }
  }

  /** Guarda los ítems y el descuento de la orden (la cotización). */
  async guardarItems(numero: string, items: Item[], descuento: number, que: string, extra: Partial<Orden> = {}, quien?: string): Promise<void> {
    await this.actualizar(numero, que, { items, descuento, ...extra }, quien);
  }

  async cambiarEstado(numero: string, estado: EstadoOrden, que: string, extra: Partial<Orden> = {}, quien?: string): Promise<void> {
    const cambios: Partial<Orden> = { estado, ...extra };
    if (estado === 'lista') cambios.listaEn = Date.now();
    await this.actualizar(numero, que, cambios, quien);
  }

  /** Marcar el avance no llena el historial: solo se guarda la lista. */
  async guardarTareas(numero: string, tareas: Tarea[]): Promise<void> {
    await db.ordenes.update(numero, { tareas, actualizada: Date.now() });
  }

  async pedirRepuesto(numero: string, que: string): Promise<void> {
    await this.cambiarEstado(numero, 'repuesto', 'Pidió un repuesto: ' + que.trim() + ' — avisado al mostrador');
  }

  async tomar(numero: string): Promise<void> {
    const yo = this.sesion.persona();
    if (!yo) return;
    await this.actualizar(numero, 'Tomó la bici', { mecanicoId: yo.id });
  }

  async guardarDiagnostico(numero: string, diagnostico: string): Promise<void> {
    const o = await db.ordenes.get(numero);
    const que = o?.diagnostico ? 'Corrigió el diagnóstico' : 'Cargó el diagnóstico';
    await this.actualizar(numero, que, { diagnostico: diagnostico.trim() });
  }

  async agregarFoto(numero: string, fotoId: string): Promise<void> {
    const o = await db.ordenes.get(numero);
    if (!o) return;
    const momento = momentoPara(o.estado);
    await this.actualizar(numero, 'Subió una foto (' + momento.toLowerCase() + ')', {
      fotos: [...o.fotos, { id: fotoId, momento, en: Date.now() }],
    });
  }

  /** El cliente aprobó todo por teléfono o WhatsApp: lo registra quien está en el celular. */
  async aprobarTodo(numero: string, medio: string): Promise<void> {
    const o = await db.ordenes.get(numero);
    if (!o) return;
    const total = totalOrden(o);
    await this.cambiarEstado(numero, 'aprobada', 'Registró que el cliente aprobó todo por ' + medio + ' (' + plata(total) + ')', {
      aprobacion: { en: Date.now(), quien: 'Cliente (' + medio + ') · registró ' + this.sesion.firma(), total },
    });
  }

  /** Trabajo express: se repara sin aprobación del cliente y queda quién lo autorizó. */
  async empezarExpress(numero: string): Promise<void> {
    const o = await db.ordenes.get(numero);
    if (!o) return;
    await this.cambiarEstado(numero, 'reparacion', 'Empezó la reparación como trabajo express (autorizó ' + this.sesion.firma() + ')', {
      aprobacion: { en: Date.now(), quien: this.sesion.firma(), total: totalOrden(o), express: true },
    });
  }

  /**
   * Entrega la bici y cobra, todo junto: ítems finales (con lo que se olvidó agregar),
   * inventario, pago, garantía, caja y, si no paga todo, lo que queda en la cartera del cliente.
   */
  async entregar(numero: string, e: { items: Item[]; medio: MedioPago; pagaAhora: number; garantiaDias: number }): Promise<void> {
    const ahora = Date.now();
    await db.transaction('rw', [db.ordenes, db.repuestos, db.movimientos, db.clientes], async () => {
      const o = await db.ordenes.get(numero);
      if (!o) throw new Error('No existe la orden ' + numero);
      if (o.estado === 'entregada') throw new Error('La orden ' + numero + ' ya se entregó');
      const cliente = await db.clientes.get(o.clienteId);
      const saldo = o.garantiaDe ? 0 : saldoOrden({ ...o, items: e.items });
      const paga = Math.min(Math.max(0, e.pagaAhora), saldo);
      const queda = saldo - paga;

      await this.moverInventario(o.items, e.items);

      let garantiaHasta: number | undefined;
      if (e.garantiaDias > 0) {
        const fin = new Date(ahora);
        fin.setDate(fin.getDate() + e.garantiaDias);
        fin.setHours(23, 59, 59, 0);
        garantiaHasta = fin.getTime();
      }

      let que = o.garantiaDe ? 'Entregó la bici (garantía, sin cobro)' : 'Entregó y cobró ' + plata(paga) + ' en ' + e.medio;
      if (queda > 0) que += ' · quedó debiendo ' + plata(queda);

      await db.ordenes.put({
        ...o,
        items: e.items,
        estado: 'entregada',
        entregada: ahora,
        pago: { en: ahora, medio: e.medio, monto: paga },
        garantiaHasta,
        historial: [...o.historial, this.sesion.evento(que)],
        actualizada: ahora,
      });

      if (paga > 0) {
        await db.movimientos.add({
          id: nuevoId(),
          tipo: 'entra',
          concepto: 'Cobro ' + numero + ' · ' + (cliente?.nombre ?? ''),
          fuente: fuenteDe(e.medio),
          medio: e.medio,
          monto: paga,
          en: ahora,
          personaId: this.sesion.persona()?.id,
          origen: { tipo: 'orden', ref: numero },
        });
      }

      if (queda > 0 && cliente) {
        await db.clientes.put({ ...cliente, debe: cliente.debe + queda, debeDesde: cliente.debe > 0 ? cliente.debeDesde : ahora });
      }
    });
  }

  /** Orden de garantía sin cobro, ligada a la original. */
  async abrirGarantia(original: Orden, motivo: string): Promise<string> {
    const ahora = Date.now();
    return db.transaction('rw', [db.taller, db.ordenes], async () => {
      const taller = await db.taller.get('taller');
      if (!taller) throw new Error('No hay taller configurado');
      const numero = 'ORD-' + taller.siguienteOrden;
      await db.taller.update('taller', { siguienteOrden: taller.siguienteOrden + 1 });
      await db.ordenes.add({
        numero,
        clienteId: original.clienteId,
        biciId: original.biciId,
        estado: 'recibida',
        recibida: ahora,
        prometida: ahora + 2 * 864e5,
        prioridad: 'Urgente',
        mecanicoId: original.mecanicoId,
        adelanto: 0,
        reportado: motivo.trim(),
        diagnostico: '',
        items: [],
        descuento: 0,
        fotos: [],
        accesorios: [],
        golpes: '',
        historial: [this.sesion.evento('Abrió orden de garantía (sin cobro) ligada a ' + original.numero)],
        garantiaDe: original.numero,
        motivoGarantia: motivo.trim(),
        actualizada: ahora,
      });
      const o = await db.ordenes.get(original.numero);
      if (o) {
        await db.ordenes.put({
          ...o,
          historial: [...o.historial, this.sesion.evento('Volvió por garantía: ' + numero)],
          actualizada: ahora,
        });
      }
      return numero;
    });
  }

  /** Crea la orden, y el cliente y la bici si son nuevos. Todo o nada. */
  async crearDesdeBorrador(b: BorradorRecibir): Promise<string> {
    const ahora = Date.now();
    return db.transaction('rw', [db.taller, db.clientes, db.bicis, db.ordenes, db.movimientos, db.kv], async () => {
      const taller = await db.taller.get('taller');
      if (!taller) throw new Error('No hay taller configurado');
      const numero = 'ORD-' + taller.siguienteOrden;
      await db.taller.update('taller', { siguienteOrden: taller.siguienteOrden + 1 });

      let clienteId = b.clienteId;
      if (!clienteId) {
        const cliente: Cliente = {
          id: nuevoId(),
          nombre: b.nombre.trim(),
          celular: b.celular.trim(),
          cedula: b.cedula.trim() || undefined,
          correo: b.correo.trim() || undefined,
          desde: ahora,
          debe: 0,
        };
        await db.clientes.add(cliente);
        clienteId = cliente.id;
      }

      let biciId = b.biciId;
      if (!biciId) {
        const prox = new Date(ahora);
        prox.setMonth(prox.getMonth() + 6);
        const bici: Bici = {
          id: nuevoId(),
          clienteId,
          marca: b.marca.trim(),
          modelo: b.modelo.trim(),
          tipo: b.tipo,
          color: b.color.trim(),
          talla: b.talla.trim(),
          serie: b.serie.trim().toUpperCase(),
          grupo: '',
          frenos: '',
          suspension: '',
          rines: '',
          proxMantenimiento: prox.toISOString().slice(0, 10),
          fotoId: b.fotoBiciId ?? undefined,
          creado: ahora,
        };
        await db.bicis.add(bici);
        biciId = bici.id;
      }

      const accesorios = [...b.accesorios];
      if (b.otroAccesorio.trim()) accesorios.push(b.otroAccesorio.trim());

      const orden: Orden = {
        numero,
        clienteId,
        biciId,
        estado: 'recibida',
        recibida: ahora,
        prometida: deFechaYHora(b.fecha, b.hora),
        prioridad: b.prioridad,
        mecanicoId: b.mecanicoId ?? undefined,
        adelanto: b.adelanto,
        reportado: b.reportado.trim(),
        diagnostico: '',
        items: [],
        descuento: 0,
        fotos: b.fotos.map((id) => ({ id, momento: 'Llegada' as const, en: ahora })),
        accesorios,
        golpes: b.golpes.trim(),
        historial: [this.sesion.evento('Recibió la bici' + (b.adelanto > 0 ? ' · adelanto ' + plata(b.adelanto) : ''))],
        actualizada: ahora,
      };
      await db.ordenes.add(orden);

      if (b.adelanto > 0) {
        const cliente = await db.clientes.get(clienteId);
        await db.movimientos.add({
          id: nuevoId(),
          tipo: 'entra',
          concepto: 'Adelanto ' + numero + ' · ' + (cliente?.nombre ?? ''),
          fuente: fuenteDe(b.medioAdelanto),
          medio: b.medioAdelanto,
          monto: b.adelanto,
          en: ahora,
          personaId: this.sesion.persona()?.id,
          origen: { tipo: 'orden', ref: numero },
        });
      }

      await db.kv.delete(CLAVE_BORRADOR);
      return numero;
    });
  }
}

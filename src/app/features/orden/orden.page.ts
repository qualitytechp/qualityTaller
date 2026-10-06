import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { db, vivo } from '../../core/db';
import { archivoDeFoto } from '../../core/fotos';
import { cuando, diasEntre, fechaCompleta, hora, inicial, plata, plural, tono } from '../../core/formato';
import type { EstadoOrden, Item, Orden } from '../../core/models';
import { OrdenesService, estaTarde, listaDesde, saldoOrden, totalOrden } from '../../core/ordenes.service';
import { SesionService } from '../../core/sesion.service';
import { UiService } from '../../core/ui.service';
import { abrirWhatsApp, compartirArchivos, enlaceLlamar, llenarPlantilla } from '../../core/whatsapp';
import { CamaraComponent } from '../../shared/camara.component';
import { EstadoComponent } from '../../shared/estado.component';
import { FotoComponent } from '../../shared/foto.component';
import { HojaComponent } from '../../shared/hoja.component';
import { OpcionHojaComponent } from '../../shared/opcion-hoja.component';
import { CargandoComponent, ErrorComponent, VacioComponent } from '../../shared/vacio.component';

type Pestana = 'resumen' | 'diagnostico' | 'trabajo' | 'fotos' | 'historial';

interface Accion {
  label: string;
  hacer: () => void;
  sec?: { label: string; hacer: () => void };
}

const PESTANAS: { k: Pestana; label: string }[] = [
  { k: 'resumen', label: 'Resumen' },
  { k: 'diagnostico', label: 'Diagnóstico' },
  { k: 'trabajo', label: 'Trabajo' },
  { k: 'fotos', label: 'Fotos' },
  { k: 'historial', label: 'Historial' },
];

@Component({
  selector: 'qt-orden',
  imports: [
    FormsModule,
    RouterLink,
    EstadoComponent,
    FotoComponent,
    CamaraComponent,
    HojaComponent,
    OpcionHojaComponent,
    CargandoComponent,
    ErrorComponent,
    VacioComponent,
  ],
  templateUrl: './orden.page.html',
  styleUrl: './orden.page.css',
})
export class OrdenPage {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ordenes = inject(OrdenesService);
  private readonly ui = inject(UiService);
  protected readonly sesion = inject(SesionService);

  private readonly numero = this.ruta.snapshot.paramMap.get('numero') ?? '';

  protected readonly pestanas = PESTANAS;
  protected readonly pestana = signal<Pestana>((this.ruta.snapshot.queryParamMap.get('tab') as Pestana) || 'resumen');
  protected readonly hoja = signal<'respuesta' | 'garantia' | null>(null);
  protected readonly fotoAbierta = signal<string | null>(null);
  protected readonly editandoDiag = signal(false);
  protected readonly textoDiag = signal('');
  protected readonly motivoGarantia = signal('');
  protected readonly ocupado = signal(false);

  protected readonly plata = plata;
  protected readonly cuando = cuando;
  protected readonly hora = hora;

  protected readonly datos = vivo(async () => {
    const orden = await db.ordenes.get(this.numero);
    if (!orden) return null;
    const [cliente, bici, mecanico, taller] = await Promise.all([
      db.clientes.get(orden.clienteId),
      db.bicis.get(orden.biciId),
      orden.mecanicoId ? db.personas.get(orden.mecanicoId) : undefined,
      db.taller.get('taller'),
    ]);
    return { orden, cliente, bici, mecanico, taller };
  }, null);

  protected readonly o = computed(() => this.datos.valor()?.orden);
  protected readonly total = computed(() => {
    const o = this.o();
    return o ? totalOrden(o) : 0;
  });
  protected readonly saldo = computed(() => {
    const o = this.o();
    return o ? saldoOrden(o) : 0;
  });
  protected readonly biciTexto = computed(() => {
    const b = this.datos.valor()?.bici;
    return [b?.marca, b?.modelo].filter(Boolean).join(' ');
  });
  protected readonly inicialBici = computed(() => inicial(this.datos.valor()?.bici?.marca));
  protected readonly tonoBici = computed(() => tono((this.o()?.biciId ?? '') + this.numero));
  protected readonly tarde = computed(() => {
    const o = this.o();
    return o ? estaTarde(o) : false;
  });

  protected readonly diasTexto = computed(() => {
    const o = this.o();
    if (!o) return '';
    const d = diasEntre(o.recibida, o.entregada ?? Date.now());
    if (o.estado === 'entregada') return 'Estuvo ' + plural(d, 'día', 'días') + ' en el taller';
    return d === 0 ? 'Entró hoy' : plural(d, 'día', 'días') + ' en el taller';
  });

  protected readonly prometidaTexto = computed(() => {
    const o = this.o();
    if (!o) return '';
    if (o.estado === 'lista') return 'Lista desde ' + cuando(listaDesde(o)).toLowerCase();
    if (o.estado === 'entregada' && o.entregada) return 'Entregada ' + cuando(o.entregada).toLowerCase();
    return (this.tarde() ? 'Se pasó: ' : 'Prometida: ') + cuando(o.prometida).toLowerCase();
  });

  /** Nota destacada: garantía, pago, aprobación o cotización pendiente. */
  protected readonly nota = computed(() => {
    const o = this.o();
    if (!o) return '';
    if (o.garantiaDe) return 'Orden de garantía de ' + o.garantiaDe + ', sin cobro. Motivo: ' + (o.motivoGarantia ?? '');
    if (o.pago) {
      let t = 'Pagado en ' + o.pago.medio + ' ' + cuando(o.pago.en).toLowerCase() + ' · ' + plata(o.pago.monto);
      if (o.garantiaHasta) t += '. Garantía en mano de obra hasta el ' + fechaCompleta(o.garantiaHasta) + '.';
      return t;
    }
    if (o.aprobacion) {
      return (o.aprobacion.express ? 'Trabajo express autorizado por ' : 'Aprobada por ') + o.aprobacion.quien + ' · ' + cuando(o.aprobacion.en).toLowerCase();
    }
    if (o.estado === 'cotizacion' && o.cotizacionEnviada) {
      const d = diasEntre(o.cotizacionEnviada);
      return 'Cotización enviada ' + (d === 0 ? 'hoy' : 'hace ' + plural(d, 'día', 'días')) + ' · sin respuesta';
    }
    return '';
  });

  protected readonly accesorios = computed(() => {
    const a = this.o()?.accesorios ?? [];
    return a.length ? a.join(' · ') : 'No traía accesorios';
  });

  protected readonly fotos = computed(() => [...(this.o()?.fotos ?? [])]);
  protected readonly historial = computed(() => [...(this.o()?.historial ?? [])].reverse());

  protected readonly puedeEditarDiag = computed(() => {
    const e = this.o()?.estado;
    return e === 'recibida' || e === 'diagnostico' || e === 'cotizacion';
  });

  protected readonly garantiaVigente = computed(() => {
    const o = this.o();
    return !!o && o.estado === 'entregada' && !!o.garantiaHasta && o.garantiaHasta > Date.now();
  });

  /** El botón de abajo cambia según el estado de la orden y quién está usando el celular. */
  protected readonly accion = computed<Accion | null>(() => {
    const o = this.o();
    if (!o) return null;
    const mecanico = this.sesion.esMecanico();
    const a: Partial<Record<EstadoOrden, Accion>> = {
      recibida: { label: 'Empezar el diagnóstico', hacer: () => this.empezarDiagnostico() },
      diagnostico: mecanico
        ? { label: o.diagnostico ? 'Corregir el diagnóstico' : 'Escribir el diagnóstico', hacer: () => this.abrirDiagnostico() }
        : {
            label: 'Armar y enviar cotización',
            hacer: () => this.router.navigate(['/cotizacion', o.numero]),
            sec: { label: 'Trabajo express: reparar sin cotizar', hacer: () => this.express() },
          },
      cotizacion: mecanico
        ? undefined
        : {
            label: 'Registrar la respuesta del cliente',
            hacer: () => this.hoja.set('respuesta'),
            sec: { label: 'Ver como lo ve el cliente', hacer: () => this.router.navigate(['/aprobacion', o.numero]) },
          },
      aprobada: { label: 'Empezar la reparación', hacer: () => this.estado('reparacion', 'Empezó la reparación') },
      reparacion: {
        label: 'Marcar lista para entrega',
        hacer: () => this.estado('lista', 'Marcó la bici lista para entrega'),
        sec: { label: 'Falta un repuesto', hacer: () => this.estado('repuesto', 'Quedó esperando un repuesto') },
      },
      repuesto: { label: 'Ya llegó el repuesto, seguir', hacer: () => this.estado('reparacion', 'Llegó el repuesto, sigue la reparación') },
      lista: mecanico
        ? undefined
        : {
            label: 'Entregar y cobrar ' + plata(this.saldo()),
            hacer: () => this.router.navigate(['/cobrar', o.numero]),
            sec: { label: 'Recordarle al cliente por WhatsApp', hacer: () => this.recordarListo() },
          },
      entregada:
        mecanico || !this.garantiaVigente()
          ? undefined
          : { label: 'Abrir orden de garantía (sin cobro)', hacer: () => this.hoja.set('garantia') },
    };
    return a[o.estado] ?? null;
  });

  constructor() {
    this.ui.titulo.set(this.numero);
  }

  elegirPestana(p: Pestana): void {
    this.pestana.set(p);
    this.router.navigate([], { relativeTo: this.ruta, queryParams: { tab: p === 'resumen' ? null : p }, replaceUrl: true });
  }

  meta(i: Item): string {
    const tipo = i.tipo === 'servicio' ? 'Mano de obra' : i.tipo === 'repuesto' ? 'Repuesto' : 'Artículo suelto';
    return this.sesion.vePlata() ? tipo + ' · ' + i.cantidad + ' × ' + plata(i.precio) : tipo + ' · ' + i.cantidad;
  }

  // ───────── Acciones ─────────

  private async correr(fn: () => Promise<unknown>, aviso?: string): Promise<void> {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    try {
      await fn();
      if (aviso) this.ui.avisar(aviso);
    } catch (e) {
      console.error(e);
      this.ui.avisar('No se pudo guardar. Intenta otra vez.');
    } finally {
      this.ocupado.set(false);
    }
  }

  estado(estado: EstadoOrden, que: string): void {
    this.correr(() => this.ordenes.cambiarEstado(this.numero, estado, que), que);
  }

  empezarDiagnostico(): void {
    const o = this.o();
    const yo = this.sesion.persona();
    // Si nadie la tiene asignada y quien empieza es mecánico, queda a su nombre.
    const extra = !o?.mecanicoId && yo && yo.rol !== 'mostrador' ? { mecanicoId: yo.id } : {};
    this.correr(() => this.ordenes.cambiarEstado(this.numero, 'diagnostico', 'Empezó el diagnóstico', extra), 'Empezó el diagnóstico');
    this.abrirDiagnostico();
  }

  abrirDiagnostico(): void {
    this.textoDiag.set(this.o()?.diagnostico ?? '');
    this.editandoDiag.set(true);
    this.elegirPestana('diagnostico');
  }

  guardarDiagnostico(): void {
    const t = this.textoDiag().trim();
    if (!t) {
      this.ui.avisar('Escribe lo que encontraste');
      return;
    }
    this.correr(() => this.ordenes.guardarDiagnostico(this.numero, t), 'Diagnóstico guardado').then(() => this.editandoDiag.set(false));
  }

  async express(): Promise<void> {
    const ok = await this.ui.confirmar({
      titulo: '¿Reparar sin cotizar?',
      texto: 'Se empieza a reparar sin la aprobación del cliente. Queda registrado que lo autorizaste tú: ' + this.sesion.firma() + '.',
      si: 'Sí, lo autorizo',
    });
    if (ok) this.correr(() => this.ordenes.empezarExpress(this.numero), 'Reparación express en marcha');
  }

  aprobarTodo(): void {
    this.hoja.set(null);
    this.correr(() => this.ordenes.aprobarTodo(this.numero, 'teléfono o WhatsApp'), 'Aprobación registrada');
  }

  aprobarParte(): void {
    this.hoja.set(null);
    this.router.navigate(['/aprobacion', this.numero]);
  }

  async rechazar(): Promise<void> {
    this.hoja.set(null);
    const ok = await this.ui.confirmar({
      titulo: '¿Rechazar el trabajo?',
      texto: 'La orden ' + this.numero + ' queda rechazada y se le devuelve la bici al cliente sin cobro.',
      si: 'Sí, rechazar',
    });
    if (ok) this.correr(() => this.ordenes.cambiarEstado(this.numero, 'rechazada', 'El cliente rechazó la cotización', {}, 'Cliente'), 'Orden rechazada');
  }

  insistir(): void {
    this.hoja.set(null);
    const d = this.datos.valor();
    if (!d) return;
    abrirWhatsApp(
      d.cliente?.celular,
      'Hola ' + (d.cliente?.nombre ?? '') + ', le recordamos la cotización de su ' + this.biciTexto() + ' (orden ' + this.numero + ') por ' + plata(this.total()) + '. ¿La autoriza?',
    );
  }

  whatsappCliente(): void {
    const d = this.datos.valor();
    if (!d) return;
    abrirWhatsApp(
      d.cliente?.celular,
      'Hola ' + (d.cliente?.nombre ?? '') + ', le escribimos de ' + (d.taller?.nombre ?? 'el taller') + ' sobre su ' + this.biciTexto() + ' (orden ' + this.numero + ').',
    );
  }

  enlaceLlamar(): string {
    return enlaceLlamar(this.datos.valor()?.cliente?.celular ?? '');
  }

  recordarListo(): void {
    const d = this.datos.valor();
    if (!d) return;
    const texto = llenarPlantilla(d.taller?.textoListo ?? 'Hola {cliente}, su {bici} ya está lista para recoger. Saldo: {saldo}.', {
      cliente: d.cliente?.nombre ?? '',
      bici: this.biciTexto(),
      orden: this.numero,
      fecha: cuando(d.orden.prometida),
      saldo: plata(this.saldo()),
      taller: d.taller?.nombre ?? '',
    });
    abrirWhatsApp(d.cliente?.celular, texto + ' Orden ' + this.numero + '.');
  }

  async abrirGarantia(): Promise<void> {
    const o = this.o();
    const motivo = this.motivoGarantia().trim();
    if (!o || !motivo) {
      this.ui.avisar('Escribe qué pasó con la bici');
      return;
    }
    this.hoja.set(null);
    try {
      const nueva = await this.ordenes.abrirGarantia(o, motivo);
      this.motivoGarantia.set('');
      this.ui.avisar('Orden de garantía ' + nueva + ' abierta');
      this.router.navigate(['/orden', nueva]);
    } catch (e) {
      console.error(e);
      this.ui.avisar('No se pudo abrir la garantía. Intenta otra vez.');
    }
  }

  fotoTomada(id: string): void {
    this.correr(() => this.ordenes.agregarFoto(this.numero, id), 'Foto agregada a la orden');
  }

  /** Manda las fotos por la hoja de compartir del iPhone (WhatsApp, AirDrop…). */
  async compartirFotos(ids: string[]): Promise<void> {
    const archivos = (await Promise.all(ids.map((id, i) => archivoDeFoto(id, this.numero + '-' + (i + 1))))).filter((f): f is File => !!f);
    const ok = await compartirArchivos(archivos, 'Fotos de la orden ' + this.numero + ' · ' + this.biciTexto());
    if (!ok) this.ui.avisar('Este navegador no deja compartir fotos. Ábrelo desde la app instalada en el iPhone.');
  }
}

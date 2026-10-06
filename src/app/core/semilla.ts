import { db, nuevoId } from './db';
import type {
  Bici,
  CategoriaServicio,
  Cliente,
  Compra,
  Item,
  Movimiento,
  Orden,
  Persona,
  Proveedor,
  Repuesto,
  Servicio,
  TipoBici,
} from './models';

export const TEXTO_RECIBO =
  'Hola {cliente}, recibimos su {bici} en {taller}. Orden {orden}. Se la tenemos lista el {fecha}.';
export const TEXTO_LISTO = 'Hola {cliente}, su {bici} ya está lista para recoger. Saldo: {saldo}.';

/** Catálogo inicial que se ofrece al configurar el taller. */
export const SERVICIOS_SUGERIDOS: [string, CategoriaServicio, number, number][] = [
  ['Mantenimiento general', 'General', 75000, 90],
  ['Sincronización de cambios', 'Transmisión', 35000, 30],
  ['Purga de frenos hidráulicos', 'Frenos', 60000, 45],
  ['Calibración de frenos', 'Frenos', 20000, 20],
  ['Centrado de rin', 'Ruedas', 30000, 40],
  ['Despinchada', 'Ruedas', 12000, 15],
  ['Cambio de guaya y forro', 'Transmisión', 25000, 25],
  ['Servicio de suspensión', 'Suspensión', 180000, 120],
  ['Cambio de balineras de dirección', 'Dirección', 55000, 60],
  ['Armado de bici nueva', 'General', 90000, 105],
  ['Mantenimiento completo (paquete)', 'Paquete', 120000, 150],
  ['Puesta a punto ruta (paquete)', 'Paquete', 165000, 180],
];

export function serviciosSugeridos(): Servicio[] {
  return SERVICIOS_SUGERIDOS.map(([nombre, categoria, precio, minutos]) => ({
    id: nuevoId(),
    nombre,
    categoria,
    precio,
    minutos,
  }));
}


/** Un momento relativo a hoy: días hacia atrás (+) o adelante (-), a una hora dada. */
function hace(dias: number, h = 9, m = 0): number {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function isoEnMeses(meses: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().slice(0, 10);
}

/**
 * Carga el taller de ejemplo del prototipo (clientes, bicis, órdenes en todos los estados,
 * inventario, proveedores y caja) con fechas relativas a hoy.
 */
export async function cargarEjemplo(personas: { mostrador: Persona; mecanico: Persona }): Promise<void> {
  const { mostrador, mecanico } = personas;
  const firmaM = mostrador.nombre + ' · Mostrador';
  const firmaJ = mecanico.nombre + ' · Mecánico';

  const servicios = serviciosSugeridos();
  const serv = (nombre: string): Item => {
    const s = servicios.find((x) => x.nombre === nombre)!;
    return { id: nuevoId(), tipo: 'servicio', refId: s.id, nombre: s.nombre, precio: s.precio, cantidad: 1 };
  };

  const proveedores: Proveedor[] = [
    { id: 'p1', nombre: 'Distribuciones Andina', celular: '313 555 0101', debe: 640000 },
    { id: 'p2', nombre: 'Bike Parts Colombia', celular: '317 555 0244', debe: 0 },
    { id: 'p3', nombre: 'Importadora Ciclo Sur', celular: '300 555 0388', debe: 285000 },
  ];

  const repuestos: Repuesto[] = [
    ['r1', 'Guaya de cambios Shimano', 'SH-GC01', 'Shimano', 6500, 14000, 24, 10, 'p2'],
    ['r2', 'Pastillas freno hidráulico B01S', 'B01S', 'Shimano', 18000, 38000, 6, 8, 'p2'],
    ['r3', 'Cámara 29" válvula presta', 'CAM-29P', 'Vittoria', 9000, 22000, 31, 12, 'p3'],
    ['r4', 'Piñón casete 11-32 9v Shimano', 'CS-HG400', 'Shimano', 78000, 145000, 2, 3, 'p1'],
    ['r5', 'Balinera dirección 1-1/8', 'BD-118', 'Neco', 22000, 48000, 9, 4, 'p2'],
    ['r6', 'Guaya de freno + forro', 'GF-STD', 'Jagwire', 5000, 12000, 18, 10, 'p2'],
    ['r7', 'Aceite mineral frenos 100ml', 'AM-100', 'Shimano', 24000, 45000, 4, 5, 'p2'],
    ['r8', 'Rin 29" doble pared', 'RIN-29DP', 'Alex', 95000, 175000, 3, 2, 'p1'],
    ['r9', 'Cadena 9v KMC', 'X9-KMC', 'KMC', 32000, 62000, 7, 6, 'p1'],
    ['r10', 'Sellante antipinchazos 250ml', 'SEL-250', 'Stans', 14000, 28000, 11, 6, 'p3'],
  ].map(([id, nombre, ref, marca, costo, precio, cantidad, minimo, proveedorId]) => ({
    id: id as string,
    nombre: nombre as string,
    ref: ref as string,
    marca: marca as string,
    costo: costo as number,
    precio: precio as number,
    cantidad: cantidad as number,
    minimo: minimo as number,
    proveedorId: proveedorId as string,
    ultimaSalida: hace(id === 'r3' || id === 'r10' ? 75 : 5),
  }));
  const rep = (id: string, cantidad = 1): Item => {
    const r = repuestos.find((x) => x.id === id)!;
    return { id: nuevoId(), tipo: 'repuesto', refId: r.id, nombre: r.nombre, precio: r.precio, costo: r.costo, cantidad };
  };

  const clientes: Cliente[] = [
    ['c1', 'Camila Restrepo', '310 555 0142', '52.884.100', 'camila.r@gmail.com', 1270, 0],
    ['c2', 'Andrés Villegas', '312 555 0987', '79.552.318', '', 630, 0],
    ['c3', 'Marcela Ospina', '301 555 7714', '', 'marce.ospina@hotmail.com', 400, 0],
    ['c4', 'Wilson Beltrán', '320 555 3390', '80.114.902', '', 1580, 180000],
    ['c5', 'Katherine Ríos', '318 555 6021', '', '', 220, 0],
    ['c6', 'Óscar Mejía', '315 555 1188', '19.883.441', '', 800, 0],
    ['c7', 'Diana Cárdenas', '304 555 4407', '', '', 330, 0],
    ['c8', 'Jorge Pineda', '311 555 9052', '1.020.774.556', '', 1250, 240000],
  ].map(([id, nombre, celular, cedula, correo, diasCliente, debe]) => ({
    id: id as string,
    nombre: nombre as string,
    celular: celular as string,
    cedula: (cedula as string) || undefined,
    correo: (correo as string) || undefined,
    desde: hace(diasCliente as number),
    debe: debe as number,
    debeDesde: id === 'c4' ? hace(12) : id === 'c8' ? hace(34) : undefined,
  }));

  const b = (
    id: string,
    clienteId: string,
    marca: string,
    modelo: string,
    tipo: TipoBici,
    color: string,
    talla: string,
    serie: string,
    grupo: string,
    frenos: string,
    suspension: string,
    rines: string,
    meses: number,
  ): Bici => ({
    id,
    clienteId,
    marca,
    modelo,
    tipo,
    color,
    talla,
    serie,
    grupo,
    frenos,
    suspension,
    rines,
    proxMantenimiento: isoEnMeses(meses),
    creado: hace(300),
  });
  const bicis: Bici[] = [
    b('b1', 'c1', 'Specialized', 'Allez Sport', 'Ruta', 'Negro mate', '54', 'WSBC6012345K', 'Shimano Claris 8v', 'De herradura', 'Rígida', 'Aluminio 700c', 3),
    b('b2', 'c1', 'Specialized', 'Rockhopper 29', 'Montaña', 'Rojo', 'M', 'WSBC7789012D', 'Shimano Altus 9v', 'Disco mecánico', 'SR Suntour XCT', 'Doble pared 29"', 5),
    b('b3', 'c2', 'Trek', 'Marlin 7', 'Montaña', 'Azul', 'L', 'TRK55219087', 'Shimano Deore 10v', 'Disco hidráulico', 'RockShox Judy', 'Bontrager 29"', 2),
    b('b4', 'c2', 'Trek', 'Domane AL 2', 'Ruta', 'Blanco', '56', 'TRK88104432', 'Shimano Claris', 'De herradura', 'Rígida', 'Alloy 700c', 4),
    b('b5', 'c3', 'Giant', 'Escape 3', 'Urbana', 'Gris', 'M', 'GNT4471120', 'Shimano Tourney 7v', 'V-brake', 'Rígida', 'Aluminio 700c', 6),
    b('b6', 'c4', 'Scott', 'Scale 970', 'Montaña', 'Amarillo', 'L', 'SCT9930112', 'Shimano SLX 12v', 'Disco hidráulico', 'Fox Rhythm 34', 'Syncros 29"', 4),
    b('b7', 'c5', 'Cannondale', 'Synapse 105', 'Ruta', 'Verde', '52', 'CDL7712004', 'Shimano 105 11v', 'Disco hidráulico', 'Rígida', 'Fulcrum 700c', 6),
    b('b8', 'c6', 'Optimus', 'Tucana Pro', 'Montaña', 'Naranja', 'M', 'OPT5540982', 'Shimano Alivio 9v', 'Disco hidráulico', 'Suntour XCM', 'Doble pared 27.5"', 0),
    b('b9', 'c7', 'GW', 'Jackal', 'Montaña', 'Negro/verde', 'S', 'GW11209844', 'Shimano Tourney', 'Disco mecánico', 'GW 100mm', 'Aluminio 29"', 0),
    b('b10', 'c8', 'Bianchi', 'Via Nirone 7', 'Ruta', 'Celeste', '55', 'BNC3391005', 'Shimano Tiagra 10v', 'De herradura', 'Rígida', 'Reparto 700c', 0),
    b('b11', 'c4', 'Trek', 'Rail 5', 'Eléctrica', 'Gris carbón', 'M', 'TRK-EB-77120', 'Bosch CX + Deore 12v', 'Disco hidráulico 4 pistones', 'RockShox 35', 'Bontrager Line', 5),
  ];

  const ev = (en: number, quien: string, que: string) => ({ en, quien, que });
  const orden = (o: Partial<Orden> & Pick<Orden, 'numero' | 'clienteId' | 'biciId' | 'estado' | 'recibida' | 'prometida' | 'reportado'>): Orden => ({
    prioridad: 'Normal',
    mecanicoId: mecanico.id,
    adelanto: 0,
    diagnostico: '',
    items: [],
    descuento: 0,
    fotos: [],
    accesorios: [],
    golpes: 'Sin golpes.',
    historial: [],
    actualizada: Date.now(),
    ...o,
  });

  const ordenes: Orden[] = [
    orden({
      numero: 'ORD-1052', clienteId: 'c5', biciId: 'b7', estado: 'recibida', recibida: hace(0, 8, 42), prometida: hace(-1, 11),
      mecanicoId: undefined, reportado: 'Los frenos no agarran bien y suena un chillido al frenar.',
      accesorios: ['Luces', 'Portacaramañola'], golpes: 'Rayón en el tubo superior, ya venía así.',
      historial: [ev(hace(0, 8, 42), firmaM, 'Recibió la bici')],
    }),
    orden({
      numero: 'ORD-1051', clienteId: 'c2', biciId: 'b3', estado: 'diagnostico', recibida: hace(1, 15, 12), prometida: hace(0, 16),
      prioridad: 'Urgente', reportado: 'No me entra el cambio de adelante y se sale la cadena en subida.',
      diagnostico: 'Guaya del cambio delantero pelada y desviador desalineado. Cadena estirada al límite (1%).',
      accesorios: ['Computador', 'Portacaramañola', 'Luces'],
      historial: [ev(hace(1, 15, 12), firmaM, 'Recibió la bici'), ev(hace(0, 9), firmaJ, 'Empezó el diagnóstico')],
    }),
    orden({
      numero: 'ORD-1050', clienteId: 'c3', biciId: 'b5', estado: 'cotizacion', recibida: hace(3, 14, 22), prometida: hace(-2, 17),
      reportado: 'Suena atrás cuando pedaleo fuerte.',
      diagnostico: 'Balineras del buje trasero secas y piñón desgastado. Guayas de freno duras.',
      items: [serv('Mantenimiento general'), serv('Centrado de rin'), rep('r4'), rep('r6', 2)],
      accesorios: ['Candado', 'Guardabarros'], cotizacionEnviada: hace(2, 10, 31),
      historial: [ev(hace(3, 14, 22), firmaM, 'Recibió la bici'), ev(hace(2, 10, 20), firmaJ, 'Cargó el diagnóstico'), ev(hace(2, 10, 31), firmaM, 'Envió la cotización por WhatsApp')],
    }),
    orden({
      numero: 'ORD-1049', clienteId: 'c4', biciId: 'b6', estado: 'aprobada', recibida: hace(2, 9, 7), prometida: hace(-3, 17),
      adelanto: 100000, reportado: 'Quiero el mantenimiento completo y que le revisen la suspensión.',
      diagnostico: 'Suspensión con fuga leve de aceite en la barra izquierda. Frenos con aire.',
      items: [serv('Mantenimiento completo (paquete)'), serv('Purga de frenos hidráulicos'), serv('Servicio de suspensión'), rep('r7')],
      accesorios: ['Computador', 'Pedales especiales'], golpes: 'Golpe pequeño en el rin trasero.',
      aprobacion: { en: hace(1, 8, 12), quien: 'Cliente (WhatsApp)', total: 405000 },
      historial: [ev(hace(2, 9, 7), firmaM, 'Recibió la bici · adelanto $100.000'), ev(hace(2, 16, 45), firmaJ, 'Cargó el diagnóstico'), ev(hace(2, 17, 2), firmaM, 'Envió la cotización'), ev(hace(1, 8, 12), 'Cliente', 'Aprobó la cotización')],
    }),
    orden({
      numero: 'ORD-1047', clienteId: 'c5', biciId: 'b7', estado: 'reparacion', recibida: hace(3, 11), prometida: hace(0, 17),
      prioridad: 'Urgente', adelanto: 50000, reportado: 'Se me va la cadena y los cambios no suben.',
      diagnostico: 'Cadena y guayas al límite. Necesita sincronización completa.',
      items: [serv('Sincronización de cambios'), serv('Cambio de guaya y forro'), rep('r1', 2), rep('r9')],
      accesorios: ['Luces'], aprobacion: { en: hace(3, 18, 40), quien: 'Cliente (WhatsApp)', total: 185000 },
      tareas: ['Desmontar transmisión', 'Cambiar guayas y forros', 'Montar cadena nueva', 'Sincronizar cambios', 'Prueba en ruta'].map((texto, i) => ({ texto, hecha: i < 2 })),
      historial: [ev(hace(3, 11, 2), firmaM, 'Recibió la bici · adelanto $50.000'), ev(hace(3, 18, 40), 'Cliente', 'Aprobó la cotización'), ev(hace(0, 9, 30), firmaJ, 'Empezó la reparación')],
    }),
    orden({
      numero: 'ORD-1046', clienteId: 'c6', biciId: 'b8', estado: 'repuesto', recibida: hace(6, 16, 15), prometida: hace(1, 17),
      reportado: 'La rueda de atrás va chueca y raspa.', diagnostico: 'Rin trasero doblado, no se puede centrar. Toca cambiarlo.',
      items: [serv('Centrado de rin'), rep('r8')], accesorios: ['Guardabarros', 'Parrilla'], golpes: 'Rin trasero doblado.',
      aprobacion: { en: hace(5, 9), quien: 'Cliente (teléfono)', total: 205000 },
      historial: [ev(hace(6, 16, 17), firmaM, 'Recibió la bici'), ev(hace(5, 9), 'Cliente', 'Aprobó la cotización'), ev(hace(4, 11, 20), firmaJ, 'Pidió repuesto: Rin 29"')],
    }),
    orden({
      numero: 'ORD-1045', clienteId: 'c7', biciId: 'b9', estado: 'lista', recibida: hace(7, 8, 30), prometida: hace(3, 12),
      reportado: 'Mantenimiento general y despinchada.', diagnostico: 'Todo normal, se hizo mantenimiento completo.',
      items: [serv('Mantenimiento general'), serv('Despinchada'), rep('r3')], accesorios: ['Candado'],
      listaEn: hace(3, 12, 5),
      historial: [ev(hace(7, 8, 32), firmaM, 'Recibió la bici'), ev(hace(3, 12, 5), firmaJ, 'Marcó lista para entrega')],
    }),
    orden({
      numero: 'ORD-1044', clienteId: 'c8', biciId: 'b10', estado: 'lista', recibida: hace(13, 10, 10), prometida: hace(9, 17),
      reportado: 'Purga de frenos y cambio de guayas.', diagnostico: 'Frenos con aire, guayas oxidadas.',
      items: [serv('Purga de frenos hidráulicos'), serv('Cambio de guaya y forro'), rep('r6', 2)],
      listaEn: hace(9, 17, 30),
      historial: [ev(hace(13, 10, 12), firmaM, 'Recibió la bici'), ev(hace(9, 17, 30), firmaJ, 'Marcó lista para entrega')],
    }),
    orden({
      numero: 'ORD-1043', clienteId: 'c1', biciId: 'b2', estado: 'entregada', recibida: hace(40, 9), prometida: hace(36, 17),
      reportado: 'Mantenimiento antes del viaje.', diagnostico: 'Mantenimiento general, todo en orden.',
      items: [serv('Mantenimiento general'), serv('Sincronización de cambios'), rep('r10', 2)], accesorios: ['Luces', 'Computador'],
      pago: { en: hace(36, 18, 20), medio: 'Efectivo', monto: 166000 }, entregada: hace(36, 18, 20), garantiaHasta: hace(6, 23),
      historial: [ev(hace(40, 9, 2), firmaM, 'Recibió la bici'), ev(hace(36, 11, 5), firmaJ, 'Marcó lista'), ev(hace(36, 18, 20), firmaM, 'Entregó y cobró $166.000')],
    }),
    orden({
      numero: 'ORD-1042', clienteId: 'c7', biciId: 'b9', estado: 'entregada', recibida: hace(4, 10), prometida: hace(1, 17),
      reportado: 'Revisar frenos.', diagnostico: 'Pastillas gastadas.',
      items: [serv('Calibración de frenos'), rep('r2')], pago: { en: hace(0, 9, 40), medio: 'Nequi', monto: 58000 },
      entregada: hace(0, 9, 40), garantiaHasta: hace(-30, 23),
      historial: [ev(hace(4, 10, 2), firmaM, 'Recibió la bici'), ev(hace(1, 12), firmaJ, 'Marcó lista'), ev(hace(0, 9, 40), firmaM, 'Entregó y cobró $58.000 en Nequi')],
    }),
    orden({
      numero: 'ORD-1039', clienteId: 'c8', biciId: 'b10', estado: 'rechazada', recibida: hace(51, 14), prometida: hace(45, 17),
      reportado: 'Revisar el grupo completo.', diagnostico: 'Grupo desgastado, se cotizó cambio completo.',
      items: [serv('Armado de bici nueva'), rep('r4')],
      historial: [ev(hace(51, 14, 2), firmaM, 'Recibió la bici'), ev(hace(44, 19, 15), 'Cliente', 'Rechazó la cotización: muy costoso'), ev(hace(42, 16), firmaM, 'Devolvió la bici sin cobro')],
    }),
    orden({
      numero: 'ORD-1021', clienteId: 'c6', biciId: 'b8', estado: 'abandonada', recibida: hace(95, 11), prometida: hace(90, 17),
      reportado: 'Cambio de balineras de dirección.', diagnostico: 'Balineras picadas, cambiadas. El cliente nunca volvió.',
      items: [serv('Cambio de balineras de dirección'), rep('r5')],
      historial: [ev(hace(95, 11, 4), firmaM, 'Recibió la bici'), ev(hace(90, 15), firmaJ, 'Marcó lista'), ev(hace(30, 0), 'Sistema', 'Marcada como abandonada (más de 60 días)')],
    }),
  ];

  const compras: Compra[] = [
    { id: 'k1', proveedorId: 'p1', factura: 'FV-88214', fecha: hace(4), total: 640000, pagado: 0, items: [{ repuestoId: 'r8', nombre: 'Rin 29"', cantidad: 2, costo: 95000 }, { repuestoId: 'r4', nombre: 'Piñón 11-32', cantidad: 3, costo: 78000 }, { repuestoId: 'r9', nombre: 'Cadena 9v', cantidad: 4, costo: 53500 }] },
    { id: 'k2', proveedorId: 'p2', factura: 'FV-10552', fecha: hace(11), total: 412000, pagado: 412000, items: [{ repuestoId: 'r2', nombre: 'Pastillas B01S', cantidad: 10, costo: 28200 }, { repuestoId: 'r1', nombre: 'Guaya cambios', cantidad: 20, costo: 6500 }] },
    { id: 'k3', proveedorId: 'p3', factura: 'FV-4471', fecha: hace(17), total: 285000, pagado: 0, items: [{ repuestoId: 'r3', nombre: 'Cámaras 29"', cantidad: 15, costo: 9000 }, { repuestoId: 'r10', nombre: 'Sellante', cantidad: 6, costo: 25000 }] },
    { id: 'k4', proveedorId: 'p2', factura: 'FV-10388', fecha: hace(30), total: 195000, pagado: 195000, items: [{ repuestoId: 'r7', nombre: 'Aceite mineral', cantidad: 5, costo: 24000 }, { repuestoId: 'r5', nombre: 'Balineras', cantidad: 4, costo: 18750 }] },
  ];

  const mov = (tipo: 'entra' | 'sale', concepto: string, fuente: Movimiento['fuente'], monto: number, en: number, origen?: Movimiento['origen']): Movimiento => ({
    id: nuevoId(), tipo, concepto, fuente, monto, en, origen, personaId: mostrador.id,
  });
  const movimientos: Movimiento[] = [
    mov('entra', 'Saldo inicial del cajón', 'Efectivo', 580000, hace(1, 20), { tipo: 'saldo' }),
    mov('entra', 'Saldo inicial del banco', 'Banco', 2225000, hace(1, 20), { tipo: 'saldo' }),
    mov('entra', 'Saldo inicial de billeteras', 'Digital', 330000, hace(1, 20), { tipo: 'saldo' }),
    mov('sale', 'Café y aseo del taller', 'Efectivo', 14000, hace(0, 8, 30), { tipo: 'gasto' }),
    mov('entra', 'Venta de vitrina VTA-2405', 'Banco', 35000, hace(0, 8, 50), { tipo: 'venta', ref: 'VTA-2405' }),
    mov('entra', 'Adelanto ORD-1049 · Wilson Beltrán', 'Efectivo', 100000, hace(0, 9, 7), { tipo: 'orden', ref: 'ORD-1049' }),
    mov('entra', 'Cobro ORD-1042 · Diana Cárdenas', 'Digital', 58000, hace(0, 9, 40), { tipo: 'orden', ref: 'ORD-1042' }),
    mov('entra', 'Venta de vitrina VTA-2406', 'Efectivo', 66000, hace(0, 10, 15), { tipo: 'venta', ref: 'VTA-2406' }),
    mov('sale', 'Transporte de repuestos', 'Efectivo', 18000, hace(0, 10, 40), { tipo: 'gasto' }),
    mov('sale', 'Abono a Distribuciones Andina', 'Banco', 80000, hace(0, 11, 20), { tipo: 'compra', ref: 'p1' }),
  ];
  for (const m of movimientos) m.medio = m.fuente === 'Efectivo' ? 'Efectivo' : m.fuente === 'Banco' ? 'Tarjeta' : 'Nequi';

  await db.transaction('rw', [db.servicios, db.repuestos, db.proveedores, db.clientes, db.bicis, db.ordenes, db.compras, db.movimientos, db.taller], async () => {
    await db.servicios.bulkPut(servicios);
    await db.repuestos.bulkPut(repuestos);
    await db.proveedores.bulkPut(proveedores);
    await db.clientes.bulkPut(clientes);
    await db.bicis.bulkPut(bicis);
    await db.ordenes.bulkPut(ordenes);
    await db.compras.bulkPut(compras);
    await db.movimientos.bulkPut(movimientos);
    await db.taller.update('taller', { siguienteOrden: 1053, siguienteVenta: 2407 });
  });
}


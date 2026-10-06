import { Routes } from '@angular/router';
import { inicioPorRolGuard, primeraVezGuard, rolGuard, sesionGuard } from './core/guards';
import type { DatosPantalla } from './layout/marco.component';

const recibir = () => import('./features/recibir/recibir.page').then((m) => m.RecibirPage);

const ADMIN_Y_MOSTRADOR = rolGuard('admin', 'mostrador');
const SOLO_ADMIN = rolGuard('admin');

/** Pantalla con cabecera. `barra` pone la barra inferior; `atras`, la flecha para volver. */
const d = (datos: DatosPantalla) => datos;

export const routes: Routes = [
  {
    path: 'bienvenida',
    canActivate: [primeraVezGuard],
    loadComponent: () => import('./features/bienvenida/bienvenida.page').then((m) => m.BienvenidaPage),
  },
  {
    path: 'entrar',
    loadComponent: () => import('./features/entrar/entrar.page').then((m) => m.EntrarPage),
  },
  {
    path: '',
    canActivate: [sesionGuard],
    loadComponent: () => import('./layout/marco.component').then((m) => m.MarcoComponent),
    children: [
      { path: '', pathMatch: 'full', canActivate: [inicioPorRolGuard], children: [] },

      // Barra principal
      {
        path: 'inicio',
        canActivate: [ADMIN_Y_MOSTRADOR],
        data: d({ logo: true, barra: 'principal' }),
        loadComponent: () => import('./features/inicio/inicio.page').then((m) => m.InicioPage),
      },
      {
        path: 'ordenes',
        canActivate: [ADMIN_Y_MOSTRADOR],
        data: d({ titulo: 'Órdenes', barra: 'principal' }),
        loadComponent: () => import('./features/ordenes/ordenes.page').then((m) => m.OrdenesPage),
      },
      {
        path: 'clientes',
        canActivate: [ADMIN_Y_MOSTRADOR],
        data: d({ titulo: 'Clientes', barra: 'principal' }),
        loadComponent: () => import('./features/clientes/clientes.page').then((m) => m.ClientesPage),
      },
      {
        path: 'mas',
        canActivate: [ADMIN_Y_MOSTRADOR],
        data: d({ titulo: 'Más', barra: 'principal' }),
        loadComponent: () => import('./features/mas/mas.page').then((m) => m.MasPage),
      },

      // Recibir una bici y la orden
      { path: 'recibir', canActivate: [ADMIN_Y_MOSTRADOR], data: d({ titulo: 'Recibir una bici', atras: true }), loadComponent: recibir },
      { path: 'recibir/:biciId', canActivate: [ADMIN_Y_MOSTRADOR], data: d({ titulo: 'Recibir una bici', atras: true }), loadComponent: recibir },
      {
        path: 'orden-creada/:numero',
        canActivate: [ADMIN_Y_MOSTRADOR],
        data: d({ titulo: 'Orden creada' }),
        loadComponent: () => import('./features/recibir/orden-creada.page').then((m) => m.OrdenCreadaPage),
      },
      {
        path: 'orden/:numero',
        data: d({ titulo: 'Orden', atras: true }),
        loadComponent: () => import('./features/orden/orden.page').then((m) => m.OrdenPage),
      },
      {
        path: 'cotizacion/:numero',
        canActivate: [ADMIN_Y_MOSTRADOR],
        data: d({ titulo: 'Cotización', atras: true }),
        loadComponent: () => import('./features/cotizacion/cotizacion.page').then((m) => m.CotizacionPage),
      },
      {
        path: 'aprobacion/:numero',
        canActivate: [ADMIN_Y_MOSTRADOR],
        data: d({ titulo: 'Vista del cliente', atras: true }),
        loadComponent: () => import('./features/cotizacion/aprobacion.page').then((m) => m.AprobacionPage),
      },
      {
        path: 'cobrar/:numero',
        canActivate: [ADMIN_Y_MOSTRADOR],
        data: d({ titulo: 'Entregar y cobrar', atras: true }),
        loadComponent: () => import('./features/cobrar/cobrar.page').then((m) => m.CobrarPage),
      },
      {
        path: 'bici/:id',
        canActivate: [ADMIN_Y_MOSTRADOR],
        data: d({ titulo: 'Hoja de vida', atras: true }),
        loadComponent: () => import('./features/bici/bici.page').then((m) => m.BiciPage),
      },

      // Mostrador
      {
        path: 'venta',
        canActivate: [ADMIN_Y_MOSTRADOR],
        data: d({ titulo: 'Venta de vitrina', atras: true }),
        loadComponent: () => import('./features/venta/venta.page').then((m) => m.VentaPage),
      },
      {
        path: 'venta-cobrada/:numero',
        canActivate: [ADMIN_Y_MOSTRADOR],
        data: d({ titulo: 'Venta cobrada' }),
        loadComponent: () => import('./features/venta/venta-cobrada.page').then((m) => m.VentaCobradaPage),
      },

      // Mecánico
      {
        path: 'mis-trabajos',
        canActivate: [rolGuard('mecanico', 'admin')],
        data: d({ titulo: 'Mis trabajos', barra: 'mecanico' }),
        loadComponent: () => import('./features/mis-trabajos/mis-trabajos.page').then((m) => m.MisTrabajosPage),
      },
      {
        path: 'perfil',
        data: d({ titulo: 'Mi perfil', barra: 'mecanico' }),
        loadComponent: () => import('./features/perfil/perfil.page').then((m) => m.PerfilPage),
      },
      {
        path: 'repuestos',
        data: d({ titulo: 'Repuestos', barra: 'mecanico' }),
        loadComponent: () => import('./features/repuestos/repuestos.page').then((m) => m.RepuestosPage),
      },

      // Módulos de "Más"
      {
        path: 'servicios',
        canActivate: [ADMIN_Y_MOSTRADOR],
        data: d({ titulo: 'Servicios', atras: true }),
        loadComponent: () => import('./features/servicios/servicios.page').then((m) => m.ServiciosPage),
      },
      {
        path: 'compras',
        canActivate: [SOLO_ADMIN],
        data: d({ titulo: 'Compras', atras: true }),
        loadComponent: () => import('./features/compras/compras.page').then((m) => m.ComprasPage),
      },
      {
        path: 'compras/nueva',
        canActivate: [SOLO_ADMIN],
        data: d({ titulo: 'Registrar una compra', atras: true }),
        loadComponent: () => import('./features/compras/nueva-compra.page').then((m) => m.NuevaCompraPage),
      },
      {
        path: 'cartera',
        canActivate: [ADMIN_Y_MOSTRADOR],
        data: d({ titulo: 'Cartera', atras: true }),
        loadComponent: () => import('./features/cartera/cartera.page').then((m) => m.CarteraPage),
      },
      {
        path: 'caja',
        canActivate: [ADMIN_Y_MOSTRADOR],
        data: d({ titulo: 'Caja', atras: true }),
        loadComponent: () => import('./features/caja/caja.page').then((m) => m.CajaPage),
      },
      {
        path: 'caja/cierre',
        canActivate: [ADMIN_Y_MOSTRADOR],
        data: d({ titulo: 'Cierre de caja', atras: true }),
        loadComponent: () => import('./features/caja/cierre.page').then((m) => m.CierrePage),
      },
      {
        path: 'mecanicos',
        canActivate: [SOLO_ADMIN],
        data: d({ titulo: 'Mecánicos', atras: true }),
        loadComponent: () => import('./features/mecanicos/mecanicos.page').then((m) => m.MecanicosPage),
      },
      {
        path: 'garantias',
        canActivate: [ADMIN_Y_MOSTRADOR],
        data: d({ titulo: 'Garantías', atras: true }),
        loadComponent: () => import('./features/garantias/garantias.page').then((m) => m.GarantiasPage),
      },
      {
        path: 'recordatorios',
        canActivate: [ADMIN_Y_MOSTRADOR],
        data: d({ titulo: 'Recordatorios', atras: true }),
        loadComponent: () => import('./features/recordatorios/recordatorios.page').then((m) => m.RecordatoriosPage),
      },
      {
        path: 'reportes',
        canActivate: [SOLO_ADMIN],
        data: d({ titulo: 'Reportes', atras: true }),
        loadComponent: () => import('./features/reportes/reportes.page').then((m) => m.ReportesPage),
      },
      {
        path: 'configuracion',
        canActivate: [SOLO_ADMIN],
        data: d({ titulo: 'Configuración', atras: true }),
        loadComponent: () => import('./features/configuracion/configuracion.page').then((m) => m.ConfiguracionPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

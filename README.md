# QualityTaller

App para administrar un taller de bicicletas desde el celular. Angular 22 + PWA, **sin servidor**: todos los datos (clientes, órdenes, fotos, caja) se guardan en el celular con IndexedDB (Dexie).

El diseño sale de `../Recibir bici y orden de trabajo/design_handoff_qualitytaller` (prototipo `QualityTaller.dc.html` y tokens en `_ds/`).

## Cómo funciona

- **Un taller por celular.** La primera vez que se abre, la app pide el nombre del taller, el administrador con su PIN y, si se quiere, más personas (mostrador o mecánico) con su propio PIN.
- **Cambio de persona con PIN de 4 dígitos.** Se toca la pastilla del rol en la cabecera (o "Cambiar de persona" en Más). Todo lo que se hace queda en el historial con el nombre de quien lo hizo y la hora.
- **Roles.** Administrador ve todo. Mostrador no ve costos ni utilidad. Mecánico solo ve Mis trabajos, Repuestos y Mi perfil, y no ve plata.
- **Copia de seguridad.** En Más → Copia de seguridad (solo administrador). Arma un archivo con todo el taller, fotos incluidas, para guardarlo en Archivos, iCloud o WhatsApp. Con ese archivo se restaura todo en otro celular.
- **WhatsApp.** Los mensajes se abren con `wa.me` y el texto ya escrito. Las fotos se comparten con la hoja de compartir del iPhone.

## Desarrollo

```bash
npm install
npm start          # http://localhost:4200 (también desde la red local por la IP del PC)
npm run build      # compila en dist/quialitytaller/browser
```

Por la IP local (http) la app abre en el celular, pero **no se puede instalar** ni funciona sin señal: Safari exige HTTPS para eso.

## Instalar en el iPhone

Safari solo instala una app web desde una dirección **HTTPS**. La app se sirve desde el PC por un túnel solo mientras se instala o se actualiza. Después funciona sin internet y sin el PC.

> **Importante: usa siempre la misma dirección.** Los datos del taller quedan atados a la dirección desde la que se instaló la app. Si un día se instala desde otra dirección, sale un taller vacío. Por eso se usa un túnel con **dirección fija**.

### 1. Túnel con dirección fija (una sola vez)

Con ngrok (gratis):

1. Crea una cuenta en https://ngrok.com e instala ngrok para Windows.
2. Conecta tu cuenta: `ngrok config add-authtoken <tu-token>`.
3. En el panel de ngrok → **Domains**, reclama tu dominio gratis (algo como `mi-taller.ngrok-free.app`).

### 2. Servir la app

En una terminal:

```bash
npm run celular    # compila y sirve en http://localhost:8080
```

En otra terminal:

```bash
ngrok http --url=mi-taller.ngrok-free.app 8080
```

### 3. Instalarla

1. En el iPhone abre **Safari** (tiene que ser Safari) en `https://mi-taller.ngrok-free.app`. La primera vez ngrok muestra un aviso: toca **Visit Site**.
2. Toca **Compartir** → **Agregar a pantalla de inicio** → **Agregar**.
3. Abre QualityTaller desde el ícono y configura el taller.

Ya puedes apagar el PC y el túnel.

### Actualizar la app

Repite el paso 2 con la **misma dirección** y abre la app en el iPhone con internet. La versión nueva se descarga sola y se aplica la próxima vez que se abra la app. Los datos no se tocan.

## Estructura

```
src/app/
  core/       datos (db.ts, models.ts), sesión y PIN, formato de plata y fechas, fotos, WhatsApp, copia de seguridad, datos de ejemplo
  shared/     piezas de interfaz: hoja inferior, confirmación, aviso, cámara, foto, estado, pasos, teclado del PIN
  layout/     cabecera negra, barra inferior de 5 pestañas y la del mecánico
  features/   una carpeta por pantalla
src/styles/   tokens del sistema de diseño (copiados del handoff) y clases de interfaz
```

## Avance por módulos

1. ✅ Base: tokens, componentes, navegación, PWA instalable, datos locales, PIN por persona, roles, copia de seguridad
2. ✅ Recibir una bici (4 pasos + confirmación, borrador automático)
3. ✅ Órdenes, orden en pantalla completa y sus estados (incluye diagnóstico, express, respuesta del cliente y garantía)
4. ✅ Cotización y vista del cliente (el inventario se aparta al cotizar y vuelve si no se aprueba)
5. ✅ Entregar y cobrar (pago parcial a cartera, garantía por orden, recibo por WhatsApp)
6. ✅ Clientes y hoja de vida de la bici (con edición de datos y componentes)
7. ✅ Inicio (panel del día, alertas calculadas con los datos reales)
8. ✅ Mis trabajos (mecánico): tareas, pedir repuesto, fotos, tomar bicis sin asignar
9. ✅ Venta de vitrina y repuestos (artículo suelto, alta y edición de repuestos)
10. ✅ Caja y cierre (saldos calculados con los movimientos, ajuste de cierre, saldos iniciales)
11. ✅ Resto de "Más": servicios, compras (con registro de compra), cartera, mecánicos, garantías, recordatorios, reportes, configuración

Todas las pantallas del prototipo están hechas y abren sin internet.

## Reglas del negocio que implementa la app

- **Inventario.** Un repuesto sale del inventario al guardarlo en una orden (queda apartado para esa bici) y vuelve si el cliente no aprueba ese ítem o rechaza la cotización. En la venta de vitrina baja al cobrar. Al registrar una compra sube y se actualiza el costo.
- **Plata.** Cada cobro, adelanto, abono, venta, gasto y compra queda como un movimiento en la caja, en su fuente (efectivo, banco o billeteras). Los saldos se calculan con esos movimientos. Si al cerrar la caja no cuadra, queda un ajuste con la diferencia.
- **Cartera.** Si el cliente no paga todo al entregar, lo que falta queda en su cartera y se cobra después con abonos.
- **Garantía.** Por defecto la del taller (Configuración), se puede cambiar al entregar. La orden de garantía es urgente, sin cobro y queda ligada a la original.
- **Aprobación.** No se repara sin aprobación del cliente, salvo trabajo express, donde queda quién lo autorizó.
- **Roles.** El mostrador no ve costos de compra, utilidad, Compras, Reportes, Mecánicos ni Configuración. El mecánico no ve plata ni datos de contacto del cliente.
- **WhatsApp e iPhone.** WhatsApp y la hoja de compartir se abren en el mismo toque del botón: Safari bloquea las ventanas que se abren después de esperar algo.

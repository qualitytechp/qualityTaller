import { soloDigitos } from './formato';

/**
 * Abre WhatsApp con el mensaje ya escrito. Sin celular, WhatsApp deja escoger el contacto.
 * Hay que llamarla directo en el toque, antes de cualquier `await`: Safari bloquea las
 * ventanas que se abren después.
 */
export function abrirWhatsApp(celular: string | undefined, texto: string): void {
  const num = soloDigitos(celular || '');
  const destino = num ? (num.length === 10 ? '57' + num : num) : '';
  const url = 'https://wa.me/' + destino + '?text=' + encodeURIComponent(texto);
  // Si igual la bloquean, se abre en la misma pestaña (iOS pasa a la app de WhatsApp).
  if (!window.open(url, '_blank')) window.location.href = url;
}

export function enlaceLlamar(celular: string): string {
  return 'tel:+57' + soloDigitos(celular);
}

/** Reemplaza {cliente} {bici} {orden} {fecha} {saldo} en los textos de la configuración. */
export function llenarPlantilla(plantilla: string, valores: Record<string, string>): string {
  return plantilla.replace(/\{(\w+)\}/g, (todo, clave: string) => valores[clave] ?? todo);
}

/**
 * Comparte fotos o archivos con la hoja de compartir del iPhone (WhatsApp, AirDrop, Archivos).
 * Devuelve false si el navegador no permite compartir archivos.
 */
export async function compartirArchivos(archivos: File[], texto?: string): Promise<boolean> {
  const datos: ShareData = { files: archivos, text: texto };
  if (!navigator.canShare?.(datos)) return false;
  try {
    await navigator.share(datos);
  } catch (e) {
    const nombre = (e as DOMException)?.name;
    // Cancelar la hoja de compartir no es un error.
    if (nombre === 'AbortError') return true;
    // Safari no deja compartir si pasó mucho tiempo desde el toque: se usa el plan B.
    if (nombre === 'NotAllowedError') return false;
    throw e;
  }
  return true;
}

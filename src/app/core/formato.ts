import { Pipe, PipeTransform } from '@angular/core';

/** Plata en pesos: `$1.234.000`, y el menos antes del signo: `-$34.000`. */
export function plata(n: number | null | undefined): string {
  const v = Math.round(n || 0);
  return (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('es-CO');
}

@Pipe({ name: 'plata' })
export class PlataPipe implements PipeTransform {
  transform(n: number | null | undefined): string {
    return plata(n);
  }
}

/** Convierte lo que se escribe en un campo de plata ("$ 120.000") en número. */
export function aNumero(texto: string | number | null | undefined): number {
  return parseInt(String(texto ?? '').replace(/\D/g, ''), 10) || 0;
}

export function soloDigitos(texto: string): string {
  return String(texto || '').replace(/\D/g, '');
}

export function hora(ms: number): string {
  return new Date(ms)
    .toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
    .replace(/\s?a\.\s?m\./, ' am')
    .replace(/\s?p\.\s?m\./, ' pm');
}

function mismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function mayuscula(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** "Hoy 8:42 am", "Ayer 3:10 pm", "Mañana 11:00 am", "Vie 6 sep 5:00 pm". */
export function cuando(ms: number, conHora = true): string {
  const d = new Date(ms);
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);
  let dia: string;
  if (mismoDia(d, hoy)) dia = 'Hoy';
  else if (mismoDia(d, ayer)) dia = 'Ayer';
  else if (mismoDia(d, manana)) dia = 'Mañana';
  else {
    const opts: Intl.DateTimeFormatOptions =
      Math.abs(d.getTime() - hoy.getTime()) < 6 * 864e5
        ? { weekday: 'short', day: 'numeric', month: 'short' }
        : { day: 'numeric', month: 'short' };
    dia = mayuscula(d.toLocaleDateString('es-CO', opts).replace(/\./g, '').replace(',', ''));
  }
  return conHora ? dia + ' ' + hora(ms) : dia;
}

/** "Viernes 4 de septiembre". */
export function fechaLarga(ms: number): string {
  return mayuscula(new Date(ms).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }));
}

/** "4 de octubre de 2026". */
export function fechaCompleta(ms: number): string {
  return new Date(ms).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "marzo 2023". */
export function mesAnio(ms: number): string {
  return new Date(ms).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

export function diasEntre(desde: number, hasta = Date.now()): number {
  const a = new Date(desde);
  a.setHours(0, 0, 0, 0);
  const b = new Date(hasta);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 864e5);
}

export function inicioDelDia(ms = Date.now()): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function inicial(texto: string | undefined): string {
  return (texto || '?').trim().charAt(0).toUpperCase() || '?';
}

const TONOS = ['#3f3f46', '#b71f0b', '#374151', '#52525b', '#951a0c', '#1f2937'];

/** Color de fondo estable para las miniaturas sin foto. */
export function tono(semilla: string): string {
  let h = 0;
  for (let i = 0; i < semilla.length; i++) h += semilla.charCodeAt(i);
  return TONOS[h % TONOS.length];
}

export function plural(n: number, uno: string, varios: string): string {
  return n + ' ' + (n === 1 ? uno : varios);
}

/** Para buscar sin importar tildes ni mayúsculas: "Óscar" encuentra "oscar". */
export function normalizar(texto: string | undefined): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Fecha de un campo `type="date"` (AAAA-MM-DD) en hora local. */
export function isoLocal(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/** Une un campo de fecha y uno de hora ("17:00") en milisegundos. */
export function deFechaYHora(fecha: string, horaTexto: string): number {
  const [a, m, d] = fecha.split('-').map(Number);
  const [h, min] = (horaTexto || '17:00').split(':').map(Number);
  return new Date(a, m - 1, d, h || 0, min || 0).getTime();
}

import * as XLSX from 'xlsx';
import { IncidenceRecord } from '@/types/incidence';
import { sanitize } from './excel';

// Date formatter in America/Mexico_City timezone
function formatExcelDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return String(dateStr);
  }
}

// Translate category key to friendly label
const CATEGORY_LABELS: Record<string, string> = {
  missing_product: 'Producto Faltante',
  wrong_position: 'Posición Incorrecta',
  wrong_price: 'Precio Incorrecto',
  empty_shelf: 'Anaquel Vacío',
  unauthorized_product: 'Producto No Autorizado',
  damaged_product: 'Producto Dañado',
  wrong_facing: 'Frentes Incorrectos',
  other: 'Otro',
};

// ─── Sheet Builders ───

// 1. Resumen Sheet
function buildResumenSheet(rows: IncidenceRecord[]): XLSX.WorkSheet {
  const headers = [
    'Fecha',
    'Promotor',
    'Tienda',
    'Críticas',
    'Altas',
    'Medias',
    'Bajas',
    'Resumen',
  ];

  const dataRows = rows.map(r => [
    sanitize(formatExcelDate(r.photo_captured_at || r.created_at)),
    sanitize(r.promoter_name || 'Desconocido'),
    sanitize(r.store_name || 'Desconocido'),
    r.severity_critical || 0,
    r.severity_high || 0,
    r.severity_medium || 0,
    r.severity_low || 0,
    sanitize(r.summary || 'Sin resumen'),
  ]);

  return XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
}

// 2. Incidencias Sheet
function buildIncidenciasSheet(rows: IncidenceRecord[]): XLSX.WorkSheet {
  const headers = [
    'Comparación ID',
    'Categoría',
    'Severidad',
    'Producto',
    'Descripción',
    'Ubicación',
  ];

  const dataRows: (string | number)[][] = [];

  rows.forEach(r => {
    if (!r.incidences || !Array.isArray(r.incidences)) return;

    r.incidences.forEach(inc => {
      dataRows.push([
        sanitize(r.id),
        sanitize(CATEGORY_LABELS[inc.category] || inc.category),
        sanitize(inc.severity.toUpperCase()),
        sanitize(inc.product || '—'),
        sanitize(inc.description),
        sanitize(inc.location || '—'),
      ]);
    });
  });

  return XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
}

// 3. Por Promotor Sheet
function buildPorPromotorSheet(rows: IncidenceRecord[]): XLSX.WorkSheet {
  const headers = [
    'Promotor',
    'Comparaciones',
    'Críticas',
    'Altas',
    'Medias',
    'Bajas',
  ];

  const groups: Record<string, {
    comparaciones: number;
    criticas: number;
    altas: number;
    medias: number;
    bajas: number;
  }> = {};

  rows.forEach(r => {
    const promoter = r.promoter_name || 'Desconocido';
    if (!groups[promoter]) {
      groups[promoter] = { comparaciones: 0, criticas: 0, altas: 0, medias: 0, bajas: 0 };
    }
    groups[promoter].comparaciones += 1;
    groups[promoter].criticas += r.severity_critical || 0;
    groups[promoter].altas += r.severity_high || 0;
    groups[promoter].medias += r.severity_medium || 0;
    groups[promoter].bajas += r.severity_low || 0;
  });

  const dataRows = Object.entries(groups).map(([promoter, stats]) => [
    sanitize(promoter),
    stats.comparaciones,
    stats.criticas,
    stats.altas,
    stats.medias,
    stats.bajas,
  ]);

  // Sort by comparisons descending
  dataRows.sort((a, b) => (b[1] as number) - (a[1] as number));

  return XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
}

// 4. Por Tienda Sheet
function buildPorTiendaSheet(rows: IncidenceRecord[]): XLSX.WorkSheet {
  const headers = [
    'Tienda',
    'Comparaciones',
    'Críticas',
    'Altas',
    'Medias',
    'Bajas',
  ];

  const groups: Record<string, {
    comparaciones: number;
    criticas: number;
    altas: number;
    medias: number;
    bajas: number;
  }> = {};

  rows.forEach(r => {
    const store = r.store_name || 'Desconocido';
    if (!groups[store]) {
      groups[store] = { comparaciones: 0, criticas: 0, altas: 0, medias: 0, bajas: 0 };
    }
    groups[store].comparaciones += 1;
    groups[store].criticas += r.severity_critical || 0;
    groups[store].altas += r.severity_high || 0;
    groups[store].medias += r.severity_medium || 0;
    groups[store].bajas += r.severity_low || 0;
  });

  const dataRows = Object.entries(groups).map(([store, stats]) => [
    sanitize(store),
    stats.comparaciones,
    stats.criticas,
    stats.altas,
    stats.medias,
    stats.bajas,
  ]);

  // Sort by comparisons descending
  dataRows.sort((a, b) => (b[1] as number) - (a[1] as number));

  return XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
}

// ─── Main Builder ───

export function buildIncidencesWorkbook(rows: IncidenceRecord[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const wsResumen = buildResumenSheet(rows);
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

  const wsIncidencias = buildIncidenciasSheet(rows);
  XLSX.utils.book_append_sheet(wb, wsIncidencias, 'Incidencias');

  const wsPromotor = buildPorPromotorSheet(rows);
  XLSX.utils.book_append_sheet(wb, wsPromotor, 'Por Promotor');

  const wsTienda = buildPorTiendaSheet(rows);
  XLSX.utils.book_append_sheet(wb, wsTienda, 'Por Tienda');

  return wb;
}

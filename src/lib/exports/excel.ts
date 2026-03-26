import * as XLSX from 'xlsx';
import type { AnalysisResponse } from '@/types/analysis';

/**
 * Sanitize a cell value against CSV injection.
 * Any value starting with =, +, -, @, \t, or \r is prefixed with a single quote.
 */
function sanitize(value: unknown): string | number {
  if (value == null) return '';
  if (typeof value === 'number') return value;

  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

function buildResumenSheet(results: AnalysisResponse[]): XLSX.WorkSheet {
  const headers = [
    'Archivo',
    'Tipo de Foto',
    'Gravedad',
    'Cumplimiento',
    'SKUs Detectados',
    'Marca Dominante',
    'Condicion',
    'Escalado',
    'Truncado',
    'Tiempo',
    'Resumen',
  ];

  const rows = results.map((r, i) => {
    const a = r.analysis;
    const m = r.meta;
    const timeSeconds =
      m.processing_time_ms != null ? `${(m.processing_time_ms / 1000).toFixed(1)}s` : '';

    return [
      sanitize(`Imagen ${i + 1}`),
      sanitize(a.photo_type),
      sanitize(a.severity),
      sanitize(a.compliance?.score),
      a.inventory?.total_skus_detected ?? '',
      sanitize(a.shelf_share?.dominant_brand),
      sanitize(a.condition?.cleanliness),
      m.escalated ? 'si' : 'no',
      m.truncated ? 'si' : 'no',
      sanitize(timeSeconds),
      sanitize(a.summary),
    ];
  });

  return XLSX.utils.aoa_to_sheet([headers, ...rows]);
}

function buildInventarioSheet(results: AnalysisResponse[]): XLSX.WorkSheet {
  const headers = ['Imagen', 'Producto', 'Marca', 'Categoria', 'Cantidad', 'Ubicacion'];

  const rows: (string | number)[][] = [];

  results.forEach((r, i) => {
    const items = r.analysis.inventory?.items;
    if (!items) return;

    for (const item of items) {
      rows.push([
        i + 1,
        sanitize(item.name),
        sanitize(item.brand),
        sanitize(item.category),
        sanitize(item.quantity),
        sanitize(item.location),
      ]);
    }
  });

  return XLSX.utils.aoa_to_sheet([headers, ...rows]);
}

export async function generateExcel(
  results: AnalysisResponse[],
  fileName: string,
): Promise<void> {
  const wb = XLSX.utils.book_new();

  const ws1 = buildResumenSheet(results);
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

  const ws2 = buildInventarioSheet(results);
  XLSX.utils.book_append_sheet(wb, ws2, 'Inventario');

  XLSX.writeFile(wb, `bbm-batch-${fileName}.xlsx`);
}

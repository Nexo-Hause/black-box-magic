import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildIncidencesWorkbook } from '../incidences-excel';
import { IncidenceRecord } from '@/types/incidence';

const mockIncidences: IncidenceRecord[] = [
  {
    id: 'inc-1',
    planogram_id: 'pl-1',
    client_id: 'cli-fotl',
    ubiqo_capture_id: 'cap-1',
    promoter_name: 'Juan Pérez',
    store_name: 'Soriana Coyoacán',
    photo_captured_at: '2026-05-21T10:00:00Z',
    field_photo_paths: ['path1.jpg'],
    status: 'completed',
    incidences: [
      {
        id: '1',
        category: 'missing_product',
        severity: 'critical',
        product: 'Playera Blanca XL',
        description: 'Falta facing completo del SKU',
        location: 'Charola 2',
      },
      {
        id: '2',
        category: 'wrong_price',
        severity: 'medium',
        product: '=cmd|\' /C calc\'!A1', // CSV injection payload
        description: 'Precio incorrecto detectado',
      }
    ],
    incidence_count: 2,
    severity_critical: 1,
    severity_high: 0,
    severity_medium: 1,
    severity_low: 0,
    summary: 'Problemas en anaquel',
    photo_quality: 'good',
    coverage: 'full',
    processing_time_ms: 1200,
    model: 'gemini-1.5-flash',
    tokens_total: 1500,
    error_message: null,
    created_at: '2026-05-21T10:05:00Z',
    processed_at: '2026-05-21T10:05:10Z',
  },
  {
    id: 'inc-2',
    planogram_id: 'pl-1',
    client_id: 'cli-fotl',
    ubiqo_capture_id: 'cap-2',
    promoter_name: 'Juan Pérez',
    store_name: 'Walmart Satélite',
    photo_captured_at: '2026-05-21T12:00:00Z',
    field_photo_paths: ['path2.jpg'],
    status: 'completed',
    incidences: [],
    incidence_count: 0,
    severity_critical: 0,
    severity_high: 0,
    severity_medium: 0,
    severity_low: 0,
    summary: 'Sin incidencias',
    photo_quality: 'good',
    coverage: 'full',
    processing_time_ms: 800,
    model: 'gemini-1.5-flash',
    tokens_total: 1000,
    error_message: null,
    created_at: '2026-05-21T12:05:00Z',
    processed_at: '2026-05-21T12:05:05Z',
  }
];

describe('buildIncidencesWorkbook', () => {
  it('debe generar las 4 hojas exactas con sus nombres canónicos', () => {
    const wb = buildIncidencesWorkbook(mockIncidences);
    
    expect(wb.SheetNames).toEqual([
      'Resumen',
      'Incidencias',
      'Por Promotor',
      'Por Tienda'
    ]);
  });

  it('debe sanitizar celdas que representen inyecciones de fórmulas CSV/DDE', () => {
    const wb = buildIncidencesWorkbook(mockIncidences);
    
    // Check in 'Incidencias' sheet where the dirty formula '=cmd|...' was present in product
    const wsInc = wb.Sheets['Incidencias'];
    
    // Let's find the cell containing the malicious payload
    // Row 1 is headers, Row 2 is Juan Pérez's first incidence (Playera Blanca XL), Row 3 is wrong_price incidence
    // Columns: A=Comparación ID, B=Categoría, C=Severidad, D=Producto
    // Product should be at D3
    const cellD3 = wsInc['D3'];
    expect(cellD3).toBeDefined();
    // It must be prefixed with a single quote to block the formula injection
    expect(cellD3.v).toBe('\'=cmd|\' /C calc\'!A1');
  });

  it('debe agregar y agrupar correctamente los datos por promotor', () => {
    const wb = buildIncidencesWorkbook(mockIncidences);
    const wsProm = wb.Sheets['Por Promotor'];
    
    // We expect Juan Pérez to be grouped with 2 comparisons
    // Columns: A=Promotor, B=Comparaciones, C=Críticas, D=Altas, E=Medias, F=Bajas
    // Row 2 should be Juan Pérez
    expect(wsProm['A2'].v).toBe('Juan Pérez');
    expect(wsProm['B2'].v).toBe(2); // comparisons total
    expect(wsProm['C2'].v).toBe(1); // critical
    expect(wsProm['D2'].v).toBe(0); // high
    expect(wsProm['E2'].v).toBe(1); // medium
    expect(wsProm['F2'].v).toBe(0); // low
  });

  it('debe agregar y agrupar correctamente los datos por tienda', () => {
    const wb = buildIncidencesWorkbook(mockIncidences);
    const wsStore = wb.Sheets['Por Tienda'];
    
    // We expect two rows: one for Soriana Coyoacán and one for Walmart Satélite
    // Row 2 and Row 3
    const store1 = wsStore['A2'].v;
    const store2 = wsStore['A3'].v;
    
    expect([store1, store2]).toContain('Soriana Coyoacán');
    expect([store1, store2]).toContain('Walmart Satélite');
    
    // Soriana Coyoacán should have 1 comparison, 1 critical, 1 medium
    const sorianaRow = store1 === 'Soriana Coyoacán' ? '2' : '3';
    expect(wsStore[`B${sorianaRow}`].v).toBe(1); // comparisons
    expect(wsStore[`C${sorianaRow}`].v).toBe(1); // critical
    expect(wsStore[`E${sorianaRow}`].v).toBe(1); // medium
  });
});

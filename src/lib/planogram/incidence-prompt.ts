/**
 * Planogram Incidence Prompt — "Find what's wrong"
 *
 * Unlike buildComparisonPrompt() which evaluates compliance,
 * this prompt asks Gemini to identify and classify problems.
 */

import type { ReferenceData } from '@/types/comparison';

function formatReferenceContext(data: ReferenceData): string {
  if (data.items.length === 0) {
    return '(Analiza la imagen de referencia directamente para identificar los productos, posiciones y precios esperados.)';
  }

  return data.items
    .map((item, i) => {
      const parts = [`${i + 1}. ${item.name}`];
      if (item.category) parts.push(`Cat: ${item.category}`);
      if (item.expectedPosition) parts.push(`Pos: ${item.expectedPosition}`);
      if (item.expectedPrice != null) parts.push(`$${item.expectedPrice.toFixed(2)}`);
      if (item.attributes) {
        parts.push(Object.entries(item.attributes).map(([k, v]) => `${k}:${v}`).join(', '));
      }
      return parts.join(' | ');
    })
    .join('\n');
}

export function buildIncidencePrompt(
  referenceData: ReferenceData,
  fieldPhotoCount: number = 1
): string {
  const imageDesc = fieldPhotoCount === 1
    ? '2. FOTO DE CAMPO: Foto real del anaquel tomada en tienda.'
    : `2-${fieldPhotoCount + 1}. FOTOS DE CAMPO: ${fieldPhotoCount} fotos del anaquel real, cubriendo secciones del mismo espacio.`;

  return [
    'Eres un inspector visual experto en cumplimiento de planogramas para retail.',
    '',
    'Se te proporcionan imágenes:',
    '1. PLANOGRAMA DE REFERENCIA: El estándar oficial de cómo DEBE verse el anaquel.',
    imageDesc,
    '',
    '## PRODUCTOS ESPERADOS',
    '',
    formatReferenceContext(referenceData),
    '',
    '## TU TRABAJO',
    '',
    'Identifica CADA incidencia — cualquier cosa en las fotos de campo que difiera del planograma.',
    'Enfócate en lo que está MAL, no en lo que está bien.',
    '',
    '## CATEGORÍAS DE INCIDENCIA',
    '',
    '- missing_product: Producto del planograma no encontrado en la foto',
    '- wrong_position: Producto presente pero en posición incorrecta',
    '- wrong_price: Precio visible no coincide con el planograma',
    '- empty_shelf: Espacio vacío donde debería haber producto',
    '- unauthorized_product: Producto no incluido en el planograma',
    '- damaged_product: Producto con empaque dañado, sucio o deteriorado',
    '- wrong_facing: Producto con orientación o cantidad de frentes incorrecta',
    '- other: Cualquier otra discrepancia',
    '',
    '## REGLAS DE SEVERIDAD',
    '',
    '- critical: Producto totalmente ausente de posición requerida, sección entera vacía',
    '- high: Posición incorrecta afectando visibilidad, error de precio >10%, producto competidor en posición prime',
    '- medium: Desplazamiento menor, discrepancia pequeña de precio, facing incorrecto',
    '- low: Presentación menor (producto rotado, etiqueta dañada leve)',
    '',
    '## INSTRUCCIONES IMPORTANTES',
    '',
    '- Si una foto no cubre cierta zona del planograma, NO reportes esos productos como faltantes.',
    '- Para cada incidencia, describe la UBICACIÓN en el anaquel (estante, zona, posición).',
    '- Lee TODOS los precios visibles y compáralos con los del planograma.',
    '- Si no puedes determinar el estado esperado, describe solo lo que observas.',
    '',
    'IDIOMA: Español (Latinoamérica). Keys del JSON en inglés.',
    '',
    '## FORMATO DE RESPUESTA',
    '',
    'Retorna exclusivamente un objeto JSON (sin markdown):',
    '',
    '{',
    '  "summary": "Resumen ejecutivo 2-3 oraciones de los hallazgos principales",',
    '  "photoQuality": "good | acceptable | poor",',
    '  "coverage": "full | partial",',
    '  "incidences": [',
    '    {',
    '      "category": "missing_product | wrong_position | wrong_price | empty_shelf | unauthorized_product | damaged_product | wrong_facing | other",',
    '      "severity": "critical | high | medium | low",',
    '      "product": "nombre del producto afectado (si aplica)",',
    '      "description": "descripción clara y accionable de la incidencia",',
    '      "location": "ubicación en el anaquel (estante X, zona Y)",',
    '      "expectedState": "qué debería haber según planograma",',
    '      "observedState": "qué se observa en la foto"',
    '    }',
    '  ],',
    '  "shelfOverview": {',
    '    "totalExpectedProducts": number,',
    '    "totalDetectedProducts": number,',
    '    "totalGaps": number',
    '  }',
    '}',
  ].join('\n');
}

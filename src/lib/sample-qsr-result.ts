import type { AnalysisResponse } from '@/types/analysis';

export const SAMPLE_QSR_RESULT: AnalysisResponse = {
  success: true,
  client: 'demo',
  analysis: {
    photo_type: 'facade',
    priority_facets: ['compliance', 'condition', 'context'],
    summary: 'Fachada de restaurante de comida rápida con señalización de marca visible pero con varios problemas de mantenimiento. El menú exterior está parcialmente obstruido, la iluminación del letrero principal funciona pero las luces laterales están apagadas. El área de entrada necesita limpieza y el material POP de la promoción actual está despegado en una esquina.',
    severity: 'MODERATE',
    execution_score: 62,
    inventory: {
      items: [
        { name: 'Menú exterior principal', brand: 'QSR Brand', quantity: 1, category: 'señalización' },
        { name: 'Banner promocional combo', brand: 'QSR Brand', quantity: 2, category: 'POP' },
        { name: 'Letrero horario', brand: 'QSR Brand', quantity: 1, category: 'señalización' },
        { name: 'Sticker de delivery apps', brand: 'Uber Eats / Rappi / DiDi', quantity: 3, category: 'señalización' },
        { name: 'Poster de temporada', brand: 'QSR Brand', quantity: 1, category: 'POP' },
      ],
      total_skus_detected: 5,
    },
    shelf_share: {
      brands: [
        { name: 'Marca Principal', estimated_share_pct: 75, position: 'Dominante en fachada' },
        { name: 'Delivery Partners', estimated_share_pct: 15, position: 'Puerta de entrada' },
        { name: 'Promoción Temporal', estimated_share_pct: 10, position: 'Ventana lateral' },
      ],
      dominant_brand: 'Marca Principal',
      notes: 'La marca mantiene dominio visual pero los elementos de delivery compiten por atención en la entrada.',
    },
    pricing: {
      prices_found: [
        { item: 'Combo del día', price: 89, currency: 'MXN', type: 'promo' },
        { item: 'Combo familiar', price: 249, currency: 'MXN', type: 'bundle' },
        { item: 'Hamburguesa clásica', price: 59, currency: 'MXN', type: 'regular' },
        { item: 'Bebida grande', price: 35, currency: 'MXN', type: 'regular' },
      ],
      strategies_detected: ['Combo pricing', 'Precio ancla', 'Promoción temporal'],
    },
    compliance: {
      score: 'MEDIUM',
      pop_materials: { present: true, properly_installed: false, condition: 'WORN' },
      product_facing: 'PARTIAL',
      signage: 'VISIBLE',
      issues: [
        'Banner promocional despegado en esquina inferior derecha',
        'Menú exterior con reflejo que dificulta lectura',
        'Falta el poster de la campaña nacional vigente',
        'Stickers de delivery desalineados',
      ],
    },
    condition: {
      cleanliness: 'ACCEPTABLE',
      displays: 'WORN',
      lighting: 'ADEQUATE',
      products: 'GOOD',
      safety_issues: [],
      notes: 'El piso de la entrada tiene manchas visibles. Los marcos de los displays exteriores muestran desgaste por exposición al sol. Las luces laterales del letrero no funcionan.',
    },
    context: {
      establishment_type: 'Restaurante QSR / Comida Rápida',
      inferred_location: {
        city_or_region: 'Zona metropolitana',
        country: 'México',
        confidence: 'HIGH',
        clues: ['Precios en MXN', 'Apps de delivery mexicanas', 'Estilo de construcción'],
      },
      setting: 'URBAN',
      time_of_day: 'Tarde',
      foot_traffic: 'MEDIUM',
    },
    insights: {
      strengths: [
        'Marca principal visible y reconocible desde la calle',
        'Precios competitivos en combos',
        'Presencia de múltiples plataformas de delivery',
      ],
      opportunities: [
        'Renovar material POP para campaña vigente — impacto inmediato en ventas',
        'Reparar iluminación lateral para visibilidad nocturna',
        'Reorganizar stickers de delivery con marco unificado',
      ],
      threats: [
        'Material POP deteriorado transmite descuido de marca',
        'Iluminación parcial reduce visibilidad en horario nocturno',
        'Competidor cercano con fachada renovada',
      ],
      recommendations: [
        'Reemplazar banner despegado y poster faltante (prioridad: hoy)',
        'Programar mantenimiento de iluminación lateral esta semana',
        'Limpiar entrada y marcos de displays',
        'Instalar soporte permanente para material POP para evitar despegue recurrente',
      ],
    },
    additional_observations: 'La sucursal cumple estándares básicos de marca pero muestra signos de mantenimiento diferido. Las áreas de mayor impacto son el material POP y la iluminación. Un supervisor debería visitar esta semana para validar la ejecución de la campaña nacional vigente.',
  },
  meta: {
    model: 'gemini-2.0-flash-lite',
    tokens: { input: 1247, output: 892, total: 2139 },
    processing_time_ms: 4200,
    engine: 'hybrid-v2',
    escalated: false,
    truncated: false,
  },
};

'use client';

import { useState } from 'react';
import type { AnalysisResponse } from '@/types/analysis';
import { formatForWhatsApp } from '@/lib/exports/whatsapp';
import { downloadJSON } from '@/lib/exports/json-download';
import { copyToClipboard } from '@/lib/exports/clipboard';
import { generateAnnotatedImage, downloadBlob } from '@/lib/exports/annotated-image';

type FeedbackState = 'idle' | 'working' | 'success' | 'error';

interface ExportMenuProps {
  result: AnalysisResponse;
  imageUrl: string;
  fileName: string;
  allResults?: AnalysisResponse[];
}

export function ExportMenu({ result, imageUrl, fileName }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, FeedbackState>>({});

  const showFeedback = (key: string, state: FeedbackState) => {
    setFeedback(prev => ({ ...prev, [key]: state }));
    if (state === 'success' || state === 'error') {
      setTimeout(() => setFeedback(prev => ({ ...prev, [key]: 'idle' })), 2000);
    }
  };

  const handleWhatsApp = async () => {
    showFeedback('whatsapp', 'working');
    const text = formatForWhatsApp(result);
    const ok = await copyToClipboard(text);
    showFeedback('whatsapp', ok ? 'success' : 'error');
    setOpen(false);
  };

  const handleJSON = () => {
    showFeedback('json', 'working');
    try {
      downloadJSON(result, fileName);
      showFeedback('json', 'success');
    } catch {
      showFeedback('json', 'error');
    }
    setOpen(false);
  };

  const handleAnnotated = async () => {
    showFeedback('annotated', 'working');
    const blob = await generateAnnotatedImage(imageUrl, result);
    if (blob) {
      downloadBlob(blob, `bbm-annotated-${fileName}.png`);
      showFeedback('annotated', 'success');
    } else {
      showFeedback('annotated', 'error');
    }
    setOpen(false);
  };

  const handlePDF = async () => {
    showFeedback('pdf', 'working');
    try {
      const { generatePDF } = await import('@/lib/exports/pdf');
      generatePDF(result, imageUrl, fileName);
      showFeedback('pdf', 'success');
    } catch {
      showFeedback('pdf', 'error');
    }
    setOpen(false);
  };

  const handleExcel = async () => {
    showFeedback('excel', 'working');
    try {
      const { generateExcel } = await import('@/lib/exports/excel');
      await generateExcel([result], fileName);
      showFeedback('excel', 'success');
    } catch {
      showFeedback('excel', 'error');
    }
    setOpen(false);
  };

  const label = (key: string, defaultLabel: string) => {
    const state = feedback[key];
    if (state === 'working') return 'Generando...';
    if (state === 'success') return key === 'whatsapp' ? 'Copiado!' : 'Descargado!';
    if (state === 'error') return 'Error';
    return defaultLabel;
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="btn btn--secondary btn--small"
        onClick={() => setOpen(!open)}
        style={{ fontSize: '0.75rem' }}
      >
        COMPARTIR {open ? '\u25B2' : '\u25BC'}
      </button>

      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9 }}
            onClick={() => setOpen(false)}
          />
          <div className="export-menu">
            <button className="export-menu__item" onClick={handleWhatsApp}>
              {label('whatsapp', 'WhatsApp (copiar texto)')}
            </button>
            <button className="export-menu__item" onClick={handleJSON}>
              {label('json', 'Descargar JSON')}
            </button>
            <button className="export-menu__item" onClick={handlePDF}>
              {label('pdf', 'Descargar PDF')}
            </button>
            <button className="export-menu__item" onClick={handleExcel}>
              {label('excel', 'Descargar Excel')}
            </button>
            <button className="export-menu__item" onClick={handleAnnotated}>
              {label('annotated', 'Imagen anotada')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

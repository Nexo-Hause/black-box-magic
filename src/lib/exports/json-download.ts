import type { AnalysisResponse } from '@/types/analysis';

export function downloadJSON(response: AnalysisResponse, fileName: string): void {
  // Create a filtered copy removing internal metadata fields
  const exportData: Record<string, unknown> = {
    success: response.success,
    ...(response.client != null && { client: response.client }),
    analysis: { ...response.analysis },
    ...(response.condition_detail != null && {
      condition_detail: response.condition_detail,
    }),
    meta: {
      model: response.meta.model,
      tokens: response.meta.tokens,
      processing_time_ms: response.meta.processing_time_ms,
      ...(response.meta.engine != null && { engine: response.meta.engine }),
      ...(response.meta.escalated != null && { escalated: response.meta.escalated }),
      ...(response.meta.truncated != null && { truncated: response.meta.truncated }),
    },
    ...(response.log_id != null && { log_id: response.log_id }),
  };

  // Remove analysis_version and model from the nested metadata (internal fields)
  if (
    exportData.analysis &&
    typeof exportData.analysis === 'object' &&
    'metadata' in (exportData.analysis as Record<string, unknown>)
  ) {
    const analysisCopy = exportData.analysis as Record<string, unknown>;
    const { metadata: _metadata, ...rest } = analysisCopy as Record<string, unknown> & {
      metadata: unknown;
    };
    exportData.analysis = rest;
  }

  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `bbm-analysis-${fileName}.json`;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();

  // Cleanup
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

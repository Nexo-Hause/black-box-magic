/**
 * BBM Onboarding — Config Synthesis
 *
 * Llama a Gemini Pro para sintetizar un ClientConfig completo a partir
 * de la transcripción del chat y los datos estructurados capturados
 * por function calls durante el onboarding.
 */

import { callGeminiChatWithRetry, SYNTHESIS_MODEL } from '@/lib/gemini-chat';
import type { ChatMessage, ChatPart } from '@/lib/gemini-chat';
import { clientConfigSchema } from '@/lib/engine/config';
import type { ClientConfig } from '@/types/engine';
import type { PartialOnboardingConfig } from '@/lib/onboarding/tools';

export interface SynthesisResult {
  config: ClientConfig;
  gaps: string[];
  confidence: number;
}

// ─── Synthesis System Prompt ──────────────────────────────────────────────────

const SYNTHESIS_SYSTEM_PROMPT = `
Eres un arquitecto de configuración de Black Box Magic (BBM).

Tu única responsabilidad es sintetizar un objeto ClientConfig JSON completo y coherente
a partir de:
1. La transcripción de una sesión de discovery entre un consultor de BBM y un prospecto.
2. Los datos estructurados capturados durante esa conversación (industria, áreas, criterios, etc.).

BBM analiza fotografías de campo (tiendas, puntos de venta, restaurantes, instalaciones)
con IA y retorna inteligencia estructurada sobre la ejecución en campo.

---

## Tu output

Debes retornar ÚNICAMENTE un objeto JSON con esta forma exacta:

{
  "config": { ... },   // ClientConfig completo
  "gaps": [ ... ],     // Lista de strings describiendo información faltante o ambigua
  "confidence": 0.85   // Número entre 0 y 1 indicando qué tan completa es la config
}

No incluyas markdown, no incluyas explicaciones fuera del JSON.

---

## Reglas para construir config

1. **Pesos de áreas:** Los pesos de todas las evaluationAreas deben sumar exactamente 1.0 (±0.05).
   Si la transcripción no especifica pesos, distribúyelos equitativamente.

2. **Criterios mínimos:** Cada área debe tener al menos 2 criterios. Si la transcripción menciona
   menos, infiere criterios razonables basados en el contexto de la industria y el área. Documenta
   las inferencias en el campo "gaps".

3. **Sin contradicciones:** Verifica que los criterios sean consistentes con la industria y el
   contexto del cliente. Si hay contradicción, elige la interpretación más coherente y documénta la
   ambigüedad en "gaps".

4. **IDs:** Genera IDs usando snake_case derivado del nombre. Ejemplo: "Limpieza del anaquel" → "limpieza_anaquel".

5. **Reglas de escalación:** Si la transcripción menciona situaciones inaceptables o críticas,
   crea EscalationRules apropiadas. Si no hay información, crea al menos una regla
   global_score_below con threshold 60.

6. **industryContext:** Resumen en español (máx. 1000 caracteres) del contexto del negocio del cliente.

7. **customInstructions:** Instrucciones específicas del cliente para el análisis (máx. 500 caracteres).
   Si no hay instrucciones específicas, usar string vacío.

8. **globalScoringMethod:** Usa "weighted" por defecto. Si el cliente mencionó pass/fail explícitamente, usar "pass_fail".

9. **passingScore:** Si el cliente mencionó un umbral de aprobación, usarlo. Por defecto, omitir.

10. **Confidence:** Calcula la confianza como: (fases cubiertas / 4) × (criterios con peso definido / total criterios).
    Si hay gaps críticos (sin industria, sin áreas), la confianza no puede superar 0.3.

---

## Schema exacto de ClientConfig

{
  "clientId": "string",
  "clientName": "string",
  "industry": "qsr" | "retail_btl" | "construccion" | "farmaceutica" | "servicios" | "operaciones",
  "evaluationAreas": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "weight": number (0-1),
      "criteria": [
        {
          "id": "string",
          "name": "string",
          "type": "binary" | "scale" | "count" | "presence",
          "description": "string",
          "weight": number (0-1),
          "critical": boolean,
          "scaleRange": [number, number]  // solo si type = "scale"
        }
      ],
      "applicableTo": ["string"]  // opcional
    }
  ],
  "globalScoringMethod": "weighted" | "equal" | "pass_fail",
  "passingScore": number (0-100),  // opcional
  "escalationRules": [
    {
      "id": "string",
      "trigger": {
        "type": "global_score_below" | "area_score_below" | "critical_criterion_failed" |
                "any_criterion_failed_in_area" | "count_below" | "count_above",
        // campos adicionales según el tipo
      },
      "severity": "low" | "medium" | "high" | "critical",
      "action": "flag" | "escalate" | "block",
      "notifyTo": "string",  // opcional
      "description": "string"
    }
  ],
  "industryContext": "string",
  "customInstructions": "string",
  "referenceImages": [],  // opcional, dejar vacío si no hay imágenes
  "version": 1,
  "createdAt": "string (ISO 8601)",
  "updatedAt": "string (ISO 8601)"
}

---

Responde SOLO con el JSON. Sin texto adicional.
`.trim();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formatea los mensajes del chat en texto legible para incluir en el prompt
 * de síntesis.
 */
export function formatTranscriptForSynthesis(messages: ChatMessage[]): string {
  const lines: string[] = [];

  for (const message of messages) {
    const role = message.role === 'user' ? 'Usuario' : 'Asistente';

    for (const part of message.parts) {
      if ('text' in part && part.text) {
        lines.push(`${role}: ${part.text}`);
      } else if ('functionCall' in part && part.functionCall) {
        const { name, args } = part.functionCall;
        lines.push(`→ Se registró: ${name}(${JSON.stringify(args)})`);
      }
      // functionResponse parts are internal — omit from transcript
    }
  }

  return lines.join('\n');
}

/**
 * Extrae texto de un ChatPart. Devuelve null si el part no es texto.
 */
function extractTextFromPart(part: ChatPart): string | null {
  if ('text' in part && part.text) return part.text;
  return null;
}

/**
 * Parsea el JSON de respuesta de Gemini, eliminando posibles bloques markdown.
 */
function parseGeminiJSON(raw: string): unknown {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  return JSON.parse(stripped);
}

// ─── Main Function ────────────────────────────────────────────────────────────

/**
 * Sintetiza un ClientConfig completo a partir de la transcripción del chat
 * de onboarding y los datos estructurados capturados durante la conversación.
 *
 * @param transcript  Historial completo del chat (ChatMessage[])
 * @param partialConfig  Datos estructurados capturados por function calls
 * @param clientInfo  Identificadores del cliente
 * @returns  SynthesisResult con config validada, gaps y confidence
 */
export async function synthesizeConfig(
  transcript: ChatMessage[],
  partialConfig: PartialOnboardingConfig,
  clientInfo: { clientId: string; clientName: string; email: string },
): Promise<SynthesisResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY no está configurada');
  }

  // Truncate transcript if too long — keep last 40 turns
  const MAX_TURNS = 40;
  const trimmedTranscript =
    transcript.length > MAX_TURNS ? transcript.slice(transcript.length - MAX_TURNS) : transcript;

  // Format transcript as readable text
  const transcriptText = formatTranscriptForSynthesis(trimmedTranscript);

  // Build the synthesis prompt
  const synthesisPrompt = buildSynthesisPrompt(
    transcriptText,
    partialConfig,
    clientInfo,
  );

  // Call Gemini Pro for synthesis
  const messages: ChatMessage[] = [
    {
      role: 'user',
      parts: [{ text: synthesisPrompt }],
    },
  ];

  const response = await callGeminiChatWithRetry(
    SYNTHESIS_MODEL,
    SYNTHESIS_SYSTEM_PROMPT,
    messages,
    apiKey,
  );

  // Extract text from response
  const rawText = response.text;
  if (!rawText) {
    throw new Error(
      'Gemini Pro no retornó texto en la síntesis. La respuesta puede haber sido vacía o solo function calls.',
    );
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = parseGeminiJSON(rawText);
  } catch (e) {
    throw new Error(
      `Gemini Pro retornó JSON inválido en la síntesis: ${(e as Error).message}\n\nRespuesta raw:\n${rawText.slice(0, 500)}`,
    );
  }

  // Validate structure
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('config' in parsed) ||
    !('gaps' in parsed) ||
    !('confidence' in parsed)
  ) {
    throw new Error(
      `Gemini Pro retornó un objeto sin los campos esperados (config, gaps, confidence).\n\nRespuesta raw:\n${rawText.slice(0, 500)}`,
    );
  }

  const { config: rawConfig, gaps, confidence } = parsed as {
    config: unknown;
    gaps: unknown;
    confidence: unknown;
  };

  const normalizedGaps: string[] = Array.isArray(gaps)
    ? (gaps as unknown[]).filter((g) => typeof g === 'string').map((g) => String(g))
    : [];

  const normalizedConfidence =
    typeof confidence === 'number' && confidence >= 0 && confidence <= 1 ? confidence : 0;

  // Inject metadata before validation so Zod doesn't reject missing fields
  const configWithMeta = Object.assign({}, rawConfig as Record<string, unknown>, {
    clientId: clientInfo.clientId,
    clientName: clientInfo.clientName,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Validate with Zod
  const validationResult = clientConfigSchema.safeParse(configWithMeta);

  if (!validationResult.success) {
    const zodErrors = validationResult.error.issues.map(
      (issue) => `${issue.path.join('.')} — ${issue.message}`,
    );

    return {
      config: configWithMeta as unknown as ClientConfig, // best-effort, incomplete
      gaps: [
        ...normalizedGaps,
        'La configuración generada no pasó la validación Zod:',
        ...zodErrors,
      ],
      confidence: 0,
    };
  }

  const validatedConfig = validationResult.data as ClientConfig;

  // Ensure metadata is always set (Zod may strip unknown fields, re-apply)
  validatedConfig.clientId = clientInfo.clientId;
  validatedConfig.clientName = clientInfo.clientName;
  validatedConfig.version = 1;
  validatedConfig.createdAt = configWithMeta.createdAt as string;
  validatedConfig.updatedAt = configWithMeta.updatedAt as string;

  return {
    config: validatedConfig,
    gaps: normalizedGaps,
    confidence: normalizedConfidence,
  };
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildSynthesisPrompt(
  transcriptText: string,
  partialConfig: PartialOnboardingConfig,
  clientInfo: { clientId: string; clientName: string; email: string },
): string {
  const sections: string[] = [];

  sections.push(`## Información del cliente

- **ID:** ${clientInfo.clientId}
- **Nombre:** ${clientInfo.clientName}
- **Email:** ${clientInfo.email}`);

  sections.push(`## Datos estructurados capturados durante el onboarding

\`\`\`json
${JSON.stringify(partialConfig, null, 2)}
\`\`\``);

  sections.push(`## Transcripción de la sesión de discovery

${transcriptText || '(Sin transcripción disponible)'}`);

  sections.push(`## Instrucción

Con base en la transcripción y los datos estructurados anteriores, genera un ClientConfig completo.
Recuerda:
- Los pesos de las áreas deben sumar 1.0 (±0.05)
- Cada área debe tener al menos 2 criterios
- Detecta qué información falta y repórtala en "gaps"
- Retorna ÚNICAMENTE el JSON con las claves: config, gaps, confidence`);

  return sections.join('\n\n');
}

/**
 * Script para generar voiceover y música de fondo usando Gemini API.
 *
 * Uso:
 *   GOOGLE_AI_API_KEY=xxx npx ts-node remotion/scripts/generate-audio.ts
 *
 * Genera:
 *   remotion/public/voiceover.mp3  — narración completa del video
 *   remotion/public/music.mp3     — música de fondo instrumental
 */

import * as fs from "node:fs";
import * as path from "node:path";

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_API_KEY;
if (!API_KEY) {
  console.error("ERROR: Set GOOGLE_AI_API_KEY environment variable");
  process.exit(1);
}

const OUT_DIR = path.join(__dirname, "..", "public");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

/** Wrap raw PCM (16-bit LE, mono) into a valid WAV file */
function pcmToWav(pcmBuffer: Buffer, sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM format chunk size
  header.writeUInt16LE(1, 20);  // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// ─── Voiceover Script ───────────────────────────────────────────────
// Cada línea corresponde a una escena del video (2:10 total).
// El narrador debe sonar profesional, cálido, confiable.
// Ritmo pausado pero no lento — como un pitch de ventas conversacional.

const VOICEOVER_SCRIPT = `
Tu equipo de campo visita decenas de puntos cada día.
Supervisores, operadores, promotores — todos en la calle, todos generando información valiosa.

Pero, ¿cuánta de esa información se pierde entre la visita y el reporte?

Reportes manuales que dependen de la memoria del operador.
Horas entre la visita y el análisis de la información.
Decisiones basadas en datos incompletos o subjetivos.

Ahora imagina esto.
El operador toma una foto en el punto — como ya lo hace.
La inteligencia artificial analiza la imagen en segundos.
Y recibes un reporte estructurado al instante.

¿Qué analiza?
Inventario y productos detectados.
Cumplimiento de planograma y materiales de punto de venta.
Participación de marca.
Condición del establecimiento.
Precios visibles.
Y oportunidades de mejora — todo de forma automática.

Ya sea que supervises franquicias de restaurantes, ejecución en punto de venta, avance de obra, instalaciones de fibra óptica, o cumplimiento de contratos de servicio — la inteligencia artificial se adapta a tu operación.

Y lo mejor: se integra directamente con Evidence.
El operador toma la foto como parte de su ruta normal.
El análisis ocurre de forma automática.
Y los resultados llegan directo a tu B.I. — dashboards, reportes, tendencias — sin cambiar el flujo de trabajo de tu equipo.

De fotos a decisiones.
Toda la inteligencia de campo centralizada, comparable y accionable.
Cumplimiento por zona, tendencias semanales, indicadores en tiempo real.

Análisis en segundos.
Cien por ciento de las visitas documentadas.
Datos objetivos, no opiniones.

Black Box Magic.
Inteligencia artificial para tu fuerza de campo.
Convierte cada visita en datos accionables.
`.trim();

// ─── Music Prompt ───────────────────────────────────────────────────

const MUSIC_PROMPT = `Crea una pieza instrumental de fondo para un video corporativo de tecnología.
Estilo: ambient electrónico minimalista, inspirador pero no agresivo.
Tempo: moderado, constante.
Instrumentos: pads suaves, piano sutil, texturas electrónicas ligeras.
Sin voces, sin letra. Instrumental only, no vocals.
Duración: lo más largo posible.
Mood: profesional, confiable, innovador — como un pitch de startup de tecnología B2B.`;

// ─── API Calls ──────────────────────────────────────────────────────

async function generateTTS(text: string, outputPath: string) {
  console.log("Generating voiceover...");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Orus",
              },
            },
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TTS API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  for (const part of data.candidates[0].content.parts) {
    if (part.inlineData) {
      const mime = part.inlineData.mimeType || "unknown";
      console.log(`  TTS mimeType: ${mime}`);
      let buffer = Buffer.from(part.inlineData.data, "base64");

      // If raw PCM (audio/L16), wrap in WAV header
      if (mime.includes("L16") || mime.includes("pcm")) {
        const rateMatch = mime.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
        console.log(`  Converting PCM to WAV (${sampleRate}Hz, ${buffer.length} bytes)`);
        buffer = pcmToWav(buffer, sampleRate);
      }

      const ext = mime.includes("mp3") || mime.includes("mpeg") ? "mp3" : "wav";
      const finalPath = outputPath.replace(/\.\w+$/, `.${ext}`);
      fs.writeFileSync(finalPath, buffer);
      console.log(`Voiceover saved: ${finalPath} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
      return;
    }
  }
  throw new Error("No audio data in TTS response");
}

async function generateMusic(prompt: string, outputPath: string) {
  console.log("Generating background music...");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/lyria-3-clip-preview:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Music API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  for (const part of data.candidates[0].content.parts) {
    if (part.inlineData) {
      const buffer = Buffer.from(part.inlineData.data, "base64");
      const ext = part.inlineData.mimeType?.includes("wav") ? "wav" : "mp3";
      const finalPath = outputPath.replace(/\.\w+$/, `.${ext}`);
      fs.writeFileSync(finalPath, buffer);
      console.log(`Music saved: ${finalPath} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
      return;
    }
  }
  throw new Error("No audio data in Music response");
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const voicePath = path.join(OUT_DIR, "voiceover.mp3");
  const musicPath = path.join(OUT_DIR, "music.mp3");

  // Generate voiceover (music already exists)
  if (!fs.existsSync(musicPath)) {
    await generateMusic(MUSIC_PROMPT, musicPath);
  } else {
    console.log(`Music already exists: ${musicPath}`);
  }
  await generateTTS(VOICEOVER_SCRIPT, voicePath);

  console.log("\nDone! Files in remotion/public/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

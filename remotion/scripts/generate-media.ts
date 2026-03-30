/**
 * Genera clips de video (Veo 3.1) e imágenes (Imagen 4) para el video BBM+Evidence.
 *
 * Uso:
 *   source .env.local && export GOOGLE_API_KEY
 *   npx tsx remotion/scripts/generate-media.ts
 *
 * Genera:
 *   public/clips/scene-1.mp4, scene-3.mp4, scene-8.mp4  (3 clips Veo)
 *   public/images/scene-2.png ... scene-7.png             (5 imágenes Imagen 4)
 */

import * as fs from "node:fs";
import * as path from "node:path";

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_API_KEY;
if (!API_KEY) {
  console.error("ERROR: Set GOOGLE_API_KEY environment variable");
  process.exit(1);
}

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const CLIPS_DIR = path.resolve(__dirname, "..", "..", "public", "clips");
const IMAGES_DIR = path.resolve(__dirname, "..", "..", "public", "images");

fs.mkdirSync(CLIPS_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });

// ─── Prompts ────────────────────────────────────────────────────────

const VEO_CLIPS = [
  {
    scene: 1,
    prompt:
      "Cinematic slow-motion shot of a professional field supervisor with a tablet walking through an industrial facility, inspecting equipment and taking notes. Modern uniform, hard hat. Warm golden hour lighting through large windows. Professional corporate documentary style.",
  },
  {
    scene: 3,
    prompt:
      "Close-up shot of hands holding a smartphone, taking a photo of a work site. The phone camera viewfinder is visible on screen. Shallow depth of field, modern and clean. Professional lighting.",
  },
  {
    scene: 8,
    prompt:
      "Aerial drone shot slowly pulling back from a modern Latin American city skyline at golden hour. Mix of commercial buildings, restaurants, and industrial areas visible. Cinematic, warm lighting, slow movement.",
  },
];

const IMAGEN_PHOTOS = [
  {
    scene: 2,
    prompt:
      "Frustrated field worker sitting in a company vehicle, surrounded by paper forms and a clipboard, looking at a phone with poor signal. Overcast lighting, muted colors. Professional photography.",
  },
  {
    scene: 4,
    prompt:
      "Wide shot of a well-organized restaurant kitchen being inspected by a supervisor with a tablet. Clean stainless steel surfaces, organized stations. Professional documentary photography.",
  },
  {
    scene: 5,
    prompt:
      "Split composition: left side shows a construction site with a worker taking a photo of structural progress; right side shows a modern office with a dashboard on a monitor. Connected by a subtle light streak. Professional composite photography.",
  },
  {
    scene: 6,
    prompt:
      "Over-the-shoulder shot of a business analyst reviewing a modern dashboard on a large monitor showing bar charts, trend lines, and KPIs. Modern office, soft ambient lighting. Professional corporate photography.",
  },
  {
    scene: 7,
    prompt:
      "A diverse team of field supervisors and managers in a modern meeting room, one person presenting positive results on a wall-mounted screen. Collaborative atmosphere. Professional corporate photography.",
  },
];

// ─── Veo 3.1 — Long-Running Video Generation ───────────────────────

async function generateVeoClip(
  prompt: string,
  outputPath: string
): Promise<void> {
  // Start generation
  const startRes = await fetch(
    `${BASE}/models/veo-3.1-generate-preview:predictLongRunning?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          durationSeconds: 8,
          resolution: "1080p",
        },
      }),
    }
  );

  if (!startRes.ok) {
    const err = await startRes.text();
    throw new Error(`Veo start failed ${startRes.status}: ${err}`);
  }

  const startData = await startRes.json();
  const operationName = startData.name;
  console.log(`    Operation: ${operationName}`);

  // Poll with exponential backoff
  let delay = 10000; // start at 10s
  const maxDelay = 120000;
  const maxAttempts = 60; // ~10 minutes max

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, delay));

    const pollRes = await fetch(
      `${BASE}/${operationName}?key=${API_KEY}`
    );
    const pollData = await pollRes.json();

    if (pollData.done) {
      // Extract video URI
      const videoUri =
        pollData.response?.generateVideoResponse?.generatedSamples?.[0]
          ?.video?.uri ||
        pollData.response?.generatedVideos?.[0]?.video?.uri;

      if (!videoUri) {
        throw new Error(
          `Veo completed but no video URI. Response: ${JSON.stringify(pollData).slice(0, 500)}`
        );
      }

      // Download video
      const dlRes = await fetch(
        `${videoUri}${videoUri.includes("?") ? "&" : "?"}key=${API_KEY}`
      );
      if (!dlRes.ok) {
        throw new Error(`Download failed ${dlRes.status}`);
      }
      const buffer = Buffer.from(await dlRes.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);
      console.log(
        `    Saved: ${outputPath} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`
      );
      return;
    }

    // Exponential backoff
    delay = Math.min(delay * 1.5, maxDelay);
    const elapsed = Math.round((attempt + 1) * (delay / 1000));
    process.stdout.write(`    Polling... (attempt ${attempt + 1})\r`);
  }

  throw new Error(`Veo timed out after ${maxAttempts} attempts`);
}

// ─── Imagen 4 — Image Generation ────────────────────────────────────

async function generateImage(
  prompt: string,
  outputPath: string
): Promise<void> {
  const res = await fetch(
    `${BASE}/models/imagen-4.0-generate-001:predict?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "16:9",
          personGeneration: "allow_adult",
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Imagen failed ${res.status}: ${err}`);
  }

  const data = await res.json();
  const b64 =
    data.predictions?.[0]?.bytesBase64Encoded ||
    data.generatedImages?.[0]?.image?.imageBytes;

  if (!b64) {
    throw new Error(
      `No image data. Response: ${JSON.stringify(data).slice(0, 500)}`
    );
  }

  const buffer = Buffer.from(b64, "base64");
  fs.writeFileSync(outputPath, buffer);
  console.log(
    `    Saved: ${outputPath} (${(buffer.length / 1024).toFixed(0)} KB)`
  );
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log("=== BBM+Evidence Media Generation ===\n");

  // Generate images in parallel (fast + cheap)
  console.log(`Generating ${IMAGEN_PHOTOS.length} images with Imagen 4...\n`);
  await Promise.all(
    IMAGEN_PHOTOS.map(async (item) => {
      const outPath = path.join(IMAGES_DIR, `scene-${item.scene}.png`);
      console.log(`  [Scene ${item.scene}] Generating image...`);
      try {
        await generateImage(item.prompt, outPath);
      } catch (e: any) {
        console.error(`  [Scene ${item.scene}] FAILED: ${e.message}`);
      }
    })
  );

  // Generate Veo clips sequentially (avoid rate limits)
  console.log(`\nGenerating ${VEO_CLIPS.length} clips with Veo 3.1...\n`);
  for (const item of VEO_CLIPS) {
    const outPath = path.join(CLIPS_DIR, `scene-${item.scene}.mp4`);
    console.log(`  [Scene ${item.scene}] Generating video clip...`);
    try {
      await generateVeoClip(item.prompt, outPath);
    } catch (e: any) {
      console.error(`  [Scene ${item.scene}] FAILED: ${e.message}`);
      // Retry once
      console.log(`  [Scene ${item.scene}] Retrying...`);
      try {
        await new Promise((r) => setTimeout(r, 30000));
        await generateVeoClip(item.prompt, outPath);
      } catch (e2: any) {
        console.error(`  [Scene ${item.scene}] RETRY FAILED: ${e2.message}`);
      }
    }
    // Wait 30s between clips to avoid rate limits
    if (item !== VEO_CLIPS[VEO_CLIPS.length - 1]) {
      console.log("  Waiting 30s before next clip...");
      await new Promise((r) => setTimeout(r, 30000));
    }
  }

  // Summary
  console.log("\n=== Summary ===");
  const clips = VEO_CLIPS.map((c) =>
    path.join(CLIPS_DIR, `scene-${c.scene}.mp4`)
  );
  const images = IMAGEN_PHOTOS.map((i) =>
    path.join(IMAGES_DIR, `scene-${i.scene}.png`)
  );
  const allFiles = [...clips, ...images];

  for (const f of allFiles) {
    const exists = fs.existsSync(f);
    console.log(`  ${exists ? "OK" : "MISSING"} ${path.basename(f)}`);
  }

  const missing = allFiles.filter((f) => !fs.existsSync(f));
  if (missing.length > 0) {
    console.error(`\n${missing.length} files missing. Re-run to retry.`);
    process.exit(1);
  }

  console.log("\nAll media generated successfully!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

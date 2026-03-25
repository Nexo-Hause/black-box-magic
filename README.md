# Black Box Magic

AI-powered image analysis API for retail execution and visual compliance.

Receives a photo from a point of sale, retail location, or commercial establishment and returns structured analysis covering inventory, shelf share, pricing, compliance, condition, and strategic insights.

## Quick Start

```bash
npm install
cp .env.example .env  # Add your keys
npm run dev
```

## API

### `GET /api/health`
Service status and documentation.

### `POST /api/analyze`
Analyze a retail/field photo.

**Headers:**
```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Body:**
```json
{
  "image": "base64-encoded-image-data",
  "mime_type": "image/jpeg",
  "custom_rules": "Optional: Check that Coca-Cola logo is at eye level"
}
```

**Response:**
```json
{
  "success": true,
  "client": "evidence",
  "analysis": {
    "summary": "Fast food restaurant with correct promotional execution...",
    "inventory": { "items": [...], "total_skus_detected": 5 },
    "shelf_share": { "brands": [...], "dominant_brand": "Burger King" },
    "pricing": { "prices_found": [...], "strategies_detected": ["psychological"] },
    "compliance": { "score": "HIGH", "pop_materials": {...} },
    "condition": { "cleanliness": "CLEAN", "displays": "GOOD" },
    "context": { "establishment_type": "Fast food", "inferred_location": {...} },
    "insights": { "strengths": [...], "opportunities": [...] }
  },
  "meta": {
    "model": "gemini-3.1-flash-lite-preview",
    "tokens": { "input": 1200, "output": 800, "total": 2000 },
    "processing_time_ms": 4500
  }
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_AI_API_KEY` | Google AI Studio API key for Gemini |
| `BBM_API_KEYS` | Comma-separated API keys. Format: `label:key,label2:key2` |

## Architecture

```
Client (Evidence/Telegram) → POST /api/analyze
                                    ↓
                              Auth check (Bearer token)
                                    ↓
                              Build composite prompt
                              (7 facets + optional custom rules)
                                    ↓
                              Gemini 3.1 Flash-Lite
                              (fallback: Gemini 3 Flash)
                                    ↓
                              Structured JSON response
```

## Deploy

Connected to Vercel. Push to `main` to deploy.

## Cost

~$0.0015 USD per image at current Gemini pricing.

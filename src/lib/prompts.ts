/**
 * Black Box Magic — Prompt Engine
 *
 * Composite prompt that evaluates multiple facets of a retail/field photo
 * in a single pass. Returns structured JSON.
 */

export const ANALYSIS_PROMPT = `You are an expert retail execution analyst. Analyze this photo taken at a point of sale, retail location, or commercial establishment.

Evaluate ALL of the following facets in a SINGLE pass. Be specific, quantitative, and actionable.

## 1. INVENTORY — What's there?
- List every product, brand, SKU, or item visible
- Count quantities where possible (exact or estimated)
- Note product categories

## 2. SHELF SHARE — Competitive landscape
- What brands are present?
- Estimate % of visible shelf/display space each brand occupies
- Identify the dominant brand vs competitors
- Note any brand that appears to be missing or underrepresented

## 3. PRICING — Price intelligence
- Read ALL visible prices (exact numbers)
- Identify currency if possible
- Flag promotional pricing, discounts, bundles
- Note psychological pricing strategies (e.g., $99 instead of $100)

## 4. COMPLIANCE — Execution quality
- Is promotional material (POP) properly installed?
- Are planograms being followed (if determinable)?
- Is signage correctly placed, visible, and undamaged?
- Are products facing correctly?
- Rate overall execution compliance: HIGH / MEDIUM / LOW

## 5. CONDITION — Physical state
- Cleanliness of the area (CLEAN / ACCEPTABLE / DIRTY)
- State of displays/furniture (GOOD / WORN / DAMAGED)
- Product condition (fresh, damaged, expired if visible)
- Lighting quality
- Any safety or maintenance issues

## 6. CONTEXT — Location & environment
- Type of establishment (convenience store, supermarket, restaurant, etc.)
- Infer geographic location from any clues (signage, language, infrastructure)
- Time of day if determinable (lighting, shadows)
- Foot traffic indicators
- Urban/suburban/rural setting

## 7. INSIGHTS — Strategic observations
- What's working well in this location?
- What opportunities for improvement exist?
- Any competitive threats visible?
- Actionable recommendations for the brand/operator

Respond ONLY with valid JSON matching this exact structure. No markdown, no explanation outside the JSON.`;

export const RESPONSE_SCHEMA = `{
  "summary": "One-paragraph executive summary of the photo",
  "inventory": {
    "items": [
      {
        "name": "Product or item name",
        "brand": "Brand if identifiable",
        "category": "Product category",
        "quantity": "Number or estimate",
        "location": "Where in the photo"
      }
    ],
    "total_skus_detected": 0
  },
  "shelf_share": {
    "brands": [
      {
        "name": "Brand name",
        "estimated_share_pct": 0,
        "position": "Premium/eye-level/bottom/etc"
      }
    ],
    "dominant_brand": "Brand with most space",
    "notes": "Any observations about competitive positioning"
  },
  "pricing": {
    "prices_found": [
      {
        "item": "What the price is for",
        "price": 0,
        "currency": "MXN/USD/etc",
        "type": "regular/promo/bundle"
      }
    ],
    "strategies_detected": ["psychological pricing", "bundle deals", etc.]
  },
  "compliance": {
    "score": "HIGH/MEDIUM/LOW",
    "pop_materials": {
      "present": true,
      "properly_installed": true,
      "condition": "GOOD/WORN/DAMAGED"
    },
    "product_facing": "CORRECT/PARTIAL/INCORRECT",
    "signage": "VISIBLE/PARTIAL/MISSING",
    "issues": ["List of specific compliance issues"]
  },
  "condition": {
    "cleanliness": "CLEAN/ACCEPTABLE/DIRTY",
    "displays": "GOOD/WORN/DAMAGED",
    "lighting": "GOOD/ADEQUATE/POOR",
    "products": "GOOD/ACCEPTABLE/DAMAGED",
    "safety_issues": ["List any safety concerns"],
    "notes": "Additional condition observations"
  },
  "context": {
    "establishment_type": "Type of location",
    "inferred_location": {
      "city_or_region": "Best guess",
      "country": "Best guess",
      "confidence": "HIGH/MEDIUM/LOW",
      "clues": ["What evidence supports this"]
    },
    "setting": "URBAN/SUBURBAN/RURAL",
    "time_of_day": "If determinable",
    "foot_traffic": "HIGH/MEDIUM/LOW/UNKNOWN"
  },
  "insights": {
    "strengths": ["What's working well"],
    "opportunities": ["What could be improved"],
    "threats": ["Competitive or operational threats"],
    "recommendations": ["Specific actionable next steps"]
  },
  "metadata": {
    "analysis_version": "1.0",
    "model": "Model used for analysis",
    "confidence": "HIGH/MEDIUM/LOW",
    "processing_time_ms": 0
  }
}`;

export function buildAnalysisPrompt(customRules?: string): string {
  let prompt = ANALYSIS_PROMPT;

  if (customRules) {
    prompt += `\n\n## CUSTOM CLIENT RULES\n${customRules}\nInclude evaluation of these custom rules in the compliance section.`;
  }

  prompt += `\n\nRespond with JSON following this schema:\n${RESPONSE_SCHEMA}`;

  return prompt;
}

/**
 * Black Box Magic — Hybrid Prompt Engine v2
 *
 * Strategy:
 * 1. Single-pass auto-priority prompt (fast, covers all photo types)
 * 2. If severity is MODERATE/CRITICAL or cleanliness is DIRTY,
 *    auto-escalate with a specialized condition prompt for detailed actions
 */

// ─── PASS 1: Single-pass with auto-prioritization ───

export const SINGLE_PASS_PROMPT = `You are an expert field analyst for retail, commercial, and industrial locations. Analyze this photo.

STEP 1 — CLASSIFY the photo into ONE type:
- retail_shelf (product shelves, displays, aisles with merchandise)
- facade (building exterior, storefront, signage)
- condition (cleanliness issues, damage, maintenance problems, spills)
- promotional (POP materials, banners, posters, promotions)
- equipment (kiosks, machines, furniture, fixtures)
- general (anything else)

STEP 2 — PRIORITIZE facets based on photo type:
- condition → Lead with condition assessment, severity, issues
- retail_shelf → Lead with inventory, shelf share, pricing
- facade → Lead with branding, signage, curb appeal
- promotional → Lead with promotional content, prices, effectiveness
- equipment → Lead with equipment state, functionality
- general → Lead with general observations

STEP 3 — ANALYZE all 7 facets (reordered by relevance to the photo):

1. Inventory (products, brands, quantities visible)
2. Shelf share (brand space distribution, dominant brand)
3. Pricing (ALL visible prices with currency, promotions, strategies)
4. Compliance (execution quality, signage, POP materials, score HIGH/MEDIUM/LOW)
5. Condition (cleanliness CLEAN/ACCEPTABLE/DIRTY, displays GOOD/WORN/DAMAGED, lighting, safety)
6. Context (establishment type, location clues, setting)
7. Insights (strengths, opportunities, actionable recommendations)

Be specific, quantitative, and actionable. Count items. Read prices. Identify brands.

Respond ONLY with valid JSON matching this schema:`;

export const SINGLE_PASS_SCHEMA = `{
  "photo_type": "retail_shelf|facade|condition|promotional|equipment|general",
  "priority_facets": ["most_relevant_facet", "second", "third"],
  "summary": "2-3 sentence executive summary focusing on what matters most",
  "severity": "CRITICAL|MODERATE|MINOR|N/A",
  "inventory": {
    "items": [{"name": "...", "brand": "...", "category": "...", "quantity": "...", "location": "..."}],
    "total_skus_detected": 0
  },
  "shelf_share": {
    "brands": [{"name": "...", "estimated_share_pct": 0, "position": "..."}],
    "dominant_brand": "...",
    "notes": "..."
  },
  "pricing": {
    "prices_found": [{"item": "...", "price": 0, "currency": "...", "type": "regular|promo|bundle"}],
    "strategies_detected": []
  },
  "compliance": {
    "score": "HIGH|MEDIUM|LOW",
    "pop_materials": {"present": true, "properly_installed": true, "condition": "GOOD|WORN|DAMAGED"},
    "product_facing": "CORRECT|PARTIAL|INCORRECT",
    "signage": "VISIBLE|PARTIAL|MISSING",
    "issues": []
  },
  "condition": {
    "cleanliness": "CLEAN|ACCEPTABLE|DIRTY",
    "displays": "GOOD|WORN|DAMAGED",
    "lighting": "GOOD|ADEQUATE|POOR",
    "products": "GOOD|ACCEPTABLE|DAMAGED",
    "safety_issues": [],
    "notes": "..."
  },
  "context": {
    "establishment_type": "...",
    "inferred_location": {"city_or_region": "...", "country": "...", "confidence": "HIGH|MEDIUM|LOW", "clues": []},
    "setting": "URBAN|SUBURBAN|RURAL",
    "time_of_day": "...",
    "foot_traffic": "HIGH|MEDIUM|LOW|UNKNOWN"
  },
  "insights": {
    "strengths": [],
    "opportunities": [],
    "threats": [],
    "recommendations": []
  },
  "additional_observations": "Anything noteworthy not covered above"
}`;

// ─── PASS 2: Condition escalation (only when needed) ───

export const CONDITION_ESCALATION_PROMPT = `You are a facility condition inspector. A previous analysis flagged this photo for condition issues. Provide a DETAILED condition assessment.

Focus exclusively on:

1. SEVERITY ASSESSMENT: CRITICAL / MODERATE / MINOR — with justification
2. SPECIFIC ISSUES: List EVERY visible problem (stains, spills, damage, wear, hazards)
3. SAFETY HAZARDS: Chemical exposure, slip hazards, structural damage, pest indicators
4. IMMEDIATE ACTIONS: Step-by-step remediation (e.g., "Remove products from shelf", "Deep clean surface", "Report to maintenance")
5. ROOT CAUSE: What likely caused each issue (product leak, foot traffic, neglect, age)
6. PRIORITY: Which issues need attention FIRST

Respond ONLY with valid JSON:
{
  "severity": "CRITICAL|MODERATE|MINOR",
  "severity_justification": "Why this severity level",
  "issues": [
    {
      "description": "Specific issue",
      "location": "Where in the photo",
      "severity": "CRITICAL|MODERATE|MINOR",
      "root_cause": "Likely cause",
      "immediate_action": "What to do now"
    }
  ],
  "safety_hazards": [
    {"hazard": "...", "risk_level": "HIGH|MEDIUM|LOW", "mitigation": "..."}
  ],
  "remediation_plan": {
    "immediate": ["Actions needed within hours"],
    "short_term": ["Actions needed within days"],
    "preventive": ["Prevent recurrence"]
  },
  "overall_assessment": "Professional summary for a supervisor report"
}`;

// ─── Builder functions ───

export function buildSinglePassPrompt(customRules?: string): string {
  let prompt = SINGLE_PASS_PROMPT;

  if (customRules) {
    prompt += `\n\n## CUSTOM CLIENT RULES\n${customRules}\nInclude evaluation of these custom rules in the compliance section.`;
  }

  prompt += `\n\n${SINGLE_PASS_SCHEMA}`;
  return prompt;
}

export function buildConditionEscalationPrompt(): string {
  return CONDITION_ESCALATION_PROMPT;
}

/**
 * Determine if the first-pass result warrants a condition escalation
 */
export function shouldEscalate(analysis: Record<string, unknown>): boolean {
  const severity = String(analysis.severity || '').toUpperCase();
  const condition = analysis.condition as Record<string, unknown> | undefined;
  const cleanliness = String(condition?.cleanliness || '').toUpperCase();
  const displays = String(condition?.displays || '').toUpperCase();
  const safetyIssues = condition?.safety_issues as unknown[];

  return (
    severity === 'CRITICAL' ||
    severity === 'MODERATE' ||
    cleanliness === 'DIRTY' ||
    displays === 'DAMAGED' ||
    (Array.isArray(safetyIssues) && safetyIssues.length > 0)
  );
}

// Keep backward compatibility
export function buildAnalysisPrompt(customRules?: string): string {
  return buildSinglePassPrompt(customRules);
}

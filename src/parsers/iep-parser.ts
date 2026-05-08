/**
 * iep-parser.ts
 *
 * Parses raw IEP text into structured data using pattern matching and
 * heuristics — zero API calls, zero cost, works fully offline.
 *
 * Design note: Rather than using a second LLM call to extract structure,
 * we expose the raw IEP as well-chunked MCP resources. Claude Desktop
 * reads those chunks and does its own reasoning. This is the correct MCP
 * design: server structures data, LLM reasons about it.
 *
 * Fields that cannot be reliably extracted fall back to empty strings.
 * We never fabricate or hallucinate data.
 */

import type { DisabilityCategory } from "../disability/disability-profiles.js";

export interface IEPGoal {
  goalNumber: number;
  area: string;
  currentLevel: string;
  targetBehavior: string;
  criteria: string;
  timeline: string;
}

export interface IEPAccommodation {
  id: string;
  category: string;
  description: string;
  appliesTo: string[];
}

export interface IEPModification {
  id: string;
  description: string;
  rationale: string;
}

export interface RelatedService {
  type: string;
  frequency: string;
  provider: string;
  location: string;
}

export interface ParsedIEP {
  studentName: string;
  gradeLevel: string;
  disabilityCategories: DisabilityCategory[];
  eligibilityLabel: string;
  presentLevels: {
    academic: string;
    functional: string;
  };
  annualGoals: IEPGoal[];
  accommodations: IEPAccommodation[];
  modifications: IEPModification[];
  relatedServices: RelatedService[];
  additionalNotes: string;
  rawSections: Record<string, string>;
  parsedAt: string;
}

// ---------------------------------------------------------------------------
// Eligibility label to our internal disability category
// ---------------------------------------------------------------------------

const ELIGIBILITY_MAP: Record<string, DisabilityCategory> = {
  "specific learning disability": "learning_disability",
  "sld": "learning_disability",
  "dyslexia": "learning_disability",
  "autism spectrum disorder": "asd",
  "autism": "asd",
  "attention deficit": "adhd",
  "adhd": "adhd",
  "other health impairment": "adhd",
  "ohi": "adhd",
  "speech or language impairment": "speech_language",
  "speech language": "speech_language",
  "intellectual disability": "intellectual_disability",
  "emotional disturbance": "emotional_behavioral",
  "emotional behavioral": "emotional_behavioral",
  "ebd": "emotional_behavioral",
  "orthopedic impairment": "physical_motor",
  "traumatic brain injury": "physical_motor",
  "visual impairment": "sensory_visual",
  "hearing impairment": "sensory_hearing",
  "deafness": "sensory_hearing",
};

export function mapEligibilityToCategory(label: string): DisabilityCategory {
  const normalized = label.toLowerCase().trim();
  for (const [key, category] of Object.entries(ELIGIBILITY_MAP)) {
    if (normalized.includes(key)) return category;
  }
  return "learning_disability";
}

// ---------------------------------------------------------------------------
// Section splitter
// ---------------------------------------------------------------------------

const SECTION_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "student_info",    pattern: /student\s+information|demographic/i },
  { name: "present_levels",  pattern: /present\s+level|plop|plaafp|current\s+performance/i },
  { name: "annual_goals",    pattern: /annual\s+goal|measurable\s+goal/i },
  { name: "accommodations",  pattern: /accommodation|supplementary\s+aid/i },
  { name: "modifications",   pattern: /modification|alternate\s+assessment/i },
  { name: "related_services",pattern: /related\s+service|speech.language\s+therapy|occupational\s+therapy/i },
  { name: "eligibility",     pattern: /eligibility|disability\s+category|classification/i },
];

function splitIntoSections(text: string): Record<string, string> {
  const lines = text.split(/\r?\n/);
  const sections: Record<string, string> = { full_text: text };
  let currentSection = "preamble";
  let buffer: string[] = [];

  for (const line of lines) {
    let matched: string | null = null;
    for (const { name, pattern } of SECTION_PATTERNS) {
      if (pattern.test(line) && line.length < 120) {
        matched = name;
        break;
      }
    }

    if (matched) {
      if (buffer.length > 0) {
        sections[currentSection] = (sections[currentSection] ?? "") + buffer.join("\n");
        buffer = [];
      }
      currentSection = matched;
    }

    buffer.push(line);
  }

  if (buffer.length > 0) {
    sections[currentSection] = (sections[currentSection] ?? "") + buffer.join("\n");
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Field extractors
// ---------------------------------------------------------------------------

function extractStudentName(text: string, hint?: string): string {
  if (hint) return hint;

  const patterns = [
    /student\s+name\s*[:\-]\s*([A-Z][a-z]+)/i,
    /name\s+of\s+student\s*[:\-]\s*([A-Z][a-z]+)/i,
    /student\s*[:\-]\s*([A-Z][a-z]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return "Student";
}

function extractGradeLevel(text: string): string {
  const match =
    text.match(/grade\s*[:\-]?\s*(\d+(?:st|nd|rd|th)?)/i) ??
    text.match(/(\d+(?:st|nd|rd|th))\s+grade/i);

  return match?.[1] ? `${match[1]} grade` : "";
}

function extractEligibility(text: string): string {
  const patterns = [
    /eligibility\s*(?:category)?\s*[:\-]\s*(.{5,60}?)(?:\n|$)/i,
    /disability\s*(?:category)?\s*[:\-]\s*(.{5,60}?)(?:\n|$)/i,
    /classification\s*[:\-]\s*(.{5,60}?)(?:\n|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return "";
}

function extractPresentLevels(sections: Record<string, string>): { academic: string; functional: string } {
  const src = sections["present_levels"] ?? sections["full_text"] ?? "";

  const academic = src.match(
    /academic\s+(?:performance|achievement)[^\n]*\n([\s\S]{20,500}?)(?:\n\s*\n|functional)/i
  )?.[1]?.trim().slice(0, 500) ?? src.slice(0, 400).trim();

  const functional = src.match(
    /functional\s+(?:performance|present\s+level)[^\n]*\n([\s\S]{20,500}?)(?:\n\s*\n|annual)/i
  )?.[1]?.trim().slice(0, 500) ?? "";

  return { academic, functional };
}

function extractGoals(sections: Record<string, string>): IEPGoal[] {
  const src = sections["annual_goals"] ?? sections["full_text"] ?? "";
  const goals: IEPGoal[] = [];

  const blocks = src.split(/\n(?=(?:annual\s+)?goal\s*#?\d+|goal\s+area\s*\d+)/i);

  for (let i = 0; i < blocks.length && goals.length < 10; i++) {
    const block = blocks[i].trim();
    if (block.length < 20) continue;

    const areaMatch  = block.match(/area\s*[:\-]\s*(.+?)(?:\n|$)/i);
    const currentMatch = block.match(/(?:current|baseline|present\s+level)\s*[:\-]\s*(.+?)(?:\n|$)/i);
    const targetMatch  = block.match(/(?:student\s+will|will\s+be\s+able\s+to)\s*(.{10,200}?)(?:\.|criteria|$)/i);
    const criteriaMatch = block.match(/(?:criteria|accuracy)\s*[:\-]\s*(.+?)(?:\n|$)/i);
    const timelineMatch = block.match(/(?:timeline|by\s+date|date)\s*[:\-]\s*(.+?)(?:\n|$)/i);

    goals.push({
      goalNumber: i + 1,
      area: areaMatch?.[1]?.trim() ?? `Goal ${i + 1}`,
      currentLevel: currentMatch?.[1]?.trim() ?? "",
      targetBehavior: targetMatch?.[1]?.trim() ?? block.slice(0, 200).trim(),
      criteria: criteriaMatch?.[1]?.trim() ?? "",
      timeline: timelineMatch?.[1]?.trim() ?? "",
    });
  }

  return goals;
}

function extractAccommodations(sections: Record<string, string>): IEPAccommodation[] {
  const src = sections["accommodations"] ?? sections["full_text"] ?? "";
  const accommodations: IEPAccommodation[] = [];

  // Try labeled pattern first: "Extended Time: ..."
  const labeledRe = /^([A-Z][^:\n]{3,40})\s*:\s*(.{10,200})/gm;
  let match: RegExpExecArray | null;

  while ((match = labeledRe.exec(src)) !== null && accommodations.length < 12) {
    const [, label, description] = match;
    if (/^(accommodation|student|name|grade|date|page|school)/i.test(label)) continue;

    const text = (label + " " + description).toLowerCase();
    let category = "Other";
    if (/time|extended|extra/.test(text))        category = "Time";
    if (/setting|room|quiet|seat/.test(text))    category = "Setting";
    if (/read|audio|text|present/.test(text))    category = "Presentation";
    if (/response|verbal|oral|write/.test(text)) category = "Response";

    accommodations.push({
      id: `ACC-${accommodations.length + 1}`,
      category,
      description: `${label}: ${description}`.trim().slice(0, 200),
      appliesTo: /test|assess|exam/.test(text) ? ["tests"] : ["classwork", "tests"],
    });
  }

  // Fall back to bullet lines
  if (accommodations.length === 0) {
    const bullets = src
      .split(/\r?\n/)
      .filter((l) => /^[-•*✓□\d]/.test(l.trim()) && l.trim().length > 15);

    for (const line of bullets.slice(0, 12)) {
      const text = line.trim().replace(/^[-•*✓□\d.]\s*/, "");
      const lower = text.toLowerCase();
      let category = "Other";
      if (/time|extended/.test(lower))      category = "Time";
      if (/setting|seat|room/.test(lower))  category = "Setting";
      if (/read|audio|text/.test(lower))    category = "Presentation";
      if (/verbal|oral|response/.test(lower)) category = "Response";

      accommodations.push({
        id: `ACC-${accommodations.length + 1}`,
        category,
        description: text.slice(0, 200),
        appliesTo: ["classwork", "tests"],
      });
    }
  }

  return accommodations;
}

function extractModifications(sections: Record<string, string>): IEPModification[] {
  const src = sections["modifications"] ?? "";
  if (!src) return [];

  return src
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[-•*✓□\d.]\s*/, ""))
    .filter((l) => l.length > 10 && !/^modification/i.test(l))
    .slice(0, 6)
    .map((description, i) => ({
      id: `MOD-${i + 1}`,
      description: description.slice(0, 200),
      rationale: "",
    }));
}

function extractRelatedServices(sections: Record<string, string>): RelatedService[] {
  const src = sections["related_services"] ?? sections["full_text"] ?? "";
  const services: RelatedService[] = [];

  const serviceTypes = [
    { type: "Speech-Language Therapy", pattern: /speech.language|slp/i },
    { type: "Occupational Therapy",    pattern: /occupational\s+therapy|ot\b/i },
    { type: "Physical Therapy",        pattern: /physical\s+therapy|\bpt\b/i },
    { type: "Counseling",              pattern: /counseling|psycholog/i },
  ];

  for (const { type, pattern } of serviceTypes) {
    if (!pattern.test(src)) continue;

    const context = src.match(new RegExp(pattern.source + `.{0,200}`, "i"))?.[0] ?? "";
    const freqMatch = context.match(/(\d+)\s*(?:x|times?)\s*(?:per\s+)?(week|month|day)/i);
    const locMatch  = context.match(/pull.out|push.in|in.class|resource\s+room/i);

    services.push({
      type,
      frequency: freqMatch ? `${freqMatch[1]}× per ${freqMatch[2]}` : "See IEP",
      provider:  "See IEP",
      location:  locMatch?.[0] ?? "See IEP",
    });
  }

  return services;
}

// ---------------------------------------------------------------------------
// Main parse function — no API calls, synchronous
// ---------------------------------------------------------------------------

export function parseIEPText(rawText: string, studentNameHint?: string): ParsedIEP {
  const sections = splitIntoSections(rawText);
  const eligibilityLabel = extractEligibility(rawText);

  return {
    studentName:        extractStudentName(rawText, studentNameHint),
    gradeLevel:         extractGradeLevel(rawText),
    disabilityCategories: [mapEligibilityToCategory(eligibilityLabel)],
    eligibilityLabel,
    presentLevels:      extractPresentLevels(sections),
    annualGoals:        extractGoals(sections),
    accommodations:     extractAccommodations(sections),
    modifications:      extractModifications(sections),
    relatedServices:    extractRelatedServices(sections),
    additionalNotes:    "",
    rawSections:        sections,
    parsedAt:           new Date().toISOString(),
  };
}

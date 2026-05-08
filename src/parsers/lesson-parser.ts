/**
 * lesson-parser.ts
 *
 * Parses a lesson plan into structured data using pattern matching.
 * Zero API calls — Claude Desktop does the reasoning, this file
 * just structures the raw text so Claude has clean data to work with.
 */

export type ActivityType =
  | "lecture"
  | "discussion"
  | "independent_reading"
  | "independent_writing"
  | "group_work"
  | "hands_on"
  | "video"
  | "assessment"
  | "other";

export interface LessonActivity {
  sequence: number;
  type: ActivityType;
  duration: string;
  description: string;
  materials: string[];
  cognitiveLoad: "low" | "medium" | "high";
}

export interface ParsedLesson {
  title: string;
  subject: string;
  gradeLevel: string;
  duration: string;
  objectives: string[];
  keyVocabulary: string[];
  activities: LessonActivity[];
  assessmentType: string;
  assessmentDescription: string;
  materialsRequired: string[];
  dominantSkillDemands: string[];
  estimatedReadingLevel: string;
  rawText: string;
  parsedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractTitle(text: string): string {
  const m =
    text.match(/lesson\s+(?:title|name)\s*[:\-]\s*(.+?)(?:\n|$)/i) ??
    text.match(/title\s*[:\-]\s*(.+?)(?:\n|$)/i);
  if (m?.[1]) return m[1].trim().slice(0, 80);
  return text.split(/\r?\n/).find((l) => l.trim().length > 3)?.trim().slice(0, 80) ?? "Lesson";
}

function extractSubject(text: string): string {
  const m =
    text.match(/subject\s*[:\-]\s*(.+?)(?:\n|$)/i) ??
    text.match(/content\s+area\s*[:\-]\s*(.+?)(?:\n|$)/i);
  if (m?.[1]) return m[1].trim().slice(0, 40);
  const lower = text.toLowerCase();
  if (/\bmath\b|fraction|algebra|geometry/.test(lower)) return "Math";
  if (/reading|writing|grammar|literature|\bela\b/.test(lower)) return "ELA";
  if (/science|biology|chemistry|experiment/.test(lower)) return "Science";
  if (/history|social\s+studies|geography/.test(lower)) return "Social Studies";
  return "";
}

function extractGradeLevel(text: string): string {
  const m =
    text.match(/grade\s*[:\-]?\s*(\d+(?:st|nd|rd|th)?)/i) ??
    text.match(/(\d+(?:st|nd|rd|th))\s+grade/i);
  return m?.[1] ? `${m[1]} grade` : "";
}

function extractDuration(text: string): string {
  const m =
    text.match(/(?:duration|time|period)\s*[:\-]\s*(.{3,30}?)(?:\n|$)/i) ??
    text.match(/(\d+)\s*(?:min(?:ute)?s?)/i);
  return m?.[1]?.trim() ?? "";
}

function extractObjectives(text: string): string[] {
  const section = text.match(
    /(?:objective|learning\s+goal|swbat)[^\n]*\n([\s\S]{10,600}?)(?:\n\s*\n|\n[A-Z][^a-z])/i
  )?.[1] ?? "";
  return section
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[-•*✓□\d.]\s*/, ""))
    .filter((l) => l.length > 10 && l.length < 300)
    .slice(0, 8);
}

function extractVocabulary(text: string): string[] {
  const section = text.match(
    /(?:vocabulary|key\s+term|word\s+wall)[^\n]*\n([\s\S]{5,300}?)(?:\n\s*\n|\n[A-Z])/i
  )?.[1] ?? "";
  return section
    .split(/[\n,;]/)
    .map((w) => w.trim().replace(/^[-•*\d.]\s*/, ""))
    .filter((w) => w.length > 1 && w.length < 50 && /[a-zA-Z]/.test(w))
    .slice(0, 15);
}

function classifyActivity(desc: string): ActivityType {
  const l = desc.toLowerCase();
  if (/quiz|test|exam|assess/.test(l))               return "assessment";
  if (/discuss|debate|share|partner\s+talk/.test(l)) return "discussion";
  if (/read|passage|text/.test(l))                   return "independent_reading";
  if (/write|journal|essay|paragraph/.test(l))       return "independent_writing";
  if (/group|team|collaborat/.test(l))               return "group_work";
  if (/hands.on|manipulat|lab|experiment/.test(l))   return "hands_on";
  if (/video|watch|film|clip/.test(l))               return "video";
  if (/lecture|direct\s+instruction|mini.lesson/.test(l)) return "lecture";
  return "other";
}

function cognitiveLoad(desc: string): "low" | "medium" | "high" {
  const l = desc.toLowerCase();
  if (/recall|remember|identify|list|define/.test(l))    return "low";
  if (/evaluate|create|design|argue|synthesize/.test(l)) return "high";
  return "medium";
}

function extractActivities(text: string): LessonActivity[] {
  const activities: LessonActivity[] = [];
  const src = text.match(
    /(?:procedure|activity|lesson\s+body|instruction)[^\n]*\n([\s\S]{20,2000}?)(?:\n\s*\n\s*(?:assess|material|closure|vocabulary)|$)/i
  )?.[1] ?? text;

  const blocks = src.split(/\n(?=\d+\.\s|[-•]\s|(?:activity|step)\s*\d+)/i);
  for (let i = 0; i < blocks.length && activities.length < 8; i++) {
    const block = blocks[i].trim();
    if (block.length < 15) continue;
    const durMatch = block.match(/(\d+)\s*(?:min(?:ute)?s?)/i);
    const matMatch = block.match(/material[s]?\s*[:\-]\s*(.+?)(?:\n|$)/i);
    activities.push({
      sequence:      activities.length + 1,
      type:          classifyActivity(block),
      duration:      durMatch ? `${durMatch[1]} minutes` : "",
      description:   block.slice(0, 250).replace(/\r?\n/g, " ").trim(),
      materials:     matMatch ? matMatch[1].split(/[,;]/).map((m) => m.trim()).filter(Boolean) : [],
      cognitiveLoad: cognitiveLoad(block),
    });
  }
  return activities;
}

function extractAssessment(text: string): { type: string; description: string } {
  const section = text.match(
    /(?:assessment|evaluation|closure)[^\n]*\n([\s\S]{10,400}?)(?:\n\s*\n|\n[A-Z]|$)/i
  )?.[1]?.trim() ?? "";
  const lower = (section + text).toLowerCase();
  let type = "informal observation";
  if (/quiz|test|exam/.test(lower))              type = "written quiz/test";
  else if (/exit\s+ticket/.test(lower))          type = "exit ticket";
  else if (/verbal|oral|discussion/.test(lower)) type = "verbal/oral response";
  else if (/project|portfolio/.test(lower))      type = "project/portfolio";
  else if (/worksheet/.test(lower))              type = "worksheet";
  return { type, description: section.slice(0, 300) };
}

function extractMaterials(text: string): string[] {
  const section = text.match(
    /(?:material|resource|supply|supplies)[^\n]*\n([\s\S]{5,400}?)(?:\n\s*\n|\n[A-Z])/i
  )?.[1] ?? "";
  return section
    .split(/[\n,;]/)
    .map((m) => m.trim().replace(/^[-•*\d.]\s*/, ""))
    .filter((m) => m.length > 1 && m.length < 80)
    .slice(0, 10);
}

function detectSkillDemands(text: string): string[] {
  const demands: string[] = [];
  const l = text.toLowerCase();
  if (/read|passage|text/.test(l))             demands.push("reading");
  if (/write|essay|paragraph|journal/.test(l)) demands.push("writing");
  if (/discuss|speak|oral|present/.test(l))    demands.push("oral participation");
  if (/listen|lecture|video/.test(l))          demands.push("listening");
  if (/calculat|comput|equation/.test(l))      demands.push("computation");
  if (/group|collaborat|team/.test(l))         demands.push("collaboration");
  return demands.length > 0 ? demands : ["reading", "writing"];
}

// ---------------------------------------------------------------------------
// Main parser — synchronous, zero API calls
// ---------------------------------------------------------------------------

export function parseLessonText(rawText: string): ParsedLesson {
  const assessment = extractAssessment(rawText);
  return {
    title:                 extractTitle(rawText),
    subject:               extractSubject(rawText),
    gradeLevel:            extractGradeLevel(rawText),
    duration:              extractDuration(rawText),
    objectives:            extractObjectives(rawText),
    keyVocabulary:         extractVocabulary(rawText),
    activities:            extractActivities(rawText),
    assessmentType:        assessment.type,
    assessmentDescription: assessment.description,
    materialsRequired:     extractMaterials(rawText),
    dominantSkillDemands:  detectSkillDemands(rawText),
    estimatedReadingLevel: extractGradeLevel(rawText) || "See document",
    rawText:               rawText.slice(0, 8000),
    parsedAt:              new Date().toISOString(),
  };
}

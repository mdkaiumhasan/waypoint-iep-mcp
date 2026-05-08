/**
 * modification-generator.ts
 *
 * The core of the system. Given a parsed lesson and a student profile,
 * generates concrete, actionable instructional modifications via the
 * Anthropic API. Every suggestion is grounded in the student's IEP and
 * their specific disability profile.
 *
 * Design goals:
 *   1. Specific to THIS lesson — not generic advice
 *   2. Grounded in THIS student's IEP (every item cites a source)
 *   3. Accommodations and modifications clearly separated
 *   4. UDL framework applied across all three pillars
 *   5. Comorbidity conflicts resolved before generation
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ParsedIEP } from "../parsers/iep-parser.js";
import type { ParsedLesson } from "../parsers/lesson-parser.js";
import type { MergedProfile } from "../disability/disability-profiles.js";
import { DISABILITY_PROFILES } from "../disability/disability-profiles.js";

export interface ModificationItem {
  phase: "before_class" | "during_lesson" | "assessment" | "follow_up";
  type: "accommodation" | "modification";
  action: string;
  iepSource: string;
  udlPrinciple: string;
  rationale: string;
}

export interface ScaffoldedQuestion {
  originalQuestion: string;
  scaffoldedVersion: string;
  scaffoldType: string;
}

export interface ModificationPlan {
  studentName: string;
  lessonTitle: string;
  generatedAt: string;
  beforeClass: ModificationItem[];
  duringLesson: ModificationItem[];
  assessment: ModificationItem[];
  scaffoldedQuestions: ScaffoldedQuestion[];
  printableChecklist: string;
  comorbidityNotes: string[];
  teacherWarnings: string[];
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(mergedProfile: MergedProfile): string {
  const profileLabels = mergedProfile.categories.map(
    (c) => DISABILITY_PROFILES[c].label
  );
  const commonMistakes = mergedProfile.categories.flatMap(
    (c) => DISABILITY_PROFILES[c].commonMistakes
  );

  return `
You are an expert special education instructional coach with deep knowledge of:
- Universal Design for Learning (UDL) framework
- IDEA accommodation vs. modification legal distinctions
- Evidence-based instructional strategies for students with disabilities
- K-8 curriculum differentiation

This student has the following disability profile: ${profileLabels.join(", ")}.

Key distinction you must always maintain:
- ACCOMMODATION: Same content and expectations, different delivery or response format. Does NOT lower the bar.
- MODIFICATION: Changed content, reduced scope, or different performance expectations. DOES change the learning goal.

Label every suggestion explicitly as "accommodation" or "modification".

UDL Framework — apply all three pillars in your output:
1. Representation: multiple ways to present information
2. Action & Expression: multiple ways students can show what they know
3. Engagement: multiple ways to motivate and sustain effort

Common mistakes to AVOID for this student:
${commonMistakes.map((m, i) => `${i + 1}. ${m}`).join("\n")}

${mergedProfile.comorbidityNotes.length > 0 ? `
Comorbidity resolution (apply when suggestions might conflict):
${mergedProfile.comorbidityNotes.map((n) => `- CONFLICT: ${n.conflict}\n  RESOLUTION: ${n.resolution}`).join("\n")}
` : ""}

Always cite the specific IEP accommodation ID (e.g. ACC-1), modification ID (e.g. MOD-2), or goal number for every suggestion. If grounding from disability profile knowledge rather than the IEP, cite as "Disability Profile: ${profileLabels[0]}".

Your output must be specific enough that a teacher can walk into class tomorrow and use it with zero further planning.
`.trim();
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export async function generateModificationPlan(
  iep: ParsedIEP,
  lesson: ParsedLesson,
  mergedProfile: MergedProfile
): Promise<ModificationPlan> {
  const client = new Anthropic();

  const systemPrompt = buildSystemPrompt(mergedProfile);

  const userPrompt = `
Generate a complete instructional modification plan for the following student and lesson.

STUDENT IEP SUMMARY
===================
Student: ${iep.studentName}, ${iep.gradeLevel}
Eligibility: ${iep.eligibilityLabel}

Present Levels:
  Academic: ${iep.presentLevels.academic || "Not provided"}
  Functional: ${iep.presentLevels.functional || "Not provided"}

Annual Goals:
${iep.annualGoals.length > 0
    ? iep.annualGoals.map((g) => `  Goal ${g.goalNumber} (${g.area}): ${g.targetBehavior} — measured by: ${g.criteria}`).join("\n")
    : "  None extracted from IEP — base suggestions on disability profile."}

IEP Accommodations:
${iep.accommodations.length > 0
    ? iep.accommodations.map((a) => `  ${a.id} [${a.category}]: ${a.description} — applies to: ${a.appliesTo.join(", ")}`).join("\n")
    : "  None extracted — apply typical accommodations from disability profile knowledge base."}

IEP Modifications:
${iep.modifications.length > 0
    ? iep.modifications.map((m) => `  ${m.id}: ${m.description}`).join("\n")
    : "  None — do NOT reduce content difficulty unless disability profile requires it."}

Related Services: ${iep.relatedServices.map((s) => `${s.type} (${s.frequency})`).join(", ") || "None on record"}

LESSON DETAILS
==============
Title: ${lesson.title}
Subject: ${lesson.subject} | Grade: ${lesson.gradeLevel} | Duration: ${lesson.duration}

Objectives:
${lesson.objectives.map((o, i) => `  ${i + 1}. ${o}`).join("\n") || "  See raw text below."}

Key Vocabulary: ${lesson.keyVocabulary.join(", ") || "None extracted"}

Activities:
${lesson.activities.map((a) => `  ${a.sequence}. [${a.type}] ${a.description} (${a.duration}, load: ${a.cognitiveLoad})`).join("\n") || "  See raw text below."}

Assessment: ${lesson.assessmentType} — ${lesson.assessmentDescription || "See lesson text"}
Skill Demands: ${lesson.dominantSkillDemands.join(", ")}

Raw lesson text (use for scaffolded questions):
---
${lesson.rawText?.slice(0, 6000) ?? ""}
---

DISABILITY PROFILE
==================
Categories: ${mergedProfile.categories.join(", ")}
Content reduction warranted: ${mergedProfile.defaultContentReduction
    ? "YES — reduce scope per IEP modifications"
    : "NO — accommodations only unless IEP modifications say otherwise"}

TASK
====
Return ONLY valid JSON — no markdown fences, no explanation.

{
  "beforeClass": [
    {
      "phase": "before_class",
      "type": "accommodation",
      "action": "specific concrete action the teacher takes before class",
      "iepSource": "ACC-1 or Goal 2 or Disability Profile: Learning Disability",
      "udlPrinciple": "Representation",
      "rationale": "one sentence — why this matters for this specific student"
    }
  ],
  "duringLesson": [ /* same structure */ ],
  "assessment": [ /* same structure */ ],
  "scaffoldedQuestions": [
    {
      "originalQuestion": "question directly from the lesson",
      "scaffoldedVersion": "same question with scaffolding for this student",
      "scaffoldType": "sentence stem | reduced choices | vocabulary support | chunked steps"
    }
  ],
  "teacherWarnings": [
    "specific thing to avoid for THIS student in THIS lesson"
  ]
}

Rules:
- 3–5 items per phase, quality over quantity
- Every beforeClass/duringLesson/assessment item must cite an iepSource
- Scaffolded questions must come from the actual lesson content
- Teacher warnings must be lesson-specific, not generic disability advice
`.trim();

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 6000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const responseText =
    response.content[0].type === "text" ? response.content[0].text : "";

  const cleanJson = responseText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  let extracted: Pick<
    ModificationPlan,
    "beforeClass" | "duringLesson" | "assessment" | "scaffoldedQuestions" | "teacherWarnings"
  >;

  try {
    extracted = JSON.parse(cleanJson);
  } catch {
    throw new Error(
      `Modification generation failed — model returned invalid JSON.\nRaw: ${responseText.slice(0, 600)}`
    );
  }

  const printableChecklist = buildPrintableChecklist(
    iep.studentName,
    lesson.title,
    extracted.beforeClass,
    extracted.duringLesson,
    extracted.assessment
  );

  return {
    studentName:      iep.studentName,
    lessonTitle:      lesson.title,
    generatedAt:      new Date().toISOString(),
    ...extracted,
    printableChecklist,
    comorbidityNotes: mergedProfile.comorbidityNotes.map(
      (n) => `${n.conflict} → ${n.resolution}`
    ),
  };
}

// ---------------------------------------------------------------------------
// Printable checklist formatter
// ---------------------------------------------------------------------------

function buildPrintableChecklist(
  studentName: string,
  lessonTitle: string,
  beforeClass: ModificationItem[],
  duringLesson: ModificationItem[],
  assessment: ModificationItem[]
): string {
  const line = "─".repeat(60);
  const now = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const formatItems = (items: ModificationItem[]): string =>
    items
      .map(
        (item) =>
          `  □  [${item.type.toUpperCase()}] ${item.action}\n` +
          `     Source: ${item.iepSource} | UDL: ${item.udlPrinciple}`
      )
      .join("\n\n");

  return `
${line}
  MODIFICATION PLAN
  Student: ${studentName}
  Lesson:  ${lessonTitle}
  Date:    ${now}
${line}

BEFORE CLASS
${line}
${formatItems(beforeClass)}

DURING LESSON
${line}
${formatItems(duringLesson)}

ASSESSMENT
${line}
${formatItems(assessment)}

${line}
  Print this sheet and keep it at your desk during class.
${line}
`.trim();
}



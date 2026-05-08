/**
 * index.ts — Waypoint IEP MCP Server
 *
 * This is the main entry point for the MCP server. It exposes:
 *
 * TOOLS (things Claude can do):
 *   - load_iep           Parse and store a student IEP from a PDF or text file
 *   - load_lesson        Parse a lesson plan from a PDF or text file
 *   - add_student        Manually register a student with disability categories
 *   - generate_modifications  The core tool — produces a teacher-ready plan
 *   - list_students      Show all registered students and their profiles
 *   - get_student_profile  Show detailed profile for one student
 *
 * RESOURCES (data Claude can read):
 *   - waypoint://students        All registered student profiles
 *   - waypoint://disability/{id} Disability profile knowledge base entry
 *
 * Architecture note: Tools do the work; resources expose reference data.
 * Claude should call tools for actions, and read resources for background
 * knowledge when building its reasoning context.
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { extractTextFromPDF } from "./utils/pdf-extractor.js";
import { parseIEPText } from "./parsers/iep-parser.js";
import { parseLessonText } from "./parsers/lesson-parser.js";
import {
  addStudent,
  getStudent,
  listStudents,
  findStudentByName,
} from "./utils/student-store.js";
import { generateModificationPlan } from "./tools/modification-generator.js";
import {
  DISABILITY_PROFILES,
  mergeDisabilityProfiles,
  type DisabilityCategory,
} from "./disability/disability-profiles.js";

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "waypoint-iep-mcp",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// TOOL: load_iep
// Parses a student's IEP from a file and stores their profile.
// ---------------------------------------------------------------------------

server.tool(
  "load_iep",
  "Parse a student IEP from a PDF or text file and register them in the system. " +
  "Once loaded, their profile is available for modification generation.",
  {
    filePath: z
      .string()
      .describe("Absolute path to the IEP file (PDF or .txt)"),
    studentNameHint: z
      .string()
      .optional()
      .describe("Optional student name hint if the name is hard to extract from the document"),
    additionalCategories: z
      .array(z.string())
      .optional()
      .describe(
        "Additional disability categories beyond what the IEP states. " +
        "Valid values: learning_disability, asd, adhd, speech_language, " +
        "intellectual_disability, emotional_behavioral, physical_motor, " +
        "sensory_visual, sensory_hearing"
      ),
  },
  async ({ filePath, studentNameHint, additionalCategories }) => {
    try {
      // Extract text — handles both PDF and plain text files
      let rawText: string;
      if (filePath.endsWith(".pdf")) {
        rawText = await extractTextFromPDF(filePath);
      } else {
        const { readFile } = await import("fs/promises");
        rawText = await readFile(filePath, "utf-8");
      }

      // Parse the IEP into structured data
      const iep = parseIEPText(rawText, studentNameHint);

      // Merge any additional categories the teacher specifies
      const categories = [...iep.disabilityCategories];
      if (additionalCategories && additionalCategories.length > 0) {
        for (const cat of additionalCategories as DisabilityCategory[]) {
          if (!categories.includes(cat)) {
            categories.push(cat);
          }
        }
      }

      const profile = addStudent(iep, categories);

      return {
        content: [
          {
            type: "text",
            text: [
              `✓ IEP loaded for ${iep.studentName} (${iep.gradeLevel})`,
              `  Student ID: ${profile.id}`,
              `  Eligibility: ${iep.eligibilityLabel}`,
              `  Disability categories mapped: ${categories.join(", ")}`,
              `  Annual goals found: ${iep.annualGoals.length}`,
              `  Accommodations found: ${iep.accommodations.length}`,
              `  Modifications found: ${iep.modifications.length}`,
              `  Related services: ${iep.relatedServices.map((s) => s.type).join(", ") || "none"}`,
              "",
              `  ${iep.studentName} is now registered. Use generate_modifications to build a lesson plan.`,
            ].join("\n"),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error loading IEP: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// TOOL: load_lesson
// Parses a lesson plan into structured format and stores it temporarily.
// ---------------------------------------------------------------------------

// We store lessons in memory too, keyed by a simple ID
const lessons = new Map<string, Awaited<ReturnType<typeof parseLessonText>>>();

server.tool(
  "load_lesson",
  "Parse a lesson plan from a PDF or text file. " +
  "Returns a lesson ID you can then use with generate_modifications.",
  {
    filePath: z
      .string()
      .describe("Absolute path to the lesson file (PDF or .txt)"),
  },
  async ({ filePath }) => {
    try {
      let rawText: string;
      if (filePath.endsWith(".pdf")) {
        rawText = await extractTextFromPDF(filePath);
      } else {
        const { readFile } = await import("fs/promises");
        rawText = await readFile(filePath, "utf-8");
      }

      const lesson = parseLessonText(rawText);

      // Store under a simple ID based on the title
      const lessonId = lesson.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .slice(0, 40);
      lessons.set(lessonId, lesson);

      return {
        content: [
          {
            type: "text",
            text: [
              `✓ Lesson loaded: "${lesson.title}"`,
              `  Lesson ID: ${lessonId}`,
              `  Subject: ${lesson.subject} | Grade: ${lesson.gradeLevel}`,
              `  Duration: ${lesson.duration}`,
              `  Objectives: ${lesson.objectives.length}`,
              `  Activities: ${lesson.activities.length}`,
              `  Key vocabulary: ${lesson.keyVocabulary.slice(0, 5).join(", ")}${lesson.keyVocabulary.length > 5 ? "..." : ""}`,
              `  Assessment type: ${lesson.assessmentType}`,
              `  Primary skill demands: ${lesson.dominantSkillDemands.join(", ")}`,
              "",
              `  Use lesson ID "${lessonId}" with generate_modifications.`,
            ].join("\n"),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error loading lesson: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// TOOL: add_student (manual registration without a PDF)
// ---------------------------------------------------------------------------

server.tool(
  "add_student",
  "Manually register a student by name and disability category. " +
  "Use this when you don't have a PDF IEP but know the student's needs. " +
  "For a full IEP-grounded plan, use load_iep instead.",
  {
    studentName: z.string().describe("Student's first name"),
    gradeLevel: z.string().describe("Grade level, e.g. '5th grade'"),
    disabilityCategories: z
      .array(z.string())
      .describe(
        "One or more disability categories. Valid values: " +
        "learning_disability, asd, adhd, speech_language, " +
        "intellectual_disability, emotional_behavioral, physical_motor, " +
        "sensory_visual, sensory_hearing"
      ),
    notes: z.string().optional().describe("Any additional notes about this student"),
  },
  async ({ studentName, gradeLevel, disabilityCategories, notes }) => {
    try {
      const categories = disabilityCategories as DisabilityCategory[];

      // Build a minimal synthetic IEP
      const syntheticIEP = {
        studentName,
        gradeLevel,
        disabilityCategories: categories,
        eligibilityLabel: categories.map((c) => DISABILITY_PROFILES[c].label).join(", "),
        presentLevels: {
          academic: notes ?? "Not provided",
          functional: "Not provided",
        },
        annualGoals: [],
        accommodations: [],
        modifications: [],
        relatedServices: [],
        additionalNotes: notes ?? "",
        rawSections: {},
        parsedAt: new Date().toISOString(),
      };

      const profile = addStudent(syntheticIEP, categories);

      return {
        content: [
          {
            type: "text",
            text: [
              `✓ Student registered: ${studentName}`,
              `  Student ID: ${profile.id}`,
              `  Grade: ${gradeLevel}`,
              `  Disability categories: ${categories.map((c) => DISABILITY_PROFILES[c].label).join(", ")}`,
              `  Note: No IEP was provided. Modifications will be based on disability profile knowledge base only.`,
              `  For IEP-grounded modifications, use load_iep to upload the student's IEP document.`,
            ].join("\n"),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error adding student: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// TOOL: generate_modifications
// The main tool — produces a teacher-ready modification plan.
// ---------------------------------------------------------------------------

server.tool(
  "generate_modifications",
  "Generate a complete, teacher-ready instructional modification plan for a specific student and lesson. " +
  "Produces accommodations, modifications, scaffolded questions, and a printable checklist. " +
  "All suggestions are grounded in the student's IEP and their disability profile.",
  {
    studentIdentifier: z
      .string()
      .describe("Student ID (from load_iep or add_student) or student's first name"),
    lessonIdentifier: z
      .string()
      .describe("Lesson ID (from load_lesson) or lesson title"),
    outputFormat: z
      .enum(["full", "checklist_only", "scaffolded_questions_only"])
      .optional()
      .default("full")
      .describe("What to include in the output"),
  },
  async ({ studentIdentifier, lessonIdentifier, outputFormat }) => {
    try {
      // Find the student
      let studentProfile = getStudent(studentIdentifier);
      if (!studentProfile) {
        studentProfile = findStudentByName(studentIdentifier);
      }
      if (!studentProfile) {
        return {
          content: [
            {
              type: "text",
              text: `Student not found: "${studentIdentifier}". Use list_students to see registered students, or load_iep to add them.`,
            },
          ],
          isError: true,
        };
      }

      // Find the lesson
      let lesson = lessons.get(lessonIdentifier);
      if (!lesson) {
        // Try partial title match
        for (const [id, l] of lessons.entries()) {
          if (
            id.includes(lessonIdentifier.toLowerCase().replace(/[^a-z0-9]/g, "_")) ||
            l.title.toLowerCase().includes(lessonIdentifier.toLowerCase())
          ) {
            lesson = l;
            break;
          }
        }
      }
      if (!lesson) {
        return {
          content: [
            {
              type: "text",
              text: `Lesson not found: "${lessonIdentifier}". Use load_lesson to load the lesson file first.`,
            },
          ],
          isError: true,
        };
      }

      // Generate the modification plan
      const plan = await generateModificationPlan(
        studentProfile.iep,
        lesson,
        studentProfile.mergedDisabilityProfile
      );

      // Format the response based on requested output format
      let output: string;

      if (outputFormat === "checklist_only") {
        output = plan.printableChecklist;
      } else if (outputFormat === "scaffolded_questions_only") {
        output = [
          `SCAFFOLDED QUESTIONS — ${plan.studentName} · ${plan.lessonTitle}`,
          "=".repeat(60),
          ...plan.scaffoldedQuestions.map(
            (q, i) =>
              `${i + 1}. ORIGINAL: ${q.originalQuestion}\n` +
              `   SCAFFOLDED [${q.scaffoldType}]: ${q.scaffoldedVersion}`
          ),
        ].join("\n\n");
      } else {
        // Full output
        const sections: string[] = [
          `MODIFICATION PLAN — ${plan.studentName} · ${plan.lessonTitle}`,
          `Generated: ${new Date(plan.generatedAt).toLocaleString()}`,
          "",
        ];

        if (plan.comorbidityNotes.length > 0) {
          sections.push("⚠ COMORBIDITY NOTES");
          sections.push(...plan.comorbidityNotes.map((n) => `  ${n}`));
          sections.push("");
        }

        sections.push("BEFORE CLASS");
        sections.push(
          ...plan.beforeClass.map(
            (item) =>
              `  □ [${item.type.toUpperCase()}] ${item.action}\n` +
              `    Source: ${item.iepSource} | UDL: ${item.udlPrinciple}\n` +
              `    Why: ${item.rationale}`
          )
        );

        sections.push("", "DURING LESSON");
        sections.push(
          ...plan.duringLesson.map(
            (item) =>
              `  □ [${item.type.toUpperCase()}] ${item.action}\n` +
              `    Source: ${item.iepSource} | UDL: ${item.udlPrinciple}\n` +
              `    Why: ${item.rationale}`
          )
        );

        sections.push("", "ASSESSMENT");
        sections.push(
          ...plan.assessment.map(
            (item) =>
              `  □ [${item.type.toUpperCase()}] ${item.action}\n` +
              `    Source: ${item.iepSource} | UDL: ${item.udlPrinciple}\n` +
              `    Why: ${item.rationale}`
          )
        );

        if (plan.scaffoldedQuestions.length > 0) {
          sections.push("", "SCAFFOLDED QUESTIONS");
          sections.push(
            ...plan.scaffoldedQuestions.map(
              (q, i) =>
                `  ${i + 1}. Original: ${q.originalQuestion}\n` +
                `     Scaffolded [${q.scaffoldType}]: ${q.scaffoldedVersion}`
            )
          );
        }

        if (plan.teacherWarnings.length > 0) {
          sections.push("", "⚠ TEACHER WARNINGS — AVOID THESE FOR THIS STUDENT");
          sections.push(...plan.teacherWarnings.map((w) => `  ! ${w}`));
        }

        sections.push("", "─".repeat(60));
        sections.push("PRINTABLE CHECKLIST");
        sections.push("─".repeat(60));
        sections.push(plan.printableChecklist);

        output = sections.join("\n");
      }

      return {
        content: [{ type: "text", text: output }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error generating modifications: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// TOOL: list_students
// ---------------------------------------------------------------------------

server.tool(
  "list_students",
  "List all registered students and their disability profiles.",
  {},
  async () => {
    const allStudents = listStudents();

    if (allStudents.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No students registered yet. Use load_iep or add_student to add students.",
          },
        ],
      };
    }

    const lines = allStudents.map((s) => {
      const categoryLabels = s.mergedDisabilityProfile.categories.map(
        (c) => DISABILITY_PROFILES[c].label
      );
      return [
        `  ${s.iep.studentName} (${s.iep.gradeLevel}) — ID: ${s.id}`,
        `    Disability: ${categoryLabels.join(", ")}`,
        `    IEP goals: ${s.iep.annualGoals.length} | Accommodations: ${s.iep.accommodations.length}`,
      ].join("\n");
    });

    return {
      content: [
        {
          type: "text",
          text: `Registered students (${allStudents.length}):\n\n${lines.join("\n\n")}`,
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// TOOL: get_student_profile
// ---------------------------------------------------------------------------

server.tool(
  "get_student_profile",
  "Get the detailed IEP and disability profile for a specific student.",
  {
    studentIdentifier: z
      .string()
      .describe("Student ID or first name"),
  },
  async ({ studentIdentifier }) => {
    let profile = getStudent(studentIdentifier);
    if (!profile) {
      profile = findStudentByName(studentIdentifier);
    }

    if (!profile) {
      return {
        content: [
          {
            type: "text",
            text: `Student not found: "${studentIdentifier}"`,
          },
        ],
        isError: true,
      };
    }

    const { iep, mergedDisabilityProfile } = profile;
    const categoryLabels = mergedDisabilityProfile.categories.map(
      (c) => DISABILITY_PROFILES[c].label
    );

    const lines = [
      `STUDENT PROFILE: ${iep.studentName}`,
      `Grade: ${iep.gradeLevel} | Eligibility: ${iep.eligibilityLabel}`,
      `Disability categories: ${categoryLabels.join(", ")}`,
      "",
      "PRESENT LEVELS",
      `  Academic: ${iep.presentLevels.academic}`,
      `  Functional: ${iep.presentLevels.functional}`,
      "",
      "ANNUAL GOALS",
      ...iep.annualGoals.map(
        (g) =>
          `  Goal ${g.goalNumber} [${g.area}]: ${g.targetBehavior}\n` +
          `    Current: ${g.currentLevel}\n` +
          `    Criteria: ${g.criteria} | Timeline: ${g.timeline}`
      ),
      "",
      "ACCOMMODATIONS",
      ...iep.accommodations.map(
        (a) => `  ${a.id} [${a.category}]: ${a.description}`
      ),
      iep.accommodations.length === 0 ? "  None on record." : "",
      "",
      "MODIFICATIONS",
      ...iep.modifications.map((m) => `  ${m.id}: ${m.description}`),
      iep.modifications.length === 0 ? "  None on record." : "",
      "",
      "RELATED SERVICES",
      ...iep.relatedServices.map(
        (s) => `  ${s.type} — ${s.frequency} (${s.location})`
      ),
      iep.relatedServices.length === 0 ? "  None on record." : "",
    ];

    if (mergedDisabilityProfile.comorbidityNotes.length > 0) {
      lines.push("", "COMORBIDITY NOTES");
      lines.push(
        ...mergedDisabilityProfile.comorbidityNotes.map(
          (n) => `  ! ${n.conflict}\n    → ${n.resolution}`
        )
      );
    }

    return {
      content: [{ type: "text", text: lines.join("\n") }],
    };
  }
);

// ---------------------------------------------------------------------------
// RESOURCE: waypoint://students
// Exposes the full list of registered students for Claude to read
// ---------------------------------------------------------------------------

server.resource(
  "students",
  "waypoint://students",
  { description: "All registered student profiles" },
  async () => {
    const allStudents = listStudents();

    if (allStudents.length === 0) {
      return {
        contents: [
          {
            uri: "waypoint://students",
            text: "No students registered.",
            mimeType: "text/plain",
          },
        ],
      };
    }

    const data = allStudents.map((s) => ({
      id: s.id,
      name: s.iep.studentName,
      grade: s.iep.gradeLevel,
      eligibility: s.iep.eligibilityLabel,
      disabilityCategories: s.mergedDisabilityProfile.categories,
      goalCount: s.iep.annualGoals.length,
      accommodationCount: s.iep.accommodations.length,
    }));

    return {
      contents: [
        {
          uri: "waypoint://students",
          text: JSON.stringify(data, null, 2),
          mimeType: "application/json",
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// RESOURCE: waypoint://disability/{categoryId}
// Exposes the disability knowledge base for reference
// ---------------------------------------------------------------------------

server.resource(
  "disability-profile",
  new ResourceTemplate("waypoint://disability/{categoryId}", {
    list: async () => ({
      resources: Object.keys(DISABILITY_PROFILES).map((id) => ({
        uri: `waypoint://disability/${id}`,
        name: DISABILITY_PROFILES[id as DisabilityCategory].label,
        description: `Classroom implications and strategies for ${DISABILITY_PROFILES[id as DisabilityCategory].label}`,
        mimeType: "application/json",
      })),
    }),
  }),
  async (uri, variables) => {
    const categoryId = variables?.categoryId as string | undefined;
    const profile = categoryId ? DISABILITY_PROFILES[categoryId as DisabilityCategory] : undefined;

    if (!categoryId || !profile) {
      return {
        contents: [
          {
            uri: uri.href,
            text: `Unknown disability category: ${categoryId ?? "unknown"}`,
            mimeType: "text/plain",
          },
        ],
      };
    }

    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(profile, null, 2),
          mimeType: "application/json",
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Start the server
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is now running and listening on stdio
}

main().catch((error) => {
  console.error("Fatal error starting Waypoint MCP server:", error);
  process.exit(1);
});

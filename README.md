# Waypoint IEP MCP Server

An MCP server that helps teachers differentiate instruction for students with IEPs — in minutes, not hours.

---

## The Problem This Solves

A special education teacher has 28 students. Six of them have IEPs. Tomorrow's math lesson is on fractions. Before she can teach, she needs to figure out what to do differently for each of those six students — different disabilities, different accommodations, sometimes conflicting needs.

The IEPs are 20+ pages each, written in legal and clinical language. The lesson plan is dense. The teacher has about 15 minutes of prep time.

This tool takes the IEP and the lesson, understands both, and produces a concrete checklist she can print and use in class tomorrow.

---

## How to Run

### Prerequisites

- Node.js 18+
- An Anthropic API key (set as `ANTHROPIC_API_KEY` environment variable)

### Setup

```bash
git clone <your-repo-url>
cd waypoint-iep-mcp
npm install
npm run build
```

### Connect to Claude Desktop

Copy `claude_desktop_config.example.json` to your Claude Desktop config directory and update the path and API key:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "waypoint-iep": {
      "command": "node",
      "args": ["/path/to/waypoint-iep-mcp/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "your-key-here"
      }
    }
  }
}
```

Restart Claude Desktop. The Waypoint tools will appear in the tools list.

---

## Example Usage

**In Claude Desktop:**

```
Load the IEP from /Users/teacher/ieps/sarah.pdf
Load tomorrow's lesson from /Users/teacher/lessons/fractions-ch4.pdf
Generate modifications for Sarah for the fractions lesson
```

**Claude will call the tools in sequence and return:**

```
MODIFICATION PLAN — Sarah · Chapter 4: Introduction to Fractions
Generated: Friday, May 9, 2026

BEFORE CLASS
─────────────────────────────────────────────────
  □ [ACCOMMODATION] Prepare fraction strip manipulatives (physical set, 
    third shelf of supply cabinet). Sarah needs concrete representations 
    before symbolic ones.
    Source: ACC-3 (Concrete manipulatives) | UDL: Representation
    Why: Sarah's IEP present levels note she performs significantly better 
    with hands-on math tools than with written symbolic notation alone.

  □ [ACCOMMODATION] Seat Sarah in the front-left position, away from the 
    door and classroom traffic.
    Source: ACC-1 (Preferential seating) | UDL: Engagement
    Why: Reduces auditory and visual distractions during instruction phases.

DURING LESSON
─────────────────────────────────────────────────
  □ [MODIFICATION] Assign Questions 1–5 only during independent practice 
    (skip 6–10). These five questions cover the same fraction concepts as 
    the full set.
    Source: MOD-1 (Reduced quantity) + Disability Profile: Learning Disability
    Why: Sarah's LD + ADHD comorbidity resolution — extended time applied 
    to a reduced item set rather than full 20 questions with extra time.

  □ [ACCOMMODATION] Provide a visual timer at Sarah's desk for the 
    independent practice segment.
    Source: ACC-5 (External time cues) | UDL: Action/Expression
    Why: ADHD time blindness means Sarah has no internal sense of how much 
    time has passed without an external cue.

  □ [ACCOMMODATION] Allow use of calculator for computation steps. The 
    lesson goal is understanding fraction equivalence, not arithmetic fluency.
    Source: ACC-4 (Calculator accommodation) | UDL: Action/Expression
    Why: Dyscalculia component means arithmetic is a barrier to demonstrating 
    fraction reasoning — removing the barrier reveals actual understanding.

ASSESSMENT
─────────────────────────────────────────────────
  □ [MODIFICATION] Verbal assessment instead of written quiz. Ask Sarah 
    to explain what 1/2 means using the fraction strips, then show you 
    one equivalent fraction.
    Source: MOD-2 (Alternative assessment format) | UDL: Action/Expression
    Why: Sarah's dysgraphia makes written assessment a test of handwriting, 
    not math understanding. Verbal format isolates the actual learning goal.

SCAFFOLDED QUESTIONS
─────────────────────────────────────────────────
1. Original: "Explain in your own words what it means for two fractions to be equivalent."
   Scaffolded [sentence stem]: "Two fractions are equivalent when _________ because _________."

2. Original: "Show three fractions equivalent to 1/2."
   Scaffolded [manipulative + reduced]: "Use your fraction strips to find two fractions that show the same amount as 1/2."

⚠ TEACHER WARNINGS — AVOID THESE FOR THIS STUDENT
─────────────────────────────────────────────────
  ! Do not cold-call Sarah for oral reading of word problems — this is humiliating 
    and unrelated to the fraction learning goal.
  ! Do not extend time AND give the full 20 questions — this ignores the ADHD 
    accommodation need for fewer items. Use the resolved comorbidity approach above.
  ! Do not mark Sarah's written work down for spelling or letter reversals — 
    that is a dysgraphia presentation, not a math error.
```

---

## Architecture Decisions

### Why structure the IEP into typed sections, not just pass raw text?

Raw IEP text passed directly to Claude works, but it wastes context window on boilerplate (district headers, legal disclaimers, signature pages) and produces less reliable extraction because Claude has to find the needle in a 20-page haystack on every call.

Instead, `load_iep` parses the IEP once into a structured `ParsedIEP` type with explicit fields for goals, accommodations, modifications, and present levels. Every subsequent call gets only the structured data — no re-parsing, no wasted context.

This also lets us assign IDs to every accommodation (`ACC-1`, `ACC-2`) and modification (`MOD-1`), so the modification output can cite sources precisely. A teacher or administrator can verify that every suggestion traces back to a specific IEP section.

### Why separate accommodations from modifications?

Most tools conflate these. They are legally and pedagogically distinct:

- **Accommodation**: Same content and learning expectation, different delivery or response format. Does not reduce the bar.
- **Modification**: Changed content scope or reduced performance expectation. Does lower the bar.

Using the wrong one has real consequences: applying a modification when the IEP only specifies accommodations can be legally incorrect and may underestimate the student's capabilities. The disability profile knowledge base enforces this distinction and the modification generator labels every suggestion explicitly.

### Why a disability profile knowledge base?

Many students are registered in the tool without a full parsed IEP — a teacher might know a student has ADHD but not have the PDF available. The disability knowledge base provides evidence-based defaults for each category so the tool can still generate grounded suggestions.

More importantly, the knowledge base encodes what **not** to do — common teacher mistakes that are specific to each disability. These become the "Teacher Warnings" section of every output.

### Why a comorbidity resolver?

About 40% of students with an IEP have more than one disability category. A naive tool generates accommodations for each disability separately, which can produce direct conflicts — for example:

- Dyslexia accommodation: extended time on tests
- ADHD accommodation: fewer items to prevent attention fatigue

Applied naively, you get a student with 90 minutes on a 20-question test. That is worse than either accommodation alone. The resolver detects known conflict patterns and produces a merged recommendation: "Extended time on a reduced set of questions" — both needs addressed simultaneously.

### What goes in a tool vs. a resource?

**Tools** are actions that change state or produce new content: loading files, generating modifications, registering students.

**Resources** are reference data Claude can read to build context: the student registry, the disability knowledge base entries. Resources don't change anything — they inform Claude's reasoning.

This distinction matters because Claude can read resources as part of its context window before deciding which tools to call. Exposing the disability knowledge base as a resource means Claude can reference it when a teacher asks a follow-up question without needing to call a tool.

### Why Claude Opus for parsing, Sonnet for generation?

Parsing an IEP requires careful extraction from messy, format-inconsistent source documents. Opus handles this more reliably for complex documents. The modification generation calls also use Opus because the output quality is the primary evaluation criterion — this is not a place to save tokens.

---

## Running Tests

```bash
npm test
```

The test suite covers:
- Disability profile completeness (every category has required fields)
- Comorbidity detection and resolution logic
- Content reduction defaults (ASD does NOT default to content reduction; intellectual disability does)

---

## What I'd Build Next

**With more time**, the highest-value additions would be:

1. **Multi-student lesson modification**: "Generate modifications for all six IEP students in my class for this lesson" — one call, six plans, formatted to compare side by side.

2. **IEP goal progress tracking**: After each lesson, prompt the teacher to log whether each IEP goal was addressed. Build a lightweight progress log that feeds back into future modification recommendations.

3. **Persistent student store**: Replace in-memory storage with SQLite so student profiles survive server restarts.

4. **Lesson library**: Cache parsed lessons so a teacher doesn't re-parse the same curriculum materials every week.

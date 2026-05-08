/**
 * disability-profiles.ts
 *
 * The knowledge base for every disability category the tool supports.
 * Each profile captures what teachers actually need to know — not just
 * a label, but the classroom implications, the right accommodations vs.
 * modifications, and the UDL lens for each.
 *
 * Design note: We separate accommodations (same content, different delivery)
 * from modifications (changed content or expectations). Most generic tools
 * conflate the two, which produces legally and pedagogically wrong output.
 */

export type DisabilityCategory =
  | "learning_disability"
  | "asd"
  | "adhd"
  | "speech_language"
  | "intellectual_disability"
  | "emotional_behavioral"
  | "physical_motor"
  | "sensory_visual"
  | "sensory_hearing";

export interface DisabilityProfile {
  category: DisabilityCategory;
  label: string;
  subtypes: string[];

  // What makes this disability distinct in a classroom setting
  classroomImplications: string[];

  // Accommodations change HOW the student accesses content — not WHAT they learn
  typicalAccommodations: string[];

  // Modifications change the content itself or the expected performance level
  typicalModifications: string[];

  // UDL framework lens for this disability category
  udlFocus: {
    representation: string[];   // Multiple means of representing information
    actionExpression: string[];  // Multiple means students can show what they know
    engagement: string[];       // Multiple means to motivate and sustain effort
  };

  // Warning flags: things NOT to do that are common teacher mistakes
  commonMistakes: string[];

  // Whether content difficulty should be reduced by default
  // Important: ASD, for example, does NOT default to simpler content
  defaultContentReduction: boolean;
}

// ---------------------------------------------------------------------------
// The full disability knowledge base
// ---------------------------------------------------------------------------

export const DISABILITY_PROFILES: Record<DisabilityCategory, DisabilityProfile> = {

  learning_disability: {
    category: "learning_disability",
    label: "Learning Disability (LD)",
    subtypes: [
      "Dyslexia (reading)",
      "Dysgraphia (writing)",
      "Dyscalculia (math)",
      "Auditory Processing Disorder",
      "Nonverbal Learning Disability",
    ],
    classroomImplications: [
      "Student likely processes information at grade level cognitively but struggles with decoding, encoding, or computation",
      "Reading aloud in front of peers is often humiliating — avoid cold calling for oral reading",
      "Written output may not reflect actual understanding",
      "Speed of processing is almost always slower than peers",
    ],
    typicalAccommodations: [
      "Extended time (typically 1.5× or 2× for tests and in-class work)",
      "Text-to-speech software or human reader for written materials",
      "Preferential seating near the board or teacher",
      "Chunked, step-by-step written instructions rather than multi-part oral directions",
      "Graphic organizers and visual frameworks before writing",
      "Spell-check tools for written work (dysgraphia/dyslexia)",
      "Calculator for computation when the goal is math reasoning, not arithmetic (dyscalculia)",
    ],
    typicalModifications: [
      "Reduced number of questions covering the same concepts (e.g., 10 problems instead of 20)",
      "Alternative assessment format: verbal response, diagram, or demonstration instead of essay",
      "Simplified vocabulary in prompts without reducing conceptual depth",
      "Oral exam option in place of written test",
    ],
    udlFocus: {
      representation: [
        "Offer audio version of any text",
        "Use diagrams, concept maps, and worked examples alongside prose",
        "Highlight key terms before reading — pre-teach vocabulary",
      ],
      actionExpression: [
        "Accept verbal, drawn, or recorded responses alongside written ones",
        "Allow use of assistive technology (text-to-speech, speech-to-text)",
        "Provide sentence starters and graphic organizers for writing tasks",
      ],
      engagement: [
        "Frame tasks around student strengths, not deficits",
        "Use low-stakes practice before high-stakes assessment",
        "Set small, visible progress checkpoints within longer tasks",
      ],
    },
    commonMistakes: [
      "Reducing the cognitive depth of the task when only the format needs to change",
      "Assuming extended time alone is sufficient — output format matters too",
      "Cold-calling for oral reading of unfamiliar text",
    ],
    defaultContentReduction: false,
  },

  asd: {
    category: "asd",
    label: "Autism Spectrum Disorder (ASD)",
    subtypes: [
      "ASD Level 1 (formerly Asperger's)",
      "ASD Level 2",
      "ASD Level 3",
      "Pathological Demand Avoidance (PDA) profile",
    ],
    classroomImplications: [
      "ASD is NOT an intellectual disability — do not reduce content difficulty without explicit IEP indication",
      "Predictability and routine are crucial; unexpected changes can cause significant distress",
      "Social and communication demands of group work may be disproportionately exhausting",
      "Sensory sensitivities (noise, light, texture, smell) can make standard classroom environments painful",
      "Literal language processing — idioms, sarcasm, and ambiguous instructions cause genuine confusion",
      "Many students have a specific intense interest that can be a powerful bridge into any subject",
    ],
    typicalAccommodations: [
      "Visual schedule posted at the student's workspace (what we're doing, in what order)",
      "Advanced notice of transitions (5-minute warning before activity changes)",
      "Quiet work area or noise-cancelling headphones available on request",
      "Literal, unambiguous written instructions to supplement oral directions",
      "Permission to take sensory or movement break when self-regulated",
      "Reduced social demands during work time — individual work option on group tasks",
      "Preferred seating away from high-traffic areas and doors",
    ],
    typicalModifications: [
      "Alternative social-interaction tasks: written reflection instead of group discussion",
      "Reduced group-work requirements where social demand exceeds academic purpose",
    ],
    udlFocus: {
      representation: [
        "Use literal, concrete language — remove idioms and ambiguous phrasing from instructions",
        "Provide written version of all oral instructions",
        "Connect lesson content to student's documented special interest when possible",
      ],
      actionExpression: [
        "Allow typed responses in place of handwritten ones",
        "Offer solo alternatives to group presentations",
        "Accept visual or diagram-based responses when written prose is not the skill being assessed",
      ],
      engagement: [
        "Leverage special interests as entry points into content",
        "Provide predictable lesson structure — same routine every class",
        "Offer clear, explicit criteria for what 'done' looks like",
      ],
    },
    commonMistakes: [
      "Automatically simplifying content — ASD does not imply reduced cognitive ability",
      "Using sarcasm or implied expectations ('you know what to do') without explicit direction",
      "Springing transitions or changed plans without advance notice",
      "Forcing group work without an individual alternative",
    ],
    defaultContentReduction: false,
  },

  adhd: {
    category: "adhd",
    label: "ADHD / Executive Function Disorder",
    subtypes: [
      "ADHD Inattentive presentation",
      "ADHD Hyperactive-Impulsive presentation",
      "ADHD Combined presentation",
      "Executive Function Disorder without ADHD diagnosis",
    ],
    classroomImplications: [
      "Attention is not a moral choice — sustained focus on low-stimulation tasks is genuinely difficult",
      "Working memory deficits mean multi-step verbal instructions are lost",
      "Task initiation is often the hardest part, not the task itself",
      "Time blindness: student has no internal sense of elapsed time without external cues",
      "Hyperactive students are not being disruptive intentionally — movement is regulatory",
    ],
    typicalAccommodations: [
      "Preferential seating away from distractions (windows, doors, high-traffic areas)",
      "Visual timer on desk for all timed work",
      "Chunked tasks: break assignments into 5–10 minute micro-tasks with clear endpoints",
      "Frequent brief check-ins from teacher during independent work",
      "Fidget tool or movement break available",
      "Agenda or task checklist provided at the start of each class",
      "Extended time on assessments (focus depletion is real)",
    ],
    typicalModifications: [
      "Reduced number of items on assessments — same conceptual coverage, fewer repetitions",
      "Shortened homework assignments that assess the skill without requiring extended output",
    ],
    udlFocus: {
      representation: [
        "Chunk instructions: one step at a time, not all steps at once",
        "Use visual supports (numbered steps on board) that stay visible throughout the task",
        "Keep written materials uncluttered — avoid dense text blocks",
      ],
      actionExpression: [
        "Allow movement-based responses or standing work stations where possible",
        "Accept shorter, more focused written responses",
        "Permit verbal check-ins in place of written progress notes",
      ],
      engagement: [
        "Front-load the most interesting or novel part of the lesson",
        "Vary activity type within a single class period",
        "Build in visible progress markers — students need to see what they've accomplished",
      ],
    },
    commonMistakes: [
      "Treating ADHD as a behavioral problem rather than an executive function difference",
      "Giving multi-step oral instructions without a written reference",
      "Expecting the student to 'just focus' without environmental or structural support",
    ],
    defaultContentReduction: false,
  },

  speech_language: {
    category: "speech_language",
    label: "Speech & Language Impairment",
    subtypes: [
      "Expressive language disorder",
      "Receptive language disorder",
      "Mixed receptive-expressive language disorder",
      "Articulation disorder",
      "Fluency disorder (stuttering)",
      "Social (pragmatic) communication disorder",
    ],
    classroomImplications: [
      "Student may understand more than they can express — output difficulty ≠ comprehension deficit",
      "Cold-calling in front of peers for a student who stutters can be traumatic",
      "Receptive language delays mean complex oral instructions may not be processed completely",
      "Expressive delays mean written or verbal responses take significantly longer to produce",
    ],
    typicalAccommodations: [
      "Never cold-call for oral responses — give advance notice before asking student to speak",
      "Written or AAC-based responses as alternative to verbal answers",
      "Extra wait time after posing a question (at least 10 seconds)",
      "Simplified, shorter oral instructions supplemented with written copy",
      "Partnership with SLP for in-class supports during language-heavy lessons",
    ],
    typicalModifications: [
      "Alternative assessment: written response or diagram in place of oral presentation",
      "Shortened oral response requirement where speaking is not the assessed skill",
    ],
    udlFocus: {
      representation: [
        "Pair all spoken content with visual or text-based alternatives",
        "Use visual vocabulary supports (word walls, picture dictionaries)",
        "Provide sentence frames and language scaffolds for discussion tasks",
      ],
      actionExpression: [
        "Accept AAC device, picture board, or written response as equivalent to verbal answer",
        "Allow pre-recorded responses for presentations",
        "Offer peer-buddy options for oral tasks where the skill is content, not speaking",
      ],
      engagement: [
        "Create low-stakes opportunities to practice verbal participation (small group vs. whole class)",
        "Celebrate all communication attempts, not just articulation-perfect responses",
      ],
    },
    commonMistakes: [
      "Finishing the student's sentences — even with good intention this undermines autonomy",
      "Calling on a student with a fluency disorder for impromptu oral reading",
      "Grading presentation delivery and content together when speaking is not the IEP goal",
    ],
    defaultContentReduction: false,
  },

  intellectual_disability: {
    category: "intellectual_disability",
    label: "Intellectual Disability (ID)",
    subtypes: [
      "Mild intellectual disability (IQ 55–70)",
      "Moderate intellectual disability (IQ 40–54)",
      "Down syndrome",
      "Fragile X syndrome",
      "ID associated with other genetic conditions",
    ],
    classroomImplications: [
      "Learning pace is slower — content must be revisited more times before mastery",
      "Abstract concepts require concrete, real-world grounding",
      "Functional literacy and numeracy goals (life skills) are often prioritized in IEP",
      "Generalization is harder — skills learned in one context may not transfer without practice",
      "Social inclusion and peer relationships are as important as academic goals",
    ],
    typicalAccommodations: [
      "Simplified language in all written materials",
      "Concrete manipulatives and real-world objects rather than purely symbolic content",
      "Peer buddy system for task guidance",
      "Frequent repetition and review built into lesson structure",
      "Visual schedules and task checklists",
    ],
    typicalModifications: [
      "Reduced content scope — focus on the most functionally relevant concepts",
      "Alternative IEP-aligned objectives for the same lesson (e.g., counting money instead of percentages)",
      "Mastery-based pacing — student moves on only when a concept is secure",
      "Alternative assessment aligned to IEP goals, not grade-level standards",
    ],
    udlFocus: {
      representation: [
        "Use real objects, photos, and demonstrations before moving to symbols or text",
        "Connect every concept to a real-world application the student encounters",
        "Limit text density — use pictures, icons, and short phrases",
      ],
      actionExpression: [
        "Accept pointing, matching, sorting, or demonstrated responses",
        "Allow extra time without penalty on all tasks",
        "Use portfolio-based assessment to capture growth over time",
      ],
      engagement: [
        "Embed learning in routines the student already values",
        "Use positive reinforcement systems that are predictable and immediate",
        "Prioritize social belonging — never isolate for pull-out if avoidable",
      ],
    },
    commonMistakes: [
      "Assuming no learning is happening because progress is slow",
      "Removing all peer interaction in favor of 1:1 aide support",
      "Focusing only on deficits rather than building on the student's genuine strengths",
    ],
    defaultContentReduction: true,
  },

  emotional_behavioral: {
    category: "emotional_behavioral",
    label: "Emotional & Behavioral Disability (EBD)",
    subtypes: [
      "Generalized anxiety disorder",
      "Oppositional Defiant Disorder (ODD)",
      "Conduct disorder",
      "Post-Traumatic Stress Disorder (PTSD)",
      "Major depressive disorder",
      "Bipolar disorder",
    ],
    classroomImplications: [
      "Behavior is communication — escalation is almost always a response to an unmet need",
      "Public correction or confrontation in front of peers dramatically increases risk of escalation",
      "Trauma-affected students may have hair-trigger responses to perceived threats",
      "Anxiety can manifest as avoidance, refusal, or apparent defiance",
      "Co-regulation from a calm adult is the most effective in-the-moment intervention",
    ],
    typicalAccommodations: [
      "Private, quiet correction rather than public reprimand",
      "Safe exit pass — student can leave to a designated calm space without asking",
      "Flexible seating options (standing desk, alternative workspace)",
      "Check-in/check-out system with a trusted adult at the start and end of each day",
      "Advance notice of high-demand tasks — no surprises",
      "Choice-based task structure where possible to maintain sense of autonomy",
    ],
    typicalModifications: [
      "Reduced written output requirements on difficult days (tracked by IEP team)",
      "Alternative assessment in low-stakes format when anxiety makes high-stakes performance impossible",
    ],
    udlFocus: {
      representation: [
        "Present expectations clearly and consistently — ambiguity increases anxiety",
        "Avoid competitive framing that elevates social risk",
      ],
      actionExpression: [
        "Allow private written responses instead of public sharing",
        "Offer choice between task formats to restore sense of control",
        "Accept partial work with a plan to complete rather than nothing",
      ],
      engagement: [
        "Start with a guaranteed success to build momentum",
        "Explicitly recognize effort, persistence, and coping — not just performance",
        "Reduce novelty and unpredictability in classroom routines",
      ],
    },
    commonMistakes: [
      "Treating avoidance as laziness rather than anxiety",
      "Public power struggles — they never end well for teacher or student",
      "Removing preferred activities as punishment — this breaks trust and escalates behavior",
    ],
    defaultContentReduction: false,
  },

  physical_motor: {
    category: "physical_motor",
    label: "Physical / Motor Disability",
    subtypes: [
      "Cerebral palsy",
      "Spina bifida",
      "Muscular dystrophy",
      "Traumatic brain injury (TBI)",
      "Acquired physical disability",
    ],
    classroomImplications: [
      "Physical access to materials and space may require pre-planning",
      "Handwriting may be slow, laborious, or impossible — this is motor, not cognitive",
      "Fatigue is a real factor — physical effort in mobility consumes energy",
      "TBI often co-presents with cognitive, memory, and emotional changes",
    ],
    typicalAccommodations: [
      "Accessible seating and materials placement",
      "Keyboarding or voice-to-text in place of handwriting",
      "Extended time for all written tasks",
      "Digital versions of all materials (no need to turn physical pages)",
      "Note-taking support (peer notes or teacher-provided guided notes)",
    ],
    typicalModifications: [
      "Reduced quantity of written output when handwriting is the barrier, not the skill",
      "Alternative lab or activity participation for hands-on tasks",
    ],
    udlFocus: {
      representation: [
        "Provide digital accessible versions of all materials",
        "Use audio and video alongside text",
      ],
      actionExpression: [
        "Accept voice recordings, typed responses, or verbal answers",
        "Reduce physical demands that are not central to the learning objective",
      ],
      engagement: [
        "Ensure student can participate fully in discussions even when physical tasks are modified",
      ],
    },
    commonMistakes: [
      "Assuming physical disability implies cognitive limitation",
      "Not planning accessible materials in advance, leaving the student to wait",
    ],
    defaultContentReduction: false,
  },

  sensory_visual: {
    category: "sensory_visual",
    label: "Visual Impairment",
    subtypes: [
      "Low vision",
      "Legal blindness",
      "Cortical visual impairment (CVI)",
    ],
    classroomImplications: [
      "Standard printed materials may be inaccessible without adaptation",
      "Board-based instruction requires supplemental verbal description or handout",
      "CVI is a brain-based visual processing difference — it is not correctable with glasses",
    ],
    typicalAccommodations: [
      "Large-print or digital materials with adjustable font size",
      "Braille materials (if braille reader)",
      "Verbal descriptions of all visual content (diagrams, charts, board work)",
      "Preferential seating close to instruction area",
      "Extended time for reading and written tasks",
    ],
    typicalModifications: [
      "Tactile or auditory alternative to visual-only tasks",
    ],
    udlFocus: {
      representation: [
        "Verbally describe all visual content — never assume the student can see the board",
        "Provide audio or text-based equivalents for every visual material",
      ],
      actionExpression: [
        "Accept verbal or audio-recorded responses",
        "Provide tactile options for hands-on tasks",
      ],
      engagement: [
        "Ensure the student is not excluded from any activity by inaccessible format",
      ],
    },
    commonMistakes: [
      "Pointing to something without describing it verbally ('look at this')",
      "Assuming low vision and blindness require the same supports",
    ],
    defaultContentReduction: false,
  },

  sensory_hearing: {
    category: "sensory_hearing",
    label: "Hearing Impairment / Deafness",
    subtypes: [
      "Mild to moderate hearing loss",
      "Severe to profound hearing loss",
      "Deaf (capital D, cultural identity)",
      "Auditory processing disorder (APD)",
    ],
    classroomImplications: [
      "Oral-only instruction without visual support is inaccessible",
      "Background noise in classrooms degrades hearing aid effectiveness significantly",
      "Students who lip-read need a clear, unobstructed view of the speaker's face",
      "Some Deaf students use ASL as their primary language — written English is a second language",
    ],
    typicalAccommodations: [
      "Preferential seating with clear sightline to teacher's face",
      "FM system or sound-field amplification in classroom",
      "Closed captions on all video content",
      "Written summary of all oral instructions",
      "Interpreter (ASL or other sign) if indicated in IEP",
      "Reduce background noise where possible",
    ],
    typicalModifications: [
      "Simplified written English for Deaf students whose primary language is ASL",
      "Visual alternatives to audio-only tasks",
    ],
    udlFocus: {
      representation: [
        "Pair all spoken content with written or visual equivalent",
        "Caption all video material before class — not live captioning only",
        "Use visual signals (lights, taps) rather than auditory ones",
      ],
      actionExpression: [
        "Accept written or signed responses in place of oral ones",
      ],
      engagement: [
        "Ensure student is always positioned to access instruction — never seat facing away from the front",
      ],
    },
    commonMistakes: [
      "Talking while facing the board (eliminates lip-reading)",
      "Assuming a hearing aid makes hearing 'normal'",
      "Not captioning video content in advance",
    ],
    defaultContentReduction: false,
  },
};

// ---------------------------------------------------------------------------
// Comorbidity resolver
// Handles the case where a student has multiple disabilities and some
// accommodations may appear to conflict. Returns a merged, de-conflicted
// profile with a note for each resolved conflict.
// ---------------------------------------------------------------------------

export interface ComorbidityNote {
  conflict: string;
  resolution: string;
}

export interface MergedProfile {
  categories: DisabilityCategory[];
  accommodations: string[];
  modifications: string[];
  udlNotes: string[];
  comorbidityNotes: ComorbidityNote[];
  defaultContentReduction: boolean;
}

export function mergeDisabilityProfiles(
  categories: DisabilityCategory[]
): MergedProfile {
  if (categories.length === 0) {
    throw new Error("At least one disability category is required.");
  }

  const profiles = categories.map((c) => DISABILITY_PROFILES[c]);
  const comorbidityNotes: ComorbidityNote[] = [];

  // Collect all accommodations and deduplicate by concept
  const allAccommodations = new Set<string>();
  for (const profile of profiles) {
    for (const acc of profile.typicalAccommodations) {
      allAccommodations.add(acc);
    }
  }

  // Collect all modifications
  const allModifications = new Set<string>();
  for (const profile of profiles) {
    for (const mod of profile.typicalModifications) {
      allModifications.add(mod);
    }
  }

  // Collect UDL notes
  const udlNotes: string[] = [];
  for (const profile of profiles) {
    for (const note of profile.udlFocus.representation) {
      udlNotes.push(`[Representation - ${profile.label}] ${note}`);
    }
    for (const note of profile.udlFocus.actionExpression) {
      udlNotes.push(`[Action/Expression - ${profile.label}] ${note}`);
    }
    for (const note of profile.udlFocus.engagement) {
      udlNotes.push(`[Engagement - ${profile.label}] ${note}`);
    }
  }

  // Detect known comorbidity conflicts and resolve them
  const hasLD = categories.includes("learning_disability");
  const hasADHD = categories.includes("adhd");
  const hasASD = categories.includes("asd");

  // LD + ADHD: extended time vs. shorter tasks — resolve to "extended time on fewer items"
  if (hasLD && hasADHD) {
    comorbidityNotes.push({
      conflict:
        "LD typically requires extended time; ADHD benefits from fewer items to reduce attention depletion.",
      resolution:
        "Use extended time on a reduced set of questions. Do not simply double either accommodation — apply both simultaneously: e.g., 10 questions (not 20) with 1.5× time.",
    });
    allAccommodations.add(
      "Extended time applied to a reduced number of items (LD + ADHD comorbidity resolution)"
    );
  }

  // ASD + EBD: routine rigidity vs. flexible exit — resolve with pre-planned structure
  if (hasASD && categories.includes("emotional_behavioral")) {
    comorbidityNotes.push({
      conflict:
        "ASD benefits from strict routine; EBD often requires flexible exit options that deviate from routine.",
      resolution:
        "Build the exit pass INTO the routine. Make it a predictable, scheduled option rather than an unpredictable interruption.",
    });
  }

  // Content reduction: only true if ANY category explicitly sets defaultContentReduction
  const defaultContentReduction = profiles.some(
    (p) => p.defaultContentReduction
  );

  return {
    categories,
    accommodations: Array.from(allAccommodations),
    modifications: Array.from(allModifications),
    udlNotes,
    comorbidityNotes,
    defaultContentReduction,
  };
}

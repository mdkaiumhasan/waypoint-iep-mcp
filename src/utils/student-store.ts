/**
 * student-store.ts
 *
 * In-memory store for parsed student profiles (IEP + disability category data).
 *
 * Design rationale: We parse the IEP once and store the structured result.
 * This way, when a teacher asks "modify tomorrow's lesson for Sarah," we
 * don't re-parse the whole IEP — we just look up Sarah's profile. This is
 * how a teacher's mental model actually works: they learn a student's needs
 * once and apply that knowledge repeatedly.
 *
 * In production this would be a database. For the challenge, in-memory is
 * fine and keeps the setup friction low.
 */

import type { ParsedIEP } from "../parsers/iep-parser.js";
import type { DisabilityCategory } from "../disability/disability-profiles.js";
import { mergeDisabilityProfiles, type MergedProfile } from "../disability/disability-profiles.js";

export interface StudentProfile {
  id: string;
  iep: ParsedIEP;
  mergedDisabilityProfile: MergedProfile;
  addedAt: string;
}

// The store itself — a simple Map keyed by student ID
const students = new Map<string, StudentProfile>();

// ---------------------------------------------------------------------------
// Generate a URL-safe, predictable student ID from a name
// ---------------------------------------------------------------------------

function generateStudentId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 32);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function addStudent(iep: ParsedIEP, overrideCategories?: DisabilityCategory[]): StudentProfile {
  const categories = overrideCategories ?? iep.disabilityCategories;
  const mergedDisabilityProfile = mergeDisabilityProfiles(categories);

  const id = generateStudentId(iep.studentName);

  const profile: StudentProfile = {
    id,
    iep,
    mergedDisabilityProfile,
    addedAt: new Date().toISOString(),
  };

  students.set(id, profile);
  return profile;
}

export function getStudent(studentId: string): StudentProfile | undefined {
  return students.get(studentId);
}

export function listStudents(): StudentProfile[] {
  return Array.from(students.values());
}

export function removeStudent(studentId: string): boolean {
  return students.delete(studentId);
}

export function findStudentByName(name: string): StudentProfile | undefined {
  const targetId = generateStudentId(name);
  return students.get(targetId);
}

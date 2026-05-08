/**
 * disability-profiles.test.ts
 *
 * Unit tests for the disability profile system, especially the comorbidity
 * resolver which is one of the key differentiators of this tool.
 *
 * Run with: npm test
 */

import { describe, it, expect } from "@jest/globals";
import {
  mergeDisabilityProfiles,
  DISABILITY_PROFILES,
  type DisabilityCategory,
} from "../src/disability/disability-profiles.js";

describe("DISABILITY_PROFILES", () => {
  it("should have a profile for every supported category", () => {
    const expectedCategories: DisabilityCategory[] = [
      "learning_disability",
      "asd",
      "adhd",
      "speech_language",
      "intellectual_disability",
      "emotional_behavioral",
      "physical_motor",
      "sensory_visual",
      "sensory_hearing",
    ];

    for (const category of expectedCategories) {
      expect(DISABILITY_PROFILES[category]).toBeDefined();
      expect(DISABILITY_PROFILES[category].label).toBeTruthy();
    }
  });

  it("should mark ASD as NOT defaulting to content reduction", () => {
    expect(DISABILITY_PROFILES.asd.defaultContentReduction).toBe(false);
  });

  it("should mark intellectual_disability as defaulting to content reduction", () => {
    expect(DISABILITY_PROFILES.intellectual_disability.defaultContentReduction).toBe(true);
  });

  it("each profile should have at least 3 accommodations", () => {
    for (const [category, profile] of Object.entries(DISABILITY_PROFILES)) {
      expect(profile.typicalAccommodations.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("mergeDisabilityProfiles", () => {
  it("should merge accommodations from multiple categories", () => {
    const merged = mergeDisabilityProfiles(["learning_disability", "adhd"]);
    const ldAccommodations = DISABILITY_PROFILES.learning_disability.typicalAccommodations;
    const adhdAccommodations = DISABILITY_PROFILES.adhd.typicalAccommodations;

    // Should contain entries from both — check for known items
    expect(merged.accommodations.length).toBeGreaterThanOrEqual(
      Math.max(ldAccommodations.length, adhdAccommodations.length)
    );
  });

  it("should detect LD + ADHD comorbidity and add a resolution note", () => {
    const merged = mergeDisabilityProfiles(["learning_disability", "adhd"]);
    expect(merged.comorbidityNotes.length).toBeGreaterThan(0);
    // The resolution should mention both concerns
    const note = merged.comorbidityNotes[0];
    expect(note.resolution.toLowerCase()).toContain("extended time");
    expect(note.resolution.toLowerCase()).toContain("fewer");
  });

  it("should detect ASD + EBD comorbidity", () => {
    const merged = mergeDisabilityProfiles(["asd", "emotional_behavioral"]);
    expect(merged.comorbidityNotes.length).toBeGreaterThan(0);
  });

  it("single category — no comorbidity notes", () => {
    const merged = mergeDisabilityProfiles(["adhd"]);
    expect(merged.comorbidityNotes).toHaveLength(0);
  });

  it("should set defaultContentReduction to true if ANY category requires it", () => {
    const merged = mergeDisabilityProfiles(["adhd", "intellectual_disability"]);
    expect(merged.defaultContentReduction).toBe(true);
  });

  it("should set defaultContentReduction to false when no category requires it", () => {
    const merged = mergeDisabilityProfiles(["adhd", "asd"]);
    expect(merged.defaultContentReduction).toBe(false);
  });

  it("should throw when given an empty categories array", () => {
    expect(() => mergeDisabilityProfiles([])).toThrow();
  });
});

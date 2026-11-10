import { describe, it, expect } from 'vitest';
import { CHARACTERS } from '../src/utils/Constants';

describe('Character Roster & Descriptions', () => {
  it('should have all 10 characters defined with valid IDs and names', () => {
    expect(CHARACTERS.length).toBe(10);
    const ids = CHARACTERS.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(10);

    const names = CHARACTERS.map((c) => c.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(10);
  });

  it('should ensure each character has a unique, non-empty species', () => {
    const speciesList = CHARACTERS.map((c) => c.species.trim());
    speciesList.forEach((species) => {
      expect(species.length).toBeGreaterThan(0);
    });
    const uniqueSpecies = new Set(speciesList);
    expect(uniqueSpecies.size).toBe(10);
  });

  it('should ensure each character has a unique, short description for multiplayer selection', () => {
    const shortDescs = CHARACTERS.map((c) => c.shortDescription?.trim() || '');
    shortDescs.forEach((desc) => {
      expect(desc.length).toBeGreaterThan(0);
      // Ensure it is concise enough to fit in UI banners (< 60 chars)
      expect(desc.length).toBeLessThan(60);
    });
    const uniqueShortDescs = new Set(shortDescs);
    expect(uniqueShortDescs.size).toBe(10);

    // Specifically verify Kiri is the only Mechanic Fox Girl
    const mechanicFoxGirls = CHARACTERS.filter((c) =>
      c.shortDescription?.toLowerCase().includes('mechanic fox girl') ||
      c.species.toLowerCase().includes('mechanic fox girl')
    );
    expect(mechanicFoxGirls.length).toBe(1);
    expect(mechanicFoxGirls[0].id).toBe('kiri');
  });

  it('should verify character descriptions are non-empty and flavor-rich', () => {
    CHARACTERS.forEach((char) => {
      expect(char.description).toBeDefined();
      expect(char.description.trim().length).toBeGreaterThan(0);
      expect(char.quote).toBeDefined();
      expect(char.defeatQuote).toBeDefined();
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  MAX_SEARCH_TERMS,
  MAX_TERM_LENGTH,
  buildSearchTokens,
  escapeRegex,
  normalizeText,
  parseSearchTerms,
  searchFilter,
  sortKey,
} from '../../src/utils/search';

describe('normalizeText / sortKey', () => {
  it('lower-cases, strips accents and collapses whitespace', () => {
    expect(normalizeText('  JOSÉ   Müller ')).toBe('jose muller');
    expect(sortKey('Åsa  Öberg')).toBe('asa oberg');
  });
});

describe('escapeRegex', () => {
  it('neutralises every regex metacharacter', () => {
    const nasty = '.*+?^${}()|[]\\/-';
    const re = new RegExp(`^${escapeRegex(nasty)}$`);
    expect(re.test(nasty)).toBe(true);
    expect(re.test('anything else')).toBe(false);
  });
});

describe('buildSearchTokens', () => {
  it('indexes name words, specialization words, whole e-mail, local part and digits-only phone', () => {
    const tokens = buildSearchTokens({
      names: ['Dr. Amina Rahman'],
      texts: ['Pediatrics', 'Riverside General Hospital'],
      emails: ['Amina.Rahman@Example.com'],
      phones: ['+1 (555) 010-1234'],
    });
    expect(tokens).toEqual(expect.arrayContaining(['dr', 'amina', 'rahman', 'pediatrics', 'riverside', 'general', 'hospital']));
    expect(tokens).toContain('amina.rahman@example.com');
    expect(tokens).toContain('amina.rahman');
    expect(tokens).toContain('example');
    expect(tokens).toContain('15550101234');
  });

  it('ignores missing e-mail / phone and caps the token count', () => {
    expect(buildSearchTokens({ names: ['A B'], emails: [null, undefined], phones: [undefined] })).toEqual(['a', 'b']);
    const many = buildSearchTokens({ texts: [Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ')] });
    expect(many.length).toBeLessThanOrEqual(48);
  });

  it('keeps Bengali words searchable', () => {
    expect(buildSearchTokens({ names: ['আমিনা রহমান'] }).length).toBeGreaterThan(0);
  });
});

describe('parseSearchTerms / searchFilter', () => {
  it('returns nothing for empty input', () => {
    expect(parseSearchTerms(undefined)).toEqual([]);
    expect(parseSearchTerms('   ')).toEqual([]);
    expect(searchFilter('')).toBeNull();
  });

  it('caps the number of terms and their length', () => {
    expect(parseSearchTerms('a b c d e f g h')).toHaveLength(MAX_SEARCH_TERMS);
    expect(parseSearchTerms('x'.repeat(500))[0]).toHaveLength(MAX_TERM_LENGTH);
  });

  it('normalises phone-looking terms to digits so formatting does not matter', () => {
    expect(parseSearchTerms('+1-555-0101')).toEqual(['15550101']);
  });

  it('builds anchored, escaped regexes - user text can never become regex syntax', () => {
    const f = searchFilter('.*  $ne  (a+)+')!;
    for (const clause of f.$and) {
      expect(clause.searchTokens.$regex.startsWith('^')).toBe(true);
      // compiles and is literal
      expect(() => new RegExp(clause.searchTokens.$regex)).not.toThrow();
    }
    expect(f.$and[0]!.searchTokens.$regex).toBe('^\\.\\*');
  });

  it('every term must match (AND semantics)', () => {
    expect(searchFilter('amina rahman')!.$and).toHaveLength(2);
  });
});

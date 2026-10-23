import { describe, expect, it } from 'vitest';
import { assertStrongPassword, dummyVerify, hashPassword, verifyPassword } from '../../src/utils/password';

describe('password hashing', () => {
  it('stores a salted bcrypt hash, never the plaintext', async () => {
    const hash = await hashPassword('Correct-Horse-9');
    expect(hash).not.toContain('Correct-Horse-9');
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(await hashPassword('Correct-Horse-9')).not.toBe(hash); // unique salt per hash
  });
  it('verifies correct and rejects wrong passwords', async () => {
    const hash = await hashPassword('Correct-Horse-9');
    expect(await verifyPassword('Correct-Horse-9', hash)).toBe(true);
    expect(await verifyPassword('correct-horse-9', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });
  it('dummyVerify (used for unknown users) always resolves false', async () => {
    expect(await dummyVerify('anything')).toBe(false);
  });
});

describe('assertStrongPassword', () => {
  it('requires length and character variety', () => {
    expect(() => assertStrongPassword('short1A')).toThrow(/at least/);
    expect(() => assertStrongPassword('alllowercase1234')).toThrow(/upper/);
    expect(() => assertStrongPassword('Valid-Passw0rd-xyz')).not.toThrow();
  });
});

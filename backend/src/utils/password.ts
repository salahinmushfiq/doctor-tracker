import bcrypt from 'bcryptjs';
import { env } from '../config/env';

/** 12 rounds (~250 ms) in real environments; 4 in tests so suites stay fast. */
export const BCRYPT_ROUNDS = env.isTest ? 4 : 12;

export const MIN_PASSWORD_LENGTH = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// A real hash to compare against when the e-mail is unknown, so "no such user" and
// "wrong password" take the same time and cannot be told apart by timing.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-not-a-real-password', BCRYPT_ROUNDS);

export function dummyVerify(plain: string): Promise<boolean> {
  return bcrypt.compare(plain, DUMMY_HASH).then(() => false);
}

export function assertStrongPassword(plain: string): void {
  if (plain.length < MIN_PASSWORD_LENGTH) throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  if (!/[a-z]/.test(plain) || !/[A-Z]/.test(plain) || !/\d/.test(plain)) {
    throw new Error('Password must contain upper-case, lower-case and a digit');
  }
}

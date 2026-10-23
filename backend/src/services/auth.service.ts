import { User, type UserDoc } from '../models/User';
import { dummyVerify, verifyPassword } from '../utils/password';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'viewer';
}

export const toPublicUser = (u: { _id: unknown; name: string; email: string; role: 'admin' | 'viewer' }): PublicUser => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
});

/**
 * Returns the user on success, null otherwise. The caller must respond identically for
 * "unknown e-mail", "wrong password" and "inactive account" (no user enumeration).
 */
export async function authenticate(email: string, password: string): Promise<UserDoc | null> {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    await dummyVerify(password);
    return null;
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok || !user.isActive) return null;
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

/** Server-side logout: every token issued before this call stops working. */
export async function revokeSessions(userId: string, tokenVersion: number): Promise<void> {
  await User.updateOne({ _id: userId, tokenVersion }, { $inc: { tokenVersion: 1 } });
}

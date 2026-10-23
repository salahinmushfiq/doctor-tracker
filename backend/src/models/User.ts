import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { ROLES } from './constants';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    // select:false -> the hash is never loaded unless a query explicitly asks for it.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'viewer' },
    isActive: { type: Boolean, default: true },
    /** Incremented on logout / password change; tokens carrying an older value are rejected. */
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

// Login lookup + uniqueness. Case-insensitivity is guaranteed by lowercasing on write and on lookup.
userSchema.index({ email: 1 }, { unique: true });

export type UserAttrs = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserAttrs>;
export const User = model('User', userSchema);

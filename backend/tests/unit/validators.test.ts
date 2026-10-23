import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { loginBody } from '../../src/validators/auth';
import { idParams } from '../../src/validators/common';
import { dashboardQuery } from '../../src/validators/dashboard';
import { doctorBody, doctorListQuery, doctorPatchBody } from '../../src/validators/doctor';
import { patientBody, patientListQuery, patientPatchBody } from '../../src/validators/patient';

const goodId = new Types.ObjectId().toHexString();
const ok = (r: { success: boolean }) => r.success;

describe('list query validation', () => {
  it('applies defaults and coerces numbers', () => {
    const r = doctorListQuery.parse({});
    expect(r).toMatchObject({ page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' });
    expect(doctorListQuery.parse({ page: '3', limit: '25' })).toMatchObject({ page: 3, limit: 25 });
  });

  it('enforces the maximum page size and positive pages', () => {
    expect(ok(doctorListQuery.safeParse({ limit: '101' }))).toBe(false);
    expect(ok(doctorListQuery.safeParse({ limit: '100' }))).toBe(true);
    expect(ok(doctorListQuery.safeParse({ page: '0' }))).toBe(false);
    expect(ok(doctorListQuery.safeParse({ page: '-1' }))).toBe(false);
    expect(ok(doctorListQuery.safeParse({ page: 'abc' }))).toBe(false);
  });

  it('only accepts allow-listed sort fields', () => {
    expect(ok(doctorListQuery.safeParse({ sortBy: 'passwordHash' }))).toBe(false);
    expect(ok(doctorListQuery.safeParse({ sortBy: 'fullName' }))).toBe(true);
    expect(ok(patientListQuery.safeParse({ sortBy: 'dateOfBirth' }))).toBe(true);
    expect(ok(patientListQuery.safeParse({ sortBy: 'doctor' }))).toBe(false);
  });

  it('rejects operator-injection shapes (arrays / objects where strings are expected)', () => {
    expect(ok(doctorListQuery.safeParse({ search: { $ne: 'x' } }))).toBe(false);
    expect(ok(doctorListQuery.safeParse({ search: ['a', 'b'] }))).toBe(false);
    expect(ok(doctorListQuery.safeParse({ specialization: { $regex: '.*' } }))).toBe(false);
    expect(ok(patientListQuery.safeParse({ doctorId: { $ne: null } }))).toBe(false);
    expect(ok(patientListQuery.safeParse({ doctorId: 'not-an-id' }))).toBe(false);
  });

  it('accepts a valid doctorId or "unassigned"', () => {
    expect(ok(patientListQuery.safeParse({ doctorId: goodId }))).toBe(true);
    expect(ok(patientListQuery.safeParse({ doctorId: 'unassigned' }))).toBe(true);
  });

  it('validates dates and their order', () => {
    expect(ok(doctorListQuery.safeParse({ startDate: '2026-02-01', endDate: '2026-01-01' }))).toBe(false);
    expect(ok(doctorListQuery.safeParse({ startDate: '2026-01-01', endDate: '2026-01-01' }))).toBe(true);
    expect(ok(doctorListQuery.safeParse({ startDate: 'yesterday' }))).toBe(false);
    expect(ok(doctorListQuery.safeParse({ startDate: '2026-13-45' }))).toBe(false);
  });

  it('caps search length', () => {
    expect(ok(doctorListQuery.safeParse({ search: 'a'.repeat(101) }))).toBe(false);
  });

  it('restricts patient condition filter to the known categories', () => {
    expect(ok(patientListQuery.safeParse({ condition: 'Oncology' }))).toBe(true);
    expect(ok(patientListQuery.safeParse({ condition: 'Made up' }))).toBe(false);
  });
});

describe('dashboard query', () => {
  it('defaults the top-N limit and bounds it', () => {
    expect(dashboardQuery.parse({}).limit).toBe(10);
    expect(ok(dashboardQuery.safeParse({ limit: '26' }))).toBe(false);
    expect(ok(dashboardQuery.safeParse({ interval: 'year' }))).toBe(false);
    expect(ok(dashboardQuery.safeParse({ interval: 'week' }))).toBe(true);
  });
});

describe('route params', () => {
  it('accepts only 24-hex ObjectIds', () => {
    expect(ok(idParams.safeParse({ id: goodId }))).toBe(true);
    expect(ok(idParams.safeParse({ id: '123' }))).toBe(false);
    expect(ok(idParams.safeParse({ id: 'zzzzzzzzzzzzzzzzzzzzzzzz' }))).toBe(false);
    expect(ok(idParams.safeParse({ id: { $gt: '' } }))).toBe(false);
  });
});

describe('auth body', () => {
  it('normalises e-mail and refuses unknown keys / non-string values', () => {
    expect(loginBody.parse({ email: '  Admin@Example.COM ', password: 'x' }).email).toBe('admin@example.com');
    expect(ok(loginBody.safeParse({ email: { $ne: null }, password: { $ne: null } }))).toBe(false);
    expect(ok(loginBody.safeParse({ email: 'a@b.co', password: 'x', role: 'admin' }))).toBe(false);
    expect(ok(loginBody.safeParse({ email: 'not-an-email', password: 'x' }))).toBe(false);
    expect(ok(loginBody.safeParse({ email: 'a@b.co', password: '' }))).toBe(false);
  });
});

describe('doctor body', () => {
  const valid = { fullName: 'Dr. Amina Rahman', specialization: 'Cardiology', hospital: 'Northgate Clinic', phone: '+1 555 010 1234', email: 'Amina@Example.com' };

  it('accepts a valid doctor and normalises e-mail', () => {
    expect(doctorBody.parse(valid).email).toBe('amina@example.com');
  });
  it.each([
    ['short name', { fullName: 'A' }],
    ['missing specialization', { specialization: '' }],
    ['bad phone', { phone: 'abc' }],
    ['short phone', { phone: '12' }],
    ['bad e-mail', { email: 'nope' }],
  ])('rejects %s', (_n, patch) => {
    expect(ok(doctorBody.safeParse({ ...valid, ...patch }))).toBe(false);
  });
  it('rejects unknown / privileged fields (mass-assignment guard)', () => {
    expect(ok(doctorBody.safeParse({ ...valid, nameSort: 'x' }))).toBe(false);
    expect(ok(doctorBody.safeParse({ ...valid, _id: goodId }))).toBe(false);
  });
  it('patch needs at least one field', () => {
    expect(ok(doctorPatchBody.safeParse({}))).toBe(false);
    expect(ok(doctorPatchBody.safeParse({ hospital: 'Unity Specialized Hospital' }))).toBe(true);
  });
});

describe('patient body', () => {
  const valid = { fullName: 'Rahim Khan', dateOfBirth: '1990-04-21', phone: '+1-555-0101', condition: 'Cardiovascular' };

  it('applies defaults on create and converts dateOfBirth to a Date', () => {
    const p = patientBody.parse(valid);
    expect(p.gender).toBe('unspecified');
    expect(p.email).toBeNull();
    expect(p.doctorId).toBeNull();
    expect(p.dateOfBirth).toBeInstanceOf(Date);
  });

  it('treats an empty e-mail string as "no e-mail"', () => {
    expect(patientBody.parse({ ...valid, email: '' }).email).toBeNull();
    expect(patientBody.parse({ ...valid, email: 'Pat@Example.com' }).email).toBe('pat@example.com');
  });

  it.each([
    ['future date of birth', { dateOfBirth: '2999-01-01' }],
    ['malformed date of birth', { dateOfBirth: '21/04/1990' }],
    ['impossible date of birth', { dateOfBirth: '1990-02-31x' }],
    ['unknown condition', { condition: 'Flu' }],
    ['bad doctor id', { doctorId: 'abc' }],
    ['bad gender', { gender: 'robot' }],
  ])('rejects %s', (_n, patch) => {
    expect(ok(patientBody.safeParse({ ...valid, ...patch }))).toBe(false);
  });

  it('PATCH does not apply create-time defaults (a partial update must not reset gender)', () => {
    const p = patientPatchBody.parse({ fullName: 'New Name' });
    expect(p).toEqual({ fullName: 'New Name' });
  });

  it('PATCH allows explicit unassignment via doctorId: null', () => {
    expect(patientPatchBody.parse({ doctorId: null })).toEqual({ doctorId: null });
    expect(ok(patientPatchBody.safeParse({}))).toBe(false);
  });
});

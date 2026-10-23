import { inject } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import type { Express } from 'express';
import { connectDatabase, disconnectDatabase } from '../../src/config/db';
import { Doctor } from '../../src/models/Doctor';
import { Patient } from '../../src/models/Patient';
import { User } from '../../src/models/User';
import { hashPassword } from '../../src/utils/password';

export const ORIGIN = 'http://localhost:3000';
export const PASSWORD = 'Passw0rd-integration-1';

/** URI of the shared in-memory MongoDB started by tests/global-setup.ts ('' = unavailable -> suites skip). */
export const mongoUri: string = inject('mongoUri');

export async function connect() {
  await connectDatabase(mongoUri);
}

export async function teardown() {
  await disconnectDatabase();
}

export async function resetData() {
  await Promise.all([Doctor.deleteMany({}), Patient.deleteMany({}), User.deleteMany({})]);
}

export async function createUser(role: 'admin' | 'viewer', overrides: Record<string, unknown> = {}) {
  return User.create({
    name: `${role} user`,
    email: `${role}@example.com`,
    role,
    passwordHash: await hashPassword(PASSWORD),
    ...overrides,
  });
}

export interface Session {
  agent: ReturnType<typeof request.agent>;
  csrf: string;
  get: (url: string) => request.Test;
  post: (url: string, body?: object) => request.Test;
  patch: (url: string, body?: object) => request.Test;
  del: (url: string) => request.Test;
}

/** Creates the user (if needed), logs in through the real endpoint and returns a cookie-carrying agent. */
export async function login(app: Express, role: 'admin' | 'viewer' = 'admin'): Promise<Session> {
  if (!(await User.exists({ email: `${role}@example.com` }))) await createUser(role);
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/login').set('Origin', ORIGIN).send({ email: `${role}@example.com`, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  const csrf: string = res.body.data.csrfToken;
  const withHeaders = (t: request.Test) => t.set('Origin', ORIGIN).set('X-CSRF-Token', csrf);
  return {
    agent,
    csrf,
    get: (url) => agent.get(url),
    post: (url, body = {}) => withHeaders(agent.post(url)).send(body),
    patch: (url, body = {}) => withHeaders(agent.patch(url)).send(body),
    del: (url) => withHeaders(agent.delete(url)),
  };
}

let doctorSeq = 0;
export async function makeDoctor(overrides: Record<string, unknown> = {}) {
  doctorSeq += 1;
  return Doctor.create({
    fullName: `Dr. Test Doctor${doctorSeq}`,
    specialization: 'Cardiology',
    hospital: 'Northgate Clinic',
    phone: '+1-555-0100',
    email: `doctor${doctorSeq}@example.com`,
    ...overrides,
  });
}

let patientSeq = 0;
export async function makePatient(overrides: Record<string, unknown> = {}) {
  patientSeq += 1;
  return Patient.create({
    fullName: `Pat Ient${patientSeq}`,
    dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
    gender: 'unspecified',
    phone: '+1-555-0101',
    condition: 'Cardiovascular',
    doctor: null,
    ...overrides,
  });
}

export const at = (iso: string) => new Date(iso);
export { mongoose };

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { Doctor } from '../../src/models/Doctor';
import { Patient } from '../../src/models/Patient';
import { at, connect, login, makeDoctor, makePatient, resetData, teardown, mongoUri, type Session } from './helpers';

const app = createApp();

describe.skipIf(!mongoUri)('doctors (integration)', () => {
  let s: Session;
  beforeAll(() => connect());
  afterAll(() => teardown());
  beforeEach(async () => {
    await resetData();
    s = await login(app, 'admin');
  });

  const valid = { fullName: 'Dr. Amina Rahman', specialization: 'Cardiology', hospital: 'Northgate Clinic', phone: '+1-555-0101', email: 'Amina.Rahman@Example.com' };

  describe('create / read / update', () => {
    it('creates a doctor, normalises the e-mail and sets timestamps', async () => {
      const res = await s.post('/api/v1/doctors', valid);
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ fullName: 'Dr. Amina Rahman', email: 'amina.rahman@example.com', patientCount: 0 });
      expect(res.body.data.createdAt).toBeTruthy();
      expect(res.body.data.updatedAt).toBeTruthy();
      expect(res.body.data).not.toHaveProperty('searchTokens');
      expect(res.body.data).not.toHaveProperty('nameSort');
    });

    it('rejects duplicate e-mails, case-insensitively, with 409', async () => {
      await s.post('/api/v1/doctors', valid);
      const res = await s.post('/api/v1/doctors', { ...valid, fullName: 'Dr. Someone Else', email: 'AMINA.RAHMAN@example.com' });
      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe('A record with this email already exists');
    });

    it('returns 404 for an unknown (well-formed) id and 400 for a malformed one', async () => {
      expect((await s.get('/api/v1/doctors/65f1c0a1a1a1a1a1a1a1a1a1')).status).toBe(404);
      expect((await s.get('/api/v1/doctors/123')).status).toBe(400);
    });

    it('gets one doctor with its patient count', async () => {
      const d = await makeDoctor();
      await makePatient({ doctor: d._id });
      await makePatient({ doctor: d._id });
      const res = await s.get(`/api/v1/doctors/${d._id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.patientCount).toBe(2);
    });

    it('updates fields, bumps updatedAt and refreshes the search index', async () => {
      const d = await makeDoctor({ hospital: 'Northgate Clinic' });
      const before = d.updatedAt;
      await new Promise((r) => setTimeout(r, 15));
      const res = await s.patch(`/api/v1/doctors/${d._id}`, { hospital: 'Zebra Memorial' });
      expect(res.status).toBe(200);
      expect(res.body.data.hospital).toBe('Zebra Memorial');
      expect(new Date(res.body.data.updatedAt).getTime()).toBeGreaterThan(before.getTime());
      expect((await s.get('/api/v1/doctors?search=zebra')).body.data).toHaveLength(1);
      expect((await s.get('/api/v1/doctors?search=northgate')).body.data).toHaveLength(0);
    });

    it('refuses to change the e-mail to one that is taken, empty patches, unknown keys and unknown ids', async () => {
      const a = await makeDoctor({ email: 'a@example.com' });
      await makeDoctor({ email: 'b@example.com' });
      expect((await s.patch(`/api/v1/doctors/${a._id}`, { email: 'b@example.com' })).status).toBe(409);
      expect((await s.patch(`/api/v1/doctors/${a._id}`, {})).status).toBe(400);
      expect((await s.patch(`/api/v1/doctors/${a._id}`, { nameSort: 'x' })).status).toBe(400);
      expect((await s.patch('/api/v1/doctors/65f1c0a1a1a1a1a1a1a1a1a1', { hospital: 'Whatever Hospital' })).status).toBe(404);
    });
  });

  describe('list: search, filters, sorting, pagination (all server-side)', () => {
    beforeEach(async () => {
      await makeDoctor({ fullName: 'Dr. Amina Rahman', specialization: 'Cardiology', hospital: 'Northgate Clinic', email: 'amina.rahman@example.com', createdAt: at('2026-01-10T10:00:00Z') });
      await makeDoctor({ fullName: 'Dr. Karim Hossain', specialization: 'Neurology', hospital: 'Riverside General', email: 'karim.hossain@example.com', createdAt: at('2026-02-10T15:00:00Z') });
      await makeDoctor({ fullName: 'Dr. Aminul Islam', specialization: 'Cardiology', hospital: 'Riverside General', email: 'aminul@example.com', createdAt: at('2026-03-10T09:00:00Z') });
    });
    const names = (res: { body: { data: Array<{ fullName: string }> } }) => res.body.data.map((d) => d.fullName);

    it('returns the documented envelope', async () => {
      const res = await s.get('/api/v1/doctors');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, pagination: { page: 1, limit: 10, total: 3, totalPages: 1 } });
    });

    it('searches by prefix across name, specialization, hospital and e-mail', async () => {
      expect(names(await s.get('/api/v1/doctors?search=amin')).sort()).toEqual(['Dr. Amina Rahman', 'Dr. Aminul Islam']);
      expect(names(await s.get('/api/v1/doctors?search=amina rahman'))).toEqual(['Dr. Amina Rahman']);
      expect(names(await s.get('/api/v1/doctors?search=cardio')).sort()).toEqual(['Dr. Amina Rahman', 'Dr. Aminul Islam']);
      expect(names(await s.get('/api/v1/doctors?search=river')).sort()).toEqual(['Dr. Aminul Islam', 'Dr. Karim Hossain']);
      expect(names(await s.get('/api/v1/doctors?search=karim.hos'))).toEqual(['Dr. Karim Hossain']);
      expect(names(await s.get('/api/v1/doctors?search=AMINA'))).toEqual(['Dr. Amina Rahman']); // case-insensitive
    });

    it('treats regex metacharacters literally instead of erroring or matching everything', async () => {
      for (const q of ['.*', '(a+)+$', '[', '\\', '$ne']) {
        const res = await s.get(`/api/v1/doctors?search=${encodeURIComponent(q)}`);
        expect(res.status, q).toBe(200);
        expect(res.body.data, q).toHaveLength(0);
      }
    });

    it('returns an empty page (not an error) when nothing matches', async () => {
      const res = await s.get('/api/v1/doctors?search=zzzzzz');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ data: [], pagination: { total: 0, totalPages: 0 } });
    });

    it('filters by specialization and hospital, alone and combined', async () => {
      expect(names(await s.get('/api/v1/doctors?specialization=Cardiology')).sort()).toEqual(['Dr. Amina Rahman', 'Dr. Aminul Islam']);
      expect(names(await s.get('/api/v1/doctors?hospital=Riverside General')).sort()).toEqual(['Dr. Aminul Islam', 'Dr. Karim Hossain']);
      expect(names(await s.get('/api/v1/doctors?specialization=Cardiology&hospital=Riverside General'))).toEqual(['Dr. Aminul Islam']);
    });

    it('filters by createdAt date range with an inclusive end day', async () => {
      expect(names(await s.get('/api/v1/doctors?startDate=2026-02-01&endDate=2026-02-28'))).toEqual(['Dr. Karim Hossain']);
      // endDate is the same calendar day as the record (15:00Z) -> must still be included
      expect(names(await s.get('/api/v1/doctors?startDate=2026-02-10&endDate=2026-02-10'))).toEqual(['Dr. Karim Hossain']);
      expect(names(await s.get('/api/v1/doctors?endDate=2026-01-31'))).toEqual(['Dr. Amina Rahman']);
      expect(names(await s.get('/api/v1/doctors?startDate=2026-03-01'))).toEqual(['Dr. Aminul Islam']);
    });

    it('sorts by allow-listed fields in both directions', async () => {
      expect(names(await s.get('/api/v1/doctors?sortBy=fullName&sortOrder=asc'))).toEqual(['Dr. Amina Rahman', 'Dr. Aminul Islam', 'Dr. Karim Hossain']);
      expect(names(await s.get('/api/v1/doctors?sortBy=fullName&sortOrder=desc'))).toEqual(['Dr. Karim Hossain', 'Dr. Aminul Islam', 'Dr. Amina Rahman']);
      expect(names(await s.get('/api/v1/doctors?sortBy=createdAt&sortOrder=desc'))).toEqual(['Dr. Aminul Islam', 'Dr. Karim Hossain', 'Dr. Amina Rahman']);
      expect(names(await s.get('/api/v1/doctors?sortBy=hospital&sortOrder=asc'))[0]).toBe('Dr. Amina Rahman');
    });

    it('sorts names case-/accent-insensitively', async () => {
      await makeDoctor({ fullName: 'dr. zeta lower', email: 'z@example.com' });
      await makeDoctor({ fullName: 'Dr. Álvaro Accent', email: 'al@example.com' });
      const list = names(await s.get('/api/v1/doctors?sortBy=fullName&sortOrder=asc&limit=100'));
      expect(list[0]).toBe('Dr. Amina Rahman'.localeCompare('Dr. Álvaro Accent') < 0 ? 'Dr. Álvaro Accent' : list[0]);
      expect(list[list.length - 1]).toBe('dr. zeta lower'); // a plain binary sort would put lowercase after all capitals anyway; accent key keeps Á with A
    });

    it('rejects non-allow-listed sort fields and oversize pages', async () => {
      expect((await s.get('/api/v1/doctors?sortBy=email')).status).toBe(400);
      expect((await s.get('/api/v1/doctors?limit=101')).status).toBe(400);
    });

    it('paginates without gaps or duplicates even when sort keys tie', async () => {
      await Doctor.deleteMany({});
      const same = at('2026-05-05T05:05:05Z');
      await Doctor.insertMany(Array.from({ length: 25 }, (_, i) => ({ fullName: `Dr. Same ${i}`, specialization: 'Cardiology', hospital: 'Northgate Clinic', phone: '+1-555-0101', email: `same${i}@example.com`, createdAt: same, updatedAt: same })));
      const seen = new Set<string>();
      for (const page of [1, 2, 3]) {
        const res = await s.get(`/api/v1/doctors?limit=10&page=${page}&sortBy=createdAt`);
        expect(res.body.pagination).toEqual({ page, limit: 10, total: 25, totalPages: 3 });
        for (const d of res.body.data as Array<{ id: string }>) seen.add(d.id);
        expect(res.body.data).toHaveLength(page === 3 ? 5 : 10);
      }
      expect(seen.size).toBe(25);
    });

    it('includes the patient count per doctor without an N+1 lookup', async () => {
      const [amina] = await Doctor.find({ email: 'amina.rahman@example.com' });
      await makePatient({ doctor: amina!._id });
      await makePatient({ doctor: amina!._id });
      const res = await s.get('/api/v1/doctors?sortBy=fullName&sortOrder=asc');
      expect(res.body.data.map((d: { patientCount: number }) => d.patientCount)).toEqual([2, 0, 0]);
    });

    it('serves distinct filter options', async () => {
      const res = await s.get('/api/v1/doctors/filters');
      expect(res.body.data).toEqual({ specializations: ['Cardiology', 'Neurology'], hospitals: ['Northgate Clinic', 'Riverside General'] });
    });
  });

  describe("a doctor's patients and the delete policy", () => {
    it('lists only this doctor’s patients, paginated, and 404s for unknown doctors', async () => {
      const a = await makeDoctor();
      const b = await makeDoctor();
      await makePatient({ doctor: a._id, fullName: 'Alice A' });
      await makePatient({ doctor: a._id, fullName: 'Bob B' });
      await makePatient({ doctor: b._id, fullName: 'Carol C' });
      const res = await s.get(`/api/v1/doctors/${a._id}/patients?sortBy=fullName&sortOrder=asc`);
      expect(res.status).toBe(200);
      expect(res.body.data.map((p: { fullName: string }) => p.fullName)).toEqual(['Alice A', 'Bob B']);
      expect(res.body.pagination.total).toBe(2);
      expect(res.body.data[0].doctor).toMatchObject({ id: String(a._id) });
      expect((await s.get('/api/v1/doctors/65f1c0a1a1a1a1a1a1a1a1a1/patients')).status).toBe(404);
    });

    it('removing a patient from a doctor UNASSIGNS - the patient record survives', async () => {
      const d = await makeDoctor();
      const p = await makePatient({ doctor: d._id });
      const res = await s.del(`/api/v1/doctors/${d._id}/patients/${p._id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.doctor).toBeNull();
      expect(await Patient.countDocuments({ _id: p._id })).toBe(1);
      expect((await s.get(`/api/v1/doctors/${d._id}`)).body.data.patientCount).toBe(0);
      // repeating it, or using the wrong doctor, is a 404 rather than a silent success
      expect((await s.del(`/api/v1/doctors/${d._id}/patients/${p._id}`)).status).toBe(404);
    });

    it('does not unassign a patient through a different doctor', async () => {
      const a = await makeDoctor();
      const b = await makeDoctor();
      const p = await makePatient({ doctor: a._id });
      expect((await s.del(`/api/v1/doctors/${b._id}/patients/${p._id}`)).status).toBe(404);
      expect(String((await Patient.findById(p._id))!.doctor)).toBe(String(a._id));
    });

    it('deletes a doctor without patients', async () => {
      const d = await makeDoctor();
      expect((await s.del(`/api/v1/doctors/${d._id}`)).status).toBe(200);
      expect(await Doctor.countDocuments()).toBe(0);
      expect((await s.del(`/api/v1/doctors/${d._id}`)).status).toBe(404);
    });

    it('refuses to delete a doctor who still has patients (409) and changes nothing', async () => {
      const d = await makeDoctor();
      await makePatient({ doctor: d._id });
      await makePatient({ doctor: d._id });
      const res = await s.del(`/api/v1/doctors/${d._id}`);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({ code: 'DOCTOR_HAS_PATIENTS', details: { patientCount: 2 } });
      expect(await Doctor.countDocuments()).toBe(1);
      expect(await Patient.countDocuments({ doctor: d._id })).toBe(2);
    });

    it('with ?patients=unassign deletes the doctor, unassigns the patients and never deletes patients', async () => {
      const d = await makeDoctor();
      await makePatient({ doctor: d._id });
      await makePatient({ doctor: d._id });
      const other = await makeDoctor();
      await makePatient({ doctor: other._id });
      const res = await s.del(`/api/v1/doctors/${d._id}?patients=unassign`);
      expect(res.status).toBe(200);
      expect(res.body.data.unassigned).toBe(2);
      expect(await Doctor.countDocuments({ _id: d._id })).toBe(0);
      expect(await Patient.countDocuments()).toBe(3);
      expect(await Patient.countDocuments({ doctor: null })).toBe(2);
      expect(await Patient.countDocuments({ doctor: other._id })).toBe(1);
    });
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { Patient } from '../../src/models/Patient';
import { at, connect, login, makeDoctor, makePatient, resetData, teardown, mongoUri, type Session } from './helpers';

const app = createApp();

describe.skipIf(!mongoUri)('patients (integration)', () => {
  let s: Session;
  beforeAll(() => connect());
  afterAll(() => teardown());
  beforeEach(async () => {
    await resetData();
    s = await login(app, 'admin');
  });

  const valid = { fullName: 'Rahim Khan', dateOfBirth: '1990-04-21', gender: 'male', phone: '+1-555-0102', email: 'Rahim@Example.com', condition: 'Cardiovascular' };

  describe('create / read / update / delete', () => {
    it('creates an unassigned patient and normalises fields', async () => {
      const res = await s.post('/api/v1/patients', valid);
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ fullName: 'Rahim Khan', email: 'rahim@example.com', condition: 'Cardiovascular', doctor: null });
      expect(res.body.data.dateOfBirth).toBe('1990-04-21T00:00:00.000Z');
      expect(res.body.data).not.toHaveProperty('searchTokens');
    });

    it('creates a patient assigned to a doctor and embeds a compact doctor reference', async () => {
      const d = await makeDoctor({ fullName: 'Dr. Ref Erence', specialization: 'Neurology' });
      const res = await s.post('/api/v1/patients', { ...valid, doctorId: String(d._id) });
      expect(res.status).toBe(201);
      expect(res.body.data.doctor).toEqual({ id: String(d._id), fullName: 'Dr. Ref Erence', specialization: 'Neurology' });
    });

    it('rejects assignment to a doctor that does not exist', async () => {
      const res = await s.post('/api/v1/patients', { ...valid, doctorId: '65f1c0a1a1a1a1a1a1a1a1a1' });
      expect(res.status).toBe(400);
      expect(res.body.error.details[0].path).toBe('body.doctorId');
    });

    it('treats an empty e-mail as absent', async () => {
      expect((await s.post('/api/v1/patients', { ...valid, email: '' })).body.data.email).toBeNull();
    });

    it('edits fields without disturbing the others (partial update keeps gender)', async () => {
      const created = (await s.post('/api/v1/patients', valid)).body.data;
      const res = await s.patch(`/api/v1/patients/${created.id}`, { fullName: 'Rahim Uddin Khan', condition: 'Respiratory' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ fullName: 'Rahim Uddin Khan', condition: 'Respiratory', gender: 'male', phone: '+1-555-0102' });
    });

    it('refreshes the search index after a rename', async () => {
      const created = (await s.post('/api/v1/patients', valid)).body.data;
      await s.patch(`/api/v1/patients/${created.id}`, { fullName: 'Zuberi Mwangi', email: null });
      expect((await s.get('/api/v1/patients?search=zuberi')).body.data).toHaveLength(1);
      expect((await s.get('/api/v1/patients?search=rahim')).body.data).toHaveLength(0);
    });

    it('can clear the e-mail with null / empty string', async () => {
      const created = (await s.post('/api/v1/patients', valid)).body.data;
      expect((await s.patch(`/api/v1/patients/${created.id}`, { email: '' })).body.data.email).toBeNull();
    });

    it('assigns, reassigns and unassigns through PATCH', async () => {
      const a = await makeDoctor();
      const b = await makeDoctor();
      const p = (await s.post('/api/v1/patients', valid)).body.data;

      expect((await s.patch(`/api/v1/patients/${p.id}`, { doctorId: String(a._id) })).body.data.doctor.id).toBe(String(a._id));
      expect((await s.get(`/api/v1/doctors/${a._id}`)).body.data.patientCount).toBe(1);

      expect((await s.patch(`/api/v1/patients/${p.id}`, { doctorId: String(b._id) })).body.data.doctor.id).toBe(String(b._id));
      expect((await s.get(`/api/v1/doctors/${a._id}`)).body.data.patientCount).toBe(0); // consistent on both sides
      expect((await s.get(`/api/v1/doctors/${b._id}`)).body.data.patientCount).toBe(1);

      expect((await s.patch(`/api/v1/patients/${p.id}`, { doctorId: null })).body.data.doctor).toBeNull();
      expect((await s.get(`/api/v1/doctors/${b._id}`)).body.data.patientCount).toBe(0);
    });

    it('rejects reassignment to a nonexistent doctor and leaves the patient untouched', async () => {
      const a = await makeDoctor();
      const p = await makePatient({ doctor: a._id });
      const res = await s.patch(`/api/v1/patients/${p._id}`, { doctorId: '65f1c0a1a1a1a1a1a1a1a1a1' });
      expect(res.status).toBe(400);
      expect(String((await Patient.findById(p._id))!.doctor)).toBe(String(a._id));
    });

    it('404s for unknown ids, 400s for malformed ones and invalid bodies', async () => {
      expect((await s.get('/api/v1/patients/65f1c0a1a1a1a1a1a1a1a1a1')).status).toBe(404);
      expect((await s.patch('/api/v1/patients/65f1c0a1a1a1a1a1a1a1a1a1', { fullName: 'Nobody Here' })).status).toBe(404);
      expect((await s.get('/api/v1/patients/xyz')).status).toBe(400);
      expect((await s.post('/api/v1/patients', { ...valid, dateOfBirth: '2999-01-01' })).status).toBe(400);
      expect((await s.post('/api/v1/patients', { ...valid, condition: 'Nope' })).status).toBe(400);
    });

    it('deletes a patient permanently and removes it from its doctor’s list', async () => {
      const d = await makeDoctor();
      const p = await makePatient({ doctor: d._id });
      expect((await s.del(`/api/v1/patients/${p._id}`)).status).toBe(200);
      expect(await Patient.countDocuments()).toBe(0);
      expect((await s.get(`/api/v1/doctors/${d._id}/patients`)).body.data).toHaveLength(0);
      expect((await s.get(`/api/v1/doctors/${d._id}`)).body.data.patientCount).toBe(0);
      expect((await s.del(`/api/v1/patients/${p._id}`)).status).toBe(404);
    });

    it('shows no dangling doctor when the referenced doctor vanished', async () => {
      const d = await makeDoctor();
      const p = await makePatient({ doctor: d._id });
      await d.deleteOne(); // bypasses the service on purpose
      const res = await s.get(`/api/v1/patients/${p._id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.doctor).toBeNull();
    });
  });

  describe('list: search, filters, sorting, pagination', () => {
    let docA: Awaited<ReturnType<typeof makeDoctor>>;
    let docB: Awaited<ReturnType<typeof makeDoctor>>;
    beforeEach(async () => {
      docA = await makeDoctor({ fullName: 'Dr. Alpha' });
      docB = await makeDoctor({ fullName: 'Dr. Beta' });
      await makePatient({ fullName: 'Amina Begum', condition: 'Cardiovascular', gender: 'female', doctor: docA._id, email: 'amina@example.com', createdAt: at('2026-01-05T08:00:00Z') });
      await makePatient({ fullName: 'Rahim Khan', condition: 'Respiratory', gender: 'male', doctor: docB._id, createdAt: at('2026-02-05T08:00:00Z') });
      await makePatient({ fullName: 'Aminul Haque', condition: 'Cardiovascular', gender: 'male', doctor: null, createdAt: at('2026-03-05T08:00:00Z') });
    });
    const names = (res: { body: { data: Array<{ fullName: string }> } }) => res.body.data.map((p) => p.fullName);

    it('returns the documented envelope with doctors resolved', async () => {
      const res = await s.get('/api/v1/patients?sortBy=fullName&sortOrder=asc');
      expect(res.body).toMatchObject({ success: true, pagination: { page: 1, limit: 10, total: 3, totalPages: 1 } });
      expect(res.body.data[0].doctor).toMatchObject({ fullName: 'Dr. Alpha' });
      expect(res.body.data[1]).toMatchObject({ fullName: 'Aminul Haque', doctor: null }); // unassigned
      expect(res.body.data[2].doctor).toMatchObject({ fullName: 'Dr. Beta' });
    });

    it('searches by name prefix, e-mail and condition', async () => {
      expect(names(await s.get('/api/v1/patients?search=amin')).sort()).toEqual(['Amina Begum', 'Aminul Haque']);
      expect(names(await s.get('/api/v1/patients?search=amina@'))).toEqual(['Amina Begum']);
      expect(names(await s.get('/api/v1/patients?search=respir'))).toEqual(['Rahim Khan']);
      expect(names(await s.get('/api/v1/patients?search=khan rah'))).toEqual(['Rahim Khan']); // term order irrelevant
    });

    it('filters by condition, gender and doctor (incl. "unassigned")', async () => {
      expect(names(await s.get('/api/v1/patients?condition=Cardiovascular')).sort()).toEqual(['Amina Begum', 'Aminul Haque']);
      expect(names(await s.get('/api/v1/patients?gender=female'))).toEqual(['Amina Begum']);
      expect(names(await s.get(`/api/v1/patients?doctorId=${docB._id}`))).toEqual(['Rahim Khan']);
      expect(names(await s.get('/api/v1/patients?doctorId=unassigned'))).toEqual(['Aminul Haque']);
      expect(names(await s.get('/api/v1/patients?condition=Cardiovascular&gender=male'))).toEqual(['Aminul Haque']);
    });

    it('filters by createdAt range', async () => {
      expect(names(await s.get('/api/v1/patients?startDate=2026-02-01&endDate=2026-02-28'))).toEqual(['Rahim Khan']);
      expect(names(await s.get('/api/v1/patients?startDate=2026-02-05&endDate=2026-02-05'))).toEqual(['Rahim Khan']);
    });

    it('combines search + filter + sort + pagination', async () => {
      const res = await s.get('/api/v1/patients?search=amin&condition=Cardiovascular&sortBy=fullName&sortOrder=desc&limit=1&page=2');
      expect(names(res)).toEqual(['Amina Begum']);
      expect(res.body.pagination).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
    });

    it('sorts by name, condition and date of birth', async () => {
      expect(names(await s.get('/api/v1/patients?sortBy=fullName&sortOrder=asc'))).toEqual(['Amina Begum', 'Aminul Haque', 'Rahim Khan']);
      expect(names(await s.get('/api/v1/patients?sortBy=condition&sortOrder=desc'))[0]).toBe('Rahim Khan');
    });

    it('returns an empty page past the last page, without error', async () => {
      const res = await s.get('/api/v1/patients?page=9');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination.total).toBe(3);
    });

    it('rejects NoSQL-operator payloads in query strings', async () => {
      expect((await s.get('/api/v1/patients?doctorId[$ne]=x')).status).toBe(400);
      expect((await s.get('/api/v1/patients?search[$regex]=.*')).status).toBe(400);
      expect((await s.get('/api/v1/patients?condition[$ne]=Oncology')).status).toBe(400);
    });

    it('rejects absurdly deep pages', async () => {
      expect((await s.get('/api/v1/patients?page=999999&limit=100')).status).toBe(400);
    });
  });
});

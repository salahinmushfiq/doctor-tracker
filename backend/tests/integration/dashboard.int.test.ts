import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { at, connect, login, makeDoctor, makePatient, resetData, teardown, mongoUri, type Session } from './helpers';

const app = createApp();

describe.skipIf(!mongoUri)('dashboard aggregations (integration)', () => {
  let s: Session;
  beforeAll(() => connect());
  afterAll(() => teardown());
  beforeEach(async () => {
    await resetData();
    s = await login(app, 'admin');
  });

  it('handles an empty database without errors or misleading numbers', async () => {
    const [ov, tr, ds, cd] = await Promise.all([
      s.get('/api/v1/dashboard/overview'),
      s.get('/api/v1/dashboard/trends'),
      s.get('/api/v1/dashboard/doctor-statistics'),
      s.get('/api/v1/dashboard/condition-distribution'),
    ]);
    expect(ov.body.data).toMatchObject({ totals: { doctors: 0, patients: 0, unassignedPatients: 0 }, inRange: { doctors: 0, patients: 0 }, averagePatientsPerDoctor: 0 });
    expect(tr.body.data).toMatchObject({ series: [], hasData: false });
    expect(ds.body.data).toMatchObject({ topDoctors: [], specializations: [] });
    expect(cd.body.data).toMatchObject({ total: 0, items: [] });
  });

  describe('with a known dataset', () => {
    beforeEach(async () => {
      const cardio = await makeDoctor({ fullName: 'Dr. Cardio One', specialization: 'Cardiology', createdAt: at('2026-01-02T10:00:00Z') });
      const cardio2 = await makeDoctor({ fullName: 'Dr. Cardio Two', specialization: 'Cardiology', createdAt: at('2026-02-03T10:00:00Z') });
      const neuro = await makeDoctor({ fullName: 'Dr. Neuro', specialization: 'Neurology', createdAt: at('2026-03-04T10:00:00Z') });
      // cardio: 3 patients, cardio2: 1, neuro: 2, 1 unassigned  => 7 patients
      await makePatient({ condition: 'Cardiovascular', doctor: cardio._id, createdAt: at('2026-01-05T10:00:00Z') });
      await makePatient({ condition: 'Cardiovascular', doctor: cardio._id, createdAt: at('2026-01-06T10:00:00Z') });
      await makePatient({ condition: 'Respiratory', doctor: cardio._id, createdAt: at('2026-02-10T10:00:00Z') });
      await makePatient({ condition: 'Cardiovascular', doctor: cardio2._id, createdAt: at('2026-02-11T10:00:00Z') });
      await makePatient({ condition: 'Neurological', doctor: neuro._id, createdAt: at('2026-03-06T10:00:00Z') });
      await makePatient({ condition: 'Neurological', doctor: neuro._id, createdAt: at('2026-03-20T10:00:00Z') });
      await makePatient({ condition: 'Other', doctor: null, createdAt: at('2026-03-21T10:00:00Z') });
    });

    it('overview: lifetime totals and in-window counts', async () => {
      const all = (await s.get('/api/v1/dashboard/overview')).body.data;
      expect(all.totals).toEqual({ doctors: 3, patients: 7, unassignedPatients: 1 });
      expect(all.inRange).toEqual({ doctors: 3, patients: 7 });
      expect(all.averagePatientsPerDoctor).toBe(2); // 6 assigned / 3 doctors

      const feb = (await s.get('/api/v1/dashboard/overview?startDate=2026-02-01&endDate=2026-02-28')).body.data;
      expect(feb.totals).toEqual({ doctors: 3, patients: 7, unassignedPatients: 1 }); // totals ignore the window
      expect(feb.inRange).toEqual({ doctors: 1, patients: 2 });
    });

    it('condition distribution: counts, percentages and ordering', async () => {
      const { total, items } = (await s.get('/api/v1/dashboard/condition-distribution')).body.data;
      expect(total).toBe(7);
      expect(items.map((i: { condition: string; count: number }) => [i.condition, i.count])).toEqual([
        ['Cardiovascular', 3],
        ['Neurological', 2],
        ['Other', 1],
        ['Respiratory', 1],
      ]);
      expect(items[0].percentage).toBe(42.9);
      expect(items.reduce((a: number, i: { count: number }) => a + i.count, 0)).toBe(total);
    });

    it('condition distribution honours the date window', async () => {
      const { total, items } = (await s.get('/api/v1/dashboard/condition-distribution?startDate=2026-03-01&endDate=2026-03-31')).body.data;
      expect(total).toBe(3);
      expect(items.map((i: { condition: string }) => i.condition).sort()).toEqual(['Neurological', 'Other']);
    });

    it('top doctors: ranked by patients, ties broken deterministically, unassigned excluded', async () => {
      const { topDoctors } = (await s.get('/api/v1/dashboard/doctor-statistics')).body.data;
      expect(topDoctors.map((d: { fullName: string; patients: number }) => [d.fullName, d.patients])).toEqual([
        ['Dr. Cardio One', 3],
        ['Dr. Neuro', 2],
        ['Dr. Cardio Two', 1],
      ]);
      expect(topDoctors[0]).toMatchObject({ specialization: 'Cardiology' });
      expect((await s.get('/api/v1/dashboard/doctor-statistics?limit=1')).body.data.topDoctors).toHaveLength(1);
    });

    it('specialization roll-up: doctors vs patients', async () => {
      const { specializations } = (await s.get('/api/v1/dashboard/doctor-statistics')).body.data;
      const byName = Object.fromEntries(specializations.map((x: { specialization: string; doctors: number; patients: number }) => [x.specialization, x]));
      expect(byName.Cardiology).toMatchObject({ doctors: 2, patients: 4 });
      expect(byName.Neurology).toMatchObject({ doctors: 1, patients: 2 });
    });

    it('trends: zero-filled, monthly for a long window, and totals reconcile with the overview', async () => {
      const res = (await s.get('/api/v1/dashboard/trends?startDate=2025-11-01&endDate=2026-03-31&interval=month')).body.data;
      expect(res.interval).toBe('month');
      expect(res.hasData).toBe(true);
      expect(res.series.map((p: { bucket: string }) => p.bucket)).toEqual(['2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01', '2026-03-01']);
      expect(res.series.map((p: { patients: number }) => p.patients)).toEqual([0, 0, 2, 2, 3]);
      expect(res.series.map((p: { doctors: number }) => p.doctors)).toEqual([0, 0, 1, 1, 1]);
      const sum = (k: 'doctors' | 'patients') => res.series.reduce((a: number, p: Record<string, number>) => a + (p[k] as number), 0);
      expect(sum('patients')).toBe(7);
      expect(sum('doctors')).toBe(3);
    });

    it('trends: daily buckets for a short window include empty days as zeros', async () => {
      const res = (await s.get('/api/v1/dashboard/trends?startDate=2026-01-04&endDate=2026-01-08')).body.data;
      expect(res.interval).toBe('day');
      expect(res.series).toEqual([
        { bucket: '2026-01-04', doctors: 0, patients: 0 },
        { bucket: '2026-01-05', doctors: 0, patients: 1 },
        { bucket: '2026-01-06', doctors: 0, patients: 1 },
        { bucket: '2026-01-07', doctors: 0, patients: 0 },
        { bucket: '2026-01-08', doctors: 0, patients: 0 },
      ]);
    });

    it('trends: "all time" starts at the oldest record', async () => {
      const res = (await s.get('/api/v1/dashboard/trends?interval=month')).body.data;
      expect(res.series[0].bucket).toBe('2026-01-01');
    });

    it('trends: a window with no records reports hasData=false so the UI shows an empty state', async () => {
      const res = (await s.get('/api/v1/dashboard/trends?startDate=2020-01-01&endDate=2020-01-10')).body.data;
      expect(res.hasData).toBe(false);
      expect(res.series.every((p: { doctors: number; patients: number }) => p.doctors === 0 && p.patients === 0)).toBe(true);
    });

    it('recent activity lists the newest records first', async () => {
      const { doctors, patients } = (await s.get('/api/v1/dashboard/recent-activity')).body.data;
      expect(doctors[0].fullName).toBe('Dr. Neuro');
      expect(patients).toHaveLength(5);
      expect(new Date(patients[0].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(patients[1].createdAt).getTime());
    });

    it('stays consistent after mutations (no stale counters to drift)', async () => {
      const before = (await s.get('/api/v1/dashboard/overview')).body.data.totals.patients;
      const created = await s.post('/api/v1/patients', { fullName: 'New Person', dateOfBirth: '1980-01-01', phone: '+1-555-0103', condition: 'Oncology' });
      expect((await s.get('/api/v1/dashboard/overview')).body.data.totals.patients).toBe(before + 1);
      await s.del(`/api/v1/patients/${created.body.data.id}`);
      expect((await s.get('/api/v1/dashboard/overview')).body.data.totals.patients).toBe(before);
    });
  });
});

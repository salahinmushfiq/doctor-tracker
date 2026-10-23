import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { buildDoctorFilter, buildDoctorPatientsFilter, buildPatientFilter } from '../../src/services/queryBuilders';

const none = { search: undefined, specialization: undefined, hospital: undefined, startDate: undefined, endDate: undefined };
const pNone = { search: undefined, condition: undefined, gender: undefined, startDate: undefined, endDate: undefined };

describe('buildDoctorFilter', () => {
  it('is empty without criteria', () => {
    expect(buildDoctorFilter(none)).toEqual({});
  });

  it('combines equality filters, createdAt range and search', () => {
    const f = buildDoctorFilter({ ...none, specialization: 'Cardiology', hospital: 'Northgate Clinic', startDate: '2026-01-01', endDate: '2026-01-31', search: 'amina' });
    expect(f.specialization).toBe('Cardiology');
    expect(f.hospital).toBe('Northgate Clinic');
    expect(f.createdAt).toEqual({ $gte: new Date('2026-01-01T00:00:00.000Z'), $lt: new Date('2026-02-01T00:00:00.000Z') });
    expect(f.$and).toEqual([{ searchTokens: { $regex: '^amina' } }]);
  });

  it('never lets user text become an operator key', () => {
    const f = buildDoctorFilter({ ...none, specialization: '$where', search: '{"$ne":null}' });
    const keys = JSON.stringify(Object.keys(f));
    expect(keys).not.toContain('$where');
    expect(f.specialization).toBe('$where'); // inert: it is only a *value* compared with equality
  });
});

describe('buildPatientFilter', () => {
  const id = new Types.ObjectId().toHexString();

  it('casts doctorId to ObjectId (aggregations and filters never receive raw strings)', () => {
    const f = buildPatientFilter({ ...pNone, doctorId: id });
    expect(f.doctor).toBeInstanceOf(Types.ObjectId);
    expect(String(f.doctor)).toBe(id);
  });

  it('maps "unassigned" to a null match', () => {
    expect(buildPatientFilter({ ...pNone, doctorId: 'unassigned' })).toEqual({ doctor: null });
  });

  it('applies condition / gender / dates', () => {
    const f = buildPatientFilter({ ...pNone, condition: 'Oncology', gender: 'female', startDate: '2026-05-01' });
    expect(f).toMatchObject({ condition: 'Oncology', gender: 'female', createdAt: { $gte: new Date('2026-05-01T00:00:00.000Z') } });
  });

  it('doctor-scoped filter always pins the doctor', () => {
    const f = buildDoctorPatientsFilter(id, { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc', search: undefined, condition: undefined, startDate: undefined, endDate: undefined });
    expect(String(f.doctor)).toBe(id);
  });
});

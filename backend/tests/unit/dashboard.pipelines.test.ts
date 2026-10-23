import { describe, expect, it } from 'vitest';
import {
  conditionDistributionPipeline,
  patientsBySpecializationPipeline,
  specializationDistributionPipeline,
  topDoctorsPipeline,
  trendPipeline,
} from '../../src/services/dashboard.pipelines';
import { buildDateRange } from '../../src/utils/dates';

const range = buildDateRange('2026-01-01', '2026-03-31');
const stageNames = (p: object[]) => p.map((s) => Object.keys(s)[0]);

describe('dashboard pipelines', () => {
  it('start with $match on createdAt so an index can be used', () => {
    for (const p of [
      conditionDistributionPipeline(range),
      specializationDistributionPipeline(range),
      topDoctorsPipeline(range, 10, 'doctors'),
      patientsBySpecializationPipeline(range, 'doctors'),
      trendPipeline(range, 'week'),
    ]) {
      expect(Object.keys(p[0]!)[0]).toBe('$match');
      expect(JSON.stringify(p[0])).toContain('createdAt');
    }
  });

  it('omit $match entirely for "all time" instead of matching everything', () => {
    expect(stageNames(conditionDistributionPipeline({}))).toEqual(['$group', '$sort']);
  });

  it('top-doctors limits BEFORE joining so $lookup touches at most N doctors', () => {
    const names = stageNames(topDoctorsPipeline(range, 5, 'doctors'));
    expect(names.indexOf('$limit')).toBeGreaterThan(-1);
    expect(names.indexOf('$limit')).toBeLessThan(names.indexOf('$lookup'));
    expect(JSON.stringify(topDoctorsPipeline(range, 5, 'doctors'))).toContain('"$limit":5');
  });

  it('specialization roll-up groups by doctor first, then joins once per distinct doctor', () => {
    const names = stageNames(patientsBySpecializationPipeline(range, 'doctors'));
    expect(names.slice(1, 3)).toEqual(['$group', '$lookup']);
  });

  it('trend buckets use $dateTrunc in UTC with Monday weeks', () => {
    const json = JSON.stringify(trendPipeline(range, 'week'));
    expect(json).toContain('$dateTrunc');
    expect(json).toContain('"timezone":"UTC"');
    expect(json).toContain('"startOfWeek":"monday"');
  });

  it('never uses $facet (sub-pipelines cannot use indexes) or $where / $function', () => {
    const all = JSON.stringify([
      conditionDistributionPipeline(range),
      topDoctorsPipeline(range, 5, 'doctors'),
      trendPipeline(range, 'day'),
    ]);
    expect(all).not.toMatch(/\$facet|\$where|\$function|\$accumulator/);
  });

  it('sorts deterministically (ties broken by _id)', () => {
    expect(JSON.stringify(topDoctorsPipeline(range, 5, 'doctors'))).toContain('"$sort":{"patients":-1,"_id":1}');
  });
});

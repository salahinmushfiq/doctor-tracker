import type { PipelineStage } from 'mongoose';
import { createdAtFilter, type DateRange } from '../utils/dates';
import type { TrendInterval } from '../validators/dashboard';

/**
 * Aggregation pipeline builders (pure => unit-testable, and reused by scripts/explain.ts so the
 * plans we inspect are exactly the pipelines the API runs).
 *
 * Every pipeline starts with a $match so the planner can use an index, and groups on the smallest
 * set of fields. $facet is deliberately NOT used for index-backed counts: sub-pipelines inside
 * $facet cannot use indexes, so we run several parallel indexed counts instead and reserve
 * aggregation for real grouping work.
 */

const match = (range: DateRange, extra: Record<string, unknown> = {}): PipelineStage[] => {
  const m = { ...createdAtFilter(range), ...extra };
  return Object.keys(m).length > 0 ? [{ $match: m }] : [];
};

/** Patients per condition category within the range. */
export function conditionDistributionPipeline(range: DateRange): PipelineStage[] {
  return [
    ...match(range),
    { $group: { _id: '$condition', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ];
}

/** Doctors per specialization within the range. */
export function specializationDistributionPipeline(range: DateRange): PipelineStage[] {
  return [
    ...match(range),
    { $group: { _id: '$specialization', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ];
}

/**
 * Top doctors by number of patients (created in range).
 * $limit runs BEFORE $lookup so the join touches at most `limit` doctor documents (_id index).
 */
export function topDoctorsPipeline(range: DateRange, limit: number, doctorsCollection: string): PipelineStage[] {
  return [
    ...match(range, { doctor: { $ne: null } }),
    { $group: { _id: '$doctor', patients: { $sum: 1 } } },
    { $sort: { patients: -1, _id: 1 } },
    { $limit: limit },
    {
      $lookup: {
        from: doctorsCollection,
        localField: '_id',
        foreignField: '_id',
        pipeline: [{ $project: { fullName: 1, specialization: 1, hospital: 1 } }],
        as: 'doctor',
      },
    },
    { $unwind: '$doctor' },
    {
      $project: {
        _id: 0,
        doctorId: '$_id',
        fullName: '$doctor.fullName',
        specialization: '$doctor.specialization',
        hospital: '$doctor.hospital',
        patients: 1,
      },
    },
  ];
}

/**
 * Patients (created in range) rolled up by their doctor's specialization.
 * Group by doctor first (index { doctor, createdAt }), then join once per DISTINCT doctor - not per patient.
 */
export function patientsBySpecializationPipeline(range: DateRange, doctorsCollection: string): PipelineStage[] {
  return [
    ...match(range, { doctor: { $ne: null } }),
    { $group: { _id: '$doctor', n: { $sum: 1 } } },
    {
      $lookup: {
        from: doctorsCollection,
        localField: '_id',
        foreignField: '_id',
        pipeline: [{ $project: { specialization: 1 } }],
        as: 'doctor',
      },
    },
    { $unwind: '$doctor' },
    { $group: { _id: '$doctor.specialization', patients: { $sum: '$n' } } },
    { $sort: { patients: -1, _id: 1 } },
  ];
}

/** New records per time bucket (UTC, weeks start Monday). */
export function trendPipeline(range: DateRange, unit: TrendInterval): PipelineStage[] {
  return [
    ...match(range),
    {
      $group: {
        _id: { $dateTrunc: { date: '$createdAt', unit, timezone: 'UTC', startOfWeek: 'monday' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ];
}

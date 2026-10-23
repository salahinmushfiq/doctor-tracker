import { Doctor } from '../models/Doctor';
import { Patient } from '../models/Patient';
import { buildDateRange, createdAtFilter, startOfUtcDay, addDays, type DateRange } from '../utils/dates';
import { buildSeries, chooseInterval, type Point } from '../utils/timeSeries';
import type { DashboardQuery } from '../validators/dashboard';
import { attachDoctors } from './patient.service';
import {
  conditionDistributionPipeline,
  patientsBySpecializationPipeline,
  specializationDistributionPipeline,
  topDoctorsPipeline,
  trendPipeline,
} from './dashboard.pipelines';
import { toDoctorDTO } from '../utils/serialize';

/**
 * Date-range contract for every dashboard endpoint (also documented in docs/architecture.md):
 *   - the window is applied to `createdAt` (record creation), UTC, half-open [from, to);
 *   - no dates supplied => all time;
 *   - the two "total" figures are lifetime totals; everything else honours the window.
 */
export function resolveRange(q: Pick<DashboardQuery, 'startDate' | 'endDate'>): DateRange {
  return buildDateRange(q.startDate, q.endDate);
}

const rangeJson = (r: DateRange) => ({ from: r.from?.toISOString() ?? null, to: r.to?.toISOString() ?? null });

export async function getOverview(q: DashboardQuery) {
  const range = resolveRange(q);
  const inRange = createdAtFilter(range);
  // Five cheap, parallel, index/metadata-backed counts (see dashboard.pipelines.ts for why not $facet).
  const [totalDoctors, totalPatients, newDoctors, newPatients, unassignedPatients] = await Promise.all([
    Doctor.estimatedDocumentCount(),
    Patient.estimatedDocumentCount(),
    Doctor.countDocuments(inRange),
    Patient.countDocuments(inRange),
    Patient.countDocuments({ doctor: null }),
  ]);
  const assigned = Math.max(0, totalPatients - unassignedPatients);
  return {
    range: rangeJson(range),
    totals: { doctors: totalDoctors, patients: totalPatients, unassignedPatients },
    inRange: { doctors: newDoctors, patients: newPatients },
    averagePatientsPerDoctor: totalDoctors === 0 ? 0 : Math.round((assigned / totalDoctors) * 10) / 10,
  };
}

async function earliest(model: typeof Doctor | typeof Patient): Promise<Date | null> {
  const row = await (model as typeof Doctor).findOne().sort({ createdAt: 1 }).select('createdAt').lean();
  return row?.createdAt ?? null;
}

export async function getTrends(q: DashboardQuery, now: Date = new Date()) {
  const range = resolveRange(q);
  const to = range.to ?? addDays(startOfUtcDay(now), 1);

  let from = range.from;
  if (!from) {
    // "All time": start at the oldest record so the axis is not padded with years of nothing.
    const [d, p] = await Promise.all([earliest(Doctor), earliest(Patient)]);
    const dates = [d, p].filter((x): x is Date => x !== null);
    if (dates.length === 0) return { range: rangeJson(range), interval: 'day' as const, series: [] as Point[], hasData: false };
    from = new Date(Math.min(...dates.map((x) => x.getTime())));
  }
  if (from >= to) return { range: rangeJson(range), interval: 'day' as const, series: [] as Point[], hasData: false };

  const interval = chooseInterval(from, to, q.interval);
  const bounded: DateRange = { from, to };
  const [doctorRows, patientRows] = await Promise.all([
    Doctor.aggregate<{ _id: Date; count: number }>(trendPipeline(bounded, interval)),
    Patient.aggregate<{ _id: Date; count: number }>(trendPipeline(bounded, interval)),
  ]);
  const series = buildSeries({ from, to }, interval, doctorRows, patientRows);
  const hasData = series.some((p) => p.doctors > 0 || p.patients > 0);
  return { range: rangeJson(range), interval, series, hasData };
}

export async function getDoctorStatistics(q: DashboardQuery) {
  const range = resolveRange(q);
  const doctorsCollection = Doctor.collection.name;
  const [top, specDoctors, specPatients] = await Promise.all([
    Patient.aggregate<{ doctorId: unknown; fullName: string; specialization: string; hospital: string; patients: number }>(
      topDoctorsPipeline(range, q.limit, doctorsCollection),
    ),
    Doctor.aggregate<{ _id: string; count: number }>(specializationDistributionPipeline(range)),
    Patient.aggregate<{ _id: string; patients: number }>(patientsBySpecializationPipeline(range, doctorsCollection)),
  ]);

  const bySpec = new Map<string, { specialization: string; doctors: number; patients: number }>();
  for (const r of specDoctors) bySpec.set(r._id, { specialization: r._id, doctors: r.count, patients: 0 });
  for (const r of specPatients) {
    const row = bySpec.get(r._id) ?? { specialization: r._id, doctors: 0, patients: 0 };
    row.patients = r.patients;
    bySpec.set(r._id, row);
  }

  return {
    range: rangeJson(range),
    topDoctors: top.map((t) => ({ ...t, doctorId: String(t.doctorId) })),
    specializations: [...bySpec.values()].sort((a, b) => b.patients + b.doctors - (a.patients + a.doctors) || a.specialization.localeCompare(b.specialization)),
  };
}

export async function getConditionDistribution(q: DashboardQuery) {
  const range = resolveRange(q);
  const rows = await Patient.aggregate<{ _id: string; count: number }>(conditionDistributionPipeline(range));
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return {
    range: rangeJson(range),
    total,
    items: rows.map((r) => ({
      condition: r._id,
      count: r.count,
      percentage: total === 0 ? 0 : Math.round((r.count / total) * 1000) / 10,
    })),
  };
}

/** Most recently created records (independent of the date window - it is a "latest" feed). */
export async function getRecentActivity(limit = 5) {
  const [doctors, patients] = await Promise.all([
    Doctor.find().select('-__v').sort({ createdAt: -1, _id: -1 }).limit(limit).lean(),
    Patient.find().select('-__v').sort({ createdAt: -1, _id: -1 }).limit(limit).lean(),
  ]);
  return {
    doctors: doctors.map((d) => toDoctorDTO(d)),
    patients: await attachDoctors(patients as unknown as Parameters<typeof attachDoctors>[0]),
  };
}

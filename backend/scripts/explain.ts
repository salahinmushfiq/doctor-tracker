/**
 * Runs MongoDB explain('executionStats') for the representative queries and aggregations the API
 * executes, using the SAME filter / pipeline builders as the application, and prints a summary
 * table. Run it against a seeded database:
 *
 *   npm run seed:demo && npm run explain
 *   npm run explain -- --write ../docs/query-plans.md     # save the report
 *
 * The output is evidence, not an assertion: index usage depends on data volume and the planner
 * version, so re-run it after changing indexes or queries.
 */
import fs from 'node:fs';
import path from 'node:path';
import type mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/db';
import { Doctor } from '../src/models/Doctor';
import { Patient } from '../src/models/Patient';
import { buildDoctorFilter, buildPatientFilter } from '../src/services/queryBuilders';
import {
  conditionDistributionPipeline,
  topDoctorsPipeline,
  trendPipeline,
} from '../src/services/dashboard.pipelines';
import { buildDateRange } from '../src/utils/dates';
import { buildSort } from '../src/utils/pagination';
import { DOCTOR_SORT_MAP } from '../src/validators/doctor';
import { PATIENT_SORT_MAP } from '../src/validators/patient';

type Json = Record<string, unknown>;

function walk(node: unknown, visit: (o: Json) => void) {
  if (Array.isArray(node)) node.forEach((n) => walk(n, visit));
  else if (node && typeof node === 'object') {
    visit(node as Json);
    Object.values(node as Json).forEach((v) => walk(v, visit));
  }
}

function summarize(explain: unknown) {
  const stages: string[] = [];
  const indexes = new Set<string>();
  let stats: Json | undefined;
  let planSeen = false;
  walk(explain, (o) => {
    if (!stats && o.executionStats && typeof o.executionStats === 'object') stats = o.executionStats as Json;
    if (!planSeen && o.winningPlan) {
      planSeen = true;
      walk(o.winningPlan, (p) => {
        if (typeof p.stage === 'string') stages.push(p.stage);
        if (typeof p.indexName === 'string') indexes.add(p.indexName);
      });
    }
  });
  return {
    plan: stages.join(' > ') || '(see raw explain)',
    indexes: [...indexes].join(', ') || '-',
    keys: stats?.totalKeysExamined ?? '-',
    docs: stats?.totalDocsExamined ?? '-',
    returned: stats?.nReturned ?? '-',
    ms: stats?.executionTimeMillis ?? '-',
  };
}

async function main() {
  await connectDatabase();
  try {
    const sampleDoctor = await Doctor.findOne().select('_id specialization').lean();
    const sampleSearch = ((await Doctor.findOne().select('fullName').lean())?.fullName ?? 'dr').split(' ')[1] ?? 'dr';
    if (!sampleDoctor) throw new Error('No doctors found - run `npm run seed:demo` first.');

    const last90 = buildDateRange(new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10), undefined);
    const rows: Array<{ name: string; s: ReturnType<typeof summarize> }> = [];
    const find = async (name: string, model: typeof Doctor | typeof Patient, filter: Json, sort: Record<string, 1 | -1>) => {
      const ex = await (model as typeof Doctor).find(filter).sort(sort).limit(10).explain('executionStats');
      rows.push({ name, s: summarize(ex) });
    };
    const agg = async (name: string, model: typeof Doctor | typeof Patient, pipeline: mongoose.PipelineStage[]) => {
      const ex = await (model as typeof Patient).aggregate(pipeline).explain('executionStats');
      rows.push({ name, s: summarize(ex) });
    };

    const dSort = (by: keyof typeof DOCTOR_SORT_MAP, o: 'asc' | 'desc' = 'desc') => buildSort(by, o, DOCTOR_SORT_MAP);
    const pSort = (by: keyof typeof PATIENT_SORT_MAP, o: 'asc' | 'desc' = 'desc') => buildSort(by, o, PATIENT_SORT_MAP);
    const empty = { search: undefined, specialization: undefined, hospital: undefined, startDate: undefined, endDate: undefined };

    await find('doctors: default list (createdAt desc)', Doctor, buildDoctorFilter(empty), dSort('createdAt'));
    await find('doctors: sort by name', Doctor, buildDoctorFilter(empty), dSort('fullName', 'asc'));
    await find('doctors: filter specialization', Doctor, buildDoctorFilter({ ...empty, specialization: sampleDoctor.specialization }), dSort('createdAt'));
    await find('doctors: prefix search', Doctor, buildDoctorFilter({ ...empty, search: sampleSearch }), dSort('createdAt'));
    await find('doctors: createdAt range', Doctor, buildDoctorFilter({ ...empty, startDate: new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10) }), dSort('createdAt'));

    const pEmpty = { search: undefined, condition: undefined, gender: undefined, startDate: undefined, endDate: undefined };
    await find('patients: default list', Patient, buildPatientFilter(pEmpty), pSort('createdAt'));
    await find("patients: of one doctor", Patient, buildPatientFilter({ ...pEmpty, doctorId: String(sampleDoctor._id) }), pSort('createdAt'));
    await find('patients: unassigned', Patient, buildPatientFilter({ ...pEmpty, doctorId: 'unassigned' }), pSort('createdAt'));
    await find('patients: filter condition', Patient, buildPatientFilter({ ...pEmpty, condition: 'Cardiovascular' }), pSort('createdAt'));
    await find('patients: prefix search', Patient, buildPatientFilter({ ...pEmpty, search: sampleSearch }), pSort('createdAt'));
    await find('patients: sort by name', Patient, buildPatientFilter(pEmpty), pSort('fullName', 'asc'));

    await agg('agg: condition distribution (90d)', Patient, conditionDistributionPipeline(last90));
    await agg('agg: top doctors (90d)', Patient, topDoctorsPipeline(last90, 10, Doctor.collection.name));
    await agg('agg: patient trend by week (90d)', Patient, trendPipeline(last90, 'week'));

    const lines = [
      '# Query plans (generated by `npm run explain`)',
      '',
      `Generated: ${new Date().toISOString()} - doctors: ${await Doctor.estimatedDocumentCount()}, patients: ${await Patient.estimatedDocumentCount()}`,
      '',
      '| Query | Plan (winning stages) | Index | Keys | Docs | Returned | ms |',
      '|---|---|---|---|---|---|---|',
      ...rows.map((r) => `| ${r.name} | ${r.s.plan} | ${r.s.indexes} | ${r.s.keys} | ${r.s.docs} | ${r.s.returned} | ${r.s.ms} |`),
      '',
    ].join('\n');
    console.log(lines);

    const i = process.argv.indexOf('--write');
    if (i !== -1 && process.argv[i + 1]) {
      const out = path.resolve(process.cwd(), process.argv[i + 1] as string);
      fs.writeFileSync(out, lines);
      console.log(`\nWritten to ${out}`);
    }
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

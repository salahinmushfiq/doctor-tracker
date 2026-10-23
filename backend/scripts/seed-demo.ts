/**
 * Populate the database with SYNTHETIC demo data so the dashboard has something real to aggregate.
 * Every name is invented, every e-mail uses the reserved example.com domain and every phone number
 * uses the fictional 555-01xx range. No real patient information is involved.
 *
 *   npm run seed:demo                  # adds data (skips if doctors already exist)
 *   npm run seed:demo -- --reset       # wipes doctors + patients first
 *   npm run seed:demo -- --doctors 30 --patients 400 --seed 7
 *
 * Deterministic: the same --seed always yields the same dataset. Refuses to run with NODE_ENV=production
 * unless --force is given.
 */
import { connectDatabase, disconnectDatabase } from '../src/config/db';
import { env } from '../src/config/env';
import { CONDITIONS, GENDERS } from '../src/models/constants';
import { Doctor } from '../src/models/Doctor';
import { Patient } from '../src/models/Patient';

const num = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`);
  const v = i !== -1 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

// mulberry32: tiny seeded PRNG
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Amina', 'Rahim', 'Nusrat', 'Karim', 'Sadia', 'Tanvir', 'Farhana', 'Imran', 'Mehzabin', 'Arif', 'Lamia', 'Sabbir', 'Ritu', 'Nayeem', 'Tasnim', 'Zahid', 'Shirin', 'Mahin', 'Joya', 'Rafi', 'Anika', 'Hasan', 'Sumaiya', 'Fahim'];
const LAST = ['Rahman', 'Hossain', 'Chowdhury', 'Ahmed', 'Khan', 'Islam', 'Akter', 'Siddique', 'Mahmud', 'Sarker', 'Begum', 'Talukder', 'Mondal', 'Uddin', 'Karim', 'Haque'];
const SPECIALIZATIONS = ['Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'Dermatology', 'Oncology', 'Psychiatry', 'Endocrinology', 'Gastroenterology', 'Pulmonology'];
const HOSPITALS = ['Riverside General Hospital', 'Lakeview Medical Center', 'Northgate Clinic', 'Unity Specialized Hospital', 'Greenfield Health Institute', 'Harbor City Hospital'];
/** Rough specialization -> likely condition mapping so the demo data looks coherent. */
const LIKELY: Record<string, (typeof CONDITIONS)[number]> = {
  Cardiology: 'Cardiovascular',
  Neurology: 'Neurological',
  Pediatrics: 'Maternal & Child Health',
  Orthopedics: 'Musculoskeletal',
  Dermatology: 'Dermatological',
  Oncology: 'Oncology',
  Psychiatry: 'Mental Health',
  Endocrinology: 'Endocrine & Metabolic',
  Gastroenterology: 'Gastrointestinal',
  Pulmonology: 'Respiratory',
};

async function main() {
  if (env.isProd && !flag('force')) throw new Error('Refusing to seed demo data with NODE_ENV=production (use --force to override).');

  const rand = rng(num('seed', 42));
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)] as T;
  const doctorCount = num('doctors', 24);
  const patientCount = num('patients', 320);
  const now = Date.now();
  const DAY = 86_400_000;

  await connectDatabase();
  try {
    if (flag('reset')) {
      await Promise.all([Doctor.deleteMany({}), Patient.deleteMany({})]);
      console.log('Cleared doctors and patients.');
    } else if ((await Doctor.estimatedDocumentCount()) > 0) {
      console.log('Doctors already exist - nothing to do (use --reset to start over).');
      return;
    }

    // Growth over time: later dates are more likely (sqrt-skewed towards "recent").
    const pastDate = (maxDays: number) => new Date(now - Math.floor((1 - Math.sqrt(rand())) * maxDays * DAY) - Math.floor(rand() * DAY));

    const doctorDocs = Array.from({ length: doctorCount }, (_, i) => {
      const first = pick(FIRST);
      const last = pick(LAST);
      const createdAt = pastDate(400);
      return {
        fullName: `Dr. ${first} ${last}`,
        specialization: SPECIALIZATIONS[i % SPECIALIZATIONS.length] as string,
        hospital: pick(HOSPITALS),
        phone: `+1-555-01${String(10 + i).padStart(2, '0')}`,
        email: `${first}.${last}.${i + 1}@example.com`.toLowerCase(),
        createdAt,
        updatedAt: createdAt,
      };
    });
    const doctors = await Doctor.insertMany(doctorDocs);

    const patientDocs = Array.from({ length: patientCount }, (_, i) => {
      const doctor = rand() < 0.93 ? pick(doctors) : null; // ~7% unassigned
      const createdAtRaw = pastDate(365);
      // a patient cannot be registered before their doctor exists
      const createdAt = doctor && createdAtRaw < doctor.createdAt ? new Date(doctor.createdAt.getTime() + Math.floor(rand() * 20 * DAY)) : createdAtRaw;
      const first = pick(FIRST);
      const last = pick(LAST);
      const likely = doctor ? LIKELY[doctor.specialization] : undefined;
      const age = 1 + Math.floor(rand() * 85);
      return {
        fullName: `${first} ${last}`,
        dateOfBirth: new Date(now - age * 365.25 * DAY),
        gender: pick(GENDERS),
        phone: `+1-555-01${String(i % 90 + 10).padStart(2, '0')}`,
        email: rand() < 0.7 ? `${first}.${last}.p${i + 1}@example.com`.toLowerCase() : null,
        condition: likely && rand() < 0.7 ? likely : pick(CONDITIONS),
        doctor: doctor?._id ?? null,
        createdAt: createdAt > new Date() ? new Date() : createdAt,
        updatedAt: createdAt > new Date() ? new Date() : createdAt,
      };
    });
    await Patient.insertMany(patientDocs);
    console.log(`Seeded ${doctorDocs.length} doctors and ${patientDocs.length} patients (synthetic data).`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

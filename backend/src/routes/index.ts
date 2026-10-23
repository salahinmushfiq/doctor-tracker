import { Router } from 'express';
import * as authCtl from '../controllers/auth.controller';
import * as dashCtl from '../controllers/dashboard.controller';
import * as doctorCtl from '../controllers/doctor.controller';
import * as patientCtl from '../controllers/patient.controller';
import { requireAuth, requireRole } from '../middleware/auth';
import { verifyCsrfToken, verifyOrigin } from '../middleware/csrf';
import { loginIpLimiter, loginLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { loginBody } from '../validators/auth';
import { dashboardQuery } from '../validators/dashboard';
import { doctorBody, doctorDeleteQuery, doctorListQuery, doctorPatchBody } from '../validators/doctor';
import { idParams } from '../validators/common';
import {
  doctorPatientParams,
  doctorPatientsQuery,
  patientBody,
  patientListQuery,
  patientPatchBody,
} from '../validators/patient';

export const v1 = Router();

/* ── Auth ────────────────────────────────────────────────────────────────
 * There is intentionally NO register endpoint: accounts are created with `npm run seed:admin`.
 */
const auth = Router();
auth.post('/login', verifyOrigin, loginIpLimiter, validate({ body: loginBody }), loginLimiter, authCtl.login);
auth.post('/logout', verifyOrigin, authCtl.logout);
auth.get('/me', requireAuth, authCtl.me);
v1.use('/auth', auth);

/* ── Everything below requires an authenticated session ──────────────────── */
v1.use(requireAuth);
// Defence in depth for cookie auth: origin allow-list + session-bound token on every mutation.
v1.use(verifyOrigin, verifyCsrfToken);
const admin = requireRole('admin');

/* ── Doctors ─────────────────────────────────────────────────────────────── */
const doctors = Router();
doctors.get('/', validate({ query: doctorListQuery }), doctorCtl.list);
doctors.get('/filters', doctorCtl.filterOptions);
doctors.post('/', admin, validate({ body: doctorBody }), doctorCtl.create);
doctors.get('/:id', validate({ params: idParams }), doctorCtl.getOne);
doctors.patch('/:id', admin, validate({ params: idParams, body: doctorPatchBody }), doctorCtl.update);
doctors.delete('/:id', admin, validate({ params: idParams, query: doctorDeleteQuery }), doctorCtl.remove);
doctors.get('/:id/patients', validate({ params: idParams, query: doctorPatientsQuery }), doctorCtl.listPatients);
doctors.delete('/:id/patients/:patientId', admin, validate({ params: doctorPatientParams }), doctorCtl.removePatient);
v1.use('/doctors', doctors);

/* ── Patients ────────────────────────────────────────────────────────────── */
const patients = Router();
patients.get('/', validate({ query: patientListQuery }), patientCtl.list);
patients.get('/filters', patientCtl.filterOptions);
patients.post('/', admin, validate({ body: patientBody }), patientCtl.create);
patients.get('/:id', validate({ params: idParams }), patientCtl.getOne);
patients.patch('/:id', admin, validate({ params: idParams, body: patientPatchBody }), patientCtl.update);
patients.delete('/:id', admin, validate({ params: idParams }), patientCtl.remove);
v1.use('/patients', patients);

/* ── Dashboard (read-only) ───────────────────────────────────────────────── */
const dashboard = Router();
dashboard.get('/overview', validate({ query: dashboardQuery }), dashCtl.overview);
dashboard.get('/trends', validate({ query: dashboardQuery }), dashCtl.trends);
dashboard.get('/doctor-statistics', validate({ query: dashboardQuery }), dashCtl.doctorStatistics);
dashboard.get('/condition-distribution', validate({ query: dashboardQuery }), dashCtl.conditionDistribution);
dashboard.get('/recent-activity', dashCtl.recentActivity);
v1.use('/dashboard', dashboard);

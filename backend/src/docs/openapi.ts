import { CONDITIONS, GENDERS } from '../models/constants';
import { DOCTOR_SORT_FIELDS } from '../validators/doctor';
import { PATIENT_SORT_FIELDS } from '../validators/patient';

/** OpenAPI 3.0 description of the REST contract. Served at /api/v1/openapi.json outside production. */

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const param = (name: string, schema: object, description: string, where: 'query' | 'path' = 'query', required = false) => ({
  name,
  in: where,
  required: where === 'path' || required,
  description,
  schema,
});

const idParam = param('id', { type: 'string', pattern: '^[a-f0-9]{24}$' }, 'MongoDB ObjectId', 'path');

const paging = [
  param('page', { type: 'integer', minimum: 1, default: 1 }, 'Page number (1-based)'),
  param('limit', { type: 'integer', minimum: 1, maximum: 100, default: 10 }, 'Page size (max 100)'),
  param('search', { type: 'string', maxLength: 100 }, 'Prefix search over normalized name/contact tokens (max 5 terms, AND)'),
  param('sortOrder', { type: 'string', enum: ['asc', 'desc'], default: 'desc' }, 'Sort direction'),
  param('startDate', { type: 'string', format: 'date' }, 'createdAt >= start of this day (UTC)'),
  param('endDate', { type: 'string', format: 'date' }, 'createdAt <= end of this day (UTC)'),
];

const dashParams = [
  param('startDate', { type: 'string', format: 'date' }, 'Window start (createdAt, UTC). Omit for all time.'),
  param('endDate', { type: 'string', format: 'date' }, 'Window end, inclusive day (UTC).'),
];

const errors = {
  '400': { description: 'Validation error', content: { 'application/json': { schema: ref('Error') } } },
  '401': { description: 'Not authenticated / session expired', content: { 'application/json': { schema: ref('Error') } } },
  '403': { description: 'Forbidden or CSRF failure', content: { 'application/json': { schema: ref('Error') } } },
};

const ok = (schema: object, description = 'OK') => ({ '200': { description, content: { 'application/json': { schema } } } });
const wrapped = (data: object) => ({ type: 'object', properties: { success: { type: 'boolean' }, data } });
const paged = (item: string) => ({
  type: 'object',
  properties: { success: { type: 'boolean' }, data: { type: 'array', items: ref(item) }, pagination: ref('Pagination') },
});
const secured = [{ cookieAuth: [] }];
const csrf = param('X-CSRF-Token', { type: 'string' }, 'Session-bound CSRF token returned by login / me (required on every mutation)');
const csrfHeader = { ...csrf, in: 'header', required: true };

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Doctor Tracker API',
    version: '1.0.0',
    description:
      'REST API for managing doctors and patients with a database-backed analytics dashboard. Authentication uses an HTTP-only session cookie; all mutations additionally need the X-CSRF-Token header and an allowed Origin.',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: { cookieAuth: { type: 'apiKey', in: 'cookie', name: 'dt_session' } },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              details: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, message: { type: 'string' } } } },
            },
          },
        },
      },
      Pagination: {
        type: 'object',
        properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' } },
      },
      User: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' }, role: { type: 'string', enum: ['admin', 'viewer'] } } },
      Doctor: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          fullName: { type: 'string' },
          specialization: { type: 'string' },
          hospital: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string', format: 'email' },
          patientCount: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      DoctorInput: {
        type: 'object',
        required: ['fullName', 'specialization', 'hospital', 'phone', 'email'],
        properties: {
          fullName: { type: 'string' },
          specialization: { type: 'string' },
          hospital: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
      },
      Patient: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          fullName: { type: 'string' },
          dateOfBirth: { type: 'string', format: 'date-time' },
          gender: { type: 'string', enum: [...GENDERS] },
          phone: { type: 'string' },
          email: { type: 'string', nullable: true },
          condition: { type: 'string', enum: [...CONDITIONS] },
          doctor: { type: 'object', nullable: true, properties: { id: { type: 'string' }, fullName: { type: 'string' }, specialization: { type: 'string' } } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      PatientInput: {
        type: 'object',
        required: ['fullName', 'dateOfBirth', 'phone', 'condition'],
        properties: {
          fullName: { type: 'string' },
          dateOfBirth: { type: 'string', format: 'date', example: '1990-04-21' },
          gender: { type: 'string', enum: [...GENDERS] },
          phone: { type: 'string' },
          email: { type: 'string', nullable: true },
          condition: { type: 'string', enum: [...CONDITIONS] },
          doctorId: { type: 'string', nullable: true, description: 'null / omitted = unassigned' },
        },
      },
    },
  },
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in; sets the HTTP-only session cookie',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } } } } },
        responses: {
          ...ok(wrapped({ type: 'object', properties: { user: ref('User'), csrfToken: { type: 'string' } } })),
          '401': { description: 'INVALID_CREDENTIALS (identical for unknown e-mail / wrong password)', content: { 'application/json': { schema: ref('Error') } } },
          '429': { description: 'Rate limited' },
        },
      },
    },
    '/auth/logout': { post: { tags: ['Auth'], summary: 'Clear the cookie and revoke the session server-side', responses: ok(wrapped({ type: 'object' })) } },
    '/auth/me': { get: { tags: ['Auth'], security: secured, summary: 'Current user + CSRF token', responses: { ...ok(wrapped({ type: 'object', properties: { user: ref('User'), csrfToken: { type: 'string' } } })), '401': errors['401'] } } },

    '/doctors': {
      get: {
        tags: ['Doctors'],
        security: secured,
        summary: 'List doctors (server-side search / filter / sort / pagination)',
        parameters: [
          ...paging,
          param('sortBy', { type: 'string', enum: [...DOCTOR_SORT_FIELDS], default: 'createdAt' }, 'Allow-listed sort field'),
          param('specialization', { type: 'string' }, 'Exact specialization'),
          param('hospital', { type: 'string' }, 'Exact hospital'),
        ],
        responses: { ...ok(paged('Doctor')), ...errors },
      },
      post: {
        tags: ['Doctors'],
        security: secured,
        summary: 'Create a doctor (admin)',
        parameters: [csrfHeader],
        requestBody: { required: true, content: { 'application/json': { schema: ref('DoctorInput') } } },
        responses: { '201': { description: 'Created', content: { 'application/json': { schema: wrapped(ref('Doctor')) } } }, '409': { description: 'E-mail already exists' }, ...errors },
      },
    },
    '/doctors/filters': { get: { tags: ['Doctors'], security: secured, summary: 'Distinct specializations and hospitals for filter dropdowns', responses: ok(wrapped({ type: 'object' })) } },
    '/doctors/{id}': {
      get: { tags: ['Doctors'], security: secured, summary: 'Doctor details incl. patientCount', parameters: [idParam], responses: { ...ok(wrapped(ref('Doctor'))), '404': { description: 'Not found' }, ...errors } },
      patch: { tags: ['Doctors'], security: secured, summary: 'Update a doctor (admin)', parameters: [idParam, csrfHeader], requestBody: { content: { 'application/json': { schema: ref('DoctorInput') } } }, responses: { ...ok(wrapped(ref('Doctor'))), ...errors } },
      delete: {
        tags: ['Doctors'],
        security: secured,
        summary: 'Delete a doctor (admin). 409 DOCTOR_HAS_PATIENTS while patients are assigned, unless ?patients=unassign (patients are never deleted).',
        parameters: [idParam, csrfHeader, param('patients', { type: 'string', enum: ['unassign'] }, 'Unassign assigned patients, then delete')],
        responses: { ...ok(wrapped({ type: 'object', properties: { unassigned: { type: 'integer' } } })), '409': { description: 'DOCTOR_HAS_PATIENTS' }, ...errors },
      },
    },
    '/doctors/{id}/patients': {
      get: {
        tags: ['Doctors'],
        security: secured,
        summary: "A doctor's patients (paginated)",
        parameters: [idParam, ...paging, param('sortBy', { type: 'string', enum: [...PATIENT_SORT_FIELDS] }, 'Allow-listed sort field'), param('condition', { type: 'string', enum: [...CONDITIONS] }, 'Condition category')],
        responses: { ...ok(paged('Patient')), ...errors },
      },
    },
    '/doctors/{id}/patients/{patientId}': {
      delete: {
        tags: ['Doctors'],
        security: secured,
        summary: 'Remove a patient from this doctor (UNASSIGN only - the patient record is kept)',
        parameters: [idParam, param('patientId', { type: 'string' }, 'Patient id', 'path'), csrfHeader],
        responses: { ...ok(wrapped(ref('Patient'))), '404': { description: 'Patient not assigned to this doctor' }, ...errors },
      },
    },

    '/patients': {
      get: {
        tags: ['Patients'],
        security: secured,
        summary: 'List patients',
        parameters: [
          ...paging,
          param('sortBy', { type: 'string', enum: [...PATIENT_SORT_FIELDS], default: 'createdAt' }, 'Allow-listed sort field'),
          param('condition', { type: 'string', enum: [...CONDITIONS] }, 'Condition category'),
          param('gender', { type: 'string', enum: [...GENDERS] }, 'Gender'),
          param('doctorId', { type: 'string' }, 'Doctor id, or the literal "unassigned"'),
        ],
        responses: { ...ok(paged('Patient')), ...errors },
      },
      post: { tags: ['Patients'], security: secured, summary: 'Create a patient (admin)', parameters: [csrfHeader], requestBody: { required: true, content: { 'application/json': { schema: ref('PatientInput') } } }, responses: { '201': { description: 'Created', content: { 'application/json': { schema: wrapped(ref('Patient')) } } }, ...errors } },
    },
    '/patients/filters': { get: { tags: ['Patients'], security: secured, summary: 'Condition and gender options', responses: ok(wrapped({ type: 'object' })) } },
    '/patients/{id}': {
      get: { tags: ['Patients'], security: secured, summary: 'Patient details', parameters: [idParam], responses: { ...ok(wrapped(ref('Patient'))), '404': { description: 'Not found' }, ...errors } },
      patch: { tags: ['Patients'], security: secured, summary: 'Update / reassign a patient (admin)', parameters: [idParam, csrfHeader], requestBody: { content: { 'application/json': { schema: ref('PatientInput') } } }, responses: { ...ok(wrapped(ref('Patient'))), ...errors } },
      delete: { tags: ['Patients'], security: secured, summary: 'Permanently delete a patient (admin)', parameters: [idParam, csrfHeader], responses: { ...ok(wrapped({ type: 'object' })), ...errors } },
    },

    '/dashboard/overview': { get: { tags: ['Dashboard'], security: secured, summary: 'Lifetime totals + new-in-window counts', parameters: dashParams, responses: ok(wrapped({ type: 'object' })) } },
    '/dashboard/trends': { get: { tags: ['Dashboard'], security: secured, summary: 'New doctors / patients per bucket (zero-filled)', parameters: [...dashParams, param('interval', { type: 'string', enum: ['day', 'week', 'month'] }, 'Optional bucket size')], responses: ok(wrapped({ type: 'object' })) } },
    '/dashboard/doctor-statistics': { get: { tags: ['Dashboard'], security: secured, summary: 'Top doctors by patients + doctors-vs-patients per specialization', parameters: [...dashParams, param('limit', { type: 'integer', minimum: 1, maximum: 25, default: 10 }, 'Top-N')], responses: ok(wrapped({ type: 'object' })) } },
    '/dashboard/condition-distribution': { get: { tags: ['Dashboard'], security: secured, summary: 'Patients per condition category', parameters: dashParams, responses: ok(wrapped({ type: 'object' })) } },
    '/dashboard/recent-activity': { get: { tags: ['Dashboard'], security: secured, summary: 'Latest created doctors and patients', responses: ok(wrapped({ type: 'object' })) } },
  },
} as const;

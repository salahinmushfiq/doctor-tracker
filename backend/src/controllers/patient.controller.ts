import type { RequestHandler } from 'express';
import * as patients from '../services/patient.service';
import type { PatientBody, PatientListQuery, PatientPatchBody } from '../validators/patient';

type P = { id: string };

export const list: RequestHandler = async (req, res) => {
  res.json({ success: true, ...(await patients.listPatients(req.validated.query as PatientListQuery)) });
};

export const filterOptions: RequestHandler = (_req, res) => {
  res.json({ success: true, data: patients.patientFilterOptions() });
};

export const getOne: RequestHandler = async (req, res) => {
  res.json({ success: true, data: await patients.getPatient((req.validated.params as P).id) });
};

export const create: RequestHandler = async (req, res) => {
  res.status(201).json({ success: true, data: await patients.createPatient(req.validated.body as PatientBody) });
};

export const update: RequestHandler = async (req, res) => {
  const data = await patients.updatePatient((req.validated.params as P).id, req.validated.body as PatientPatchBody);
  res.json({ success: true, data });
};

export const remove: RequestHandler = async (req, res) => {
  await patients.deletePatient((req.validated.params as P).id);
  res.json({ success: true, data: { deleted: true } });
};

import type { RequestHandler } from 'express';
import * as doctors from '../services/doctor.service';
import { unassignPatient } from '../services/patient.service';
import type { DoctorBody, DoctorListQuery } from '../validators/doctor';
import type { DoctorPatientsQuery } from '../validators/patient';

type P = { id: string };

export const list: RequestHandler = async (req, res) => {
  const result = await doctors.listDoctors(req.validated.query as DoctorListQuery);
  res.json({ success: true, ...result });
};

export const filterOptions: RequestHandler = async (_req, res) => {
  res.json({ success: true, data: await doctors.doctorFilterOptions() });
};

export const getOne: RequestHandler = async (req, res) => {
  res.json({ success: true, data: await doctors.getDoctor((req.validated.params as P).id) });
};

export const create: RequestHandler = async (req, res) => {
  res.status(201).json({ success: true, data: await doctors.createDoctor(req.validated.body as DoctorBody) });
};

export const update: RequestHandler = async (req, res) => {
  const data = await doctors.updateDoctor((req.validated.params as P).id, req.validated.body as Partial<DoctorBody>);
  res.json({ success: true, data });
};

export const remove: RequestHandler = async (req, res) => {
  const mode = (req.validated.query as { patients?: 'unassign' }).patients;
  const result = await doctors.deleteDoctor((req.validated.params as P).id, mode);
  res.json({ success: true, data: result });
};

export const listPatients: RequestHandler = async (req, res) => {
  const result = await doctors.listDoctorPatients((req.validated.params as P).id, req.validated.query as DoctorPatientsQuery);
  res.json({ success: true, ...result });
};

export const removePatient: RequestHandler = async (req, res) => {
  const { id, patientId } = req.validated.params as { id: string; patientId: string };
  res.json({ success: true, data: await unassignPatient(id, patientId) });
};

import type { Types } from 'mongoose';

type Id = Types.ObjectId | string;

export interface DoctorDTO {
  id: string;
  fullName: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  patientCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DoctorRefDTO {
  id: string;
  fullName: string;
  specialization: string;
}

export interface PatientDTO {
  id: string;
  fullName: string;
  dateOfBirth: Date;
  gender: string;
  phone: string;
  email: string | null;
  condition: string;
  doctor: DoctorRefDTO | null;
  createdAt: Date;
  updatedAt: Date;
}

interface LeanDoctor {
  _id: Id;
  fullName: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

interface LeanPatient {
  _id: Id;
  fullName: string;
  dateOfBirth: Date;
  gender: string;
  phone: string;
  email?: string | null;
  condition: string;
  doctor?: Id | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toDoctorDTO(d: LeanDoctor, patientCount?: number): DoctorDTO {
  return {
    id: String(d._id),
    fullName: d.fullName,
    specialization: d.specialization,
    hospital: d.hospital,
    phone: d.phone,
    email: d.email,
    ...(patientCount === undefined ? {} : { patientCount }),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export function toPatientDTO(p: LeanPatient, doctors: Map<string, DoctorRefDTO>): PatientDTO {
  const doctorId = p.doctor ? String(p.doctor) : null;
  return {
    id: String(p._id),
    fullName: p.fullName,
    dateOfBirth: p.dateOfBirth,
    gender: p.gender,
    phone: p.phone,
    email: p.email ?? null,
    condition: p.condition,
    doctor: doctorId ? (doctors.get(doctorId) ?? null) : null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

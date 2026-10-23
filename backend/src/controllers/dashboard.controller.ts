import type { RequestHandler } from 'express';
import * as dashboard from '../services/dashboard.service';
import type { DashboardQuery } from '../validators/dashboard';

const q = (req: Parameters<RequestHandler>[0]) => req.validated.query as DashboardQuery;

export const overview: RequestHandler = async (req, res) => {
  res.json({ success: true, data: await dashboard.getOverview(q(req)) });
};
export const trends: RequestHandler = async (req, res) => {
  res.json({ success: true, data: await dashboard.getTrends(q(req)) });
};
export const doctorStatistics: RequestHandler = async (req, res) => {
  res.json({ success: true, data: await dashboard.getDoctorStatistics(q(req)) });
};
export const conditionDistribution: RequestHandler = async (req, res) => {
  res.json({ success: true, data: await dashboard.getConditionDistribution(q(req)) });
};
export const recentActivity: RequestHandler = async (_req, res) => {
  res.json({ success: true, data: await dashboard.getRecentActivity() });
};

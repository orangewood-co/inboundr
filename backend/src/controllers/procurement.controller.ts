import type { Request, Response } from "express";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import {
  ProcurementServiceError,
  getOrCreateProcurementSettings,
  getProcurementRun,
  listProcurementRuns,
  requestProcurementRun,
  selectProcurementCandidate,
  serializeProcurementSettings,
  updateProcurementSettings,
} from "../services/procurement.service";

function handle(res: Response, error: unknown, fallback: string) {
  if (error instanceof ProcurementServiceError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error(fallback, error);
  res.status(500).json({ error: fallback });
}

function context(req: Request) {
  const orgReq = req as OrganizationRequest;
  return { organizationId: orgReq.organization._id, userId: orgReq.user.id };
}

export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await getOrCreateProcurementSettings(context(req).organizationId);
    res.json({ settings: serializeProcurementSettings(settings) });
  } catch (error) {
    handle(res, error, "Failed to load procurement settings");
  }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId, userId } = context(req);
    const settings = await updateProcurementSettings(organizationId, req.body ?? {}, userId);
    res.json({ settings: serializeProcurementSettings(settings) });
  } catch (error) {
    handle(res, error, "Failed to save procurement settings");
  }
};

export const listRuns = async (req: Request, res: Response): Promise<void> => {
  try {
    const runs = await listProcurementRuns({ ...context(req), rfqId: req.params.rfqId });
    res.json({ runs });
  } catch (error) {
    handle(res, error, "Failed to load procurement runs");
  }
};

export const createRun = async (req: Request, res: Response): Promise<void> => {
  try {
    const run = await requestProcurementRun({
      ...context(req),
      rfqId: req.params.rfqId,
      searchResultIndex: req.body?.searchResultIndex,
      notes: req.body?.notes,
      searchAnyway: req.body?.searchAnyway,
      force: req.body?.force,
    });
    res.status(202).json({ run });
  } catch (error) {
    handle(res, error, "Failed to start supplier search");
  }
};

export const getRun = async (req: Request, res: Response): Promise<void> => {
  try {
    const run = await getProcurementRun({ ...context(req), runId: req.params.runId });
    res.json({ run });
  } catch (error) {
    handle(res, error, "Failed to load procurement run");
  }
};

export const selectCandidate = async (req: Request, res: Response): Promise<void> => {
  try {
    const run = await selectProcurementCandidate({
      ...context(req),
      runId: req.params.runId,
      candidateId: req.body?.candidateId,
    });
    res.json({ run });
  } catch (error) {
    handle(res, error, "Failed to select supplier");
  }
};

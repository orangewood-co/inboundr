import { Router } from "express";
import {
  addServiceActivity,
  assignServiceRequest,
  changeServiceStatus,
  closeServiceRequest,
  createCustomerSite,
  createInstalledEquipment,
  createServiceAttachment,
  createServiceRecord,
  createServiceRequest,
  createServiceRequestFromTicket,
  deleteCustomerSite,
  deleteInstalledEquipment,
  deleteServiceAttachment,
  deleteServiceRecord,
  deleteServiceRequest,
  exportServiceRequests,
  getCustomerSite,
  getInstalledEquipment,
  getServiceRecord,
  getServiceRequest,
  getServiceSettings,
  linkTicket,
  listCustomerSites,
  listInstalledEquipment,
  listServiceActivities,
  listServiceAttachments,
  listServiceRecords,
  listServiceRequests,
  presignServiceAttachment,
  reopenServiceRequest,
  serviceSummary,
  unlinkTicket,
  updateCustomerSite,
  updateInstalledEquipment,
  updateServiceRecord,
  updateServiceRequest,
  updateServiceSettings,
  viewServiceAttachment,
} from "../controllers/service-management.controller";
import {
  requireAuth,
  requireEmployeeModule,
  requireFeature,
  requireOrganization,
  requireOrganizationAdmin,
} from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);
router.use(requireFeature("service_management"));
router.use(requireEmployeeModule("service_management"));

router.get("/settings", getServiceSettings);
router.put("/settings", requireOrganizationAdmin(), updateServiceSettings);
router.get("/summary", serviceSummary);
router.get("/summary/export", exportServiceRequests);
router.get("/export.csv", exportServiceRequests);

router.get("/sites", listCustomerSites);
router.post("/sites", createCustomerSite);
router.get("/sites/:siteId", getCustomerSite);
router.patch("/sites/:siteId", updateCustomerSite);
router.delete("/sites/:siteId", deleteCustomerSite);

router.get("/equipment", listInstalledEquipment);
router.post("/equipment", createInstalledEquipment);
router.get("/equipment/:equipmentId", getInstalledEquipment);
router.patch("/equipment/:equipmentId", updateInstalledEquipment);
router.delete("/equipment/:equipmentId", deleteInstalledEquipment);

router.post("/tickets/:ticketId/create-request", createServiceRequestFromTicket);

router.get("/requests", listServiceRequests);
router.post("/requests", createServiceRequest);
router.get("/requests/:id", getServiceRequest);
router.patch("/requests/:id", updateServiceRequest);
router.delete("/requests/:id", deleteServiceRequest);
router.patch("/requests/:id/assignment", assignServiceRequest);
router.patch("/requests/:id/status", changeServiceStatus);
router.post("/requests/:id/close", closeServiceRequest);
router.post("/requests/:id/reopen", reopenServiceRequest);
router.get("/requests/:id/activities", listServiceActivities);
router.post("/requests/:id/activities", addServiceActivity);

router.get("/requests/:id/records", listServiceRecords);
router.post("/requests/:id/records", createServiceRecord);
router.get("/requests/:id/records/:recordId", getServiceRecord);
router.patch("/requests/:id/records/:recordId", updateServiceRecord);
router.delete("/requests/:id/records/:recordId", deleteServiceRecord);

router.get("/requests/:id/attachments", listServiceAttachments);
router.post("/requests/:id/attachments/presign", presignServiceAttachment);
router.post("/requests/:id/attachments", createServiceAttachment);
router.get("/requests/:id/attachments/:attachmentId/view", viewServiceAttachment);
router.delete("/requests/:id/attachments/:attachmentId", deleteServiceAttachment);

router.put("/requests/:id/tickets/:ticketId", linkTicket);
router.delete("/requests/:id/tickets/:ticketId", unlinkTicket);

export default router;

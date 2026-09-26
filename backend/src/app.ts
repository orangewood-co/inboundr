import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import emailRouter from "./routes/email.route";
import productsRouter from "./routes/products.route";
import rfqRouter from "./routes/rfq.route";
import procurementRouter from "./routes/procurement.route";
import gmailRouter from "./routes/gmail.route";
import customerRouter from "./routes/customer.route";
import crmRouter from "./routes/crm.route";
import organizationRouter from "./routes/organization.route";
import formsRouter from "./routes/forms.route";
import publicFormsRouter from "./routes/public-forms.route";
import linksRouter from "./routes/links.route";
import publicLinksRouter from "./routes/public-links.route";
import uploadsRouter from "./routes/uploads.route";
import driveRouter from "./routes/drive.route";
import publicDriveRouter from "./routes/public-drive.route";
import statsRouter from "./routes/stats.route";
import digestRouter from "./routes/digest.route";
import dashboardLayoutRouter from "./routes/dashboard-layout.route";
import searchRouter from "./routes/search.route";
import invoiceRouter from "./routes/invoice.route";
import adminRouter from "./routes/admin.route";
import contactRouter from "./routes/contact.route";
import feedbackRouter from "./routes/feedback.route";
import employeeRouter from "./routes/employee.route";
import assetsRouter from "./routes/assets.route";
import projectRouter from "./routes/project.route";
import attendanceRouter from "./routes/attendance.route";
import publicAttendanceRouter from "./routes/public-attendance.route";
import publicSupportRouter from "./routes/public-support.route";
import telephonyRouter from "./routes/telephony.route";
import whatsAppRouter from "./routes/whatsapp.route";
import chatRouter from "./routes/chat.route";
import ticketRouter from "./routes/ticket.route";
import supportAiRouter from "./routes/support-ai.route";
import supportTemplateRouter from "./routes/support-template.route";
import supportTicketTagRouter from "./routes/support-ticket-tag.route";
import notificationRouter from "./routes/notification.route";
import ogRouter from "./routes/og.route";
import formShareRouter from "./routes/form-share.route";
import serviceManagementRouter from "./routes/service-management.route";
import workflowRouter from "./routes/workflow.route";
import recruitmentRouter from "./routes/recruitment.route";
import publicRecruitmentRouter from "./routes/public-recruitment.route";
import publicWaitlistRouter from "./routes/public-waitlist.route";
import { connectDB, disconnectDB } from "./config/database.config";
import { ensureKnowledgeSchema } from "./db/knowledge-schema";
import { embedOrigin, frontendOrigin, landingOrigin } from "./config/origins.config";
import {
  contactLimiter,
  generalApiLimiter,
  publicReadLimiter,
  publicWriteLimiter,
} from "./middleware/rate-limit.middleware";
import { auth } from "./lib/auth";
import { registerNotificationEventHandlers } from "./events/notification-event-handlers";
import { registerCrmLeadCaptureHandlers } from "./events/crm-lead-capture-handlers";
import {
  registerWorkflowEventHandlers,
  startWorkflowDelayWorker,
} from "./services/workflow-engine.service";
import {
  startWatchesForConnectedAccounts,
  scheduleWatchRenewal,
  stopWatchRenewal,
} from "./services/gmail-watcher.service";
import { startCallRecordingCron } from "./jobs/call-recording-cron";
import { startDigestCron } from "./jobs/digest-cron";
import { startEmailReconciliationCron } from "./jobs/email-reconciliation-cron";
import { startPaymentReminderCron } from "./jobs/payment-reminder-cron";
import { startCrmActivityReminderCron } from "./jobs/crm-activity-reminder-cron";
import { startRecruitmentRankingWorker } from "./services/recruitment-ranking.service";
import { startRecruitmentAcknowledgementWorker } from "./services/recruitment-acknowledgement.service";
import { startProcurementWorker } from "./services/procurement.service";
import { backfillRFQThreadIds } from "./services/rfq.service";

const app: Application = express();

// Exactly one reverse-proxy hop (Nginx) sets X-Forwarded-For. Without this,
// req.ip resolves to 127.0.0.1 and every IP-keyed rate limit shares one bucket.
app.set("trust proxy", 1);

app.use(
  cors({
    origin: [frontendOrigin, embedOrigin, landingOrigin],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-organization-id"],
    credentials: true,
  }),
);

app.all("/api/auth/*splat", toNodeHandler(auth));

// Telephony and WhatsApp webhooks need the raw request body for signature
// verification, so they are mounted before the global JSON body parser.
app.use("/api/v1/telephony", telephonyRouter);
app.use("/api/v1/whatsapp", whatsAppRouter);

app.use("/api/v1/products/import", express.json({ limit: "1mb" }));
// Composed replies carry an HTML body, a quoted chain and possibly inline
// images, which the default 100kb limit rejects with an opaque 413.
app.use("/api/v1/email", express.json({ limit: "10mb" }));
app.use(express.json());

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    message: "API is running smoothly.",
  });
});

// Per-IP safety net for the whole API. Telephony webhooks are mounted above
// (signature-verified) and the email webhook is skipped inside the limiter.
// Route-specific limiters below add stricter limits on top of this one.
app.use("/api/v1", generalApiLimiter);

app.use("/api/v1/email", emailRouter);
app.use("/api/v1/gmail", gmailRouter);
app.use("/api/v1/products", productsRouter);
app.use("/api/v1/rfq", rfqRouter);
app.use("/api/v1/procurement", procurementRouter);
app.use("/api/v1/workflows", workflowRouter);
app.use("/api/v1/customers", customerRouter);
app.use("/api/v1/crm", crmRouter);
app.use("/api/v1/organization", organizationRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/forms", formsRouter);
app.use("/api/v1/links", linksRouter);
app.use("/api/v1/uploads", uploadsRouter);
app.use("/api/v1/drive", driveRouter);
app.use("/api/v1/invoices", invoiceRouter);
app.use("/api/v1/contact", contactLimiter, contactRouter);
app.use("/api/v1/feedback", feedbackRouter);
app.use("/api/v1/employees", employeeRouter);
app.use("/api/v1/assets", assetsRouter);
app.use("/api/v1/service-management", serviceManagementRouter);
app.use("/api/v1/recruitment", recruitmentRouter);
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/attendance", attendanceRouter);
app.use("/api/v1/chat", chatRouter);
app.use("/api/v1/tickets", ticketRouter);
app.use("/api/v1/support", supportAiRouter);
app.use("/api/v1/support/templates", supportTemplateRouter);
app.use("/api/v1/support/ticket-tags", supportTicketTagRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/og", publicReadLimiter, ogRouter);
app.use("/api/v1/public/forms", publicFormsRouter);
app.use("/api/v1/public/drive", publicDriveRouter);
app.use("/api/v1/public/attendance", publicAttendanceRouter);
app.use("/api/v1/public/support", publicSupportRouter);
app.use("/api/v1/public/recruitment", publicRecruitmentRouter);
app.use("/api/v1/public/waitlist", publicWriteLimiter, publicWaitlistRouter);
app.use("/l", publicReadLimiter, publicLinksRouter);
app.use("/f", publicReadLimiter, formShareRouter);
app.use("/api/v1/stats", statsRouter);
app.use("/api/v1/digest", digestRouter);
app.use("/api/v1/dashboard-layout", dashboardLayoutRouter);
app.use("/api/v1/search", searchRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
});

export async function initializeServices(): Promise<void> {
  await connectDB();
  registerNotificationEventHandlers();
  registerCrmLeadCaptureHandlers();
  registerWorkflowEventHandlers();
  startWorkflowDelayWorker();

  try {
    await ensureKnowledgeSchema();
    console.log("Knowledge (RAG) schema ready");
  } catch (err) {
    console.error("Failed to provision knowledge schema:", err);
    console.warn("Chat document retrieval will be unavailable until the database is reachable");
  }

  // Watch registration + history catch-up can take minutes on a cold boot, so
  // run it in the background instead of blocking app.listen. A failed catch-up
  // leaves the sync cursor untouched and is retried by the next Pub/Sub
  // notification or the reconciliation cron.
  startWatchesForConnectedAccounts()
    .then(() => console.log("Gmail watcher initialized"))
    .catch((err) => {
      console.error("Failed to initialize Gmail watcher:", err);
      console.warn("Server will continue without Gmail watch — set up GCP credentials and retry");
    });
  scheduleWatchRenewal();

  backfillRFQThreadIds().catch((err) =>
    console.error("RFQ threadId backfill failed:", err)
  );

  startDigestCron();
  startEmailReconciliationCron();
  startPaymentReminderCron();
  startCrmActivityReminderCron();
  startCallRecordingCron();
  startRecruitmentRankingWorker();
  startRecruitmentAcknowledgementWorker();
  startProcurementWorker();
}

async function shutdown(): Promise<void> {
  console.log("Shutting down...");
  stopWatchRenewal();
  await disconnectDB();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export default app;

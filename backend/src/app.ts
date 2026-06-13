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
import gmailRouter from "./routes/gmail.route";
import customerRouter from "./routes/customer.route";
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
import searchRouter from "./routes/search.route";
import invoiceRouter from "./routes/invoice.route";
import adminRouter from "./routes/admin.route";
import contactRouter from "./routes/contact.route";
import employeeRouter from "./routes/employee.route";
import projectRouter from "./routes/project.route";
import attendanceRouter from "./routes/attendance.route";
import publicAttendanceRouter from "./routes/public-attendance.route";
import chatRouter from "./routes/chat.route";
import { connectDB, disconnectDB } from "./config/database.config";
import { embedOrigin, frontendOrigin, landingOrigin } from "./config/origins.config";
import { auth } from "./lib/auth";
import {
  startWatchesForConnectedAccounts,
  scheduleWatchRenewal,
  stopWatchRenewal,
} from "./services/gmail-watcher.service";
import { startDigestCron } from "./jobs/digest-cron";
import { startPaymentReminderCron } from "./jobs/payment-reminder-cron";

const app: Application = express();

app.use(
  cors({
    origin: [frontendOrigin, embedOrigin, landingOrigin],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-organization-id"],
    credentials: true,
  }),
);

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    message: "API is running smoothly.",
  });
});

app.use("/api/v1/email", emailRouter);
app.use("/api/v1/gmail", gmailRouter);
app.use("/api/v1/products", productsRouter);
app.use("/api/v1/rfq", rfqRouter);
app.use("/api/v1/customers", customerRouter);
app.use("/api/v1/organization", organizationRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/forms", formsRouter);
app.use("/api/v1/links", linksRouter);
app.use("/api/v1/uploads", uploadsRouter);
app.use("/api/v1/drive", driveRouter);
app.use("/api/v1/invoices", invoiceRouter);
app.use("/api/v1/contact", contactRouter);
app.use("/api/v1/employees", employeeRouter);
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/attendance", attendanceRouter);
app.use("/api/v1/chat", chatRouter);
app.use("/api/v1/public/forms", publicFormsRouter);
app.use("/api/v1/public/drive", publicDriveRouter);
app.use("/api/v1/public/attendance", publicAttendanceRouter);
app.use("/l", publicLinksRouter);
app.use("/api/v1/stats", statsRouter);
app.use("/api/v1/digest", digestRouter);
app.use("/api/v1/search", searchRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
});

export async function initializeServices(): Promise<void> {
  await connectDB();

  try {
    await startWatchesForConnectedAccounts();
    scheduleWatchRenewal();
    console.log("Gmail watcher initialized");
  } catch (err) {
    console.error("Failed to initialize Gmail watcher:", err);
    console.warn("Server will continue without Gmail watch — set up GCP credentials and retry");
  }

  startDigestCron();
  startPaymentReminderCron();
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

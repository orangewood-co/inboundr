import express, {
  type Application,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import emailRouter from "./routes/email.route";
import rfqRouter from "./routes/rfq.route";
import { connectDB, disconnectDB } from "./config/database.config";
import {
  startWatch,
  scheduleWatchRenewal,
  stopWatchRenewal,
} from "./services/gmail-watcher.service";

const app: Application = express();

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json());

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    message: "API is running smoothly.",
  });
});

app.use("/api/v1/email", emailRouter);
app.use("/api/v1/rfq", rfqRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
});

export async function initializeServices(): Promise<void> {
  await connectDB();

  try {
    await startWatch();
    scheduleWatchRenewal();
    console.log("Gmail watcher initialized");
  } catch (err) {
    console.error("Failed to initialize Gmail watcher:", err);
    console.warn("Server will continue without Gmail watch — set up GCP credentials and retry");
  }
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

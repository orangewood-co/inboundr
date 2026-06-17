import "dotenv/config";
import app, { initializeServices } from "./app";
import { renderASCIILogo } from "./lib/branding";
import { attachNotificationWebSocketServer } from "./services/notification-ws.service";
import { attachSupportWebSocketServer } from "./services/support-ws.service";

renderASCIILogo();
console.log("Logs: ");
console.log("--------------------------------");

const PORT = process.env.PORT || 3000;

async function start(): Promise<void> {
  await initializeServices();

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
  attachSupportWebSocketServer(server);
  attachNotificationWebSocketServer(server);
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

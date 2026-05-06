import "dotenv/config";
import app, { initializeServices } from "./app";

const PORT = process.env.PORT || 3000;

async function start(): Promise<void> {
  await initializeServices();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

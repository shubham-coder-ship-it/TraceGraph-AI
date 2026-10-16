import { createApp } from "./app.js";
import { closeDb } from "./db.js";
import { config } from "./config.js";
const server = createApp().listen(config.apiPort, config.bind, () =>
  console.log(`TraceGraph API: http://${config.bind}:${config.apiPort}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(() => void closeDb().finally(() => process.exit(0)));
  });

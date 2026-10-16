import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
export const config = {
  graph: process.env.FALKORDB_GRAPH || "tracegraph",
  host: process.env.FALKORDB_HOST || "127.0.0.1",
  port: Number(process.env.FALKORDB_PORT || 6379),
  url: process.env.FALKORDB_URL,
  password: process.env.FALKORDB_PASSWORD,
  apiPort: Number(process.env.PORT || 5000),
  bind: process.env.HOST || "127.0.0.1",
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  key: process.env.OPENAI_API_KEY,
  base: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
};

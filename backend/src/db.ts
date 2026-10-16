import { FalkorDB } from "falkordb";
import { config } from "./config.js";
import { records } from "./results.js";
type Param =
  null | string | number | boolean | Param[] | { [key: string]: Param };
export type Params = Record<string, Param>;
export type Query = <T extends object = Record<string, unknown>>(
  cypher: string,
  params?: Params,
  write?: boolean,
) => Promise<T[]>;
let client: FalkorDB | undefined;
let connecting: Promise<FalkorDB> | undefined;
export class DatabaseError extends Error {
  readonly status = 503;
}
async function connect() {
  if (client) return client;
  const socket = {
    host: config.host,
    port: config.port,
    connectTimeout: 2000,
    reconnectStrategy: false,
  };
  connecting ??= FalkorDB.connect({
    url: config.url,
    password: config.password,
    socket,
  })
    .then((db) => {
      client = db;
      db.on("error", () => {
        console.error(JSON.stringify({ event: "database.connection.error" }));
      });
      return db;
    })
    .finally(() => {
      connecting = undefined;
    });
  return connecting;
}
export const query: Query = async <T extends object>(
  cypher: string,
  params: Params = {},
  write = false,
) => {
  try {
    const db = await connect();
    const graph = db.selectGraph(config.graph);
    const result = await (write
      ? graph.query<T>(cypher, { params, TIMEOUT: 5000 })
      : graph.roQuery<T>(cypher, { params, TIMEOUT: 5000 }));
    return records<T>(result);
  } catch (error) {
    // Never turn failed queries into successful empty responses; do not log params/secrets.
    console.error(
      JSON.stringify({
        event: "database.query.error",
        message:
          error instanceof Error
            ? error.message.replace(/falkors?:\/\/[^\s]+/g, "[redacted]")
            : "unknown",
      }),
    );
    const old = client;
    client = undefined;
    if (old) await old.close().catch(() => {});
    throw new DatabaseError(
      "FalkorDB query failed. Check database connectivity and server logs.",
    );
  }
};
export async function closeDb() {
  const old = client;
  client = undefined;
  if (old) await old.close();
}

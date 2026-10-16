import { spawn } from "node:child_process";
const processes = ["backend", "frontend"].map((folder) =>
  spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "dev", "--prefix", folder],
    { stdio: "inherit", shell: process.platform === "win32" },
  ),
);
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const p of processes) p.kill("SIGTERM");
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, stop);
for (const p of processes)
  p.on("exit", (code) => {
    if (!stopping) {
      process.exitCode = code || 0;
      stop();
    }
  });

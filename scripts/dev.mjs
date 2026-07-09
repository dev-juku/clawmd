import { spawn } from "node:child_process";
import { once } from "node:events";

const vite = spawn("pnpm", ["vite", "--host", "127.0.0.1"], {
  stdio: ["ignore", "pipe", "pipe"],
  env: process.env
});

let devUrl = "";

vite.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  const match = text.match(/http:\/\/127\.0\.0\.1:\d+\//);
  if (match && !devUrl) {
    devUrl = match[0];
  }
});

vite.stderr.on("data", (chunk) => process.stderr.write(chunk));

while (!devUrl) {
  if (vite.exitCode !== null) {
    process.exit(vite.exitCode ?? 1);
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
}

const buildMain = spawn("pnpm", ["tsc", "-p", "tsconfig.node.json"], {
  stdio: "inherit",
  env: process.env
});
const [buildCode] = await once(buildMain, "exit");
if (buildCode !== 0) {
  vite.kill();
  process.exit(buildCode ?? 1);
}

const electron = spawn("pnpm", ["electron", "."], {
  stdio: "inherit",
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: devUrl
  }
});

electron.on("exit", (code) => {
  vite.kill();
  process.exit(code ?? 0);
});

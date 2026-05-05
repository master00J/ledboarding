/**
 * Sluit draaiende LED-boarding builds op Windows zodat electron-builder de portable exe kan overschrijven.
 */
import { spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";

const EXE_NAMES = [
  "ArenaCue-Ledboarding.exe",
  "ArenaCue LED boarding 0.1.0.exe",
  "ArenaCue LED boarding.exe",
];

async function main() {
  if (process.platform !== "win32") return;

  for (const im of EXE_NAMES) {
    spawnSync("taskkill", ["/F", "/IM", im, "/T"], {
      stdio: "ignore",
      windowsHide: true,
    });
  }

  await setTimeout(400);
}

await main();

#!/usr/bin/env node
/**
 * Pre-dev setup — runs automatically before `npm run dev`.
 * Idempotent: skips steps already done.
 */
import { execSync, spawnSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const run = (cmd, opts = {}) =>
  spawnSync(cmd, { shell: true, stdio: "inherit", cwd: ROOT, ...opts });

const ok = (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
const info = (msg) => console.log(`  \x1b[34m→\x1b[0m ${msg}`);

console.log("\n\x1b[1mAustin AVM — dev setup\x1b[0m\n");

// 1. Python deps — api requirements
const apiReqs = join(ROOT, "api", "requirements.txt");
if (existsSync(apiReqs)) {
  info("Installing Python API deps...");
  run(`pip install -q -r "${apiReqs}"`);
  ok("API deps ready");
}

// 2. Install avm ML package (editable)
const mlPkg = join(ROOT, "ml", "pyproject.toml");
if (existsSync(mlPkg)) {
  info("Installing avm ML package...");
  run(`pip install -q -e "${join(ROOT, "ml")}"`);
  ok("avm package installed");
}

// 3. Web node_modules
const webNm = join(ROOT, "web", "node_modules");
if (!existsSync(webNm)) {
  info("Installing web dependencies...");
  run("npm install", { cwd: join(ROOT, "web") });
}
ok("Web deps ready");

// 4. Check .env.local
const envLocal = join(ROOT, "web", ".env.local");
const envExample = join(ROOT, "web", ".env.example");
if (!existsSync(envLocal) && existsSync(envExample)) {
  console.log(
    "\n  \x1b[33m⚠\x1b[0m  web/.env.local not found. Copy web/.env.example → web/.env.local and fill in values.\n"
  );
}

// 5. Check models exist
const modelsDir = join(ROOT, "models");
const requiredModels = ["xgb_model.joblib", "lgb_model.joblib", "meta.json"];
const missing = requiredModels.filter((f) => !existsSync(join(modelsDir, f)));
if (missing.length > 0) {
  console.log(
    `\n  \x1b[33m⚠\x1b[0m  Missing models: ${missing.join(", ")}`
  );
  console.log(
    "     Run: cd ml && python run_training.py 50\n     Or download from https://huggingface.co/ofunrein/austin-avm-models\n"
  );
} else {
  ok("Models present");
}

console.log("\n\x1b[1mStarting servers...\x1b[0m\n");

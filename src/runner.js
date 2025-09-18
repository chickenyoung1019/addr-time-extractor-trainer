// src/runner.js  ← このファイルを丸ごと置き換え

import fs from "fs";
import fse from "fs-extra";
import * as glob from "glob"; // ※ Node v22 では default export ではない
import { runExtractExperimental } from "./extractor_adapter.js";
import { suggestPatchFromFailures } from "./suggest_patch.js";
import { applyPatch } from "./apply_patch.js";

const LEARN = process.argv.includes("--learn");

function loadLogic() {
  try {
    return JSON.parse(fs.readFileSync("src/logic_seed.json", "utf8"));
  } catch (e) {
    console.error("❌ logic_seed.json の読込/JSONパースに失敗:", e.message);
    process.exit(1);
  }
}

function saveLogic(obj) {
  try {
    fse.writeJsonSync("src/logic_seed.json", obj, { spaces: 2 });
  } catch (e) {
    console.error("❌ logic_seed.json の保存に失敗:", e.message);
    process.exit(1);
  }
}

function loadCases() {
  const files = glob.sync("tests/cases/*.json");
  const cases = [];
  for (const f of files) {
    try {
      const json = JSON.parse(fs.readFileSync(f, "utf8"));
      cases.push({ name: json.name || f, ...json });
    } catch (e) {
      console.error(`❌ テストJSONが壊れています: ${f}\n   → ${e.message}`);
      process.exit(1);
    }
  }
  if (cases.length === 0) {
    console.warn("⚠ tests/cases にテストがありません。サンプルを追加してください。");
  }
  return cases;
}

function eq(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function printFail(name, expected, got) {
  console.log("──── FAIL:", name);
  console.log("expected:", JSON.stringify(expected));
  console.log("got     :", JSON.stringify(got));
  console.log("────");
}

const logic0 = loadLogic();
let logic = JSON.parse(JSON.stringify(logic0));
const cases = loadCases();

for (let epoch = 0; epoch < 5; epoch++) {
  const fails = [];
  for (const c of cases) {
    const got = runExtractExperimental(c.input, logic);
    if (!eq(got, c.expected)) {
      printFail(c.name, c.expected, got);
      fails.push({ input: c.input, expected: c.expected, got });
    }
  }

  console.log(`epoch ${epoch} fails: ${fails.length}`);
  if (fails.length === 0) break;

  if (LEARN) {
    const patch = suggestPatchFromFailures({
      failures: [fails[0]], // 代表1件で学習
      currentLogic: logic,
      limits: { maxAdd: 6 },
    });

    if (Object.keys(patch).length) {
      logic = applyPatch(logic, patch);
      saveLogic(logic);
      console.log("✅ applied patch:", patch);
      // 次のepochで再評価
    } else {
      console.log("no patch suggested");
      break;
    }
  } else {
    // 学習モードでなければ一回だけ評価して終了
    break;
  }
}

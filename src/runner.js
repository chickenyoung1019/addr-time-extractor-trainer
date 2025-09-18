import fs from 'fs';
import fse from 'fs-extra';
import * as glob from 'glob';
import { runExtractExperimental } from './extractor_adapter.js';
import { suggestPatchFromFailures } from './suggest_patch.js';
import { applyPatch } from './apply_patch.js';

const LEARN = process.argv.includes('--learn');

function loadLogic(){ return JSON.parse(fs.readFileSync('src/logic_seed.json','utf8')); }
function saveLogic(obj){ fse.writeJsonSync('src/logic_seed.json', obj, { spaces:2 }); }

function loadCases(){
  const files = glob.sync('tests/cases/*.json');
  return files.map(f=>({name:f, ...JSON.parse(fs.readFileSync(f,'utf8'))}));
}

function eq(a,b){ return JSON.stringify(a)===JSON.stringify(b); }

const logic0 = loadLogic();
let logic = JSON.parse(JSON.stringify(logic0));
const cases = loadCases();

for(let epoch=0; epoch<5; epoch++){
  const fails = [];
  for(const c of cases){
    const got = runExtractExperimental(c.input, logic);
    if(!eq(got, c.expected)) fails.push({ input: c.input, expected: c.expected, got });
  }
  console.log(`epoch ${epoch} fails: ${fails.length}`);
  if(!fails.length) break;

  if(LEARN){
    const patch = suggestPatchFromFailures({ failures: [fails[0]], currentLogic: logic, limits:{maxAdd:6} });
    if(Object.keys(patch).length){
      logic = applyPatch(logic, patch);
      saveLogic(logic);
      console.log('applied patch:', patch);
    }else{
      console.log('no patch suggested');
      break;
    }
  }else{
    break; // just report without learning
  }
}

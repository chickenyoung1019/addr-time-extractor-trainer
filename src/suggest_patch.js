// Heuristic patch suggester: looks at failures and proposes small additive patches (no deletion).
import Ajv from 'ajv';
const ajv = new Ajv();

export const patchSchema = {
  type: 'object',
  properties: {
    BLDG_WORDS_add: { type: 'array', items: { type: 'string' } },
    ROOM_TOKENS_add: { type: 'array', items: { type: 'string' } },
    TIME_PATTERNS_add: { type: 'array', items: { type: 'string' } }
  },
  additionalProperties: false
};

export function suggestPatchFromFailures({failures, currentLogic, limits={maxAdd:8}}){
  const cand = { BLDG_WORDS_add: [], ROOM_TOKENS_add: [], TIME_PATTERNS_add: [] };

  for(const f of failures){
    const text = (Array.isArray(f.input)?f.input.join('\n'):String(f.input));
    // If expected has addr2 but got missing, try mining candidate building words
    const needAddr2 = (f.expected?.[0]?.addr2 && !(f.got?.[0]?.addr2));
    if(needAddr2){
      // naive mining: Katakana/Alpha phrases ending with optional space + digits or floor markers
      const m = text.match(/[\p{Script=Katakana}A-Za-z][\p{Script=Katakana}A-Za-z0-9\-]{1,20}(?:\s?タワー|\s?レジデンス|\s?コート|\s?ヒルズ|\s?テラス|\s?ガーデン)?/gu);
      if(m){
        for(const w of m){
          const t = w.replace(/\s+/g,'').slice(0,20);
          if(t.length>=2 && !currentLogic.BLDG_WORDS.includes(t) && !cand.BLDG_WORDS_add.includes(t)) cand.BLDG_WORDS_add.push(t);
          if(cand.BLDG_WORDS_add.length>=limits.maxAdd) break;
        }
      }
    }

    // If expected time exists but got missing, add simple numeric pattern fallback
    const needTime = (f.expected?.[0]?.time && !(f.got?.[0]?.time));
    if(needTime){
      if(!currentLogic.TIME_WINDOW_PATTERNS.some(p=>p.includes('\\d'))){
        cand.TIME_PATTERNS_add.push("(?:[01]?\\d|2[0-3])(?:[:：]?[0-5]?\\d?)?\\s*[~〜～\\-–—]\\s*(?:[01]?\\d|2[0-3])(?:[:：]?[0-5]?\\d?)?");
      }
    }

    // If expected addr2 includes tokens like 号室, 階, F, but got missing → add token
    const ex2 = f.expected?.[0]?.addr2 || '';
    for(const tok of ['号室','室','階','F','#']){
      if(ex2.includes(tok) && !currentLogic.ROOM_TOKENS.includes(tok) && !cand.ROOM_TOKENS_add.includes(tok)){
        cand.ROOM_TOKENS_add.push(tok);
      }
    }
  }

  // enforce limits
  cand.BLDG_WORDS_add = cand.BLDG_WORDS_add.slice(0, limits.maxAdd);
  cand.ROOM_TOKENS_add = cand.ROOM_TOKENS_add.slice(0, limits.maxAdd);
  cand.TIME_PATTERNS_add = cand.TIME_PATTERNS_add.slice(0, 2);

  // Clean empty arrays
  for(const k of Object.keys(cand)) if(!cand[k].length) delete cand[k];

  // Validate
  const valid = ajv.validate(patchSchema, cand);
  if(!valid) return {};
  return cand;
}

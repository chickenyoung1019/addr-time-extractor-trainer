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

export function applyPatch(logic, patch){
  const valid = ajv.validate(patchSchema, patch);
  if(!valid) throw new Error('Patch failed schema validation');
  const next = JSON.parse(JSON.stringify(logic));
  if(patch.BLDG_WORDS_add) next.BLDG_WORDS = uniq([...(next.BLDG_WORDS||[]), ...patch.BLDG_WORDS_add]);
  if(patch.ROOM_TOKENS_add) next.ROOM_TOKENS = uniq([...(next.ROOM_TOKENS||[]), ...patch.ROOM_TOKENS_add]);
  if(patch.TIME_PATTERNS_add) next.TIME_WINDOW_PATTERNS = uniq([...(next.TIME_WINDOW_PATTERNS||[]), ...patch.TIME_PATTERNS_add]);
  return next;
}
function uniq(a){ return [...new Set(a)]; }

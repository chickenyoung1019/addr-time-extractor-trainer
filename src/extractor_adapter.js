// Minimal adapter: you must implement `runExtractExperimental(input, logic)`
// Here, we provide a simple reference extractor compatible with your single-HTML approach
// Replace with your actual experimental extractor if available.

export function runExtractExperimental(input, logic){
  // --- very compact reference implementation ---
  const lines = input.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const out = [];
  let curr = { addr1:"", addr2:"", time:"" };

  function flush(){
    if(curr.addr1){ out.push({...curr}); }
    curr = { addr1:"", addr2:"", time:"" };
  }

  const TIME = new RegExp(logic.TIME_WINDOW_PATTERNS.join('|'));
  const ROOM = new RegExp(logic.ROOM_TOKENS.map(x=>`(?:${escapeRe(x)})`).join('|'));
  const BLDG = new RegExp(logic.BLDG_WORDS.map(x=>`(?:${escapeRe(x)})`).join('|'));

  for(const raw of lines){
    const s = normalize(raw);
    if(/^〒?\d{3}-?\d{4}$/.test(s) || /^東京都|^道府県|^北海道|^大阪府|^京都府|^..県|^..府|^..都/.test(s)){
      // new addr starts
      if(curr.addr1) flush();
      curr.addr1 = s.replace(/^〒/,'');
      continue;
    }
    if(TIME.test(s) && !curr.time){ curr.time = normalizeTimeWindow(s); continue; }
    if(BLDG.test(s) || ROOM.test(s) || /[FfＦｆ]$/.test(s)){
      curr.addr2 += s.replace(/\s+/g,'');
      continue;
    }
    // fallback: supplement to addr1
    if(curr.addr1){ curr.addr1 += (curr.addr1.endsWith('-')?'':'') + (curr.addr1? '\n':'') + s; }
  }
  flush();
  return out.filter(e=>e.addr1);
}

function escapeRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function normalize(s){
  return s
    .replace(/[：:]/g,':')
    .replace(/[〜～–—\-]/g,'-')
    .replace(/[　\s]+/g,' ')
    .replace(/[ｰ―‐]/g,'-')
    .trim();
}

export function normalizeTimeWindow(s){
  const t = normalize(s).replace(/時/g,':00')
    .replace(/午前中|AM/gi,'午前中')
    .replace(/指定時間?なし|時間帯指定なし/gi,'指定なし');
  if(/午前中/.test(t)) return '午前中';
  if(/指定なし/.test(t)) return '指定なし';
  const m = t.match(/(\d{1,2})(?::?\d{0,2})?-(\d{1,2})(?::?\d{0,2})/);
  if(m){
    let a=+m[1], b=+m[2];
    const canon=[[8,12],[12,14],[14,16],[16,18],[18,20],[19,21]];
    let best=[a,b], diff=1e9; for(const [x,y] of canon){ const d=Math.abs(a-x)+Math.abs(b-y); if(d<diff){diff=d;best=[x,y];}}
    return `${best[0]}-${best[1]}`;
  }
  return '';
}

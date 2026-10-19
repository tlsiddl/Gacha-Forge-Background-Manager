(() => {
  'use strict';
  const KEY='__gfMissingBackgroundManager_v034';
  if(typeof window.__gfMissingBackgroundManager_v033==='function')window.__gfMissingBackgroundManager_v033();
  if(typeof window.__gfMissingBackgroundManager_v032==='function')window.__gfMissingBackgroundManager_v032();
  if(typeof window.__gfMissingBackgroundManager_v031==='function')window.__gfMissingBackgroundManager_v031();
  if(typeof window.__gfMissingBackgroundManager_v030==='function')window.__gfMissingBackgroundManager_v030();
  if(typeof window.__gfMissingBackgroundManager_v029==='function')window.__gfMissingBackgroundManager_v029();
  if(typeof window.__gfMissingBackgroundManager_v028==='function')window.__gfMissingBackgroundManager_v028();
  if(typeof window.__gfMissingBackgroundManager_v027==='function')window.__gfMissingBackgroundManager_v027();
  if(typeof window.__gfMissingBackgroundManager_v026==='function')window.__gfMissingBackgroundManager_v026();
  // Remove older versions when upgrading without a full refresh.
  if(typeof window.__gfMissingBackgroundManager_v010==='function')window.__gfMissingBackgroundManager_v010();
  if(typeof window.__gfMissingBackgroundManager_v020==='function')window.__gfMissingBackgroundManager_v020();
  if(typeof window.__gfMissingBackgroundManager_v021==='function')window.__gfMissingBackgroundManager_v021();
  if(typeof window.__gfMissingBackgroundManager_v022==='function')window.__gfMissingBackgroundManager_v022();
  if (typeof window.__gfMissingBackgroundManager_v023 === 'function') window.__gfMissingBackgroundManager_v023();
  if (typeof window.__gfMissingBackgroundManager_v024 === 'function') window.__gfMissingBackgroundManager_v024();
  if(typeof window.__gfMissingBackgroundManager_v025==='function')window.__gfMissingBackgroundManager_v025();
  if (typeof window[KEY] === 'function') window[KEY]();
  const state={disposed:false,runId:'',chapter:'',index:null,places:[],working:new Set(),status:'스토리를 열면 실제 장소를 확인합니다.',visible:false,visualBackground:false,animations:true,motionMinimal:false,placesEnabled:true,animTouched:new Map()};
  const oldFetch=window.fetch;
  const requests=new Set();
  let autoCheckTimer=0,autoCheckToken=0,autoCheckedKey="",checkInFlightKey="";
  function planAutoCheck(){
    if(state.disposed||!state.runId||!state.places.length)return;
    const key=state.runId+"|"+state.chapter+"|"+state.index+"|"+state.places.map(p=>p.slug).join(",");
    if(autoCheckedKey===key||checkInFlightKey===key)return;
    clearTimeout(autoCheckTimer);
    const token=++autoCheckToken;
    autoCheckTimer=setTimeout(()=>{
      if(state.disposed||token!==autoCheckToken)return;
      if(autoCheckedKey===key||checkInFlightKey===key)return;
      checkInFlightKey=key;
      refresh().then(()=>{
        if(!state.disposed&&token===autoCheckToken)autoCheckedKey=key;
      }).catch(()=>{}).finally(()=>{if(checkInFlightKey===key)checkInFlightKey="";});
    },500);
  }
  let box,observer;
  const clean=s=>String(s??'').trim();
  const slug=s=>clean(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/(^-|-$)/g,'').slice(0,60);
  const isGacha=()=>!!document.querySelector('[class*="gacha-forge"], [class*="gachaForge"], [class*="gacha_forge"], [data-gacha-forge], #gacha-forge-root');
  const esc=s=>clean(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function dedupe(a){const m=new Map();for(const p of a){let name=clean(p.name||p.place);if(name&&!m.has(slug(name)))m.set(slug(name),{name,tags:clean(p.tags),url:clean(p.url),slug:slug(name)});}return [...m.values()];}
  function extractPlaces(payload){
    const found=[];const seen=new WeakSet();
    function walk(v,depth){if(depth>7||!v||typeof v!=='object'||seen.has(v))return;seen.add(v);
      if(Array.isArray(v)){for(const x of v.slice(0,140))walk(x,depth+1);return;}
      if(Array.isArray(v.segments))for(const x of v.segments){if(x&&typeof x==='object'&&typeof x.place==='string'&&clean(x.place))found.push({name:x.place});}
      if(v.storyIndex!==undefined&&Array.isArray(v.segments))state.index=v.storyIndex;
      if(v.chapter!==undefined&&Array.isArray(v.segments))state.chapter=String(v.chapter);
      for(const [k,val] of Object.entries(v))if(!/^(segments|dialogue|text|narrative|prompt|prose|description|message)$/i.test(k))walk(val,depth+1);
    }
    walk(payload,0);return dedupe(found);
  }
  function readRequest(input,opts){
    try{const url=new URL(typeof input==='string'?input:input.url,location.href);if(!url.pathname.includes('/api/gacha-forge/'))return null;
      const body=opts?.body;
      let req={url:url.pathname};if(typeof body==='string'){try{req={...req,...JSON.parse(body)}}catch{}}
      return req;
    }catch{return null;}
  }
  function safeJson(r){const ct=r.headers?.get?.('content-type')||'';if(!ct.includes('json'))return Promise.resolve(null);return r.clone().json().catch(()=>null);}
  function listenResponse(req,response){
    if(state.disposed||!req)return;
    if(req.runId){state.runId=req.runId;scheduleUI();}
    if(req.chapter!==undefined)state.chapter=String(req.chapter);
    if(req.storyIndex!==undefined)state.index=Number(req.storyIndex);
    if(!/\/(beat|run|story|backgrounds|background)(\/|$)/.test(req.url))return;
    safeJson(response).then(data=>{
      if(!data||state.disposed)return;
      if(req.url.endsWith('/background')){if(data.ok) {state.status='배경 생성이 완료되었습니다. 스토리를 다시 열어 확인해 주세요.';}return;}
      const places=extractPlaces(data);
      if(places.length){
        // The official beat API sometimes returns a place->URL mapping in
        // `places[]`; use only explicit URLs as proof of saved backgrounds.
        // In old beats the `places` array may be empty even with images saved.
        const entries=Array.isArray(data.places)?data.places:
          (Array.isArray(data.beat?.places)?data.beat.places:[]);
        const mapped=new Map(entries.filter(x=>x&&typeof x==='object'&&clean(x.name))
          .map(x=>[slug(x.name),x]));
        for(const p of places){
          const x=mapped.get(p.slug);
          if(x?.url){p.url=clean(x.url);p.evidence='beat';}
          else if(x&&Object.prototype.hasOwnProperty.call(x,'url')){
            p.verifiedMissing=false;p.evidence='beat-no-url';
          }
        }
        state.places=places;
        state.status=entries.length?'스토리의 장소별 배경 기록을 대조했습니다.':'장소명은 확인했습니다. 저장 여부는 아직 확인할 수 없습니다.';
        draw();
        planAutoCheck();
      }
    });
  }
  const wrapper=function(input,opts){const req=readRequest(input,opts);const p=oldFetch.apply(this,arguments);if(req&&p?.then)p.then(r=>listenResponse(req,r)).catch(()=>{});return p;};
  window.fetch=wrapper;
  const PREF='gfmb-v022-settings';
  try {const pref=JSON.parse(localStorage.getItem(PREF)||'{}'); for(const k of ['animations','motionMinimal','placesEnabled']) if(typeof pref[k]==='boolean')state[k]=pref[k];}catch{}
  function savePrefs(){try{localStorage.setItem(PREF,JSON.stringify({animations:state.animations,motionMinimal:state.motionMinimal,placesEnabled:state.placesEnabled}));}catch{}}
  let header=null,mini=null,pop=null,animTimer=0,uiTimer=0,observedBody=null,probeTimer=0,animRoot=null,animRootLastCheck=0;
  let hostStyle=null;
  const CHAPTER_RE=/(?:\d+\s*챕터|챕터\s*\d+|chapter\s*(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)|제\s*\d+\s*장)/i;
  // Gacha Forge reader's actual chapter subtitle is <span class="mood">…</span>.
  // Traverse open shadow roots as well as the main document; don't depend on localized title text.
  function readerRoots(){
    const roots=[document],queue=[document],seen=new Set([document]);
    for(let i=0;i<queue.length&&i<120;i++){
      const root=queue[i];
      for(const el of root.querySelectorAll('*')){
        const sr=el.shadowRoot;
        if(sr&&!seen.has(sr)){seen.add(sr);queue.push(sr);roots.push(sr);}
      }
    }
    return roots;
  }
  // v0.3.5: never treat other extensions' panels (e.g. the Gacha Forge quest extension) as the story header.
  const GFMB_FOREIGN='#gfmb-details,#gfmb-inline,#gfq-01-panel,#gfq-01-toasts,dialog[open]';
  function headerTarget(){
    const roots=readerRoots();
    // Directly match verified markup. Exclude headings hidden in menus or other panels.
    for(const root of roots){
      for(const n of root.querySelectorAll('span.mood')){
        if(n.closest(GFMB_FOREIGN))continue;
        const t=(n.textContent||'').trim();
        if(!CHAPTER_RE.test(t))continue;
        const r=n.getBoundingClientRect();
        if(r.width>0&&r.height>0&&r.top>=0&&r.top<innerHeight*.5)return n;
      }
    }
    // Fallback for other Gacha Forge releases.
    const nodes=roots.flatMap(root=>[...root.querySelectorAll('span,header,h1,h2,h3')]);
    return nodes.find(n=>{
      if(n.closest(GFMB_FOREIGN))return false;
      const t=(n.textContent||'').trim(),r=n.getBoundingClientRect();
      return t.length>=4&&t.length<140&&CHAPTER_RE.test(t)&&r.width>0&&r.height>0&&r.top>=0&&r.top<innerHeight*.5;
    })||null;
  }
  function activeStory(){return !!headerTarget();}
  function storyRoot(target){
    if(!target)return null;
    let n=target;
    while(n&&n!==document.body){
      const r=n.getBoundingClientRect();
      if(r.width>=Math.min(innerWidth*.50,450)&&r.height>=Math.min(innerHeight*.35,260)&&r.width<=innerWidth+10)return n;
      n=n.parentElement;
    }
    return null;
  }
  function style(){if(document.getElementById('gfmb-v034-style'))return;
    const st=document.createElement('style');st.id='gfmb-v034-style';st.textContent=`
    #gfmb-inline{display:inline-flex;align-items:center;gap:7px;max-width:90%;margin-top:3px;padding:0;background:transparent!important;color:#f4efe6;border:0!important;box-shadow:none!important;font:11px/1.4 system-ui,sans-serif;letter-spacing:.015em;text-shadow:0 1px 3px #000c,0 0 7px #0008;white-space:nowrap;text-overflow:ellipsis;vertical-align:middle}
    #gfmb-inline .gfmb-place{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:min(400px,65vw)}
    #gfmb-inline button{background:transparent!important;border:0!important;padding:0 3px!important;color:inherit!important;opacity:.72;text-shadow:inherit;font:11px system-ui!important;cursor:pointer!important}
    #gfmb-details,#gfmb-details *{box-sizing:border-box}
    #gfmb-details.gfmb-in-fullscreen{z-index:2147483646!important;right:12px;top:12px;max-height:calc(100% - 24px)}
    #gfmb-details{--ink:#1b1a18;--paper:#f1eee6;position:fixed;z-index:2147483000;top:clamp(12px,5vh,50px);right:clamp(10px,2vw,32px);width:min(420px,calc(100vw - 20px));max-height:min(84vh,800px);overflow-y:auto;background:var(--paper);color:var(--ink);border:1px solid #d7d1c7;border-radius:8px;box-shadow:0 18px 60px #000a, 0 0 0 3px #0d0d0d; font:13px/1.5 system-ui,'Malgun Gothic',sans-serif;letter-spacing:-.015em;scrollbar-width:thin;scrollbar-color:#87827a transparent}
    #gfmb-details[hidden]{display:none!important}
    #gfmb-details .gfmb-ticket{position:relative;min-height:100%;padding:20px 20px 17px;background:radial-gradient(circle at 92% 13%,#a29b8d25 0 1px,transparent 2px) 0 0/6px 6px,linear-gradient(#f4f1e9,#ebe6dd)}
    #gfmb-details .gfmb-topline{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:9px;letter-spacing:.19em;text-transform:uppercase;font-weight:800;border-bottom:2px solid var(--ink);padding-bottom:9px}
    #gfmb-details .gfmb-head{display:flex;align-items:flex-start;justify-content:space-between;gap:6px;margin:13px 0 14px}
    #gfmb-details h2{color:var(--ink);font-family:Georgia,'Malgun Gothic',serif;font-size:23px;line-height:1.22;font-weight:900;letter-spacing:-.05em;margin:0}
    #gfmb-details .gfmb-star{font-size:30px;line-height:1;color:#151515;user-select:none}
    #gfmb-details .gfmb-meta{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:11px;border-top:1px solid #a7a198;padding:10px 0;color:#45423e}
    #gfmb-details .gfmb-meta b{font-weight:800;color:#121212}
    #gfmb-details .gfmb-status{border:1.5px solid #222;background:#202020;color:#f4f1e9;padding:12px 13px;margin:0 0 12px}
    #gfmb-details .gfmb-eyebrow{font-size:10px;font-weight:800;letter-spacing:.12em;opacity:.72}
    #gfmb-details .gfmb-statustext{margin-top:4px;font-size:12px;line-height:1.5;font-weight:650;word-break:keep-all}
    #gfmb-details .gfmb-section{border-top:1px dashed #68635e;padding:12px 0}
    #gfmb-details .gfmb-sectiontitle{display:flex;align-items:center;gap:7px;margin:0 0 8px;font-size:11px;letter-spacing:.08em;font-weight:900}
    #gfmb-details label.gfmb-setting{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 2px;border-bottom:1px solid #c5beb1;font-size:12px;font-weight:750;cursor:pointer}
    #gfmb-details label.gfmb-setting:last-of-type{border-bottom:0}
    #gfmb-details input[type=checkbox]{appearance:none;-webkit-appearance:none;position:relative;flex-shrink:0;margin:0;width:36px;height:21px;border-radius:20px;border:1px solid #333;background:#beb8ad;cursor:pointer;transition:background .15s}
    #gfmb-details input[type=checkbox]:checked{background:#252525}
    #gfmb-details input[type=checkbox]::after{content:'';position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:#fff;transition:transform .15s}
    #gfmb-details input[type=checkbox]:checked::after{transform:translateX(15px)}
    #gfmb-details input[type=checkbox]:disabled{opacity:.45;cursor:default}
    #gfmb-details button{font:inherit;cursor:pointer;border-radius:3px;transition:background .15s,color .15s}
    #gfmb-details button:disabled{opacity:.55;cursor:default}
    #gfmb-details .gfmb-close{border:0!important;background:transparent!important;color:var(--ink)!important;font-size:18px;padding:0 3px;line-height:1}
    #gfmb-details .gfmb-action{display:flex;align-items:center;justify-content:space-between;width:100%;padding:12px 13px!important;border:1px solid #111!important;background:#171717!important;color:#fff!important;font-weight:800!important;font-size:12px!important;letter-spacing:.015em}
    #gfmb-details .gfmb-action:not(:disabled):hover{background:#49443f!important}
    #gfmb-details .gfmb-placecard{display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid #bbb5a8;padding:10px 0}
    #gfmb-details .gfmb-placecard:last-child{border-bottom:0}
    #gfmb-details .gfmb-placename{font-weight:900;font-size:14px;word-break:keep-all}
    #gfmb-details .gfmb-caption{color:#625d56;font-size:11px;margin-top:3px}
    #gfmb-details .gfmb-pill{flex-shrink:0;background:#ddd7cc;border:1px solid #777168;border-radius:2px;padding:5px 8px;color:#171717;font-size:10px;font-weight:800;text-align:center;white-space:nowrap}
    #gfmb-details .gfmb-pill.ok{background:#222;color:#fff;border-color:#222}
    #gfmb-details button.gfmb-create{background:#262626;color:#fff;border:1px solid #1a1a1a;border-radius:2px;padding:6px 8px;font-size:11px;font-weight:800}
    #gfmb-details .gfmb-warning{font-size:10px;color:#625d56;line-height:1.6;margin:8px 0 0}
    #gfmb-details .gfmb-foot{display:flex;justify-content:space-between;font-size:9px;font-weight:700;letter-spacing:.1em;border-top:2px solid #171717;padding-top:9px;margin-top:4px;color:#615b53}
    /* v0.3.5 — compact, restrained ticket UI; avoid visually broken cut-outs */
    #gfmb-details{width:min(390px,calc(100vw - 20px));max-height:min(87vh,720px);border-radius:12px;overflow:auto;box-shadow:0 20px 55px #0008;background:#f1eee6}
    #gfmb-details .gfmb-ticket{min-height:0;padding:16px 17px 13px;background:linear-gradient(135deg,#f8f5ee,#ece8df)}
    #gfmb-details .gfmb-topline{padding-bottom:7px;font-size:8px;letter-spacing:.13em;gap:8px}
    #gfmb-details .gfmb-head{margin:10px 0 10px;align-items:center}
    #gfmb-details h2{font-family:system-ui,'Malgun Gothic',sans-serif;font-size:19px;line-height:1.3;letter-spacing:-.04em}
    #gfmb-details .gfmb-version{font-size:10px;font-weight:650;letter-spacing:0;white-space:nowrap}
    #gfmb-details .gfmb-star{font-size:20px}
    #gfmb-details .gfmb-meta{padding:7px 0;font-size:10px;gap:6px;border-top:1px solid #c7c0b4}
    #gfmb-details .gfmb-status{padding:9px 11px;margin:0 0 4px;border-radius:5px}
    #gfmb-details .gfmb-eyebrow{font-size:9px}
    #gfmb-details .gfmb-statustext{font-size:11px;margin-top:2px;line-height:1.4}
    #gfmb-details .gfmb-section{padding:9px 0;border-top:1px solid #c4bcb0}
    #gfmb-details .gfmb-sectiontitle{margin:0 0 5px;font-size:10px;letter-spacing:.025em}
    #gfmb-details label.gfmb-setting{font-size:11px;padding:6px 2px;min-height:31px;border-color:#d5cfc4}
    #gfmb-details input[type=checkbox]{width:32px;height:19px}
    #gfmb-details input[type=checkbox]::after{width:13px;height:13px;top:2px;left:2px}
    #gfmb-details input[type=checkbox]:checked::after{transform:translateX(13px)}
    #gfmb-details .gfmb-action{padding:9px 12px!important;border-radius:5px;font-size:11px!important}
    #gfmb-details .gfmb-placecard{padding:7px 0}
    #gfmb-details .gfmb-placename{font-size:12px}
    #gfmb-details .gfmb-caption{font-size:10px;margin-top:1px}
    #gfmb-details .gfmb-pill{font-size:10px;padding:4px 7px;border-radius:4px}
    #gfmb-details .gfmb-warning{font-size:9px;margin:4px 0 0;line-height:1.35}
    @media(max-width:480px){#gfmb-details{width:calc(100vw - 16px);top:8px;right:8px;max-height:85vh}#gfmb-details .gfmb-ticket{padding:13px}#gfmb-details h2{font-size:17px}}

    `;document.head.appendChild(st);
  }
  function styleForRoot(node){
    const root=node.getRootNode();
    if(root===document)return;
    if(hostStyle?.getRootNode()===root)return;
    hostStyle?.remove();
    hostStyle=document.createElement('style');
    hostStyle.textContent=`#gfmb-inline{display:inline-flex!important;align-items:center;gap:7px;margin-top:3px;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;color:#ebf2ff;text-shadow:0 1px 3px #000c,0 0 7px #0008;font:11px/1.4 system-ui,sans-serif;white-space:nowrap;max-width:min(450px,80vw);vertical-align:middle}#gfmb-inline .gfmb-place{max-width:min(390px,68vw);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#gfmb-inline button{background:transparent!important;border:0!important;padding:0 3px!important;color:inherit!important;opacity:.65;text-shadow:inherit;font:11px system-ui!important;cursor:pointer!important}`;
    root.appendChild(hostStyle);
  }
  function visibleStoryBackground(){
    const tgt=headerTarget(),root=storyRoot(tgt);
    if(!root)return false;
    // This reports only that a sizeable image is shown, NOT that this place has a saved background.
    const bounds=root.getBoundingClientRect();
    const els=[root,...root.querySelectorAll('*')];
    for(const el of els.slice(0,1500)){
      const rect=el.getBoundingClientRect();
      if(rect.width<Math.min(bounds.width*.46,320)||rect.height<Math.min(bounds.height*.34,180))continue;
      const c=getComputedStyle(el);
      if(c.display==='none'||c.visibility==='hidden'||Number(c.opacity)===0)continue;
      if(c.backgroundImage&&c.backgroundImage!=='none'&&/url\(/.test(c.backgroundImage))return true;
      if(el.tagName==='IMG'&&el.complete&&el.naturalWidth>0)return true;
    }
    return false;
  }
  function renderInline(){
    if(state.disposed)return;
    if(!state.placesEnabled){mini?.remove();mini=null;header=null;return;}
    const tgt=headerTarget();if(!tgt){mini?.remove();mini=null;header=null;return;}
    if(!mini||!mini.isConnected||header!==tgt){mini?.remove();mini=document.createElement('span');mini.id='gfmb-inline';header=tgt;styleForRoot(tgt);
      // Subtitle's own parent is usually a row. Insert after it to appear under chapter/story title.
      // Place immediately after the subtitle span inside the existing reader title block.
      tgt.insertAdjacentElement('afterend',mini);
    }
    state.visualBackground=visibleStoryBackground();
    const names=state.places.map(p=>p.name);
    const current=names[0]||'장소 데이터 수신 대기';
    const more=names.length>1?` 외 ${names.length-1}곳`:'';
    const nextHTML=`<span class="gfmb-place" title="${esc(names.join(' · ')||current)}">${esc(current+more)}</span><button type="button" title="배경 관리자 열기" aria-label="배경 관리자 열기">⚙</button>`;
    if(mini.innerHTML!==nextHTML){mini.innerHTML=nextHTML;mini.querySelector('button').onclick=()=>{state.visible=!state.visible;draw();};}
  }
  function draw(){if(!box)return;renderInline();box.hidden=!state.visible;if(!state.visible)return;
    const run=esc(state.runId||'스토리 대기 중');
    const position=state.chapter?`챕터 ${esc(state.chapter)}${state.index!==null?` · 스토리 ${state.index+1}`:''}`:'스토리 대기 중';
    const status=esc(state.status);
    const lines=state.places.length?state.places.map(p=>{
      const ok=!!p.url,missing=!ok&&!!p.verifiedMissing&&p.evidence==='saved-locations';
      const waiting=state.working.has(p.slug);
      const caption=ok?'저장된 배경이 확인되었습니다.':missing?'저장된 배경이 없습니다.':'저장 상태를 확인하지 못했습니다.';
      const action=ok?'<span class="gfmb-pill ok">✓ 등록됨</span>':missing?
        `<button class="gfmb-create" data-gen="${esc(p.slug)}" ${!state.runId||waiting?'disabled':''}>${waiting?'생성 중…':'생성 승인 ↗'}</button>`:
        '<span class="gfmb-pill">확인 필요</span>';
      return `<div class="gfmb-placecard"><div><div class="gfmb-placename">${esc(p.name)}</div><div class="gfmb-caption">${caption}</div></div>${action}</div>`;
    }).join(''):'<p class="gfmb-caption">스토리를 열어 장소 정보를 불러와 주세요.</p>';
    box.innerHTML=`<div class="gfmb-ticket">
      <div class="gfmb-topline"><span>✦ GACHA FORGE</span><span>BACKGROUND / MANAGER</span><button class="gfmb-close" data-act="close" aria-label="닫기" title="닫기">✕</button></div>
      <div class="gfmb-head"><h2>가챠포지 · 배경 관리자 <span class="gfmb-version">v0.3.5</span></h2><span class="gfmb-star" aria-hidden="true">✦</span></div>
      <div class="gfmb-meta"><span>◉ <b>세계</b> ${run}</span><span>▤ <b>${position}</b></span></div>
      <div class="gfmb-status"><div class="gfmb-eyebrow">◆ 배경 상태 · 자동 확인</div><div class="gfmb-statustext">${status}</div></div>
      <div class="gfmb-section"><div class="gfmb-sectiontitle">✦ 화면 설정</div>
      <label class="gfmb-setting">제목 아래 장소 표시<input data-pref="placesEnabled" type="checkbox" ${state.placesEnabled?'checked':''} aria-label="제목 아래 장소 표시"></label>
      <label class="gfmb-setting">애니메이션 보정<input data-pref="animations" type="checkbox" ${state.animations?'checked':''} aria-label="애니메이션 보정"></label>
      <label class="gfmb-setting">장식 움직임 최소화<input data-pref="motionMinimal" type="checkbox" ${state.motionMinimal?'checked':''} ${!state.animations?'disabled':''} aria-label="장식 움직임 최소화"></label>
      </div>
      <div class="gfmb-section gfmb-refreshrow"><button class="gfmb-action" data-act="refresh" ${!state.runId?'disabled':''}><span>↻ &nbsp;다시 확인</span><span>↗</span></button></div>
      <div class="gfmb-section"><div class="gfmb-sectiontitle">◈ 현재 스토리 장소 <span style="margin-left:auto;font-weight:600;color:#766f66">${state.places.length}곳</span></div>${lines}</div>
      <p class="gfmb-warning">※ 배경 생성은 누락이 확인된 장소에서만 승인할 수 있습니다. 이미지 생성 비용이 발생할 수 있습니다.</p>

    </div>`;
  }
  function resetAnim(){
    for(const [el,saved] of state.animTouched){
      if(!el?.style)continue;
      for(const [key,val] of Object.entries(saved)){
        if(val.value)el.style.setProperty(key,val.value,val.priority);
        else el.style.removeProperty(key);
      }
    }
    state.animTouched.clear();
  }
  function fixOneAnimation(el,animation){
    if(!el?.isConnected)return;
    // Reapply only when the target was replaced/repainted or the OS motion rule won.
    if(state.animTouched.has(el)){
      if(el.style.getPropertyValue('animation')!==animation)
        el.style.setProperty('animation',animation,'important');
      return;
    }
    state.animTouched.set(el,{'animation':{
      value:el.style.getPropertyValue('animation'),
      priority:el.style.getPropertyPriority('animation')
    }});
    el.style.setProperty('animation',animation,'important');
  }
  function getAnimationRoot(){
    const now=Date.now();
    if(animRoot && now-animRootLastCheck<1100)return animRoot;
    animRootLastCheck=now;
    let tgt=header && header.isConnected ? header : headerTarget();
    if(!tgt){animRoot=null;return null;}
    animRoot=tgt.getRootNode();
    return animRoot;
  }
  function fixAnimations(){
    if(state.disposed)return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(!state.animations||!reduced){
      if(state.animTouched.size)resetAnim();
      return;
    }
    const root=getAnimationRoot();
    if(!root)return;
    // These are the two verified Gacha Forge v1.8.12 targets, not global CSS.
    // Their elements live in Gacha's open shadow root and loading <g> is transient.
    for(const el of root.querySelectorAll('.vn-next')){
      fixOneAnimation(el,state.motionMinimal
        ? 'none'
        : 'vn-bob 1.6s ease-in-out infinite');
    }
    for(const el of root.querySelectorAll('g.spin')){
      const name=getComputedStyle(el).animationName;
      if(name==='forge-spin'||state.animTouched.has(el))
        fixOneAnimation(el,'forge-spin 1s linear infinite');
    }
    // Avoid holding references to long-deleted loading SVG elements.
    for(const el of state.animTouched.keys())if(!el.isConnected)state.animTouched.delete(el);
  }
  function scheduleUI(){if(state.disposed||uiTimer)return;uiTimer=setTimeout(()=>{uiTimer=0;renderInline();},250);}
  // Mirrors Marinara Engine's first-party API client's admin header convention.
  // The secret is read at request time only; never cached in this extension's state,
  // written to an extension preference, or printed to the console.
  function privilegedHeaders(){
    const headers={'Content-Type':'application/json'};
    try {
      const secret=window.localStorage.getItem('marinara_admin_secret')?.trim();
      if(secret)headers['X-Admin-Secret']=secret;
    } catch {}
    return headers;
  }
  // Gacha Forge's official POST /locations endpoint reads runId:locations
  // and returns {ok:true,places:{slug:{name,url}}}, with ONLY saved URLs.
  // It returns an empty map when background art is disabled too; never
  // interpret a completely empty map as conclusive proof of missing art.
  async function fetchLocations(runId){
    const r=await oldFetch.call(window,'/api/gacha-forge/locations',{
      method:'POST',credentials:'same-origin',
      headers:{...privilegedHeaders(),'X-Marinara-CSRF':'1'},
      body:JSON.stringify({runId})
    });
    const body=await r.json().catch(()=>null);
    if(!r.ok||!body?.ok||!body.places||typeof body.places!=='object'||Array.isArray(body.places)){
      throw new Error(r.status===403?'관리자 인증 실패(403)':`저장 배경 조회 실패 (HTTP ${r.status})`);
    }
    return body.places;
  }
  function lookupSaved(places,p){
    const id=p.slug;
    if(places[id]&&clean(places[id].url))return places[id];
    for(const [key,record] of Object.entries(places)){
      if(record&&clean(record.url)&&(slug(key)===id||slug(record.name)===id))return record;
    }
    return null;
  }
  async function refresh(){
    if(!state.runId||!state.places.length)return;
    const runId=state.runId, snapshot=state.places;
    state.status='저장된 배경을 확인하고 있습니다…';draw();
    let places;
    try{places=await fetchLocations(runId);}
    catch(e){
      if(runId!==state.runId||snapshot!==state.places)return;
      state.status=clean(e.message||e)+' — 저장 상태를 확인할 수 없어 생성 버튼을 잠갔습니다.';
      for(const p of state.places){p.url='';p.verifiedMissing=false;p.evidence='';}
      draw();return;
    }
    if(runId!==state.runId||snapshot!==state.places)return;
    const savedEntries=Object.values(places).filter(v=>v&&clean(v.url));
    // Empty means either nothing has been generated OR background art is off.
    // The official response doesn't distinguish the two cases.
    if(!savedEntries.length){
      for(const p of state.places){p.url='';p.verifiedMissing=false;p.evidence='empty-locations';}
      state.status='저장 배경 목록이 비어 있습니다. 누락으로 확정하지 않았습니다.';
      draw();return;
    }
    let complete=0,missing=0;
    for(const p of state.places){
      const match=lookupSaved(places,p);
      p.url=match?clean(match.url):'';
      p.verifiedMissing=!match;
      p.evidence='saved-locations';
      if(match)complete++;else missing++;
    }
    state.status=`저장 배경 확인 완료 · 등록 ${complete}곳 / 누락 ${missing}곳`;
    draw();
  }
  async function generate(id){
    const p=state.places.find(p=>p.slug===id);
    if(!p||!state.runId||state.working.has(id)||p.url||!p.verifiedMissing||p.evidence!=='saved-locations')return;
    const runId=state.runId;
    if(!confirm(`'${p.name}' 장소의 배경을 생성하시겠습니까?\n기존 저장 여부를 다시 확인한 후 진행하며, 이미지 생성 비용이 발생할 수 있습니다.`))return;
    state.working.add(id);state.status=`${p.name}: 생성 전 중복 여부를 확인하고 있습니다.`;draw();
    try{
      let stored;
      try{stored=await fetchLocations(runId);}
      catch{state.status='생성이 중단되었습니다. 저장 여부를 다시 확인할 수 없습니다.';return;}
      if(runId!==state.runId||!state.places.includes(p)){
        state.status='생성이 중단되었습니다. 스토리가 변경되었습니다.';return;
      }
      if(!Object.values(stored).some(v=>v&&clean(v.url))){
        state.status='생성이 중단되었습니다. 배경 목록이 비어 있습니다.';return;
      }
      const existing=lookupSaved(stored,p);
      if(existing){
        p.url=clean(existing.url);p.verifiedMissing=false;
        state.status='이미 저장된 배경이 확인되어 중복 생성을 방지했습니다.';return;
      }
      state.status=`${p.name}: 배경 생성을 요청하고 있습니다.`;draw();
      const r=await oldFetch.call(window,'/api/gacha-forge/background',{
        method:'POST',credentials:'same-origin',headers:{...privilegedHeaders(),'X-Marinara-CSRF':'1'},
        body:JSON.stringify({runId,name:p.name,tags:p.tags})
      });
      const data=await r.json().catch(()=>({error:'invalid-response'}));
      if(r.status===403){state.status='관리자 인증에 실패했습니다(403). 설정의 관리자 접근 항목을 확인해 주세요.';return;}
      if(!r.ok||!data?.ok){state.status=`생성 실패: HTTP ${r.status}, ${clean(data?.error)||'알 수 없는 오류'}`;return;}
      p.url=clean(data.url)||'generated';p.verifiedMissing=false;p.evidence='generated';
      state.status=`${p.name}: ${data.cached?'저장된 배경을 재사용했습니다.':'배경 생성이 완료되었습니다.'} 스토리를 다시 열면 표시될 수 있습니다.`;
    }catch(e){state.status=`네트워크 오류: ${clean(e.message||e)}`;}
    finally{state.working.delete(id);draw();}
  }
  // The browser Fullscreen API displays only the fullscreen element's subtree.
  // Move our existing popup into that subtree, then move it back when exiting.
  // This preserves dialog state, action handlers, and any in-flight lookups.
  let fullscreenPanelStyle=null;
  function currentFullscreenHost(){
    // document.fullscreenElement identifies the browser's fullscreen target,
    // even if its contents are rendered in an open shadow root.
    let el=document.fullscreenElement||document.webkitFullscreenElement||null;
    for(let i=0;i<6&&el?.shadowRoot?.fullscreenElement;i++)
      el=el.shadowRoot.fullscreenElement;
    return el;
  }
  function fullscreenDestination(){
    const host=currentFullscreenHost();
    if(!host)return document.body;
    // Light DOM appended to a shadow host is not rendered unless explicitly
    // slotted. Put the panel in the *rendered* open shadow tree instead.
    return host.shadowRoot||host;
  }
  function syncFullscreenPanel(){
    if(state.disposed||!box||!document.body)return;
    const host=currentFullscreenHost();
    const destination=fullscreenDestination();
    if(!destination)return;
    if(box.parentNode!==destination)destination.appendChild(box);
    const root=box.getRootNode();
    if(root instanceof ShadowRoot){
      if(!fullscreenPanelStyle||fullscreenPanelStyle.getRootNode()!==root){
        fullscreenPanelStyle?.remove();
        fullscreenPanelStyle=document.createElement('style');
        fullscreenPanelStyle.id='gfmb-fullscreen-style';
        fullscreenPanelStyle.textContent=document.getElementById('gfmb-v034-style')?.textContent||'';
        root.appendChild(fullscreenPanelStyle);
      }
    }else{
      fullscreenPanelStyle?.remove();fullscreenPanelStyle=null;
    }
    box.classList.toggle('gfmb-in-fullscreen',!!host);
  }
  function onFullscreenChanged(){
    syncFullscreenPanel();
    if(state.visible)draw();
  }
  document.addEventListener('fullscreenchange',onFullscreenChanged);
  document.addEventListener('webkitfullscreenchange',onFullscreenChanged);
  function mount(){if(state.disposed||box)return;style();box=document.createElement('aside');box.id='gfmb-details';box.hidden=true;box.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;if(t.dataset.act==='close'){state.visible=false;draw();}else if(t.dataset.act==='refresh')refresh().catch(e=>{state.status=String(e);draw()});else if(t.dataset.gen)generate(t.dataset.gen);});
    box.addEventListener('change',e=>{const k=e.target?.dataset?.pref;if(!['animations','motionMinimal','placesEnabled'].includes(k))return;state[k]=!!e.target.checked;savePrefs();resetAnim();fixAnimations();draw();});
    document.body.append(box);observedBody=document.body;syncFullscreenPanel();
    observer=new MutationObserver(scheduleUI);observer.observe(document.body,{childList:true,subtree:true});
    animTimer=setInterval(fixAnimations,120);
    // For shadow-root UIs the body observer doesn't receive internal mutations.
    // Slow, bounded probe only until the subtitle is mounted.
    probeTimer=setInterval(()=>{if(!state.disposed){if(!mini||!mini.isConnected)renderInline();if(box&&box.parentNode!==fullscreenDestination())syncFullscreenPanel();}},400);draw();}
  if(document.body)mount();else document.addEventListener('DOMContentLoaded',mount,{once:true});
  window[KEY]=()=>{state.disposed=true;if(window.fetch===wrapper)window.fetch=oldFetch;observer?.disconnect();clearTimeout(autoCheckTimer);autoCheckToken++;clearTimeout(uiTimer);clearInterval(animTimer);clearInterval(probeTimer);resetAnim();document.removeEventListener('fullscreenchange',onFullscreenChanged);document.removeEventListener('webkitfullscreenchange',onFullscreenChanged);fullscreenPanelStyle?.remove();hostStyle?.remove();box?.remove();mini?.remove();document.getElementById('gfmb-v034-style')?.remove();delete window[KEY];};
})();

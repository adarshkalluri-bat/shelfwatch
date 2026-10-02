(function(){
"use strict";
/* ---------- constants ---------- */
const STATUS=[
  {id:'on-floor',label:'On floor',tone:''},
  {id:'selling-fast',label:'Selling fast',tone:'good'},
  {id:'restocked',label:'Restocked',tone:'good'},
  {id:'sold-out',label:'Sold out',tone:'warn'},
  {id:'on-sale',label:'On sale / discount',tone:'warn'},
  {id:'removed',label:'Removed',tone:'bad'}];
const STATUS_BY=Object.fromEntries(STATUS.map(s=>[s.id,s]));
const DEFAULTS={
  team:['Adarsh','Ankita','Hemant','Santosh','Anuj','Shilpa'],
  fixtures:['Shelf Display','Shelf Hook','Power Aisle','End Cap','Power Aisle & End Cap','POS Display','Entry Gate Wall','Full Bin Display','Table Display','Gondola'],
  purposes:['Colour Inspiration','Product Development','Design Inspiration','Design & Colour Inspiration','Missing Assortment','Price Benchmark','WIP']};
const OPTIONAL=[
  {k:'depth',t:'More depth or width added',d:'More colours, sizes, prints or facings'},
  {k:'multi',t:'Multiple displays',d:'Seen in more than one place in the store'},
  {k:'tag',t:'Best seller tag on shelf',d:'Retailer marks it as best or top seller'},
  {k:'across',t:'Available across stores',d:'Seen in other formats or other retailers'}];
const AVC=['#0A66D8','#C2410C','#15803D','#7C3AED','#B91C1C','#0E7490','#A16207','#BE185D'];
const IC={
  chev:'<svg class="chev" viewBox="0 0 8 13"><path d="M1.5 1.5 6.5 6.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  back:'<svg viewBox="0 0 12 20" style="width:12px;height:20px"><path d="M10 2 2 10l8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  img:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>',
  cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  store:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5 5.5 4h13L20 9.5M4 9.5V20h16V9.5M4 9.5c0 1.4 1.1 2.5 2.7 2.5S9.3 10.9 9.3 9.5c0 1.4 1.2 2.5 2.7 2.5s2.7-1.1 2.7-2.5c0 1.4 1.1 2.5 2.6 2.5S20 10.9 20 9.5M9.5 20v-5h5v5"/></svg>',
  dl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg>',
  ul:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4m-5 5 5-5 5 5M5 20h14"/></svg>',
  edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>'
};

/* ---------- state ---------- */
const S={ready:false,noDb:false,readOnly:false,stores:{},products:{},entries:{},visits:{},cfg:{},photoCache:{},
  tab:'home',page:null,pf:{q:'',store:'all',buyer:'all',status:'all',sort:'recent'},ins:{store:'all'},activeVisit:null,visitMine:true};
let db=null,assets=null,downloads=null,userCap=null;
const ls={get(k,d){try{const v=localStorage.getItem('sw:'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('sw:'+k,JSON.stringify(v))}catch(e){}}};
S.me=ls.get('me','');S.activeVisit=ls.get('activeVisit',null);S.visitMine=ls.get('visitMine',true);

/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=p=>(p||'x')+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const pd=s=>{if(!s)return null;const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const fd=(s,o)=>{const d=pd(s);if(!d)return '';const t=d.getDate()+' '+MON[d.getMonth()];return o==='dow'?DOW[d.getDay()]+', '+t:(o==='y'?t+' '+d.getFullYear():t)};
const daysBetween=(a,b)=>Math.round((pd(b)-pd(a))/864e5);
const rel=s=>{const n=daysBetween(s,today());if(n<=0)return 'Today';if(n===1)return 'Yesterday';if(n<7)return n+' days ago';if(n<30)return Math.round(n/7)+' wk ago';return fd(s,'y')};
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const priceNum=p=>{const m=String(p||'').replace(/,/g,'').match(/\d+(\.\d+)?/g);return m?Math.min(...m.map(Number)):null};
const fmtPrice=p=>{if(!p)return '—';const s=String(p).trim();return /^\d/.test(s)?'₹'+s:s};
const avColor=n=>AVC[[...String(n)].reduce((a,c)=>a+c.charCodeAt(0),0)%AVC.length];
const initials=n=>String(n||'?').split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
const team=()=>{const base=(S.cfg.team&&S.cfg.team.length?S.cfg.team:DEFAULTS.team).slice();(PLATFORM.status.members||[]).forEach(m=>{if(m.name&&!base.includes(m.name))base.push(m.name)});return base};
const fixtures=()=>(S.cfg.fixtures&&S.cfg.fixtures.length?S.cfg.fixtures:DEFAULTS.fixtures);
const purposes=()=>(S.cfg.purposes&&S.cfg.purposes.length?S.cfg.purposes:DEFAULTS.purposes);
const storeName=id=>{const s=S.stores[id];return s?(s.name+(s.location?' · '+s.location:'')):'Unknown store'};
const storeShort=id=>{const s=S.stores[id];return s?s.name:'Store'};
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),2200)}
function photoSrc(ref){return PLATFORM.photoUrl(ref)}
const img=(ref,cls,extra)=>ref?`<img ${cls?`class="${cls}"`:''} data-ph="${esc(ref)}" src="${esc(photoSrc(ref))}" alt="" loading="lazy" ${extra||''}>`:'';

/* ---------- derived ---------- */
function entriesOf(pid){return Object.values(S.entries).filter(e=>e.productId===pid).sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.at||0)-(b.at||0))}
let _idx=null;
function idx(){
  if(_idx)return _idx;
  const by={};for(const e of Object.values(S.entries)){(by[e.productId]=by[e.productId]||[]).push(e)}
  for(const k in by)by[k].sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.at||0)-(b.at||0));
  _idx={by};return _idx;
}
function ents(pid){return idx().by[pid]||[]}
function latest(pid){const a=ents(pid);return a[a.length-1]||null}
function prevOf(pid,e){const a=ents(pid);const i=a.indexOf(e);return i>0?a[i-1]:null}
function cover(p){const a=ents(p.id);for(let i=a.length-1;i>=0;i--){if(a[i].photos&&a[i].photos.length)return a[i].photos[0]}return p.cover||''}
function allPhotos(p){const out=[];const a=ents(p.id);for(let i=a.length-1;i>=0;i--)(a[i].photos||[]).forEach(x=>out.push(x));if(!out.length&&p.cover)out.push(p.cover);return out}
function diff(prev,cur){
  const ch=[];if(!prev)return [{k:'new',t:'First logged'}];
  if(norm(prev.price)!==norm(cur.price)&&cur.price){const a=priceNum(prev.price),b=priceNum(cur.price);ch.push({k:'price',t:fmtPrice(prev.price)+' → '+fmtPrice(cur.price),dir:(a!=null&&b!=null)?(b>a?'up':b<a?'down':''):''})}
  if(norm(prev.fixture)!==norm(cur.fixture)&&cur.fixture)ch.push({k:'fixture',t:(prev.fixture||'—')+' → '+cur.fixture});
  if((prev.status||'on-floor')!==(cur.status||'on-floor'))ch.push({k:'status',t:(STATUS_BY[cur.status]||{}).label||cur.status,tone:(STATUS_BY[cur.status]||{}).tone});
  if(cur.observation&&norm(prev.observation)!==norm(cur.observation))ch.push({k:'obs',t:'New observation'});
  return ch;
}
function weeksOnFloor(p){
  const a=ents(p.id);if(!a.length)return 0;
  const first=p.firstSeen||a[0].date;let last=null;
  for(const e of a){if(e.status!=='removed')last=e.date}
  if(!last)return 0;return Math.max(0,Math.floor(daysBetween(first,last)/7));
}
function bsEval(p){
  const a=ents(p.id);const l=a[a.length-1];const w=weeksOnFloor(p);
  const m1=w>=3;const liq=a.some(e=>e.status==='on-sale');const m2=!liq;
  const bs=p.bs||{};const opt=OPTIONAL.filter(o=>bs[o.k]).length;
  let stage='watching',label='Watching',tone='';
  if(l&&l.status==='removed'){stage='dropped';label='Dropped';tone='bad'}
  else if(p.bsVerdict==='yes'){stage='best';label='Best seller';tone='gold'}
  else if(p.bsVerdict==='no'){stage='not';label='Not a best seller';tone=''}
  else if(m1&&m2&&opt>=2){stage='likely';label='Likely best seller';tone='good'}
  else if(m1&&m2){stage='candidate';label='Candidate';tone='tint'}
  return {w,m1,m2,liq,opt,stage,label,tone};
}
function visitsOfStore(sid){return Object.values(S.visits).filter(v=>v.storeId===sid).sort((a,b)=>(a.date||'').localeCompare(b.date||''))}
function lastVisitAny(){const v=Object.values(S.visits).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.at||0)-(a.at||0));return v[0]||null}
function activeProducts(){return Object.values(S.products).filter(p=>!p.archived)}

/* ---------- data writes ---------- */
async function w(fn,okMsg){
  try{await fn();if(okMsg)toast(okMsg);return true}
  catch(e){console.warn(e);if(e&&e.code==='invalid_argument'){S.readOnly=true;toast('This change couldn’t be saved on this device.')}else if(e&&e.code==='quota_exceeded'){toast('Storage is full. Remove old photos or archived products.')}else toast('Couldn’t save. Check your connection and try again.');return false}
}
async function compress(file,max,q){
  const url=URL.createObjectURL(file);
  try{const im=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url});
    let {width:wd,height:ht}=im;const s=Math.min(1,max/Math.max(wd,ht));wd=Math.round(wd*s);ht=Math.round(ht*s);
    const c=document.createElement('canvas');c.width=wd;c.height=ht;c.getContext('2d').drawImage(im,0,0,wd,ht);
    return await new Promise(r=>c.toBlob(r,'image/jpeg',q));
  }finally{URL.revokeObjectURL(url)}
}
async function savePhoto(file){const b=await compress(file,1400,.8);const ref='ph_'+Date.now().toString(36)+Math.random().toString(36).slice(2,9);await PLATFORM.putPhoto(ref,b,true);return ref}

/* ---------- rendering: shell ---------- */
function setTab(t){S.tab=t;S.page=null;render();window.scrollTo(0,0)}
function topbar(title,left,right){return `<header class="top" id="top"><div class="side">${left||''}</div><div class="t">${esc(title)}</div><div class="side r">${right||''}</div></header>`}
function render(){
  _idx=null;
  document.querySelectorAll('#tabbar button').forEach(b=>b.classList.toggle('on',b.dataset.tab===S.tab&&!S.page));
  const app=$('#app');let h='';
  if(S.page&&S.page.type==='product')h=viewProduct(S.page.id);
  else if(S.page&&S.page.type==='visit')h=viewVisit(S.page.id);
  else if(S.tab==='home')h=viewHome();
  else if(S.tab==='products')h=viewProducts();
  else if(S.tab==='visit')h=viewVisitStart();
  else if(S.tab==='insights')h=viewInsights();
  else h=viewSettings();
  app.innerHTML=h;onScroll();
}
function emptyState(t,d,btn){return `<div class="empty">${IC.store}<b>${esc(t)}</b><div>${esc(d)}</div>${btn||''}</div>`}
function notReady(){return `<div class="empty"><div class="spin"></div><div>Loading your store visits…</div></div>`}
function ago(t){const s=Math.round((Date.now()-t)/1000);if(s<45)return 'just now';const m=Math.round(s/60);if(m<60)return m+' min ago';const h=Math.round(m/60);return h+' hr ago'}
function syncPill(){const s=PLATFORM.status;let t,c;
  if(!s.online){t=s.pending?`Offline · ${s.pending} change${s.pending>1?'s':''} saved on this device`:'Offline · you can keep working';c='warn'}
  else if(s.error){t=s.error;c='bad'}
  else if(s.pending){t=`Syncing ${s.pending} change${s.pending>1?'s':''}…`;c='tint'}
  else if(s.syncing&&!s.lastSync){t='Syncing…';c='tint'}
  else{t='All changes synced'+(s.lastSync?' · '+ago(s.lastSync):'');c='good'}
  return `<button id="syncpill" class="pill ${c}" data-act="tab" data-tab="more" style="white-space:normal;text-align:left;margin:-8px 0 16px"><span class="sdot"></span>${esc(t)}</button>`}
function updatePill(){const p=$('#syncpill');if(p)p.outerHTML=syncPill();const q=$('#syncrow');if(q)q.innerHTML=syncDetail()}

/* ---------- Home ---------- */
function viewHome(){
  const meBtn=`<button class="ibtn" data-act="who" aria-label="Who is using this">${S.me?`<span class="av" style="background:${avColor(S.me)}">${esc(initials(S.me))}</span>`:IC.plus}</button>`;
  let h=topbar('Shelfwatch','',meBtn)+`<h1 class="lt">Shelfwatch</h1><p class="sub">${S.me?'Hi '+esc(S.me)+'. ':''}Competitor store benchmarking for Household.</p>`;
  if(!S.ready)return h+notReady();
  h+=syncPill();
  const av=S.activeVisit&&S.visits[S.activeVisit];
  if(av){const done=visitProgress(av);
    h+=`<div class="hero"><div class="live"><i></i>Visit in progress</div><div><h3>${esc(storeName(av.storeId))}</h3><p>${esc(fd(av.date,'dow'))} · ${done.done} of ${done.total} products checked</p></div><button class="btn" data-act="open-visit" data-id="${av.id}">Continue visit</button></div>`;
  }else{
    h+=`<div class="hero"><div><h3>Going to a store?</h3><p>Start a visit and update each product in a few taps. Last time’s details are filled in for you.</p></div><button class="btn" data-act="tab" data-tab="visit">${IC.plus} Start a store visit</button></div>`;
  }
  const ps=activeProducts();const evs=ps.map(p=>[p,bsEval(p)]);
  const cnt=k=>evs.filter(x=>x[1].stage===k).length;
  const openActions=ps.filter(p=>p.action&&p.action.text&&!p.action.done).length;
  h+=`<div class="sec"><h2>At a glance</h2></div><div class="tiles">
    <button class="tile tap" data-act="goprod" data-status="all"><span class="k">Products tracked</span><span class="v">${ps.length}</span></button>
    <button class="tile tap" data-act="goprod" data-status="best"><span class="k"><i style="background:var(--gold)"></i>Best sellers</span><span class="v">${cnt('best')+cnt('likely')}</span></button>
    <button class="tile tap" data-act="goprod" data-status="candidate"><span class="k"><i style="background:var(--tint)"></i>Candidates</span><span class="v">${cnt('candidate')}</span></button>
    <button class="tile tap" data-act="goprod" data-status="action"><span class="k"><i style="background:var(--warn)"></i>Open actions</span><span class="v">${openActions}</span></button></div>`;
  // recent changes
  const lv=lastVisitAny();
  h+=`<div class="cols"><div>`;
  if(lv){
    const ch=changesForVisit(lv.id).filter(c=>c.ch.some(x=>x.k!=='obs'||true));
    h+=`<div class="sec"><h2>Last visit</h2><button class="lnk" data-act="open-visit" data-id="${lv.id}">Open</button></div><p class="foot" style="margin:0 4px 8px">${esc(storeName(lv.storeId))} · ${esc(fd(lv.date,'dow'))}</p>`;
    const shown=ch.filter(c=>c.ch.length&&!(c.ch.length===1&&c.ch[0].k==='obs')).slice(0,6);
    const nP=ch.filter(c=>c.ch.some(x=>x.k==='price')).length,nF=ch.filter(c=>c.ch.some(x=>x.k==='fixture')).length,nN=ch.filter(c=>c.ch.some(x=>x.k==='new')).length,nO=ch.filter(c=>c.ch.some(x=>x.k==='obs')).length;
    h+=`<div class="facts" style="margin:0 0 10px;grid-template-columns:repeat(4,minmax(0,1fr))"><div><span class="k">Checked</span><span class="v">${ch.length}</span></div><div><span class="k">New</span><span class="v">${nN}</span></div><div><span class="k">Price</span><span class="v">${nP}</span></div><div><span class="k">Notes</span><span class="v">${nO}</span></div></div>`;
    const list=shown.length?shown:ch.slice(0,6);
    h+=list.length?`<div class="group">${list.map(c=>prodRow(c.p,changeLine(c.ch))).join('')}</div>`:`<div class="note">No updates logged at this visit yet.</div>`;
  }
  h+=`</div><div>`;
  // needs revisit
  const stale=ps.map(p=>[p,latest(p.id)]).filter(([p,l])=>l&&l.status!=='removed'&&daysBetween(l.date,today())>=21).sort((a,b)=>a[1].date.localeCompare(b[1].date)).slice(0,6);
  h+=`<div class="sec"><h2>Due for a revisit</h2></div>`;
  h+=stale.length?`<div class="group">${stale.map(([p,l])=>prodRow(p,'Last seen '+rel(l.date)+' · '+storeShort(p.storeId))).join('')}</div>`:`<div class="note">Everything has been checked in the last three weeks.</div>`;
  const acts=ps.filter(p=>p.action&&p.action.text&&!p.action.done).slice(0,5);
  if(acts.length){h+=`<div class="sec"><h2>Actions to close</h2></div><div class="group">${acts.map(p=>prodRow(p,(p.action.text)+(p.action.due?' · due '+fd(p.action.due):''))).join('')}</div>`}
  h+=`</div></div>`;
  return h;
}
function changeLine(ch){return ch.filter(c=>c.k!=='obs').map(c=>c.t).join(' · ')||(ch.length?'Observation updated':'')}
function prodRow(p,meta){
  const ev=bsEval(p);
  return `<button class="row th" data-act="product" data-id="${p.id}"><span class="thumb">${img(cover(p))||IC.img}</span><span class="grow"><div class="ttl">${esc(p.name)}</div><div class="meta">${esc(meta)}</div></span>${ev.stage!=='watching'?`<span class="pill ${ev.tone}">${esc(ev.label)}</span>`:''}${IC.chev}</button>`;
}
function changesForVisit(vid){
  const out=[];
  for(const e of Object.values(S.entries)){if(e.visitId!==vid)continue;const p=S.products[e.productId];if(!p)continue;out.push({p,e,ch:diff(prevOf(p.id,e),e)})}
  const rank=c=>c.ch.some(x=>x.k==='status'&&x.tone==='bad')?0:c.ch.some(x=>x.k==='price')?1:c.ch.some(x=>x.k==='status')?2:c.ch.some(x=>x.k==='fixture')?3:c.ch.some(x=>x.k==='new')?4:5;
  return out.sort((a,b)=>rank(a)-rank(b));
}

/* ---------- Products ---------- */
function viewProducts(){
  let h=topbar('Products','',`<button class="ibtn" data-act="new-product" aria-label="Add product">${IC.plus}</button>`)+`<h1 class="lt">Products</h1>`;
  if(!S.ready)return h+notReady();
  const f=S.pf;
  h+=`<div class="search">${IC.search}<input id="pq" type="search" placeholder="Search name, category, brand" value="${esc(f.q)}" autocomplete="off"></div>`;
  const stores=Object.values(S.stores).sort((a,b)=>a.name.localeCompare(b.name));
  h+=`<div class="chips">${chip('store','all','All stores',f.store)}${stores.map(s=>chip('store',s.id,s.name+(s.location?' '+s.location:''),f.store)).join('')}</div>`;
  h+=`<div class="chips" style="margin-top:6px">${chip('buyer','all','Everyone',f.buyer)}${team().map(t=>chip('buyer',t,t,f.buyer)).join('')}</div>`;
  h+=`<div class="chips" style="margin-top:6px">${[['all','All'],['best','Best sellers'],['candidate','Candidates'],['watching','Watching'],['action','Open actions'],['dropped','Dropped'],['archived','Archived']].map(([k,l])=>chip('status',k,l,f.status)).join('')}</div>`;
  const list=filteredProducts();
  h+=`<div style="display:flex;justify-content:space-between;align-items:center;margin:16px 2px 10px"><span class="foot" style="margin:0">${list.length} product${list.length===1?'':'s'}</span><div class="seg" style="width:220px">${[['recent','Recent'],['name','A–Z'],['weeks','Weeks']].map(([k,l])=>`<button data-act="psort" data-k="${k}" class="${f.sort===k?'on':''}">${l}</button>`).join('')}</div></div>`;
  if(!list.length)return h+emptyState(Object.keys(S.products).length?'No products match':'No products yet',Object.keys(S.products).length?'Try a different search or filter.':'Start a store visit and add the first product you spot.');
  h+=`<div class="pgrid">${list.map(pcard).join('')}</div>`;
  return h;
}
function chip(grp,val,label,cur){return `<button class="chip ${cur===val?'on':''}" data-act="pf" data-g="${grp}" data-v="${esc(val)}">${esc(label)}</button>`}
function filteredProducts(){
  const f=S.pf;const q=norm(f.q);
  let list=Object.values(S.products).filter(p=>f.status==='archived'?p.archived:!p.archived);
  if(f.store!=='all')list=list.filter(p=>p.storeId===f.store);
  if(f.buyer!=='all')list=list.filter(p=>p.buyer===f.buyer);
  if(q)list=list.filter(p=>norm([p.name,p.category,p.brand,p.purpose,storeName(p.storeId)].join(' ')).includes(q));
  if(['best','candidate','watching','dropped'].includes(f.status))list=list.filter(p=>{const s=bsEval(p).stage;return f.status==='best'?(s==='best'||s==='likely'):s===f.status});
  if(f.status==='action')list=list.filter(p=>p.action&&p.action.text&&!p.action.done);
  const ld=p=>(latest(p.id)||{}).date||'';
  if(f.sort==='name')list.sort((a,b)=>a.name.localeCompare(b.name));
  else if(f.sort==='weeks')list.sort((a,b)=>weeksOnFloor(b)-weeksOnFloor(a));
  else list.sort((a,b)=>ld(b).localeCompare(ld(a))||a.name.localeCompare(b.name));
  return list;
}
function pcard(p){
  const l=latest(p.id)||{};const ev=bsEval(p);const c=cover(p);
  const st=l.status&&l.status!=='on-floor'?STATUS_BY[l.status]:null;
  return `<button class="pcard tap" data-act="product" data-id="${p.id}"><div class="ph">${c?img(c):IC.img}${ev.stage!=='watching'?`<span class="pill ${ev.tone||''}">${esc(ev.label)}</span>`:''}</div><div class="bd"><div class="nm">${esc(p.name)}</div><div class="mt">${esc(storeShort(p.storeId))} · ${esc(p.buyer||'')}</div><div class="pr">${esc(fmtPrice(l.price))}</div><div class="mt">${st?`<span style="color:var(--${st.tone||'label2'})">${esc(st.label)}</span> · `:''}${l.date?esc(rel(l.date)):'Not logged'}</div></div></button>`;
}

/* ---------- Product detail ---------- */
function viewProduct(pid){
  const p=S.products[pid];
  if(!p)return topbar('',`<button class="lnk" data-act="back">${IC.back} Back</button>`)+emptyState('Product not found','It may have been deleted.');
  const a=ents(pid);const l=a[a.length-1]||{};const prev=a.length>1?a[a.length-2]:null;const ev=bsEval(p);const ph=allPhotos(p);
  let h=topbar(p.name,`<button class="lnk" data-act="back">${IC.back} Back</button>`,`<button class="lnk" data-act="edit-product" data-id="${pid}">Edit</button>`);
  h+=`<div class="page-enter"><div class="cols" style="align-items:start"><div>`;
  h+=`<div class="dhero">${ph.length?`<div class="strip" id="strip">${ph.map((r,i)=>img(r,'',`data-act="zoom" data-ref="${esc(r)}"`)).join('')}</div>${ph.length>1?`<span class="cnt">${ph.length} photos</span>`:''}`:`<div class="none">${IC.img}</div>`}</div>`;
  h+=`</div><div>`;
  h+=`<div class="dname">${esc(p.name)}</div><div class="foot" style="margin:0 0 10px;font-size:15px">${p.brand&&norm(p.brand)!==norm(storeShort(p.storeId))?esc(p.brand)+' · ':''}${esc(storeName(p.storeId))}</div>`;
  h+=`<div class="pills"><span class="pill ${ev.tone}">${esc(ev.label)}</span>${p.category?`<span class="pill">${esc(p.category)}</span>`:''}${p.purpose?`<span class="pill tint">${esc(p.purpose)}</span>`:''}<span class="pill"><span class="av" style="width:16px;height:16px;font-size:8px;background:${avColor(p.buyer)}">${esc(initials(p.buyer))}</span>${esc(p.buyer||'—')}</span>${p.archived?'<span class="pill bad">Archived</span>':''}</div>`;
  const pa=prev?priceNum(prev.price):null,pb=priceNum(l.price);
  const pdir=(pa!=null&&pb!=null&&pa!==pb)?`<span class="d ${pb>pa?'up':'down'}">${pb>pa?'▲':'▼'} from ${esc(fmtPrice(prev.price))}</span>`:'';
  h+=`<div class="facts"><div><span class="k">Price</span><span class="v">${esc(fmtPrice(l.price))}</span>${pdir}</div><div><span class="k">Fixture</span><span class="v" style="font-size:15px">${esc(l.fixture||'—')}</span></div><div><span class="k">Weeks on floor</span><span class="v">${ev.w}</span><span class="d" style="color:var(--label2);font-weight:500">since ${esc(fd(p.firstSeen||(a[0]||{}).date))}</span></div><div><span class="k">Last status</span><span class="v" style="font-size:15px;color:var(--${(STATUS_BY[l.status]||{}).tone||'label'})">${esc((STATUS_BY[l.status]||STATUS_BY['on-floor']).label)}</span><span class="d" style="color:var(--label2);font-weight:500">${l.date?esc(rel(l.date)):''}</span></div></div>`;
  h+=`<div style="margin-top:14px"><button class="btn" data-act="update" data-id="${pid}">${IC.cam} Log an update</button></div>`;
  h+=`</div></div>`;
  // best seller + action
  h+=`<div class="cols"><div><div class="cap">Best-seller check</div><div class="group">`;
  h+=`<div class="verdict"><div class="grow" style="flex:1"><div class="big">${esc(ev.label)}</div><div class="foot" style="margin:2px 0 0">${ev.m1&&ev.m2?'Both must-haves met':'Must-haves not met yet'} · ${ev.opt} of 4 signals</div><div class="meter">${[ev.m1,ev.m2,...OPTIONAL.map(o=>(p.bs||{})[o.k])].map(x=>`<i class="${x?'on':''}"></i>`).join('')}</div></div></div>`;
  h+=`<div class="check auto ${ev.m1?'on':'off'}"><span class="bx">${ev.m1?IC.check:''}</span><span class="grow"><div>3–4 weeks on floor <span class="pill" style="font-size:11px;padding:1px 6px">Must</span></div><div class="why">${ev.w} week${ev.w===1?'':'s'} so far, worked out from your visits</div></span></div>`;
  h+=`<div class="check auto ${ev.m2?'on':'off'}"><span class="bx">${ev.m2?IC.check:''}</span><span class="grow"><div>No liquidation or forced discount <span class="pill" style="font-size:11px;padding:1px 6px">Must</span></div><div class="why">${ev.liq?'Marked “On sale / discount” at a visit':'Never marked on sale at any visit'}</div></span></div>`;
  h+=OPTIONAL.map(o=>{const on=!!(p.bs||{})[o.k];return `<button class="check ${on?'on':''}" data-act="bs" data-id="${pid}" data-k="${o.k}"><span class="bx">${on?IC.check:''}</span><span class="grow"><div>${esc(o.t)}</div><div class="why">${esc(o.d)}</div></span></button>`}).join('');
  h+=`</div><div class="seg" style="margin-top:10px">${[['','Auto'],['yes','Confirm best seller'],['no','Not one']].map(([k,l])=>`<button data-act="verdict" data-id="${pid}" data-k="${k}" class="${(p.bsVerdict||'')===k?'on':''}">${l}</button>`).join('')}</div>`;
  h+=`</div><div><div class="cap">Action for VMM</div><div class="group">`;
  const ac=p.action||{};
  h+=`<div class="field"><label for="act-t">Action</label><input id="act-t" data-act-f="text" data-id="${pid}" placeholder="e.g. Develop 3 pastel SKUs" value="${esc(ac.text||'')}"></div>`;
  h+=`<div class="field"><label for="act-o">Owner</label><select id="act-o" data-act-f="owner" data-id="${pid}"><option value="">Choose</option>${team().map(t=>`<option ${ac.owner===t?'selected':''}>${esc(t)}</option>`).join('')}</select></div>`;
  h+=`<div class="field"><label for="act-d">Due by</label><input id="act-d" type="date" data-act-f="due" data-id="${pid}" value="${esc(ac.due||'')}"></div>`;
  h+=`<button class="check ${ac.done?'on':''}" data-act="act-done" data-id="${pid}"><span class="bx">${ac.done?IC.check:''}</span><span class="grow">Action completed</span></button>`;
  h+=`</div><p class="foot">Saves as you type. Shown on Home until it’s marked complete.</p></div></div>`;
  // timeline
  h+=`<div class="cap">History · ${a.length} visit${a.length===1?'':'s'}</div><div class="tl">`;
  for(let i=a.length-1;i>=0;i--){const e=a[i];const pv=i>0?a[i-1]:null;const ch=diff(pv,e);const v=S.visits[e.visitId];
    const same=pv&&e.observation&&norm(e.observation)===norm(pv.observation);
    h+=`<div class="tli ${i===a.length-1?'first':''}"><div class="when">${esc(fd(e.date,'dow'))}${v&&v.storeId!==p.storeId?' · '+esc(storeShort(v.storeId)):''}${e.by?` · ${esc(e.by)}`:''}<span style="flex:1"></span><button class="lnk" style="font-size:13px;padding:0" data-act="edit-entry" data-id="${e.id}">Edit</button></div><div class="box">`;
    if(ch.length&&ch.some(c=>c.k!=='obs'))h+=`<div class="chg">${ch.filter(c=>c.k!=='obs').map(c=>`<span class="pill ${c.k==='status'?(c.tone||''):c.k==='price'?(c.dir==='up'?'bad':c.dir==='down'?'good':'tint'):c.k==='new'?'tint':''}">${c.k==='price'?'Price ':c.k==='fixture'?'Moved: ':''}${esc(c.t)}</span>`).join('')}</div>`;
    h+=e.observation?`<div class="obs ${same?'same':''}">${same?'No change: ':''}${esc(e.observation)}</div>`:`<div class="obs same">No observation noted</div>`;
    if(e.photos&&e.photos.length)h+=`<div class="imgs">${e.photos.map(r=>img(r,'',`data-act="zoom" data-ref="${esc(r)}"`)).join('')}</div>`;
    h+=`<div class="foot" style="margin:0">${esc(fmtPrice(e.price))} · ${esc(e.fixture||'—')}${e.purpose?' · '+esc(e.purpose):''}</div></div></div>`;
  }
  if(!a.length)h+=`<div class="note">No visits logged yet.</div>`;
  h+=`</div></div>`;
  return h;
}

/* ---------- Visit ---------- */
function visitProgress(v){
  const ps=visitProducts(v,false);const done=ps.filter(p=>entryFor(p.id,v.id)).length;
  return {done,total:ps.length};
}
function visitProducts(v,mineOnly){
  let ps=activeProducts().filter(p=>p.storeId===v.storeId);
  // include products logged at this visit even if from another store
  for(const e of Object.values(S.entries))if(e.visitId===v.id&&S.products[e.productId]&&!ps.includes(S.products[e.productId]))ps.push(S.products[e.productId]);
  ps=ps.filter(p=>{const l=latest(p.id);return !(l&&l.status==='removed'&&l.visitId!==v.id)});
  if(mineOnly&&S.me)ps=ps.filter(p=>p.buyer===S.me);
  return ps.sort((a,b)=>(a.buyer||'').localeCompare(b.buyer||'')||a.name.localeCompare(b.name));
}
function entryFor(pid,vid){return Object.values(S.entries).find(e=>e.productId===pid&&e.visitId===vid)}
function viewVisitStart(){
  let h=topbar('Store visit')+`<h1 class="lt">Store visit</h1><p class="sub">Pick the store you’re at. Everyone on the team can log into the same visit.</p>`;
  if(!S.ready)return h+notReady();
  const t=today();
  const todays=Object.values(S.visits).filter(v=>v.date===t);
  if(todays.length)h+=`<div class="cap">Join today’s visit</div><div class="group">${todays.map(v=>{const pr=visitProgress(v);return `<button class="row" data-act="open-visit" data-id="${v.id}"><span class="thumb" style="width:40px;height:40px;color:var(--tint)">${IC.store}</span><span class="grow"><div class="ttl">${esc(storeName(v.storeId))}</div><div class="meta">${pr.done} of ${pr.total} checked · ${esc((v.attendees||[]).join(', '))}</div></span>${IC.chev}</button>`}).join('')}</div>`;
  const stores=Object.values(S.stores).sort((a,b)=>a.name.localeCompare(b.name));
  h+=`<div class="cap">New visit</div><div class="group">`;
  h+=`<div class="field"><label for="vs-store">Store</label><select id="vs-store">${stores.map(s=>`<option value="${s.id}">${esc(s.name+(s.location?' · '+s.location:''))}</option>`).join('')}<option value="__new">Add a store…</option></select></div>`;
  h+=`<div class="field"><label for="vs-date">Date</label><input id="vs-date" type="date" value="${t}"></div></div>`;
  h+=`<div class="cap">Who’s on the visit</div><div class="group"><div class="optgrid" id="vs-att">${team().map(n=>`<button class="opt ${n===S.me?'on':''}" data-act="toggle-opt" data-v="${esc(n)}">${esc(n)}</button>`).join('')}</div></div>`;
  h+=`<div style="margin-top:16px"><button class="btn" data-act="start-visit">Start visit</button></div>`;
  const past=Object.values(S.visits).sort((a,b)=>(b.date||'').localeCompare(a.date||'')).filter(v=>v.date!==t).slice(0,12);
  if(past.length)h+=`<div class="cap">Past visits</div><div class="group">${past.map(v=>{const n=Object.values(S.entries).filter(e=>e.visitId===v.id).length;return `<button class="row" data-act="open-visit" data-id="${v.id}"><span class="grow"><div class="ttl">${esc(storeName(v.storeId))}</div><div class="meta">${esc(fd(v.date,'y'))} · ${n} update${n===1?'':'s'}</div></span>${IC.chev}</button>`}).join('')}</div>`;
  return h;
}
function viewVisit(vid){
  const v=S.visits[vid];
  if(!v)return topbar('',`<button class="lnk" data-act="back">${IC.back} Back</button>`)+emptyState('Visit not found','It may have been removed.');
  const all=visitProducts(v,false);const list=visitProducts(v,S.visitMine);
  const done=all.filter(p=>entryFor(p.id,v.id)).length;
  const isActive=S.activeVisit===vid;
  let h=topbar(storeShort(v.storeId),`<button class="lnk" data-act="back">${IC.back} Visits</button>`,`<button class="lnk" data-act="new-product" data-visit="${vid}">Add</button>`);
  h+=`<div class="page-enter"><h1 class="lt">${esc(storeShort(v.storeId))}</h1><p class="sub" style="margin-bottom:8px">${S.stores[v.storeId]&&S.stores[v.storeId].location?esc(S.stores[v.storeId].location)+' · ':''}${esc(fd(v.date,'dow'))} · ${esc((v.attendees||[]).join(', ')||'No attendees listed')}</p>`;
  h+=`<div class="group" style="padding:14px 16px"><div style="display:flex;justify-content:space-between;font-size:15px"><b>${done} of ${all.length} checked</b><span style="color:var(--label2)">${all.length-done} left</span></div><div class="progress"><i style="width:${all.length?Math.round(done/all.length*100):0}%"></i></div></div>`;
  h+=`<div class="seg" style="margin:14px 0 4px">${[[true,S.me?'My products':'Mine'],[false,'Whole team']].map(([k,l])=>`<button data-act="vmine" data-k="${k}" class="${S.visitMine===k?'on':''}">${esc(l)}</button>`).join('')}</div>`;
  if(S.visitMine&&!S.me)h+=`<p class="foot">Choose who you are on Home to see only your products.</p>`;
  if(!list.length)h+=emptyState('Nothing to check here yet','Add the products you spot at this store. Next visit, they’ll be waiting for you here.',`<button class="btn" style="width:auto" data-act="new-product" data-visit="${vid}">${IC.plus} Add product</button>`);
  else{
    const todo=list.filter(p=>!entryFor(p.id,v.id)),dn=list.filter(p=>entryFor(p.id,v.id));
    if(todo.length)h+=`<div class="cap">To check · ${todo.length}</div><div class="group">${todo.map(p=>visitRow(p,v,false)).join('')}</div>`;
    if(dn.length)h+=`<div class="cap">Done · ${dn.length}</div><div class="group">${dn.map(p=>visitRow(p,v,true)).join('')}</div>`;
  }
  h+=`<div style="margin-top:18px;display:grid;gap:10px"><button class="btn sec2" data-act="new-product" data-visit="${vid}">${IC.plus} Add a new product</button>`;
  h+=isActive?`<button class="btn plain" data-act="finish-visit" data-id="${vid}">Finish visit</button>`:`<button class="btn plain" data-act="resume-visit" data-id="${vid}">Make this my active visit</button>`;
  h+=`</div>`;
  const ch=changesForVisit(vid).filter(c=>c.ch.length);
  if(ch.length){h+=`<div class="cap">What changed at this visit</div><div class="group">${ch.map(c=>prodRow(c.p,changeLine(c.ch)||c.e.observation||'')).join('')}</div>`}
  h+=`</div>`;
  return h;
}
function visitRow(p,v,isDone){
  const e=entryFor(p.id,v.id);const l=isDone?prevOf(p.id,e):latest(p.id);
  const meta=isDone?(changeLine(diff(l,e))||'No change')+' · '+(e.by||''):(l?('Last: '+(l.observation||fmtPrice(l.price))):'New');
  return `<div class="row th" style="padding-right:10px"><button data-act="product" data-id="${p.id}" class="thumb" aria-label="Open ${esc(p.name)}">${img(cover(p))||IC.img}</button><button class="grow" style="text-align:left;min-width:0" data-act="update" data-id="${p.id}" data-visit="${v.id}"><div class="ttl">${esc(p.name)}</div><div class="meta">${esc(p.buyer||'')} · ${esc(meta)}</div></button>${isDone?`<button class="done-dot on" data-act="update" data-id="${p.id}" data-visit="${v.id}" aria-label="Edit update">${IC.check}</button>`:`<button class="pill tint" style="padding:6px 10px" data-act="nochange" data-id="${p.id}" data-visit="${v.id}">Same</button>`}</div>`;
}

/* ---------- Insights ---------- */
function viewInsights(){
  let h=topbar('Insights')+`<h1 class="lt">Insights</h1>`;
  if(!S.ready)return h+notReady();
  const stores=Object.values(S.stores).sort((a,b)=>a.name.localeCompare(b.name));
  const sf=S.ins.store;
  h+=`<div class="chips">${[['all','All stores'],...stores.map(s=>[s.id,s.name+(s.location?' '+s.location:'')])].map(([k,l])=>`<button class="chip ${sf===k?'on':''}" data-act="ins-store" data-v="${k}">${esc(l)}</button>`).join('')}</div>`;
  const ps=activeProducts().filter(p=>sf==='all'||p.storeId===sf);
  const evs=ps.map(p=>({p,ev:bsEval(p),l:latest(p.id)}));
  const visits=Object.values(S.visits).filter(v=>sf==='all'||v.storeId===sf).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const allE=Object.values(S.entries).filter(e=>S.products[e.productId]&&(sf==='all'||S.products[e.productId].storeId===sf));
  h+=`<div class="tiles" style="margin-top:14px">
   <div class="tile"><span class="k">Store visits</span><span class="v">${visits.length}</span></div>
   <div class="tile"><span class="k">Updates logged</span><span class="v">${allE.length}</span></div>
   <div class="tile"><span class="k">Price changes</span><span class="v">${countChanges(allE,'price')}</span></div>
   <div class="tile"><span class="k">Display moves</span><span class="v">${countChanges(allE,'fixture')}</span></div></div>`;
  // pipeline
  const stages=[['watching','Watching','var(--label3)'],['candidate','Candidate','var(--tint)'],['likely','Likely best seller','var(--good)'],['best','Confirmed best seller','var(--gold)'],['dropped','Dropped','var(--bad)']];
  const mx=Math.max(1,...stages.map(s=>evs.filter(x=>x.ev.stage===s[0]).length));
  h+=`<div class="cols"><div><div class="cap">Best-seller pipeline</div><div class="group">${stages.map(([k,l,c])=>{const n=evs.filter(x=>x.ev.stage===k).length;return `<button class="bar tap" style="width:100%" data-act="goprod" data-status="${k==='likely'?'best':k}"><span class="lb">${l}</span><span class="tr"><i style="width:${n/mx*100}%;background:${c}"></i></span><span class="n">${n}</span></button>`}).join('')}</div><p class="foot">Based on the rules in your Notes sheet: 3–4 weeks on floor and no liquidation are must-haves; the four signals add confidence.</p></div>`;
  // by category
  const byCat={};ps.forEach(p=>{const k=p.category||'Uncategorised';byCat[k]=(byCat[k]||0)+1});
  const cats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,10);const cm=Math.max(1,...cats.map(c=>c[1]));
  h+=`<div><div class="cap">Products by category</div><div class="group">${cats.map(([k,n])=>`<div class="bar"><span class="lb">${esc(k.replace(/^HH_/,''))}</span><span class="tr"><i style="width:${n/cm*100}%"></i></span><span class="n">${n}</span></div>`).join('')||'<div class="row">No products</div>'}</div></div></div>`;
  // price movements
  const pm=[];for(const {p} of evs){const a=ents(p.id);for(let i=1;i<a.length;i++){const d=diff(a[i-1],a[i]).find(c=>c.k==='price');if(d)pm.push({p,e:a[i],d,from:a[i-1].price})}}
  pm.sort((a,b)=>b.e.date.localeCompare(a.e.date));
  h+=`<div class="cap">Price movements</div>`;
  h+=pm.length?`<div class="tbl"><table><thead><tr><th>Product</th><th>Store</th><th>From</th><th>To</th><th>Seen</th></tr></thead><tbody>${pm.slice(0,25).map(x=>`<tr><td><button class="lnk" style="padding:0;font-size:14px;text-align:left" data-act="product" data-id="${x.p.id}">${esc(x.p.name)}</button></td><td>${esc(storeShort(x.p.storeId))}</td><td class="n">${esc(fmtPrice(x.from))}</td><td class="n ${x.d.dir}">${esc(fmtPrice(x.e.price))}</td><td class="n">${esc(fd(x.e.date))}</td></tr>`).join('')}</tbody></table></div>`:`<div class="note">No price changes recorded yet. They’ll show here when a price differs from the visit before.</div>`;
  // status signals
  const sig=evs.filter(x=>x.l&&['selling-fast','sold-out','restocked','removed','on-sale'].includes(x.l.status));
  h+=`<div class="cols"><div><div class="cap">Latest stock signals</div>`;
  h+=sig.length?`<div class="group">${sig.slice(0,12).map(x=>prodRow(x.p,STATUS_BY[x.l.status].label+' · '+rel(x.l.date))).join('')}</div>`:`<div class="note">No selling-fast, sold-out or removed signals at the latest visits.</div>`;
  h+=`</div><div>`;
  // team activity
  const byB={};allE.forEach(e=>{const b=(S.products[e.productId]||{}).buyer||'—';byB[b]=(byB[b]||0)+1});
  const bb=Object.entries(byB).sort((a,b)=>b[1]-a[1]);const bm=Math.max(1,...bb.map(x=>x[1]));
  h+=`<div class="cap">Updates by buyer</div><div class="group">${bb.map(([k,n])=>`<div class="bar"><span class="lb" style="display:flex;align-items:center;gap:8px"><span class="av" style="width:22px;height:22px;font-size:9px;background:${avColor(k)}">${esc(initials(k))}</span>${esc(k)}</span><span class="tr"><i style="width:${n/bm*100}%;background:${avColor(k)}"></i></span><span class="n">${n}</span></div>`).join('')||'<div class="row">No updates</div>'}</div>`;
  const byP={};ps.forEach(p=>{const k=p.purpose||'Not set';byP[k]=(byP[k]||0)+1});
  h+=`<div class="cap">Why we’re tracking</div><div class="group">${Object.entries(byP).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`<div class="row"><span class="grow">${esc(k)}</span><span class="val">${n}</span></div>`).join('')}</div>`;
  h+=`</div></div>`;
  h+=`<div class="cap">Share with the team</div><div class="group"><button class="row" data-act="export"><span class="thumb" style="width:36px;height:36px;color:var(--good)">${IC.dl}</span><span class="grow"><div class="ttl">Download Excel report</div><div class="meta">Latest view, full history, visit-by-visit changes, price moves</div></span>${IC.chev}</button><button class="row" data-act="import"><span class="thumb" style="width:36px;height:36px;color:var(--tint)">${IC.ul}</span><span class="grow"><div class="ttl">Import from Excel</div><div class="meta">Your old benchmarking sheet or the Shelfwatch template</div></span>${IC.chev}</button></div>`;
  return h;
}
function countChanges(es,k){let n=0;const by={};es.forEach(e=>(by[e.productId]=by[e.productId]||[]).push(e));for(const a of Object.values(by)){a.sort((x,y)=>(x.date||'').localeCompare(y.date||''));for(let i=1;i<a.length;i++)if(diff(a[i-1],a[i]).some(c=>c.k===k))n++}return n}

/* ---------- Settings ---------- */
function syncDetail(){const s=PLATFORM.status;
  return `<div class="row"><span class="grow"><div class="ttl">${s.online?'Online':'Offline'}</div><div class="meta">${s.pending?s.pending+' change'+(s.pending>1?'s':'')+' waiting to upload':'Nothing waiting to upload'}${s.lastSync?' · last synced '+ago(s.lastSync):''}</div></span><button class="lnk" data-act="sync-now">Sync now</button></div>${s.error?`<div class="row"><span class="grow" style="color:var(--bad);font-size:14px">${esc(s.error)}</span></div>`:''}`}
function viewSettings(){
  let h=topbar('Settings')+`<h1 class="lt">Settings</h1>`;
  if(!S.ready)return h+notReady();
  const st=PLATFORM.status;
  h+=`<div class="cap">You</div><div class="group"><button class="row" data-act="who"><span class="av" style="background:${avColor(S.me||'?')}">${esc(initials(S.me||'?'))}</span><span class="grow"><div class="ttl">${esc(S.me||'Choose your name')}</div><div class="meta">${esc(st.email||'')}</div></span>${IC.chev}</button><button class="row" data-act="signout" style="color:var(--bad)"><span class="grow">Sign out of this device</span></button></div><div id="signout-confirm"></div>`;
  h+=`<div class="cap">Sync</div><div class="group" id="syncrow">${syncDetail()}</div><p class="foot">Everything you log is saved on this device first, so the app works without signal. It uploads on its own when you’re back online.</p>`;
  h+=`<div class="cap">Team access</div><div class="group">${(st.members||[]).map(m=>`<div class="row"><span class="av" style="background:${avColor(m.name)}">${esc(initials(m.name))}</span><span class="grow"><div class="ttl">${esc(m.name)}</div><div class="meta">${esc(m.email)}</div></span>${m.email.toLowerCase()===String(st.email).toLowerCase()?'<span class="val">You</span>':`<button class="lnk" style="color:var(--bad);font-size:15px" data-act="member-del" data-v="${esc(m.email)}">Remove</button>`}</div>`).join('')}
    <div class="field"><input id="mem-name" placeholder="Name" style="text-align:left;max-width:34%"><input id="mem-email" type="email" placeholder="work email" style="text-align:left" autocomplete="off"><button class="lnk" data-act="member-add">Add</button></div></div>
    <p class="foot">Only these emails can sign in and see the data. After adding someone, send them the app link.</p>
    <div class="group" style="margin-top:10px"><button class="row" data-act="copy-invite"><span class="grow"><div class="ttl" style="color:var(--tint)">Copy app link for the team</div><div class="meta">They open it and create a password with the email you added</div></span></button></div>`;
  h+=`<div class="cap">Stores</div><div class="group">${Object.values(S.stores).sort((a,b)=>a.name.localeCompare(b.name)).map(s=>{const n=activeProducts().filter(p=>p.storeId===s.id).length;return `<button class="row" data-act="edit-store" data-id="${s.id}"><span class="grow"><div class="ttl">${esc(s.name)}</div><div class="meta">${esc(s.location||'Location not set')} · ${n} product${n===1?'':'s'}</div></span>${IC.chev}</button>`}).join('')}<button class="row" data-act="edit-store" style="color:var(--tint)">${IC.plus.replace('<svg','<svg style="width:20px;height:20px"')} Add a store</button></div>`;
  h+=listEditor('team','Buyer names',team(),'Names that show in buyer and attendee pickers');
  h+=listEditor('fixtures','Fixtures',fixtures(),'Quick picks when logging where a product sits');
  h+=listEditor('purposes','Why we track',purposes(),'Quick picks for the reason a product is on the list');
  h+=`<div class="cap">Data</div><div class="group"><button class="row" data-act="export"><span class="grow">Download Excel report</span>${IC.chev}</button><button class="row" data-act="import"><span class="grow">Import from Excel</span>${IC.chev}</button><button class="row" data-act="backup"><span class="grow"><div class="ttl">Download full backup</div><div class="meta">All products, visits and photos in one .zip</div></span>${IC.chev}</button><button class="row" data-act="restore"><span class="grow"><div class="ttl">Restore from backup</div><div class="meta">Load a Shelfwatch .zip into the team’s data</div></span>${IC.chev}</button><button class="row" data-act="goprod" data-status="archived"><span class="grow">Archived products</span><span class="val">${Object.values(S.products).filter(p=>p.archived).length}</span>${IC.chev}</button></div>`;
  h+=`<p class="foot">Shelfwatch · data is shared live with everyone on the team list.</p>`;
  return h;
}
function listEditor(k,t,arr,foot){return `<div class="cap">${t}</div><div class="group"><div class="optgrid">${arr.map(x=>`<span class="opt" style="display:inline-flex;gap:6px;align-items:center">${esc(x)}<button data-act="list-del" data-k="${k}" data-v="${esc(x)}" aria-label="Remove ${esc(x)}" style="color:var(--label2)">×</button></span>`).join('')}</div><div class="field"><input id="add-${k}" placeholder="Add ${t.toLowerCase()==='team'?'a name':'an option'}" style="text-align:left"><button class="lnk" data-act="list-add" data-k="${k}">Add</button></div></div><p class="foot">${foot}</p>`}

/* ---------- Sheets ---------- */
let sheetState=null;
function openSheet(html,opts){
  const root=$('#sheetRoot');
  root.innerHTML=`<div class="scrim" data-act="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  requestAnimationFrame(()=>{root.querySelector('.scrim').classList.add('show');root.querySelector('.sheet').classList.add('show')});
  document.body.style.overflow='hidden';
}
function closeSheet(){
  const root=$('#sheetRoot');const sh=root.querySelector('.sheet');if(!sh)return;
  sh.classList.remove('show');root.querySelector('.scrim').classList.remove('show');
  document.body.style.overflow='';sheetState=null;
  setTimeout(()=>{if(!sheetState)root.innerHTML=''},300);
}
function sheetHead(t,right,rightAct){return `<div class="grab"></div><div class="sh"><button class="lnk" data-act="close-sheet">Cancel</button><div class="t">${esc(t)}</div><button class="lnk r" data-act="${rightAct}" id="sheet-save">${esc(right)}</button></div>`}

/* Update sheet (log observation) */
function openUpdate(pid,vid,entryId){
  const p=S.products[pid];if(!p)return;
  let e=entryId?S.entries[entryId]:(vid?entryFor(pid,vid):null);
  const prev=e?prevOf(pid,e):latest(pid);
  const base=e||{};
  sheetState={kind:'update',pid,vid:e?e.visitId:vid,entryId:e?e.id:null,
    status:base.status||(prev&&prev.status!=='removed'?(prev.status==='sold-out'?'on-floor':prev.status):'on-floor'),
    price:base.price!=null?base.price:(prev?prev.price:''),fixture:base.fixture!=null?base.fixture:(prev?prev.fixture:''),
    purpose:base.purpose!=null?base.purpose:(prev?prev.purpose:p.purpose||''),observation:base.observation||'',photos:(base.photos||[]).slice(),
    date:base.date||(vid&&S.visits[vid]?S.visits[vid].date:today()),busy:0};
  const st=sheetState;
  let h=sheetHead(p.name,'Save','save-update')+`<div class="sb">`;
  h+=`<div class="who" style="margin:2px 4px 12px">${esc(storeName(p.storeId))} · ${esc(fd(st.date,'dow'))}${prev?` · last checked ${esc(rel(prev.date))}`:''}</div>`;
  h+=`<div class="group"><div class="photos" id="u-photos"></div></div>`;
  h+=`<div class="cap">How is it doing?</div><div class="group"><div class="optgrid" id="u-status">${STATUS.map(s=>`<button class="opt ${s.tone} ${st.status===s.id?'on':''}" data-act="u-status" data-v="${s.id}">${esc(s.label)}</button>`).join('')}</div></div>`;
  h+=`<div class="cap">Details</div><div class="group">`;
  h+=`<div class="field"><label for="u-price">Price (₹)</label><input id="u-price" inputmode="text" placeholder="e.g. 399 or 99/249" value="${esc(st.price)}"></div>`;
  h+=`<div class="field"><label for="u-fixture">Fixture</label><input id="u-fixture" list="dl-fix" placeholder="Where it sits" value="${esc(st.fixture)}"></div>`;
  h+=`<div class="field"><label for="u-purpose">Why track</label><input id="u-purpose" list="dl-pur" placeholder="Reason" value="${esc(st.purpose)}"></div>`;
  h+=`</div><datalist id="dl-fix">${fixtures().map(x=>`<option value="${esc(x)}">`).join('')}</datalist><datalist id="dl-pur">${purposes().map(x=>`<option value="${esc(x)}">`).join('')}</datalist>`;
  h+=`<div class="cap">What did you notice?</div><div class="group"><textarea id="u-obs" placeholder="Colours selling, new sizes, display change, stock level…">${esc(st.observation)}</textarea>${prev&&prev.observation?`<div class="prev"><b>Last time</b><span style="flex:1">${esc(prev.observation)}</span><button class="lnk" style="padding:0;font-size:13.5px" data-act="u-same">Use</button></div>`:''}</div>`;
  if(e)h+=`<div style="margin-top:22px"><button class="btn danger" data-act="del-entry" data-id="${e.id}">Delete this update</button></div><div id="del-confirm"></div>`;
  h+=`</div>`;
  openSheet(h);renderUPhotos();
}
function renderUPhotos(){
  const st=sheetState;const el=$('#u-photos');if(!el||!st)return;
  el.innerHTML=st.photos.map((r,i)=>`<div class="ph">${img(r)}<button class="x" data-act="u-delph" data-i="${i}" aria-label="Remove photo">×</button></div>`).join('')+(st.busy?`<div class="ph" style="font-size:12px;color:var(--label2)">Saving…</div>`:'')+`<label class="ph">${IC.cam}<span>${st.photos.length?'Add':'Photo'}</span><input type="file" accept="image/*" multiple data-act="u-file"></label>`;
}
async function saveUpdate(quick){
  const st=sheetState;if(!st||st.busy)return;
  if(!quick){st.price=$('#u-price').value.trim();st.fixture=$('#u-fixture').value.trim();st.purpose=$('#u-purpose').value.trim();st.observation=$('#u-obs').value.trim()}
  const id=st.entryId||(st.vid?('e_'+st.pid+'_'+st.vid):uid('e_'));
  const old=S.entries[id]||{};
  const data={productId:st.pid,visitId:st.vid||'',date:st.date,status:st.status,price:st.price,fixture:st.fixture,purpose:st.purpose,observation:st.observation,photos:st.photos,by:old.by||S.me||'',at:old.at||Date.now(),editedAt:Date.now()};
  const ok=await w(async()=>{await db.doc('entries/'+id).set(data);
    const p=S.products[st.pid];const upd={};if(st.purpose&&st.purpose!==p.purpose)upd.purpose=st.purpose;
    if(Object.keys(upd).length)await db.doc('products/'+st.pid).update(upd)},'Saved');
  if(ok){S.entries[id]=Object.assign({id},data);closeSheet();render()}
}
async function quickSame(pid,vid){
  const l=latest(pid);const v=S.visits[vid];if(!v)return;
  const id='e_'+pid+'_'+vid;
  const data={productId:pid,visitId:vid,date:v.date,status:l&&l.status&&l.status!=='sold-out'?l.status:'on-floor',price:l?l.price:'',fixture:l?l.fixture:'',purpose:l?l.purpose:'',observation:l?l.observation:'',photos:[],by:S.me||'',at:Date.now()};
  if(await w(()=>db.doc('entries/'+id).set(data),'Logged as no change')){S.entries[id]=Object.assign({id},data);render()}
}

/* New / edit product */
function openProductForm(pid,vid){
  const p=pid?S.products[pid]:null;const v=vid?S.visits[vid]:null;
  const stores=Object.values(S.stores).sort((a,b)=>a.name.localeCompare(b.name));
  const cats=[...new Set(Object.values(S.products).map(x=>x.category).filter(Boolean))].sort();
  sheetState={kind:'product',pid,vid,photos:[],status:'on-floor',busy:0};
  let h=sheetHead(p?'Edit product':'New product',p?'Save':'Add','save-product')+`<div class="sb">`;
  if(!p)h+=`<div class="group"><div class="photos" id="u-photos"></div></div>`;
  h+=`<div class="cap">Product</div><div class="group">`;
  h+=`<div class="field"><label for="np-name">Name</label><input id="np-name" placeholder="e.g. Ribbed glass tumbler" value="${esc(p?p.name:'')}"></div>`;
  h+=`<div class="field"><label for="np-cat">Category</label><input id="np-cat" list="dl-cat" placeholder="MC, e.g. HH_C_G_TUMBLER" value="${esc(p?p.category:'')}"></div>`;
  h+=`<div class="field"><label for="np-brand">Brand</label><input id="np-brand" placeholder="Brand" value="${esc(p?p.brand:(v?storeShort(v.storeId):''))}"></div>`;
  h+=`<div class="field"><label for="np-store">Store</label><select id="np-store">${stores.map(s=>`<option value="${s.id}" ${(p?p.storeId:(v?v.storeId:''))===s.id?'selected':''}>${esc(s.name+(s.location?' · '+s.location:''))}</option>`).join('')}</select></div>`;
  h+=`<div class="field"><label for="np-buyer">Buyer</label><select id="np-buyer">${team().map(t=>`<option ${(p?p.buyer:S.me)===t?'selected':''}>${esc(t)}</option>`).join('')}</select></div>`;
  h+=`<div class="field"><label for="np-pur">Why track</label><input id="np-pur" list="dl-pur" placeholder="Reason" value="${esc(p?p.purpose:'')}"></div>`;
  h+=`</div><datalist id="dl-cat">${cats.map(x=>`<option value="${esc(x)}">`).join('')}</datalist><datalist id="dl-pur">${purposes().map(x=>`<option value="${esc(x)}">`).join('')}</datalist><datalist id="dl-fix">${fixtures().map(x=>`<option value="${esc(x)}">`).join('')}</datalist>`;
  if(!p){
    h+=`<div class="cap">First observation${v?' · '+esc(fd(v.date)):''}</div><div class="group">`;
    h+=`<div class="field"><label for="np-price">Price (₹)</label><input id="np-price" placeholder="e.g. 399"></div>`;
    h+=`<div class="field"><label for="np-fix">Fixture</label><input id="np-fix" list="dl-fix" placeholder="Where it sits"></div>`;
    h+=`</div><div class="group" style="margin-top:10px"><div class="optgrid" id="u-status">${STATUS.filter(s=>s.id!=='removed').map(s=>`<button class="opt ${s.tone} ${s.id==='on-floor'?'on':''}" data-act="u-status" data-v="${s.id}">${esc(s.label)}</button>`).join('')}</div></div>`;
    h+=`<div class="group" style="margin-top:10px"><textarea id="np-obs" placeholder="What did you notice?"></textarea></div>`;
  }else{
    h+=`<div style="margin-top:22px;display:grid;gap:10px"><button class="btn plain" data-act="archive" data-id="${p.id}">${p.archived?'Start tracking again':'Stop tracking (archive)'}</button><button class="btn danger" data-act="del-product" data-id="${p.id}">Delete product and history</button><div id="del-confirm"></div></div>`;
  }
  h+=`</div>`;openSheet(h);if(!p)renderUPhotos();
  setTimeout(()=>{const n=$('#np-name');if(n&&!p)n.focus()},350);
}
async function saveProduct(){
  const st=sheetState;if(!st||st.busy)return;
  const name=$('#np-name').value.trim();if(!name){toast('Give the product a name');$('#np-name').focus();return}
  const base={name,category:$('#np-cat').value.trim(),brand:$('#np-brand').value.trim(),storeId:$('#np-store').value,buyer:$('#np-buyer').value,purpose:$('#np-pur').value.trim()};
  if(st.pid){if(await w(()=>db.doc('products/'+st.pid).update(base),'Saved')){Object.assign(S.products[st.pid],base);closeSheet();render()}return}
  const pid=uid('p_');let vid=st.vid;
  const date=vid&&S.visits[vid]?S.visits[vid].date:today();
  const prod=Object.assign(base,{firstSeen:date,createdAt:Date.now(),createdBy:S.me||'',bs:{}});
  const entry={productId:pid,visitId:vid||'',date,status:st.status,price:$('#np-price').value.trim(),fixture:$('#np-fix').value.trim(),purpose:base.purpose,observation:$('#np-obs').value.trim(),photos:st.photos,by:S.me||'',at:Date.now()};
  const eid=vid?('e_'+pid+'_'+vid):uid('e_');
  const ok=await w(async()=>{await db.doc('products/'+pid).set(prod);await db.doc('entries/'+eid).set(entry)},'Added '+name);
  if(ok){S.products[pid]=Object.assign({id:pid},prod);S.entries[eid]=Object.assign({id:eid},entry);closeSheet();render()}
}

/* Store form */
function openStoreForm(sid){
  const s=sid?S.stores[sid]:null;sheetState={kind:'store',sid};
  let h=sheetHead(s?'Edit store':'New store',s?'Save':'Add','save-store')+`<div class="sb"><div class="group">`;
  h+=`<div class="field"><label for="st-name">Retailer</label><input id="st-name" placeholder="e.g. IKEA" value="${esc(s?s.name:'')}"></div>`;
  h+=`<div class="field"><label for="st-loc">Location</label><input id="st-loc" placeholder="e.g. Nagasandra" value="${esc(s?s.location:'')}"></div>`;
  h+=`</div><p class="foot">Add each outlet you visit separately, so visits and prices stay per store.</p></div>`;
  openSheet(h);setTimeout(()=>{const n=$('#st-name');if(n&&!s)n.focus()},350);
}
async function saveStore(){
  const st=sheetState;const name=$('#st-name').value.trim();if(!name){toast('Enter the retailer name');return}
  const data={name,location:$('#st-loc').value.trim()};
  const id=st.sid||(norm(name+' '+data.location).replace(/ /g,'-').slice(0,60)||uid('s_'));
  if(await w(()=>st.sid?db.doc('stores/'+id).update(data):db.doc('stores/'+id).set(data),'Saved')){S.stores[id]=Object.assign({id},S.stores[id]||{},data);closeSheet();
    if(S._pendingStoreSelect){S._pendingStoreSelect=false;render();const sel=$('#vs-store');if(sel)sel.value=id}else render()}
}

/* Who am I */
function openWho(){
  sheetState={kind:'who'};
  let h=`<div class="grab"></div><div class="sh"><span style="min-width:76px"></span><div class="t">Who’s using this?</div><button class="lnk r" data-act="close-sheet">Done</button></div><div class="sb"><p class="foot" style="margin:0 4px 12px;font-size:15px">Your updates are signed with this name. It’s remembered on this device.</p><div class="group">${team().map(n=>`<button class="row" data-act="set-me" data-v="${esc(n)}"><span class="av" style="background:${avColor(n)}">${esc(initials(n))}</span><span class="grow"><div class="ttl">${esc(n)}</div></span>${S.me===n?`<span style="color:var(--tint);width:20px">${IC.check}</span>`:''}</button>`).join('')}</div><p class="foot">Not listed? Add your name in Settings → Team.</p></div>`;
  openSheet(h);
}

/* Import */
function openImport(){
  sheetState={kind:'import',rows:null};
  let h=`<div class="grab"></div><div class="sh"><button class="lnk" data-act="close-sheet">Cancel</button><div class="t">Import from Excel</div><button class="lnk r" data-act="do-import" id="imp-go" disabled style="opacity:.4">Import</button></div><div class="sb">`;
  h+=`<div class="note">Choose your existing benchmarking workbook (the wide format with one block per visit) or a Shelfwatch template. Each product becomes one card and each visit block becomes one update in its history. Existing products are matched by name and store, so importing twice won’t duplicate them. Photos inside Excel can’t be read here; add them from your phone.</div>`;
  h+=`<div style="margin-top:14px;display:grid;gap:10px"><label class="btn sec2" style="cursor:pointer">${IC.ul} Choose Excel file<input type="file" accept=".xlsx,.xlsm,.xls,.csv" data-act="imp-file" style="display:none"></label><button class="btn plain" data-act="template">${IC.dl} Download blank template</button></div><div id="imp-prev" style="margin-top:14px"></div></div>`;
  openSheet(h);
}
function parseWorkbook(wb){
  const rows=[];const yr=new Date().getFullYear();
  const toISO=v=>{
    if(v==null||v==='')return null;
    if(v instanceof Date)return v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0');
    if(typeof v==='number'){const d=XLSX.SSF.parse_date_code(v);if(d)return d.y+'-'+String(d.m).padStart(2,'0')+'-'+String(d.d).padStart(2,'0')}
    const s=String(v).trim();let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return m[0];
    m=s.match(/(\d{1,2})(?:st|nd|rd|th)?[\s\-\/.]*([A-Za-z]{3,})[a-z]*[\s,\-\/.]*(\d{4})?/);
    if(m){const mi=MON.findIndex(x=>m[2].toLowerCase().startsWith(x.toLowerCase()));if(mi>=0)return (m[3]||yr)+'-'+String(mi+1).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0')}
    m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);if(m){const y=m[3].length===2?'20'+m[3]:m[3];return y+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0')}
    return null};
  for(const sn of wb.SheetNames){
    const ws=wb.Sheets[sn];const A=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null});
    // template format
    const hi=A.findIndex(r=>r&&r.some(c=>norm(c)==='product')&&r.some(c=>norm(c)==='store'));
    if(hi>=0){const H=A[hi].map(norm);const col=k=>H.indexOf(k);
      for(let i=hi+1;i<A.length;i++){const r=A[i];if(!r)continue;const g=k=>{const c=col(k);return c>=0&&r[c]!=null?String(r[c]).trim():''};
        if(!g('product'))continue;rows.push({store:g('store'),date:toISO(r[col('date')])||today(),buyer:g('buyer'),category:g('category'),name:g('product'),brand:g('brand'),price:g('price'),fixture:g('fixture'),observation:g('observation'),purpose:g('why track')||g('purpose')||g('remarks'),status:g('status')})}
      continue}
    // wide format: header row has repeated "Product Description"
    const wi=A.findIndex(r=>r&&r.filter(c=>norm(c)==='product description').length>=1);
    if(wi<0)continue;
    const H=A[wi].map(norm);const starts=[];H.forEach((c,i)=>{if(c==='product description')starts.push(i)});
    starts.forEach(sc=>{
      // find date above within block
      let date=null;for(let r=0;r<wi&&!date;r++){const row=A[r]||[];for(let c=Math.max(0,sc-2);c<sc+6&&!date;c++){if(norm(row[c]).startsWith('date')){date=toISO(row[c+1])}}}
      if(!date)return;
      let catC=-1;for(let c=sc-1;c>=Math.max(0,sc-4);c--){if(H[c]==='category'){catC=c;break}}
      const off=k=>{for(let c=sc;c<sc+12;c++)if(H[c]===k)return c;return -1};
      const cS=off('store'),cB=off('brand'),cP=off('brand sp'),cF=off('fixture'),cO=off('observation'),cR=off('remarks');
      for(let i=wi+1;i<A.length;i++){const r=A[i]||[];const nm=r[sc];if(nm==null||String(nm).trim()==='')continue;const v=c=>c>=0&&r[c]!=null?String(r[c]).trim():'';
        rows.push({store:v(cS),date,buyer:v(0),category:(catC>=0?v(catC):v(1)).replace(/^'/,''),name:String(nm).trim(),brand:v(cB),price:v(cP),fixture:v(cF),observation:v(cO),purpose:v(cR),status:''})}
    });
  }
  return rows;
}
function guessStatus(s,obs){const t=norm(s+' '+obs);
  if(/removed|discontinu|delisted/.test(t))return 'removed';
  if(/on sale|discount|clearance|liquidat/.test(t))return 'on-sale';
  if(/out of stock|sold out|sold ou|oos/.test(t))return 'sold-out';
  if(/replenish|restock/.test(t))return 'restocked';
  if(/selling fast|selling well|fast sell|fast moving/.test(t))return 'selling-fast';
  const m=STATUS.find(x=>norm(x.label)===norm(s)||x.id===s);return m?m.id:'on-floor'}
function previewImport(rows){
  const st=sheetState;st.rows=rows;const el=$('#imp-prev');
  if(!rows.length){el.innerHTML=`<div class="note" style="color:var(--bad)">No products found. Check that the sheet has a “Product Description” or “Product” header row.</div>`;return}
  const prods=new Set(rows.map(r=>norm(r.name)+'|'+norm(r.store)));const dates=[...new Set(rows.map(r=>r.date))].sort();const stores=[...new Set(rows.map(r=>r.store||'(no store)'))];
  el.innerHTML=`<div class="group"><div class="row"><span class="grow">Products</span><span class="val">${prods.size}</span></div><div class="row"><span class="grow">Updates</span><span class="val">${rows.length}</span></div><div class="row"><span class="grow">Visit dates</span><span class="val">${dates.map(d=>esc(fd(d))).join(', ')}</span></div><div class="row"><span class="grow">Stores</span><span class="val" style="white-space:normal">${stores.map(esc).join(', ')}</span></div></div>`;
  const b=$('#imp-go');b.disabled=false;b.style.opacity=1;
}
function storeFromText(t){
  const n=norm(t);if(!n)return null;
  for(const s of Object.values(S.stores)){if(norm(s.name+' '+(s.location||''))===n||norm(s.name+' '+(s.location||'')).replace(/ /g,'')===n.replace(/ /g,''))return s.id}
  for(const s of Object.values(S.stores)){if(n.includes(norm(s.name))&&(!s.location||n.includes(norm(s.location))))return s.id}
  return null;
}
async function doImport(){
  const st=sheetState;if(!st||!st.rows||st.busy)return;st.busy=1;$('#imp-go').textContent='Importing…';
  const rows=st.rows;const writes=[];const newStores={},newProds={},newVisits={};
  const sid=t=>{let id=storeFromText(t);if(id)return id;const parts=String(t||'Unknown store').split(',');const name=parts[0].trim(),loc=(parts[1]||'').trim();id=norm(name+' '+loc).replace(/ /g,'-').slice(0,60)||'unknown';if(!S.stores[id]&&!newStores[id]){newStores[id]={name,location:loc};S.stores[id]=Object.assign({id},newStores[id])}return id};
  const pkey={};Object.values(S.products).forEach(p=>pkey[norm(p.name)+'|'+p.storeId]=p.id);
  const vkey={};Object.values(S.visits).forEach(v=>vkey[v.storeId+'|'+v.date]=v.id);
  rows.sort((a,b)=>a.date.localeCompare(b.date));
  for(const r of rows){
    const s=sid(r.store);const k=norm(r.name)+'|'+s;let pid=pkey[k];
    if(!pid){pid=uid('p_');pkey[k]=pid;newProds[pid]={name:r.name,category:r.category,brand:r.brand,storeId:s,buyer:(r.buyer?r.buyer.charAt(0).toUpperCase()+r.buyer.slice(1).toLowerCase():S.me||''),purpose:r.purpose,firstSeen:r.date,createdAt:Date.now(),bs:{}}}
    let vid=vkey[s+'|'+r.date];if(!vid){vid='v_'+s.slice(0,30)+'_'+r.date;vkey[s+'|'+r.date]=vid;newVisits[vid]={storeId:s,date:r.date,attendees:[],at:Date.now()}}
    writes.push(['entries/e_'+pid+'_'+vid,{productId:pid,visitId:vid,date:r.date,status:guessStatus(r.status,r.observation),price:r.price,fixture:r.fixture,purpose:r.purpose,observation:r.observation,photos:(S.entries['e_'+pid+'_'+vid]||{}).photos||[],by:'Import',at:Date.now()}]);
  }
  const all=[...Object.entries(newStores).map(([id,d])=>['stores/'+id,d]),...Object.entries(newProds).map(([id,d])=>['products/'+id,d]),...Object.entries(newVisits).map(([id,d])=>['visits/'+id,d]),...writes];
  let n=0;const ok=await w(async()=>{for(const [path,d] of all){await db.doc(path).set(d);n++;if(n%10===0)$('#imp-go').textContent=Math.round(n/all.length*100)+'%'}});
  if(ok){toast(`Imported ${Object.keys(newProds).length} new products, ${writes.length} updates`);closeSheet();setTab('products')}else{st.busy=0;$('#imp-go').textContent='Import'}
}

/* Export */
async function doExport(){
  if(!(await loadXLSX())){toast('Excel tools didn’t load. Reload the app and try again.');return}
  const wb=XLSX.utils.book_new();
  const prods=Object.values(S.products).sort((a,b)=>storeName(a.storeId).localeCompare(storeName(b.storeId))||(a.buyer||'').localeCompare(b.buyer||'')||a.name.localeCompare(b.name));
  const latestRows=prods.map(p=>{const a=ents(p.id);const l=a[a.length-1]||{};const pv=a.length>1?a[a.length-2]:null;const ev=bsEval(p);return {
    'Store':storeName(p.storeId),'Buyer':p.buyer,'Category':p.category,'Product':p.name,'Brand':p.brand,'Why track':p.purpose,
    'Latest price':l.price||'','Previous price':pv?pv.price:'','Fixture':l.fixture||'','Status':(STATUS_BY[l.status]||{}).label||'',
    'Latest observation':l.observation||'','What changed':pv?changeLine(diff(pv,l)):'First logged','First seen':p.firstSeen||'','Last checked':l.date||'',
    'Weeks on floor':ev.w,'Visits logged':a.length,'Best-seller stage':ev.label,'Signals (of 4)':ev.opt,
    'Action':(p.action||{}).text||'','Action owner':(p.action||{}).owner||'','Due':(p.action||{}).due||'','Action done':(p.action||{}).done?'Yes':'','Archived':p.archived?'Yes':''}});
  const ws1=XLSX.utils.json_to_sheet(latestRows);ws1['!cols']=[22,10,22,34,14,20,12,12,18,14,50,34,11,11,8,8,18,8,30,12,11,8,8].map(w=>({wch:w}));XLSX.utils.book_append_sheet(wb,ws1,'Latest view');
  const hist=[];for(const p of prods){const a=ents(p.id);a.forEach((e,i)=>{hist.push({'Date':e.date,'Store':storeName(p.storeId),'Buyer':p.buyer,'Category':p.category,'Product':p.name,'Price':e.price,'Fixture':e.fixture,'Status':(STATUS_BY[e.status]||{}).label||'','Observation':e.observation,'Why track':e.purpose,'What changed':changeLine(diff(i?a[i-1]:null,e))||'No change','Photos':(e.photos||[]).length,'Logged by':e.by||''})})}
  hist.sort((a,b)=>b.Date.localeCompare(a.Date)||a.Product.localeCompare(b.Product));
  const ws2=XLSX.utils.json_to_sheet(hist);ws2['!cols']=[11,22,10,22,34,12,18,14,50,20,34,7,10].map(w=>({wch:w}));XLSX.utils.book_append_sheet(wb,ws2,'Full history');
  const vs=Object.values(S.visits).sort((a,b)=>b.date.localeCompare(a.date)).map(v=>{const ch=changesForVisit(v.id);return {'Date':v.date,'Store':storeName(v.storeId),'Attendees':(v.attendees||[]).join(', '),'Products checked':ch.length,'Price changes':ch.filter(c=>c.ch.some(x=>x.k==='price')).length,'Display moves':ch.filter(c=>c.ch.some(x=>x.k==='fixture')).length,'New products':ch.filter(c=>c.ch.some(x=>x.k==='new')).length,'Removed':ch.filter(c=>c.e.status==='removed').length}});
  const ws3=XLSX.utils.json_to_sheet(vs);ws3['!cols']=[11,26,40,10,10,10,10,10].map(w=>({wch:w}));XLSX.utils.book_append_sheet(wb,ws3,'Visits');
  const out=XLSX.write(wb,{bookType:'xlsx',type:'array'});
  const fname='Shelfwatch_'+today()+'.xlsx';
  if(!downloads){toast('Downloads aren’t available in this view');return}
  try{await downloads.save({filename:fname,data:new Blob([out])});}catch(e){if(e&&e.code!=='declined')toast('Couldn’t save the file here')}
}
async function doTemplate(){
  if(!(await loadXLSX()))return;
  const ws=XLSX.utils.aoa_to_sheet([['Date','Store','Buyer','Category','Product','Brand','Price','Fixture','Status','Observation','Why track'],[today(),'IKEA, Nagasandra','Adarsh','HH_C_G_TUMBLER','Example: Ribbed glass tumbler 300ml','IKEA','199','Shelf Display','Selling fast','Clear and amber selling; green low','Product Development']]);
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Updates');const out=XLSX.write(wb,{bookType:'xlsx',type:'array'});
  if(!downloads){toast('Downloads aren’t available in this view');return}
  try{await downloads.save({filename:'Shelfwatch_template.xlsx',data:new Blob([out])})}catch(e){}
}

/* ---------- events ---------- */
function onScroll(){const t=$('#top');if(t)t.classList.toggle('scrolled',window.scrollY>40)}
window.addEventListener('scroll',onScroll,{passive:true});
let actTimer={};
document.addEventListener('click',async ev=>{
  const b=ev.target.closest('[data-act]');if(!b)return;
  const a=b.dataset.act,id=b.dataset.id;
  if(b.tagName==='INPUT'||b.tagName==='LABEL')return;
  switch(a){
    case 'tab':if(b.dataset.tab)setTab(b.dataset.tab);break;
    case 'product':closeSheet();S.page={type:'product',id,from:S.page};render();window.scrollTo(0,0);break;
    case 'back':S.page=S.page&&S.page.from||null;render();window.scrollTo(0,0);break;
    case 'goprod':S.pf.status=b.dataset.status||'all';setTab('products');break;
    case 'pf':S.pf[b.dataset.g]=b.dataset.v;render();break;
    case 'psort':S.pf.sort=b.dataset.k;render();break;
    case 'ins-store':S.ins.store=b.dataset.v;render();break;
    case 'who':openWho();break;
    case 'set-me':S.me=b.dataset.v;ls.set('me',S.me);ls.set('meChosen',true);closeSheet();render();break;
    case 'close-sheet':closeSheet();break;
    case 'new-product':openProductForm(null,b.dataset.visit||(S.page&&S.page.type==='visit'?S.page.id:null));break;
    case 'edit-product':openProductForm(id);break;
    case 'save-product':saveProduct();break;
    case 'update':openUpdate(id,b.dataset.visit||(S.activeVisit&&S.visits[S.activeVisit]&&S.visits[S.activeVisit].storeId===(S.products[id]||{}).storeId?S.activeVisit:null));break;
    case 'edit-entry':{const e=S.entries[id];if(e)openUpdate(e.productId,e.visitId,id);break}
    case 'save-update':saveUpdate();break;
    case 'nochange':quickSame(id,b.dataset.visit);break;
    case 'u-status':sheetState.status=b.dataset.v;document.querySelectorAll('#u-status .opt').forEach(o=>o.classList.toggle('on',o.dataset.v===b.dataset.v));break;
    case 'u-same':{const st=sheetState;const p=latest(st.pid);if(p)$('#u-obs').value=p.observation;break}
    case 'u-delph':sheetState.photos.splice(+b.dataset.i,1);renderUPhotos();break;
    case 'zoom':{const v=document.createElement('div');v.className='viewer';v.innerHTML=`<img src="${esc(photoSrc(b.dataset.ref))}" alt=""><button aria-label="Close">×</button>`;v.onclick=()=>v.remove();document.body.appendChild(v);break}
    case 'bs':{const p=S.products[id];const bs=Object.assign({},p.bs||{});bs[b.dataset.k]=!bs[b.dataset.k];p.bs=bs;render();w(()=>db.doc('products/'+id).update({bs}));break}
    case 'verdict':{const p=S.products[id];p.bsVerdict=b.dataset.k;render();w(()=>db.doc('products/'+id).update({bsVerdict:b.dataset.k}));break}
    case 'act-done':{const p=S.products[id];const ac=Object.assign({},p.action||{});ac.done=!ac.done;p.action=ac;render();w(()=>db.doc('products/'+id).update({action:ac}),ac.done?'Action closed':'Action reopened');break}
    case 'archive':{const p=S.products[id];const v=!p.archived;if(await w(()=>db.doc('products/'+id).update({archived:v}),v?'Archived':'Tracking again')){p.archived=v;closeSheet();render()}break}
    case 'del-product':$('#del-confirm').innerHTML=`<div class="confirm"><p>Delete <b>${esc(S.products[id].name)}</b> and all ${ents(id).length} updates? This can’t be undone. Archiving keeps the history.</p><div class="row2"><button class="btn plain" data-act="del-cancel">Keep</button><button class="btn danger" data-act="del-product-yes" data-id="${id}">Delete</button></div></div>`;break;
    case 'del-entry':$('#del-confirm').innerHTML=`<div class="confirm"><p>Delete this update from ${esc(fd(S.entries[id].date))}?</p><div class="row2"><button class="btn plain" data-act="del-cancel">Keep</button><button class="btn danger" data-act="del-entry-yes" data-id="${id}">Delete</button></div></div>`;break;
    case 'del-cancel':$('#del-confirm').innerHTML='';break;
    case 'del-product-yes':{const es=ents(id).map(e=>e.id);if(await w(async()=>{for(const e of es)await db.doc('entries/'+e).delete();await db.doc('products/'+id).delete()},'Deleted')){es.forEach(e=>delete S.entries[e]);delete S.products[id];closeSheet();S.page=null;render()}break}
    case 'del-entry-yes':if(await w(()=>db.doc('entries/'+id).delete(),'Update deleted')){delete S.entries[id];closeSheet();render()}break;
    case 'toggle-opt':b.classList.toggle('on');break;
    case 'start-visit':{
      const sid=$('#vs-store').value;if(sid==='__new'){S._pendingStoreSelect=true;openStoreForm();break}
      const date=$('#vs-date').value||today();const att=[...document.querySelectorAll('#vs-att .opt.on')].map(o=>o.dataset.v);
      let v=Object.values(S.visits).find(x=>x.storeId===sid&&x.date===date);
      if(!v){const vid='v_'+sid.slice(0,30)+'_'+date;const data={storeId:sid,date,attendees:att,by:S.me||'',at:Date.now()};
        if(!await w(()=>db.doc('visits/'+vid).set(data)))break;v=S.visits[vid]=Object.assign({id:vid},data)}
      else if(att.length){const merged=[...new Set([...(v.attendees||[]),...att])];v.attendees=merged;w(()=>db.doc('visits/'+v.id).update({attendees:merged}))}
      S.activeVisit=v.id;ls.set('activeVisit',v.id);S.page={type:'visit',id:v.id,from:null};render();window.scrollTo(0,0);break}
    case 'open-visit':S.page={type:'visit',id,from:S.page};render();window.scrollTo(0,0);break;
    case 'resume-visit':S.activeVisit=id;ls.set('activeVisit',id);render();toast('Active visit set');break;
    case 'finish-visit':S.activeVisit=null;ls.set('activeVisit',null);toast('Visit finished');S.page={type:'visit',id,from:null};render();break;
    case 'vmine':S.visitMine=b.dataset.k==='true';ls.set('visitMine',S.visitMine);render();break;
    case 'edit-store':openStoreForm(id);break;
    case 'save-store':saveStore();break;
    case 'list-add':{const k=b.dataset.k;const inp=$('#add-'+k);const v=inp.value.trim();if(!v)break;const arr=(k==='team'?team():k==='fixtures'?fixtures():purposes()).slice();if(!arr.includes(v))arr.push(v);if(await w(()=>db.doc('config/settings').set(Object.assign({},S.cfg,{[k]:arr})),'Added')){S.cfg[k]=arr;render()}break}
    case 'list-del':{const k=b.dataset.k;const arr=(k==='team'?team():k==='fixtures'?fixtures():purposes()).filter(x=>x!==b.dataset.v);if(await w(()=>db.doc('config/settings').set(Object.assign({},S.cfg,{[k]:arr})))){S.cfg[k]=arr;render()}break}
    case 'export':doExport();break;
    case 'template':doTemplate();break;
    case 'import':openImport();break;
    case 'do-import':doImport();break;
    case 'sync-now':PLATFORM.retryStuck();PLATFORM.flush();PLATFORM.pull();toast('Syncing');break;
    case 'signout':{const n=PLATFORM.status.pending;$('#signout-confirm').innerHTML=`<div class="confirm"><p>${n?`<b>${n} change${n>1?'s haven’t':' hasn’t'} uploaded yet.</b> Signing out now deletes ${n>1?'them':'it'}. Connect to the internet first if you can.`:'Sign out and remove the team’s data from this device? It stays safe online.'}</p><div class="row2"><button class="btn plain" data-act="signout-cancel">Cancel</button><button class="btn danger" data-act="signout-yes">Sign out</button></div></div>`;break}
    case 'signout-cancel':$('#signout-confirm').innerHTML='';break;
    case 'signout-yes':PLATFORM.signOut(true);break;
    case 'member-add':{const n=$('#mem-name').value.trim(),e=$('#mem-email').value.trim();if(!n||!/^\S+@\S+\.\S+$/.test(e)){toast('Enter a name and a valid email');break}
      try{await PLATFORM.addMember(e,n);toast(n+' can now sign in');render()}catch(err){toast(navigator.onLine?'Couldn’t add: '+(err.message||'error'):'Connect to the internet to add people')}break}
    case 'member-del':try{await PLATFORM.removeMember(b.dataset.v);toast('Removed');render()}catch(err){toast('Couldn’t remove. Check your connection.')}break;
    case 'copy-invite':{const link=(window.SHELFWATCH_CONFIG&&window.SHELFWATCH_CONFIG.url)?location.origin+location.pathname:PLATFORM.joinLink();try{await navigator.clipboard.writeText(link);toast('Link copied. Paste it in WhatsApp or email.')}catch(e){openSheet(`<div class="grab"></div><div class="sh"><span style="min-width:76px"></span><div class="t">App link</div><button class="lnk r" data-act="close-sheet">Done</button></div><div class="sb"><div class="group"><textarea readonly style="min-height:120px;font-size:14px">${esc(link)}</textarea></div><p class="foot">Copy this link and send it to your team.</p></div>`)}break}
    case 'backup':doBackup();break;
    case 'restore':openRestore();break;
    case 'do-restore':doRestore();break;
  }
});
document.addEventListener('change',async ev=>{
  const t=ev.target;
  if(t.dataset.act==='u-file'){
    const st=sheetState;if(!st)return;const files=[...t.files];t.value='';
    st.busy=(st.busy||0)+files.length;renderUPhotos();
    for(const f of files){try{const id=await savePhoto(f);if(sheetState===st)st.photos.push(id)}catch(e){console.warn(e);toast('That photo couldn’t be saved')}st.busy--;if(sheetState===st)renderUPhotos()}
  }
  if(t.dataset.act==='rs-file'){const f=t.files[0];if(f)previewRestore(f)}
  if(t.dataset.act==='imp-file'){
    const f=t.files[0];if(!f)return;
    if(!(await loadXLSX())){toast('Excel tools didn’t load. Reload the app and try again.');return}
    try{const buf=await f.arrayBuffer();const wb=XLSX.read(buf,{type:'array'});previewImport(parseWorkbook(wb))}catch(e){console.warn(e);$('#imp-prev').innerHTML=`<div class="note" style="color:var(--bad)">This file couldn’t be read. Save it as .xlsx and try again.</div>`}
  }
  if(t.id==='vs-store'&&t.value==='__new'){S._pendingStoreSelect=true;openStoreForm()}
  if(t.dataset.actF){saveAction(t)}
});
document.addEventListener('input',ev=>{
  const t=ev.target;
  if(t.id==='pq'){S.pf.q=t.value;clearTimeout(actTimer.q);actTimer.q=setTimeout(()=>{const pos=t.selectionStart;render();const n=$('#pq');if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(e){}}},160)}
  if(t.dataset.actF==='text'){clearTimeout(actTimer.a);actTimer.a=setTimeout(()=>saveAction(t),700)}
});
function saveAction(t){const id=t.dataset.id;const p=S.products[id];if(!p)return;const ac=Object.assign({},p.action||{});ac[t.dataset.actF]=t.value;if(JSON.stringify(ac)===JSON.stringify(p.action||{}))return;p.action=ac;w(()=>db.doc('products/'+id).update({action:ac}))}
document.getElementById('tabbar').addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(b)setTab(b.dataset.tab)});

/* ---------- platform glue ---------- */
let rT=null;function soon(){clearTimeout(rT);rT=setTimeout(()=>{
  if(!S.ready)return;
  const ae=document.activeElement;if(ae&&ae.dataset&&ae.dataset.actF)return;
  if(ae&&(ae.id==='pq'||ae.id==='mem-name'||ae.id==='mem-email'||(ae.id||'').startsWith('add-')))return;render()},150)}
downloads={save:async({filename,data})=>{const b=data instanceof Blob?data:new Blob([data]);const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),8000);return {status:'saved'}}};
let _xlsxP=null;
function loadXLSX(){if(typeof XLSX!=='undefined')return Promise.resolve(true);if(!_xlsxP)_xlsxP=new Promise(res=>{const s=document.createElement('script');s.src='vendor/xlsx.full.min.js';s.onload=()=>res(true);s.onerror=()=>{_xlsxP=null;res(false)};document.head.appendChild(s)});return _xlsxP}

/* ---------- backup & restore ---------- */
function referencedPhotos(){const set=new Set();Object.values(S.entries).forEach(e=>(e.photos||[]).forEach(r=>set.add(r)));Object.values(S.products).forEach(p=>{if(p.cover)set.add(p.cover)});return [...set]}
async function doBackup(){
  if(typeof JSZip==='undefined'){toast('Backup tools didn’t load. Reload the app.');return}
  const refs=referencedPhotos();toast('Preparing backup…');
  const strip=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>{const c=Object.assign({},v);delete c.id;return [k,c]}));
  const zip=new JSZip();
  zip.file('data.json',JSON.stringify({app:'shelfwatch',version:1,exportedAt:new Date().toISOString(),collections:{stores:strip(S.stores),products:strip(S.products),entries:strip(S.entries),visits:strip(S.visits),config:{settings:S.cfg}}}));
  let got=0,missing=0;const ph=zip.folder('photos');
  for(const r of refs){try{const b=await PLATFORM.photoBlob(r);if(b){ph.file(r+'.jpg',b);got++}else missing++}catch(e){missing++}
    if((got+missing)%20===0)toast(`Collecting photos ${got+missing} of ${refs.length}…`)}
  const out=await zip.generateAsync({type:'blob'});
  await downloads.save({filename:'Shelfwatch_backup_'+today()+'.zip',data:out});
  toast(missing?`Backup saved. ${missing} photo${missing>1?'s':''} couldn’t be fetched (offline?).`:'Backup saved with '+got+' photos');
}
function openRestore(){
  sheetState={kind:'restore',zip:null,data:null};
  openSheet(`<div class="grab"></div><div class="sh"><button class="lnk" data-act="close-sheet">Cancel</button><div class="t">Restore from backup</div><button class="lnk r" data-act="do-restore" id="rs-go" disabled style="opacity:.4">Restore</button></div><div class="sb">
  <div class="note">Choose a Shelfwatch backup (.zip). Its products, visits and photos are added to the team’s data. Items that already exist with the same ID are replaced by the backup’s version.</div>
  <div style="margin-top:14px"><label class="btn sec2" style="cursor:pointer">${IC.ul} Choose backup file<input type="file" accept=".zip,application/zip" data-act="rs-file" style="display:none"></label></div><div id="rs-prev" style="margin-top:14px"></div></div>`);
}
async function previewRestore(f){
  const el=$('#rs-prev');
  try{const zip=await JSZip.loadAsync(f);const df=zip.file('data.json');if(!df)throw new Error('no data');const data=JSON.parse(await df.async('string'));
    sheetState.zip=zip;sheetState.data=data;const c=data.collections||{};const n=k=>Object.keys(c[k]||{}).length;
    const photos=Object.keys(zip.files).filter(k=>k.startsWith('photos/')&&!zip.files[k].dir).length;
    el.innerHTML=`<div class="group"><div class="row"><span class="grow">Products</span><span class="val">${n('products')}</span></div><div class="row"><span class="grow">Updates</span><span class="val">${n('entries')}</span></div><div class="row"><span class="grow">Visits</span><span class="val">${n('visits')}</span></div><div class="row"><span class="grow">Stores</span><span class="val">${n('stores')}</span></div><div class="row"><span class="grow">Photos</span><span class="val">${photos}</span></div></div>`;
    const b=$('#rs-go');b.disabled=false;b.style.opacity=1;
  }catch(e){el.innerHTML=`<div class="note" style="color:var(--bad)">This isn’t a Shelfwatch backup file.</div>`}
}
async function doRestore(){
  const st=sheetState;if(!st||!st.data||st.busy)return;st.busy=1;const go=$('#rs-go');
  const c=st.data.collections||{};const photoFiles=Object.keys(st.zip.files).filter(k=>k.startsWith('photos/')&&!st.zip.files[k].dir);
  const total=photoFiles.length+['stores','visits','products','entries','config'].reduce((a,k)=>a+Object.keys(c[k]||{}).length,0);let done=0;
  const tick=()=>{done++;if(done%10===0||done===total)go.textContent=Math.round(done/total*100)+'%'};
  try{
    for(const k of photoFiles){const ref=k.slice(7).replace(/\.jpe?g$/i,'');const raw=await st.zip.file(k).async('blob');await PLATFORM.putPhoto(ref,new Blob([raw],{type:'image/jpeg'}),true);tick()}
    for(const col of ['config','stores','visits','products','entries']){for(const [id,d] of Object.entries(c[col]||{})){const x=Object.assign({},d);delete x.id;await PLATFORM.write(col,id,x,false);tick()}}
    toast('Restored. Uploading to the team in the background.');closeSheet();setTab('products');
  }catch(e){console.warn(e);toast('Restore stopped: '+(e.message||'error'));st.busy=0;go.textContent='Restore'}
}

/* ---------- sign-in gate ---------- */
const LOGO=`<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1B74E8"/><stop offset="1" stop-color="#5B3FD9"/></linearGradient></defs><rect width="64" height="64" rx="15" fill="url(#lg)"/><path d="M14 22h36M14 34h36M14 46h36" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".95"/><rect x="18" y="13" width="8" height="9" rx="1.6" fill="#fff"/><rect x="29" y="16" width="6" height="6" rx="1.4" fill="#fff" opacity=".8"/><rect x="36" y="25" width="10" height="9" rx="1.6" fill="#fff"/><rect x="20" y="38" width="7" height="8" rx="1.6" fill="#fff" opacity=".85"/><circle cx="41" cy="41" r="5" fill="none" stroke="#fff" stroke-width="2.6"/></svg>`;
let gateEmail=ls.get('lastEmail','');
function showGate(kind,msg){
  const g=$('#gate');g.hidden=false;$('#tabbar').hidden=true;$('#app').innerHTML='';
  let h=`<div class="gcard"><div class="glogo">${LOGO}</div>`;
  if(kind==='setup'){
    h+=`<h1>Connect Shelfwatch</h1><p>One-time setup for the admin. Paste the two values from your Supabase project (Project Settings → API).</p>
    <div class="group"><div class="field"><label for="g-url">Project URL</label><input id="g-url" placeholder="https://xxxx.supabase.co" autocomplete="off" autocapitalize="off"></div><div class="field"><label for="g-key">Public key</label><input id="g-key" placeholder="anon / publishable key" autocomplete="off" autocapitalize="off"></div></div>
    <button class="btn" data-gate="connect">Connect</button><p class="small">Joining a team? Open the link your admin sent you instead.</p>`;
  }else if(kind==='signin'||kind==='signup'){
    const up=kind==='signup';
    h+=`<h1>${up?'Create your password':'Sign in'}</h1><p>${up?'First time here? Use your work email and pick a password of at least 8 characters. Your email must be on the team list.':'Use your work email and the password you set the first time.'}</p>
    <div class="group"><div class="field"><label for="g-email">Email</label><input id="g-email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" placeholder="you@company.com" value="${esc(gateEmail)}"></div>
    <div class="field"><label for="g-pw">Password</label><input id="g-pw" type="password" autocomplete="${up?'new-password':'current-password'}" placeholder="${up?'At least 8 characters':'Password'}"></div></div>
    <button class="btn" data-gate="${up?'signup':'login'}">${up?'Create password and sign in':'Sign in'}</button><div id="g-msg" class="small"></div>
    <div class="glinks"><button class="lnk" data-gate="${up?'to-login':'to-signup'}">${up?'I already have a password':'First time? Create a password'}</button>${up?'':'<button class="lnk" data-gate="forgot">Forgot password?</button>'}</div>`;
  }else if(kind==='notmember'){
    h+=`<h1>Almost there</h1><p><b>${esc(PLATFORM.status.email)}</b> isn’t on the team list yet. Ask your admin to add this email in Settings → Team access, then tap Check again.</p>
    <button class="btn" data-gate="recheck">Check again</button><div class="glinks"><button class="lnk" data-gate="signout">Use a different email</button></div>`;
  }else{
    h+=`<h1>Something went wrong</h1><p>${esc(msg||'Reload the app and try again.')}</p><button class="btn" data-gate="reload">Reload</button>`;
  }
  g.innerHTML=h+`</div>`;
  const f=g.querySelector('input');if(f)setTimeout(()=>f.focus(),60);
}
function gateMsg(t,bad){const m=$('#g-msg');if(m){m.textContent=t;m.style.color=bad?'var(--bad)':'var(--label2)'}}
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.closest&&e.target.closest('#gate')){const b=$('#gate .btn');if(b)b.click()}});
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-gate]');if(!b)return;const a=b.dataset.gate;
  if(a==='connect'){const u=$('#g-url').value.trim(),k=$('#g-key').value.trim();if(!/^https:\/\/.+/.test(u)||k.length<20){toast('Paste both values from Supabase');return}PLATFORM.saveConn(u,k);location.reload()}
  if(a==='login'||a==='signup'){
    gateEmail=$('#g-email').value.trim().toLowerCase();const pw=$('#g-pw').value;
    if(!/^\S+@\S+\.\S+$/.test(gateEmail)){gateMsg('Enter a valid email',true);return}
    if(pw.length<8){gateMsg('The password needs at least 8 characters',true);return}
    if(!navigator.onLine){gateMsg('You’re offline. Connect to the internet to sign in the first time.',true);return}
    ls.set('lastEmail',gateEmail);b.disabled=true;gateMsg(a==='login'?'Signing in…':'Creating your account…');
    try{PLATFORM.initClient();if(a==='login')await PLATFORM.signInPassword(gateEmail,pw);else await PLATFORM.signUpPassword(gateEmail,pw);location.reload()}
    catch(err){b.disabled=false;const m=(err&&err.message)||'';
      gateMsg(err&&err.code==='confirm'?m:/invalid login/i.test(m)?'Email or password is wrong. First time? Tap “Create a password”.':/already registered|already exists/i.test(m)?'This email already has a password. Tap “I already have a password”.':/weak|short|at least/i.test(m)?'Choose a longer password.':'Couldn’t sign in: '+m,true)}
  }
  if(a==='to-signup'){gateEmail=($('#g-email')||{}).value||gateEmail;showGate('signup')}
  if(a==='to-login'){gateEmail=($('#g-email')||{}).value||gateEmail;showGate('signin')}
  if(a==='forgot'){gateMsg('Ask your admin to reset it: Supabase → Authentication → Users → delete your user. Then tap “First time? Create a password” again.',false)}
  if(a==='change'){showGate('signin')}
  if(a==='recheck'){await PLATFORM.loadMembers();if(PLATFORM.status.member)location.reload();else toast('Still not on the list')}
  if(a==='signout'){PLATFORM.signOut(true)}
  if(a==='reload'){location.reload()}
});

/* ---------- boot ---------- */
db=PLATFORM.db;
render();
(async()=>{
  let r;
  try{r=await PLATFORM.init(S,()=>{_idx=null;soon()})}
  catch(e){console.warn(e);r={state:'error',message:'This browser is blocking storage the app needs. Turn off private browsing and reload.'}}
  if(r.state==='setup')return showGate('setup');
  if(r.state==='signin')return showGate('signin');
  if(r.state==='error')return showGate('error',r.message);
  const st=PLATFORM.status;
  if(navigator.onLine&&!st.member){await PLATFORM.loadMembers();if(!st.member)return showGate('notmember')}
  if(st.member&&st.member.name&&!ls.get('meChosen',false)){S.me=st.member.name;ls.set('me',S.me)}
  S.ready=true;$('#gate').hidden=true;$('#tabbar').hidden=false;render();
  PLATFORM.on(()=>updatePill());
  setInterval(updatePill,30000);
  if(!S.me)setTimeout(()=>{if(!S.me&&!sheetState)openWho()},700);
})();

})();

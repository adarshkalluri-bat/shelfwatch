/* ===== Shelfwatch platform layer: local cache (IndexedDB) + outbox + Supabase sync ===== */
const PLATFORM=(function(){
  const CFG_LS='sw:conn';
  const COLS=['stores','products','entries','visits','config'];
  let idb=null,sb=null,session=null,flushing=false,pulling=false,pollT=null;
  const listeners=new Set();
  const st={online:navigator.onLine,pending:0,lastSync:null,syncing:false,error:'',email:'',member:null,members:[]};
  const emit=()=>listeners.forEach(f=>{try{f(st)}catch(e){}});

  /* ---------- config ---------- */
  function readJoinHash(){
    const m=location.hash.match(/join=([A-Za-z0-9_\-+/=]+)/);if(!m)return null;
    try{const j=JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g,'+').replace(/_/g,'/')))));if(j.url&&j.key){localStorage.setItem(CFG_LS,JSON.stringify({url:j.url,key:j.key}));history.replaceState(null,'',location.pathname+location.search);return j}}catch(e){}
    return null;
  }
  function conn(){
    readJoinHash();
    const fixed=window.SHELFWATCH_CONFIG||{};
    if(fixed.url&&fixed.key)return {url:fixed.url.trim(),key:fixed.key.trim(),fixed:true};
    try{const c=JSON.parse(localStorage.getItem(CFG_LS)||'null');if(c&&c.url&&c.key)return c}catch(e){}
    return null;
  }
  function saveConn(url,key){localStorage.setItem(CFG_LS,JSON.stringify({url:url.trim(),key:key.trim()}))}
  function joinLink(){const c=conn();if(!c)return '';const b=btoa(unescape(encodeURIComponent(JSON.stringify({url:c.url,key:c.key})))).replace(/\+/g,'-').replace(/\//g,'_');return location.origin+location.pathname+'#join='+b}

  /* ---------- IndexedDB ---------- */
  function openIdb(){return new Promise((res,rej)=>{const r=indexedDB.open('shelfwatch',1);
    r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('docs');d.createObjectStore('meta');d.createObjectStore('outbox',{keyPath:'seq',autoIncrement:true});d.createObjectStore('blobs')};
    r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
  function tx(store,mode,fn){return new Promise((res,rej)=>{const t=idb.transaction(store,mode);const s=t.objectStore(store);let out;const r=fn(s);if(r&&'onsuccess' in r)r.onsuccess=()=>{out=r.result};t.oncomplete=()=>res(out);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})}
  const iget=(s,k)=>tx(s,'readonly',o=>o.get(k));
  const iput=(s,v,k)=>tx(s,'readwrite',o=>k===undefined?o.put(v):o.put(v,k));
  const idel=(s,k)=>tx(s,'readwrite',o=>o.delete(k));
  const iall=s=>tx(s,'readonly',o=>o.getAll());
  const ikeys=s=>tx(s,'readonly',o=>o.getAllKeys());
  const iclear=s=>tx(s,'readwrite',o=>o.clear());

  /* ---------- in-memory mirror (owned by app's S) ---------- */
  let S=null,onChange=()=>{};
  function applyLocal(col,id,data,deleted){
    if(col==='config'){if(id==='settings')S.cfg=deleted?{}:Object.assign({},data);return}
    if(!S[col])return;
    if(deleted)delete S[col][id];else S[col][id]=Object.assign({id},data);
  }

  /* ---------- write API used by the app (db shim) ---------- */
  const localAt={},pushedAt={};
  async function write(col,id,data,deleted){
    localAt[col+'/'+id]=Date.now();
    applyLocal(col,id,data,deleted);
    await iput('docs',{col,id,data:data||{},deleted:!!deleted},col+'/'+id);
    await iput('outbox',{t:'doc',col,id,data:data||{},deleted:!!deleted,at:Date.now()});
    await countPending();onChange();flushSoon();
  }
  const db={doc(path){const p=path.split('/');const col=p[0],id=p[1];return{
    set:async d=>write(col,id,JSON.parse(JSON.stringify(d)),false),
    update:async d=>{const cur=await iget('docs',col+'/'+id);if(!cur||cur.deleted)throw {code:'invalid_argument',message:'missing'};await write(col,id,Object.assign({},cur.data,JSON.parse(JSON.stringify(d))),false)},
    delete:async()=>write(col,id,{},true)}}};

  /* ---------- photos ---------- */
  const urlCache={},inflight={},failedAt={};let dlActive=0;const dlQueue=[];
  async function putPhoto(ref,blob,queue){await iput('blobs',blob,ref);urlCache[ref]=URL.createObjectURL(blob);if(queue){await iput('outbox',{t:'photo',ref,at:Date.now()});await countPending();flushSoon()}}
  function photoUrl(ref){
    if(!ref)return '';if(urlCache[ref])return urlCache[ref];
    if(!inflight[ref]&&!(failedAt[ref]&&Date.now()-failedAt[ref]<60000))inflight[ref]=loadPhoto(ref).finally(()=>delete inflight[ref]);
    return 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
  }
  async function loadPhoto(ref){
    let b=await iget('blobs',ref);
    if(!b){
      if(!sb||!session||!navigator.onLine){failedAt[ref]=Date.now();return}
      await new Promise(r=>{dlQueue.push(r);pump()});
      try{const {data,error}=await sb.storage.from('photos').download(ref+'.jpg');if(error||!data){failedAt[ref]=Date.now();return}b=data;await iput('blobs',b,ref)}
      finally{dlActive--;pump()}
    }
    urlCache[ref]=URL.createObjectURL(b);
    document.querySelectorAll('img[data-ph="'+ref+'"]').forEach(i=>{i.src=urlCache[ref]});
  }
  function pump(){while(dlActive<4&&dlQueue.length){dlActive++;dlQueue.shift()()}}
  async function photoBlob(ref){let b=await iget('blobs',ref);if(b)return b;if(!sb||!session)return null;const {data}=await sb.storage.from('photos').download(ref+'.jpg');if(data){await iput('blobs',data,ref);return data}return null}

  /* ---------- sync ---------- */
  async function countPending(){st.pending=(await ikeys('outbox')).length;emit()}
  let flushT=null;function flushSoon(){clearTimeout(flushT);flushT=setTimeout(flush,400)}
  const isNetErr=e=>!navigator.onLine||!e||e.status===0||/fetch|network|load failed|timeout/i.test((e&&e.message)||'');
  async function flush(){
    if(flushing||!sb||!session||!navigator.onLine)return;flushing=true;st.syncing=true;emit();
    try{
      const ops=await iall('outbox');
      for(const op of ops){
        let error=null;
        if(op.t==='doc'){
          ({error}=await sb.from('docs').upsert({collection:op.col,id:op.id,data:op.data,deleted:op.deleted},{onConflict:'collection,id'}));
        }else if(op.t==='photo'){
          const blob=await iget('blobs',op.ref);
          if(blob){const r=await sb.storage.from('photos').upload(op.ref+'.jpg',blob,{contentType:'image/jpeg',upsert:false});error=r.error;
            if(error&&(String(error.statusCode)==='409'||/exist|duplicate/i.test(error.message||'')))error=null;}
        }
        if(error){
          if(isNetErr(error)){st.error='';break}
          if(error.code==='42501'||error.status===401||error.status===403||/row-level security|permission|jwt/i.test(error.message||'')){st.error='Your email isn’t on the team list, so changes can’t sync. Ask the admin to add you.';break}
          st.error='A change couldn’t sync: '+(error.message||'unknown error');
          op.tries=(op.tries||0)+1;await iput('outbox',op);
          if(op.tries<5)break; // keep order; retry later
          // after 5 failures move it aside so it doesn't block everything
          await idel('outbox',op.seq);await iput('meta',op,'stuck:'+op.seq);continue;
        }
        if(op.t==='doc')pushedAt[op.col+'/'+op.id]=Date.now();
        await idel('outbox',op.seq);st.error='';
      }
    }catch(e){console.warn('flush',e)}
    finally{flushing=false;st.syncing=false;await countPending();emit()}
    if(st.pending===0)pull();
  }
  async function pull(){
    if(pulling||!sb||!session||!navigator.onLine)return;pulling=true;st.syncing=true;emit();
    try{
      let since=(await iget('meta','lastSync'))||'1970-01-01T00:00:00Z';
      const start=new Date(new Date(since).getTime()-5000).toISOString();
      let cursor=start,changed=0,maxSeen=since,redo=null;
      for(let page=0;page<50;page++){
        const t0=Date.now();
        const {data,error}=await sb.from('docs').select('collection,id,data,deleted,updated_at').gt('updated_at',cursor).order('updated_at',{ascending:true}).limit(1000);
        if(error){if(!isNetErr(error))st.error=/row-level|permission/i.test(error.message||'')?'Your email isn’t on the team list yet.':('Sync error: '+error.message);break}
        // never let a server copy overwrite something changed on this device while the request was in flight
        const pend=error?new Set():new Set((await iall('outbox')).filter(o=>o.t==='doc').map(o=>o.col+'/'+o.id));
        for(const r of data){
          const k=r.collection+'/'+r.id;
          const racing=(localAt[k]||0)>=t0||(pushedAt[k]||0)>=t0;
          if(racing&&(!redo||r.updated_at<redo))redo=r.updated_at; // look at this row again on the next pass
          if(!pend.has(k)&&!racing){applyLocal(r.collection,r.id,r.data,r.deleted);await iput('docs',{col:r.collection,id:r.id,data:r.data,deleted:r.deleted},k);changed++}
          if(r.updated_at>maxSeen)maxSeen=r.updated_at;
        }
        if(data.length<1000)break;cursor=data[data.length-1].updated_at;
      }
      if(redo&&redo<maxSeen)maxSeen=redo;
      await iput('meta',maxSeen,'lastSync');st.lastSync=Date.now();
      if(changed)onChange();
    }catch(e){console.warn('pull',e)}
    finally{pulling=false;st.syncing=false;emit()}
  }
  function startPolling(){clearInterval(pollT);pollT=setInterval(()=>{if(document.visibilityState==='visible'){flush();pull()}},20000)}

  /* ---------- auth ---------- */
  async function loadMembers(){
    if(!sb||!session||!navigator.onLine){const m=await iget('meta','members');if(m){st.members=m;st.member=m.find(x=>x.email.toLowerCase()===st.email.toLowerCase())||null}return}
    const {data,error}=await sb.from('members').select('email,name,role').order('name');
    if(!error&&data){st.members=data;await iput('meta',data,'members');st.member=data.find(x=>x.email.toLowerCase()===st.email.toLowerCase())||null}
    emit();
  }
  async function signInPassword(email,password){const {data,error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;session=data.session;st.email=session.user.email||email;return session}
  async function signUpPassword(email,password){const {data,error}=await sb.auth.signUp({email,password});if(error)throw error;if(!data.session)throw {code:'confirm',message:'Email confirmation is switched on in Supabase. Turn off “Confirm email” (Authentication → Sign In / Providers → Email).'};session=data.session;st.email=session.user.email||email;return session}
  async function sendCode(email){const {error}=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:true,emailRedirectTo:location.origin+location.pathname}});if(error)throw error}
  async function verifyCode(email,token){
    let r=await sb.auth.verifyOtp({email,token,type:'email'});
    if(r.error)r=await sb.auth.verifyOtp({email,token,type:'signup'}).catch(()=>r);
    if(r.error)throw r.error;session=r.data.session;st.email=session.user.email||email;return session;
  }
  async function signOut(clearLocal){
    try{await sb.auth.signOut()}catch(e){}
    session=null;
    if(clearLocal){for(const s of ['docs','meta','outbox','blobs'])await iclear(s)}
    location.reload();
  }
  async function addMember(email,name){const {error}=await sb.from('members').upsert({email:email.trim().toLowerCase(),name:name.trim()});if(error)throw error;await loadMembers()}
  async function removeMember(email){const {error}=await sb.from('members').delete().eq('email',email);if(error)throw error;await loadMembers()}

  /* ---------- boot ---------- */
  async function init(appState,changeCb){
    S=appState;onChange=changeCb;
    idb=await openIdb();
    // load cache
    const docs=await iall('docs');for(const d of docs)if(!d.deleted)applyLocal(d.col,d.id,d.data,false);
    await countPending();
    const c=conn();if(!c)return {state:'setup'};
    if(!window.supabase){return {state:'error',message:'The app files didn’t load completely. Reload the page.'}}
    sb=window.supabase.createClient(c.url,c.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'sw-auth'}});
    const {data}=await sb.auth.getSession();session=data.session;
    sb.auth.onAuthStateChange((ev,s)=>{session=s;if(s&&s.user)st.email=s.user.email||st.email});
    if(!session)return {state:'signin'};
    st.email=session.user.email||'';
    await loadMembers();
    window.addEventListener('online',()=>{st.online=true;emit();flush();pull()});
    window.addEventListener('offline',()=>{st.online=false;emit()});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){flush();pull()}});
    startPolling();flush();pull();
    if(navigator.onLine&&!st.member&&st.members.length===0){/* could be RLS denial */}
    return {state:'ready'};
  }
  function initClient(){const c=conn();if(c&&window.supabase&&!sb)sb=window.supabase.createClient(c.url,c.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'sw-auth'}});return !!sb}
  async function stuck(){return (await ikeys('meta')).filter(k=>String(k).startsWith('stuck:')).length}
  async function retryStuck(){const ks=(await ikeys('meta')).filter(k=>String(k).startsWith('stuck:'));for(const k of ks){const op=await iget('meta',k);delete op.seq;op.tries=0;await iput('outbox',op);await idel('meta',k)}await countPending();flush()}
  async function allPhotoRefs(){return await ikeys('blobs')}

  return {init,initClient,signInPassword,signUpPassword,db,conn,saveConn,joinLink,photoUrl,putPhoto,photoBlob,flush,pull,sendCode,verifyCode,signOut,addMember,removeMember,loadMembers,
    status:st,on:f=>{listeners.add(f);return()=>listeners.delete(f)},stuck,retryStuck,allPhotoRefs,write};
})();

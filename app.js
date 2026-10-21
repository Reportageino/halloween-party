(() => {
  "use strict";
  const cfg = window.APP_CONFIG || {};
  const hasConfig = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_URL.includes("YOUR-PROJECT") && !cfg.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
  const $ = id => document.getElementById(id);
  const state = { client:null, session:null, guests:[], hosts:[], deleting:null, toastTimer:null };
  const fa = new Intl.NumberFormat("fa-IR");
  const toman = n => `${fa.format(Number(n || 0))} تومان`;
  const digitsToLatin = s => String(s).replace(/[۰-۹]/g,d=>"۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d));
  const parseAmount = s => { const v=digitsToLatin(String(s||"")).replace(/[,.\u066C\s٬]/g,"").replace(/[^\d]/g,""); return v?Number(v):0; };
  const isAdmin = () => !!state.session;
  const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const toast = msg => { const el=$("toast");el.textContent=msg;el.classList.add("show");clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>el.classList.remove("show"),3000); };
  const setConnection = (kind,text) => { const el=$("connection");el.className="connection "+kind;el.innerHTML=`<i></i> ${esc(text)}`; };
  const showDialog = id => $(id).showModal();
  const closeDialog = id => $(id).close();
  const sortPeople = list => [...list].sort((a,b)=>(a.sort_order??999)-(b.sort_order??999)||String(a.name).localeCompare(String(b.name),"fa"));
  function adminUI(){document.querySelectorAll(".admin-only").forEach(el=>el.classList.toggle("hidden",!isAdmin()));$("adminOpen").classList.toggle("hidden",isAdmin());$("logoutBtn").classList.toggle("hidden",!isAdmin());$("adminFinance").classList.toggle("hidden",!isAdmin());}
  async function loadData(){
    if(!state.client)return renderSetupMessage();
    try{
      const [g,h]=await Promise.all([
        state.client.from(isAdmin()?"guests":"guests_public").select("*").order("sort_order",{ascending:true}),
        state.client.from(isAdmin()?"hosts":"hosts_public").select("*").order("sort_order",{ascending:true})
      ]);
      if(g.error)throw g.error;if(h.error)throw h.error;
      state.guests=g.data||[];state.hosts=h.data||[];renderAll();setConnection("online",isAdmin()?"ادمین وارد شده":"آنلاین");
    }catch(e){console.error(e);setConnection("offline","خطا در دریافت اطلاعات");$("guestList").innerHTML='<div class="empty-card">دریافت اطلاعات انجام نشد. تنظیمات Supabase و SQL را بررسی کن.</div>';toast("خطا در دریافت اطلاعات از سرور");}
  }
  function renderSetupMessage(){setConnection("offline","نیازمند تنظیم");$("guestList").innerHTML='<div class="loading-card">برای فعال‌شدن سایت، آدرس پروژه و کلید عمومی Supabase را در فایل <b>config.js</b> وارد کن و SQL راهنما را اجرا کن.</div>';}
  function renderAll(){
    const primary=state.guests.filter(g=>!g.parent_id).length+state.hosts.length;
    const subs=state.guests.filter(g=>!!g.parent_id).length;
    $("primaryCount").textContent=fa.format(primary);$("guestCount").textContent=fa.format(state.guests.length+state.hosts.length);$("hostCount").textContent=fa.format(subs);
    renderParticipants();
    if(isAdmin()){
      const gm=state.guests.reduce((n,g)=>n+Number(g.amount_toman||0),0),hm=state.hosts.reduce((n,h)=>n+Number(h.amount_toman||0),0);
      $("guestMoney").textContent=toman(gm);$("hostMoney").textContent=toman(hm);$("allMoney").textContent=toman(gm+hm);
    }
    adminUI();
  }
  function renderParticipants(){
    const root=$("guestList");
    if(!state.guests.length&&!state.hosts.length){root.innerHTML='<div class="empty-card">هنوز شرکت‌کننده‌ای ثبت نشده است.</div>';return;}
    const children=new Map();state.guests.forEach(g=>{const k=g.parent_id||"__root";if(!children.has(k))children.set(k,[]);children.get(k).push(g);});
    const descendantCount=id=>(children.get(id)||[]).reduce((n,c)=>n+1+descendantCount(c.id),0);
    const actions=(type,id)=>isAdmin()?`<div class="admin-actions"><button class="icon-button" data-action="add-child" data-id="${esc(id)}">＋ زیرمجموعه</button><button class="icon-button" data-action="edit-${type}" data-id="${esc(id)}">ویرایش</button><button class="icon-button delete" data-action="delete-${type}" data-id="${esc(id)}">حذف</button></div>`:"";
    const renderSub=(g,depth=1)=>{
      const subs=sortPeople(children.get(g.id)||[]);
      return `<div class="subperson nested-depth-${Math.min(depth,4)}"><div class="participant-label"><span class="participant-name subordinate-name">${esc(g.name)}</span><span class="sub-label">زیرمجموعه</span></div>${actions("guest",g.id)}${subs.length?`<div class="subpeople">${subs.map(s=>renderSub(s,depth+1)).join("")}</div>`:""}</div>`;
    };
    const renderPrimary=g=>{
      const subs=sortPeople(children.get(g.id)||[]),total=1+descendantCount(g.id);
      return `<article class="guest-card participant-card"><div class="person-row"><span class="person-icon">👤</span><div class="person-info"><div class="person-name">${esc(g.name)}</div><div class="person-meta">نفر اصلی · ${fa.format(total-1)} زیرمجموعه</div></div><span class="headcount">${fa.format(total)} نفر</span>${actions("guest",g.id)}</div>${subs.length?`<div class="subpeople">${subs.map(s=>renderSub(s)).join("")}</div>`:""}</article>`;
    };
    // Legacy host records remain visible as top-level participants and retain their existing edit/delete/payment data.
    const entries=[...sortPeople(state.guests.filter(g=>!g.parent_id)).map(g=>({kind:"guest",item:g,sort:g.sort_order??999})),...sortPeople(state.hosts).map(h=>({kind:"host",item:h,sort:h.sort_order??999}))].sort((a,b)=>a.sort-b.sort);
    root.innerHTML=entries.map(e=>e.kind==="guest"?renderPrimary(e.item):`<article class="guest-card participant-card legacy-host"><div class="person-row"><span class="person-icon">👤</span><div class="person-info"><div class="person-name">${esc(e.item.name)}</div><div class="person-meta">نفر اصلی</div></div>${actions("host",e.item.id)}</div></article>`).join("");
    if(isAdmin())root.querySelectorAll("[data-action]").forEach(btn=>btn.addEventListener("click",()=>handleAction(btn.dataset.action,btn.dataset.id)));
  }
  function openPerson(person=null,parentId=""){
    $("personForm").reset();$("personError").textContent="";$("personId").value=person?.id||"";$("personType").value="guest";
    $("personName").value=person?.name||"";$("personAmount").value=person?fa.format(Number(person.amount_toman||0)):"0";
    $("personDialogTitle").textContent=person?"ویرایش شرکت‌کننده":"افزودن شرکت‌کننده";$("personEmoji").textContent="🎃";$("parentFieldWrap").classList.remove("hidden");
    const select=$("parentSelect");select.innerHTML='<option value="">نفر اصلی (بدون والد)</option>';
    const blocked=new Set();
    if(person){const cm=new Map();state.guests.forEach(g=>{if(g.parent_id){if(!cm.has(g.parent_id))cm.set(g.parent_id,[]);cm.get(g.parent_id).push(g.id);}});const mark=id=>{blocked.add(id);(cm.get(id)||[]).forEach(mark);};mark(person.id);}
    sortPeople(state.guests.filter(g=>!blocked.has(g.id))).forEach(g=>{const o=document.createElement("option");o.value=g.id;o.textContent=(g.parent_id?"↳ ":"")+g.name;select.appendChild(o);});
    select.value=person?.parent_id||parentId||"";showDialog("personDialog");
  }
  function openLegacyHost(host){
    $("personForm").reset();$("personError").textContent="";$("personId").value=host.id;$("personType").value="host";$("personName").value=host.name;$("personAmount").value=fa.format(Number(host.amount_toman||0));
    $("personDialogTitle").textContent="ویرایش شرکت‌کننده";$("personEmoji").textContent="🎃";$("parentFieldWrap").classList.add("hidden");showDialog("personDialog");
  }
  async function handleAction(action,id){
    if(action==="add-child")return openPerson(null,id);
    if(action==="edit-guest")return openPerson(state.guests.find(g=>g.id===id));
    if(action==="edit-host")return openLegacyHost(state.hosts.find(h=>h.id===id));
    if(action==="delete-guest"||action==="delete-host"){
      const type=action.endsWith("host")?"host":"guest",item=(type==="host"?state.hosts:state.guests).find(x=>x.id===id);
      state.deleting={type,id};$("confirmText").textContent=type==="host"?`شرکت‌کنندهٔ «${item?.name||""}» و پرداخت ثبت‌شده‌اش حذف می‌شود.`:item?.parent_id?`زیرمجموعهٔ «${item?.name||""}» حذف می‌شود.`:`نفر اصلی «${item?.name||""}» و تمام زیرمجموعه‌هایش حذف می‌شوند.`;showDialog("confirmDialog");
    }
  }
  $("personForm").addEventListener("submit",async e=>{
    e.preventDefault();if(!isAdmin())return;
    const type=$("personType").value,id=$("personId").value,name=$("personName").value.trim(),amount=parseAmount($("personAmount").value);
    if(!name){$("personError").textContent="نام را وارد کن.";return;}if(!Number.isSafeInteger(amount)||amount<0){$("personError").textContent="مبلغ باید یک عدد صحیح و نامنفی باشد.";return;}
    const payload={name,amount_toman:amount,sort_order:Date.now()};if(type==="guest")payload.parent_id=$("parentSelect").value||null;
    const table=type==="host"?"hosts":"guests";
    try{const result=id?await state.client.from(table).update(payload).eq("id",id):await state.client.from("guests").insert(payload);if(result.error)throw result.error;closeDialog("personDialog");await loadData();toast("اطلاعات شرکت‌کننده ذخیره شد.");}
    catch(err){console.error(err);$("personError").textContent="ذخیره انجام نشد. اتصال و مجوزهای دیتابیس را بررسی کن.";}
  });
  $("confirmDelete").addEventListener("click",async()=>{
    if(!state.deleting||!isAdmin())return;const {type,id}=state.deleting,table=type==="host"?"hosts":"guests";
    try{
      if(type==="guest"){
        const descendants=[];const collect=pid=>state.guests.filter(g=>g.parent_id===pid).forEach(g=>{descendants.push(g.id);collect(g.id);});collect(id);
        if(descendants.length){const del=await state.client.from("guests").delete().in("id",descendants);if(del.error)throw del.error;}
      }
      const result=await state.client.from(table).delete().eq("id",id);if(result.error)throw result.error;closeDialog("confirmDialog");state.deleting=null;await loadData();toast("شرکت‌کننده حذف شد.");
    }catch(err){console.error(err);toast("حذف انجام نشد؛ مجوزهای دیتابیس را بررسی کن.");}
  });
  $("loginForm").addEventListener("submit",async e=>{e.preventDefault();$("loginError").textContent="";if(!state.client){$("loginError").textContent="ابتدا تنظیمات Supabase را تکمیل کن.";return;}const email=$("loginEmail").value.trim(),password=$("loginPassword").value;const {data,error}=await state.client.auth.signInWithPassword({email,password});if(error){console.error(error);$("loginError").textContent="ورود ناموفق بود؛ ایمیل و رمز عبور را بررسی کن.";return;}state.session=data.session;closeDialog("loginDialog");adminUI();await loadData();toast("با موفقیت وارد پنل شدی.");});
  $("logoutBtn").addEventListener("click",async()=>{await state.client.auth.signOut();state.session=null;adminUI();await loadData();toast("از پنل خارج شدی.");});
  $("adminOpen").addEventListener("click",()=>showDialog("loginDialog"));
  $("addGuestBtn").addEventListener("click",()=>openPerson());
  document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeDialog(b.dataset.close)));
  $("pumpkin").addEventListener("click",()=>{const p=$("pumpkin");p.classList.remove("wiggle");void p.offsetWidth;p.classList.add("wiggle");});
  $("skull").addEventListener("click",()=>{const s=$("skull");s.classList.remove("bounce");void s.offsetWidth;s.classList.add("bounce");});
  if(hasConfig&&window.supabase){state.client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);state.client.auth.getSession().then(({data})=>{state.session=data.session;adminUI();loadData();});state.client.auth.onAuthStateChange((_event,session)=>{state.session=session;adminUI();loadData();});}else renderSetupMessage();
})();

(() => {
  "use strict";
  const cfg = window.APP_CONFIG || {};
  const hasConfig = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes("YOUR-PROJECT") &&
    !cfg.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
  const $ = (id) => document.getElementById(id);
  const state = { client: null, session: null, guests: [], hosts: [], deleting: null, toastTimer: null };
  const fa = new Intl.NumberFormat("fa-IR");
  const toman = (n) => `${fa.format(Number(n || 0))} تومان`;
  const digitsToLatin = (s) => String(s).replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  const parseAmount = (s) => {
    const cleaned = digitsToLatin(String(s || "")).replace(/[,\u066C\s٬]/g, "").replace(/[^\d]/g, "");
    return cleaned ? Number(cleaned) : 0;
  };
  const isAdmin = () => !!state.session;
  const toast = (msg) => { const el=$("toast"); el.textContent=msg; el.classList.add("show"); clearTimeout(state.toastTimer); state.toastTimer=setTimeout(()=>el.classList.remove("show"),3000); };
  const setConnection = (kind, text) => { const el=$("connection"); el.className="connection "+kind; el.innerHTML=`<i></i> ${text}`; };
  const showDialog = (id) => $(id).showModal();
  const closeDialog = (id) => $(id).close();
  const adminUI = () => {
    document.querySelectorAll(".admin-only").forEach(el=>el.classList.toggle("hidden",!isAdmin()));
    $("adminOpen").classList.toggle("hidden",isAdmin());
    $("logoutBtn").classList.toggle("hidden",!isAdmin());
    $("adminFinance").classList.toggle("hidden",!isAdmin());
  };
  const sortGuests = (list) => [...list].sort((a,b)=>(a.sort_order??999)-(b.sort_order??999)||a.name.localeCompare(b.name,"fa"));
  async function loadData() {
    if (!state.client) return renderSetupMessage();
    try {
      const [gRes,hRes] = await Promise.all([
        state.client.from(isAdmin()?"guests":"guests_public").select("*").order("sort_order",{ascending:true}),
        state.client.from(isAdmin()?"hosts":"hosts_public").select("*").order("sort_order",{ascending:true})
      ]);
      if (gRes.error) throw gRes.error;
      if (hRes.error) throw hRes.error;
      state.guests = gRes.data || []; state.hosts = hRes.data || [];
      renderAll(); setConnection("online",isAdmin()?"ادمین وارد شده":"آنلاین");
    } catch (e) {
      console.error(e); setConnection("offline","خطا در دریافت اطلاعات");
      $("guestList").innerHTML='<div class="empty-card">دریافت اطلاعات انجام نشد. تنظیمات Supabase و SQL را بررسی کن.</div>';
      $("hostList").innerHTML='<div class="empty-card">اطلاعات میزبان‌ها در دسترس نیست.</div>';
      toast("خطا در دریافت اطلاعات از سرور");
    }
  }
  function renderSetupMessage() {
    setConnection("offline","نیازمند تنظیم");
    $("guestList").innerHTML='<div class="loading-card">برای فعال‌شدن سایت، آدرس پروژه و کلید عمومی Supabase را در فایل <b>config.js</b> وارد کن و SQL راهنما را اجرا کن.</div>';
    $("hostList").innerHTML='<div class="empty-card">پس از راه‌اندازی دیتابیس، فهرست میزبان‌ها اینجا نمایش داده می‌شود.</div>';
  }
  function renderAll() {
    const top = state.guests.filter(g=>!g.parent_id);
    $("primaryCount").textContent=fa.format(top.length);
    $("guestCount").textContent=fa.format(state.guests.length);
    $("hostCount").textContent=fa.format(state.hosts.length);
    renderGuests(); renderHosts();
    if(isAdmin()){
      const gm=state.guests.reduce((sum,g)=>sum+Number(g.amount_toman||0),0);
      const hm=state.hosts.reduce((sum,h)=>sum+Number(h.amount_toman||0),0);
      $("guestMoney").textContent=toman(gm); $("hostMoney").textContent=toman(hm); $("allMoney").textContent=toman(gm+hm);
    }
    adminUI();
  }
  function renderGuests() {
    const root=$("guestList");
    if(!state.guests.length){root.innerHTML='<div class="empty-card">هنوز مهمانی ثبت نشده است.</div>';return;}
    const children = new Map();
    state.guests.forEach(g=>{const k=g.parent_id||"__root";if(!children.has(k))children.set(k,[]);children.get(k).push(g);});
    const allById = new Map(state.guests.map(g=>[g.id,g]));
    const descendantCount = (id) => (children.get(id)||[]).reduce((sum,c)=>sum+1+descendantCount(c.id),0);
    const renderNode = (g, depth=0) => {
      const subs=sortGuests(children.get(g.id)||[]);
      const total=1+descendantCount(g.id);
      const actions=isAdmin()?`<div class="admin-actions"><button class="icon-button" data-action="add-child" data-id="${g.id}">＋ زیرمجموعه</button><button class="icon-button" data-action="edit-guest" data-id="${g.id}">ویرایش</button><button class="icon-button delete" data-action="delete-guest" data-id="${g.id}">حذف</button></div>`:"";
      const childrenHTML=subs.length?`<div class="subpeople">${subs.map(s=>`<div class="subperson nested-depth-${Math.min(depth+1,4)}"><span>${escapeHTML(s.name)}</span><span class="sub-label">${depth===0?"زیرمجموعه":"عضو گروه"}</span>${isAdmin()?`<div class="admin-actions"><button class="icon-button" data-action="add-child" data-id="${s.id}">＋ زیرمجموعه</button><button class="icon-button" data-action="edit-guest" data-id="${s.id}">ویرایش</button><button class="icon-button delete" data-action="delete-guest" data-id="${s.id}">حذف</button></div>`:""}${renderNestedChildren(s,depth+1)}</div>`).join("")}</div>`:"";
      return `<article class="guest-card"><div class="person-row"><span class="person-icon">${depth===0?"👤":"🧛"}</span><div class="person-info"><div class="person-name" style="${depth>0?`font-size:${Math.max(13,18-depth*2)}px;font-weight:600`:""}">${escapeHTML(g.name)}</div><div class="person-meta">${depth===0?"مهمان اصلی":"زیرمجموعه"} · ${fa.format(total-1)} نفر زیرمجموعه</div></div><span class="headcount">${fa.format(total)} نفر در گروه</span>${actions}</div>${childrenHTML}</article>`;
    };
    function renderNestedChildren(parent, depth) {
      const subs=sortGuests(children.get(parent.id)||[]);
      if(!subs.length)return "";
      return `<div class="subpeople">${subs.map(s=>`<div class="subperson nested-depth-${Math.min(depth+1,4)}"><span>${escapeHTML(s.name)}</span><span class="sub-label">زیرمجموعه</span>${isAdmin()?`<div class="admin-actions"><button class="icon-button" data-action="add-child" data-id="${s.id}">＋ زیرمجموعه</button><button class="icon-button" data-action="edit-guest" data-id="${s.id}">ویرایش</button><button class="icon-button delete" data-action="delete-guest" data-id="${s.id}">حذف</button></div>`:""}${renderNestedChildren(s,depth+1)}</div>`).join("")}</div>`;
    }
    root.innerHTML=sortGuests(children.get("__root")||[]).map(g=>renderNode(g,0)).join("");
    if(isAdmin()) root.querySelectorAll("[data-action]").forEach(btn=>btn.addEventListener("click",()=>handleGuestAction(btn.dataset.action,btn.dataset.id)));
  }
  function renderHosts() {
    const root=$("hostList");
    if(!state.hosts.length){root.innerHTML='<div class="empty-card">هنوز میزبانی ثبت نشده است.</div>';return;}
    root.innerHTML=sortGuests(state.hosts).map(h=>`<article class="host-card"><div class="host-row"><span class="person-icon">🕯️</span><div class="person-info"><div class="host-name">${escapeHTML(h.name)}</div><span class="host-badge">میزبان</span></div>${isAdmin()?`<div class="admin-actions"><button class="icon-button" data-action="edit-host" data-id="${h.id}">ویرایش</button><button class="icon-button delete" data-action="delete-host" data-id="${h.id}">حذف</button></div>`:""}</div></article>`).join("");
    if(isAdmin()) root.querySelectorAll("[data-action]").forEach(btn=>btn.addEventListener("click",()=>handleHostAction(btn.dataset.action,btn.dataset.id)));
  }
  function escapeHTML(s) { return String(s??"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function openPerson(type, person=null, parentId="") {
    $("personForm").reset(); $("personError").textContent=""; $("personId").value=person?.id||""; $("personType").value=type;
    $("personName").value=person?.name||""; $("personAmount").value=person?fa.format(Number(person.amount_toman||0)):"0";
    $("personDialogTitle").textContent=person?(type==="guest"?"ویرایش مهمان":"ویرایش میزبان"):(type==="guest"?"افزودن مهمان":"افزودن میزبان");
    $("personEmoji").textContent=type==="guest"?"🎃":"🕯️";
    $("parentFieldWrap").classList.toggle("hidden",type!=="guest");
    if(type==="guest"){
      const parentSelect=$("parentSelect"); parentSelect.innerHTML='<option value="">مهمان اصلی (بدون والد)</option>';
      const blocked = new Set();
      if(person) {
        const childrenMap = new Map();
        state.guests.forEach(g=>{if(g.parent_id){if(!childrenMap.has(g.parent_id))childrenMap.set(g.parent_id,[]);childrenMap.get(g.parent_id).push(g.id);}});
        const mark = id => { blocked.add(id); (childrenMap.get(id)||[]).forEach(mark); };
        mark(person.id);
      }
      sortGuests(state.guests.filter(g=>!blocked.has(g.id))).forEach(g=>{const o=document.createElement("option");o.value=g.id;o.textContent=(g.parent_id?"↳ ":"")+g.name;parentSelect.appendChild(o);});
      parentSelect.value=person?.parent_id||parentId||"";
    }
    showDialog("personDialog");
  }
  async function handleGuestAction(action,id) {
    const person=state.guests.find(g=>g.id===id);
    if(action==="add-child") return openPerson("guest",null,id);
    if(action==="edit-guest") return openPerson("guest",person);
    if(action==="delete-guest") {
      state.deleting={type:"guest",id}; $("confirmText").textContent=person?.parent_id?"این زیرمجموعه حذف می‌شود.":"این مهمان اصلی و تمام زیرمجموعه‌هایش حذف می‌شوند.";
      showDialog("confirmDialog");
    }
  }
  async function handleHostAction(action,id) {
    const host=state.hosts.find(h=>h.id===id);
    if(action==="edit-host") return openPerson("host",host);
    if(action==="delete-host"){state.deleting={type:"host",id};$("confirmText").textContent="این میزبان و مبلغ پرداختی ثبت‌شده‌اش حذف می‌شود.";showDialog("confirmDialog");}
  }
  $("personForm").addEventListener("submit",async e=>{
    e.preventDefault(); if(!isAdmin()) return;
    const type=$("personType").value, id=$("personId").value;
    const name=$("personName").value.trim(); const amount=parseAmount($("personAmount").value);
    if(!name){$("personError").textContent="نام را وارد کن.";return;}
    if(!Number.isSafeInteger(amount)||amount<0){$("personError").textContent="مبلغ باید یک عدد صحیح و نامنفی باشد.";return;}
    const payload={name,amount_toman:amount,sort_order:Date.now()};
    if(type==="guest") payload.parent_id=$("parentSelect").value||null;
    const table=type==="guest"?"guests":"hosts";
    try {
      let result;
      if(id) result=await state.client.from(table).update(payload).eq("id",id);
      else result=await state.client.from(table).insert(payload);
      if(result.error) throw result.error;
      closeDialog("personDialog"); await loadData(); toast("اطلاعات با موفقیت ذخیره شد.");
    } catch(err){console.error(err);$("personError").textContent="ذخیره انجام نشد. اتصال و مجوزهای دیتابیس را بررسی کن.";}
  });
  $("confirmDelete").addEventListener("click",async()=>{
    if(!state.deleting||!isAdmin())return;
    const {type,id}=state.deleting; const table=type==="guest"?"guests":"hosts";
    try {
      if(type==="guest"){
        const item=state.guests.find(g=>g.id===id);
        if(item&&!item.parent_id){
          const childIds=state.guests.filter(g=>g.parent_id===id).map(g=>g.id);
          if(childIds.length){const delChildren=await state.client.from("guests").delete().in("id",childIds);if(delChildren.error)throw delChildren.error;}
        }
      }
      const result=await state.client.from(table).delete().eq("id",id); if(result.error)throw result.error;
      closeDialog("confirmDialog");state.deleting=null;await loadData();toast("مورد حذف شد.");
    }catch(err){console.error(err);toast("حذف انجام نشد؛ مجوزهای دیتابیس را بررسی کن.");}
  });
  $("loginForm").addEventListener("submit",async e=>{
    e.preventDefault();$("loginError").textContent="";
    if(!state.client){$("loginError").textContent="ابتدا تنظیمات Supabase را تکمیل کن.";return;}
    const email=$("loginEmail").value.trim(),password=$("loginPassword").value;
    const {data,error}=await state.client.auth.signInWithPassword({email,password});
    if(error){$("loginError").textContent="ورود ناموفق بود؛ ایمیل و رمز عبور را بررسی کن.";return;}
    state.session=data.session;closeDialog("loginDialog");adminUI();await loadData();toast("با موفقیت وارد پنل شدی.");
  });
  $("logoutBtn").addEventListener("click",async()=>{await state.client.auth.signOut();state.session=null;adminUI();await loadData();toast("از پنل خارج شدی.");});
  $("adminOpen").addEventListener("click",()=>showDialog("loginDialog"));
  $("addGuestBtn").addEventListener("click",()=>openPerson("guest"));
  $("addHostBtn").addEventListener("click",()=>openPerson("host"));
  document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeDialog(b.dataset.close)));
  $("pumpkin").addEventListener("click",()=>{const p=$("pumpkin");p.classList.remove("wiggle");void p.offsetWidth;p.classList.add("wiggle");});
  $("skull").addEventListener("click",()=>{const s=$("skull");s.classList.remove("bounce");void s.offsetWidth;s.classList.add("bounce");});
  if(hasConfig && window.supabase){
    state.client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
    state.client.auth.getSession().then(({data})=>{state.session=data.session;adminUI();loadData();});
    state.client.auth.onAuthStateChange((_event,session)=>{state.session=session;adminUI();loadData();});
  } else renderSetupMessage();
})();

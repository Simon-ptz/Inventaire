(() => {
  "use strict";
  const cfg = window.INVENTORY_CONFIG || {};
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const state = { client:null, user:null, profile:null, categories:[], items:[], deleteId:null, page:"dashboard" };
  const statusClass = s => ({ "Neuf":"new", "Bon état":"good", "État moyen":"medium", "À réparer":"repair", "Hors service":"broken" }[s] || "");
  const dateFr = v => v ? new Date(v+"T00:00:00").toLocaleDateString("fr-FR") : "—";
  const money = v => v === null || v === undefined || v === "" ? "—" : Number(v).toLocaleString("fr-FR",{style:"currency",currency:"EUR"});
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const roleLabel = r => ({admin:"Administrateur",editor:"Éditeur",reader:"Lecteur"}[r] || r);
  const canEdit = () => ["admin","editor"].includes(state.profile?.role);
  const isAdmin = () => state.profile?.role === "admin";

  function toast(message, type="success") {
    const el=document.createElement("div"); el.className=`toast ${type}`; el.textContent=message;
    $("#toast-region").append(el); setTimeout(()=>el.remove(),4200);
  }
  function showLogin(error="") {
    $("#login-screen").classList.remove("hidden"); $("#app-shell").classList.add("hidden");
    $("#login-error").textContent=error;
  }
  function showApp() {
    $("#login-screen").classList.add("hidden"); $("#app-shell").classList.remove("hidden");
    $("#user-name").textContent=state.profile?.display_name || state.user?.user_metadata?.full_name || state.user?.email || "Utilisateur";
    $("#user-role").textContent=roleLabel(state.profile?.role);
    const avatar=state.profile?.avatar_url || state.user?.user_metadata?.avatar_url;
    if(avatar){$("#user-avatar").src=avatar;$("#user-avatar").classList.remove("hidden");$("#user-initial").classList.add("hidden");}
    else{$("#user-initial").textContent=($("#user-name").textContent[0]||"?").toUpperCase();$("#user-initial").classList.remove("hidden");}
    $$(".editor-only").forEach(e=>e.classList.toggle("hidden",!canEdit()));
    $$(".admin-only").forEach(e=>e.classList.toggle("hidden",!isAdmin()));
  }
  function page(name) {
    state.page=name;
    $$(".page").forEach(p=>p.classList.toggle("hidden",p.id!==`page-${name}`));
    $$(".nav-link[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===name));
  }
  async function getProfile(user) {
    let {data,error}=await state.client.from("profiles").select("*").eq("id",user.id).maybeSingle();
    if(error) throw error;
    if(!data) {
      const {data:created,error:createError}=await state.client.from("profiles").insert({
        id:user.id,email:user.email,display_name:user.user_metadata?.full_name || user.email,
        avatar_url:user.user_metadata?.avatar_url || null,role:"reader",is_active:false
      }).select().single();
      if(createError) throw createError;
      data=created;
    }
    return data;
  }
  async function loadAll() {
    const [cats,items]=await Promise.all([
      state.client.from("categories").select("*").order("name"),
      state.client.from("equipment").select("*, categories(id,name,color), equipment_images(id,storage_path,caption,created_at)").order("updated_at",{ascending:false})
    ]);
    if(cats.error) throw cats.error; if(items.error) throw items.error;
    state.categories=cats.data||[]; state.items=items.data||[];
    renderAll();
  }
  function renderAll() {
    $("#stat-items").textContent=state.items.length;
    $("#stat-quantity").textContent=state.items.reduce((n,x)=>n+Number(x.quantity||0),0);
    $("#stat-repair").textContent=state.items.filter(x=>x.condition==="À réparer").length;
    $("#stat-warranty").textContent=state.items.filter(x=>x.warranty_until && x.warranty_until<new Date().toISOString().slice(0,10)).length;
    renderRecent(); renderInventory(); renderCategories(); fillCategorySelects();
  }
  async function photoUrl(path) {
    const {data,error}=await state.client.storage.from("equipment-photos").createSignedUrl(path,3600);
    return error ? "" : data.signedUrl;
  }
  async function imageFor(item) {
    if(!item.equipment_images?.length) return "";
    return await photoUrl(item.equipment_images[0].storage_path);
  }
  async function renderRecent() {
    const host=$("#recent-list"); host.innerHTML="";
    const items=state.items.slice(0,5);
    if(!items.length){host.innerHTML='<div class="empty">Aucun matériel enregistré pour le moment.</div>';return;}
    for(const item of items) host.append(await itemRow(item));
  }
  async function itemRow(item) {
    const row=document.createElement("button"); row.className="recent-row"; row.type="button";
    const img=await imageFor(item);
    row.innerHTML=`${img?`<img src="${img}" alt="">`:'<span class="item-placeholder">▧</span>'}<span class="recent-name"><b>${esc(item.name)}</b><small>${esc(item.reference||item.brand||"Sans référence")}</small></span><span class="status ${statusClass(item.condition)}">${esc(item.condition)}</span><span class="recent-qty">Qté ${Number(item.quantity)}</span>`;
    row.addEventListener("click",()=>openDetail(item.id)); return row;
  }
  async function renderInventory() {
    const host=$("#inventory-grid"); host.innerHTML="";
    const q=$("#search-input").value.toLocaleLowerCase("fr");
    const cat=$("#filter-category").value, cond=$("#filter-condition").value;
    const rows=state.items.filter(x=>{
      const hay=[x.name,x.reference,x.brand,x.model,x.serial_number,x.location].join(" ").toLocaleLowerCase("fr");
      return (!q||hay.includes(q))&&(!cat||String(x.category_id)===cat)&&(!cond||x.condition===cond);
    });
    if(!rows.length){host.innerHTML='<div class="empty">Aucun matériel ne correspond à votre recherche.</div>';return;}
    for(const item of rows) {
      const card=document.createElement("button"); card.className="equipment-card"; card.type="button";
      const img=await imageFor(item);
      card.innerHTML=`<div class="card-photo">${img?`<img src="${img}" alt="">`:'<span>▧</span>'}<span class="status ${statusClass(item.condition)}">${esc(item.condition)}</span></div><div class="card-body"><div class="category-label">${esc(item.categories?.name||"Sans catégorie")}</div><h3>${esc(item.name)}</h3><p>${esc(item.brand||"")} ${esc(item.model||"")}</p><div class="card-foot"><span>Quantité <b>${Number(item.quantity)}</b></span><span>${esc(item.location||"Emplacement —")}</span></div></div>`;
      card.addEventListener("click",()=>openDetail(item.id)); host.append(card);
    }
  }
  function fillCategorySelects() {
    const opts=state.categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
    $("#filter-category").innerHTML='<option value="">Toutes les catégories</option>'+opts;
    $("#form-category").innerHTML='<option value="">Sans catégorie</option>'+opts;
  }
  function renderCategories() {
    const host=$("#category-list"); host.innerHTML="";
    if(!state.categories.length){host.innerHTML='<p class="muted">Aucune catégorie.</p>';return;}
    state.categories.forEach(c=>{
      const row=document.createElement("div"); row.className="category-row";
      row.innerHTML=`<span class="color-dot" style="background:${esc(c.color)}"></span><b>${esc(c.name)}</b>${isAdmin()?'<button class="icon-btn" title="Supprimer">×</button>':''}`;
      const btn=$("button",row); if(btn) btn.addEventListener("click",()=>deleteCategory(c.id));
      host.append(row);
    });
  }
  async function renderUsers() {
    const {data,error}=await state.client.from("profiles").select("*").order("created_at",{ascending:false});
    if(error){toast(error.message,"error");return;}
    const host=$("#users-table"); host.innerHTML="";
    (data||[]).forEach(u=>{
      const tr=document.createElement("tr");
      tr.innerHTML=`<td><b>${esc(u.display_name||"Utilisateur")}</b><small>${esc(u.email)}</small></td><td><select class="role-select"><option value="reader">Lecteur</option><option value="editor">Éditeur</option><option value="admin">Administrateur</option></select></td><td><select class="active-select"><option value="false">En attente / désactivé</option><option value="true">Actif</option></select></td><td><button class="btn secondary small-btn">Enregistrer</button></td>`;
      $(".role-select",tr).value=u.role; $(".active-select",tr).value=String(u.is_active);
      $("button",tr).addEventListener("click",async()=>{
        const {error}=await state.client.from("profiles").update({role:$(".role-select",tr).value,is_active:$(".active-select",tr).value==="true"}).eq("id",u.id);
        if(error)toast(error.message,"error");else toast("Accès utilisateur mis à jour.");
      });
      host.append(tr);
    });
  }
  async function openDetail(id) {
    const item=state.items.find(x=>x.id===id); if(!item)return;
    $("#detail-title").textContent=item.name;
    const photos=await Promise.all((item.equipment_images||[]).map(async p=>({url:await photoUrl(p.storage_path),caption:p.caption})));
    const {data:history}=await state.client.from("equipment_history").select("*, profiles(display_name,email)").eq("equipment_id",id).order("created_at",{ascending:false});
    const historyHtml=(history||[]).map(h=>`<div class="event"><span class="event-dot"></span><div><b>${esc(h.action)}</b><p>${esc(h.details||"")}</p><small>${new Date(h.created_at).toLocaleString("fr-FR")} · ${esc(h.profiles?.display_name||h.profiles?.email||"Utilisateur")}</small></div></div>`).join("")||'<p class="muted">Aucun événement enregistré.</p>';
    $("#detail-content").innerHTML=`
      <div class="detail-gallery">${photos.map(p=>`<a href="${p.url}" target="_blank" rel="noopener"><img src="${p.url}" alt="${esc(p.caption)}"></a>`).join("")||'<div class="empty-photo">▧<span>Aucune photo</span></div>'}</div>
      <div class="detail-columns"><div><section class="detail-section"><h3>Informations générales</h3><dl>
      ${fact("État",item.condition)}${fact("Quantité",item.quantity)}${fact("Catégorie",item.categories?.name||"—")}${fact("Référence",item.reference)}${fact("Marque / modèle",[item.brand,item.model].filter(Boolean).join(" ")||"—")}${fact("Numéro de série",item.serial_number)}${fact("Emplacement",item.location)}${fact("Description",item.description||"—")}
      </dl></section><section class="detail-section"><h3>Suivi d'achat</h3><dl>${fact("Date d'achat",dateFr(item.purchase_date))}${fact("Prix",money(item.purchase_price))}${fact("Fournisseur",item.supplier)}${fact("Fin de garantie",dateFr(item.warranty_until))}</dl></section></div>
      <section class="detail-section"><h3>Historique</h3><div class="timeline">${historyHtml}</div></section></div>
      <div class="modal-actions">${canEdit()?`<button id="edit-item" class="btn primary">Modifier</button>`:""}${isAdmin()?`<button id="delete-item" class="btn danger">Supprimer</button>`:""}</div>`;
    $("#edit-item")?.addEventListener("click",()=>{ $("#detail-dialog").close();openEquipmentForm(item); });
    $("#delete-item")?.addEventListener("click",()=>{state.deleteId=id;$("#detail-dialog").close();$("#confirm-dialog").showModal();});
    $("#detail-dialog").showModal();
  }
  function fact(k,v){return `<div><dt>${esc(k)}</dt><dd>${esc(v??"—")}</dd></div>`;}
  async function openEquipmentForm(item=null) {
    const form=$("#equipment-form"); form.reset(); form.elements.id.value=item?.id||"";
    $("#equipment-modal-title").textContent=item?"Modifier la fiche":"Ajouter un matériel";
    $("#existing-photos").innerHTML="";
    if(item) {
      ["name","reference","description","brand","model","serial_number","quantity","condition","location","supplier","purchase_date","purchase_price","warranty_until"].forEach(k=>{if(form.elements[k])form.elements[k].value=item[k]??"";});
      form.elements.category_id.value=item.category_id||"";
      for(const p of item.equipment_images||[]){const url=await photoUrl(p.storage_path);if(url){const im=document.createElement("img");im.src=url;$("#existing-photos").append(im);}}
    }
    $("#equipment-dialog").showModal();
  }
  async function uploadPhotos(itemId, files) {
    for(const file of files) {
      if(!file.type.startsWith("image/")||file.size>12*1024*1024) {toast(`${file.name} ignoré : image invalide ou supérieure à 12 Mo.`,"error");continue;}
      const ext=(file.name.split(".").pop()||"jpg").toLowerCase();
      const path=`${itemId}/${crypto.randomUUID()}.${ext}`;
      const {error}=await state.client.storage.from("equipment-photos").upload(path,file,{upsert:false,contentType:file.type});
      if(error) throw error;
      const {error:insertError}=await state.client.from("equipment_images").insert({equipment_id:itemId,storage_path:path,caption:file.name});
      if(insertError) throw insertError;
    }
  }
  async function saveEquipment(event) {
    event.preventDefault(); const form=event.currentTarget, f=new FormData(form), id=f.get("id");
    const payload={name:f.get("name").trim(),reference:f.get("reference")||null,description:f.get("description")||null,category_id:f.get("category_id")||null,quantity:Number(f.get("quantity")||0),condition:f.get("condition"),brand:f.get("brand")||null,model:f.get("model")||null,serial_number:f.get("serial_number")||null,location:f.get("location")||null,purchase_date:f.get("purchase_date")||null,purchase_price:f.get("purchase_price")?Number(f.get("purchase_price")):null,supplier:f.get("supplier")||null,warranty_until:f.get("warranty_until")||null};
    let result;
    if(id) result=await state.client.from("equipment").update(payload).eq("id",id).select().single();
    else result=await state.client.from("equipment").insert({...payload,created_by:state.user.id}).select().single();
    if(result.error){toast(result.error.message,"error");return;}
    const itemId=result.data.id;
    try { await uploadPhotos(itemId,[...form.elements.photos.files]); }
    catch(e){toast("Fiche enregistrée, mais une photo n'a pas pu être envoyée : "+e.message,"error");}
    const action=id?"Modification":"Création";
    await state.client.from("equipment_history").insert({equipment_id:itemId,action,details:id?"Fiche mise à jour":"Matériel ajouté à l'inventaire",user_id:state.user.id});
    if(id && state.items.find(x=>x.id===id)?.condition!==payload.condition) await state.client.from("equipment_history").insert({equipment_id:itemId,action:"Changement d'état",details:"État mis à jour : "+payload.condition,user_id:state.user.id});
    $("#equipment-dialog").close(); toast("Matériel enregistré."); await loadAll();
  }
  async function deleteItem() {
    if(!state.deleteId)return;
    const item=state.items.find(x=>x.id===state.deleteId);
    if(item?.equipment_images?.length) {
      const paths=item.equipment_images.map(p=>p.storage_path);
      await state.client.storage.from("equipment-photos").remove(paths);
    }
    const {error}=await state.client.from("equipment").delete().eq("id",state.deleteId);
    $("#confirm-dialog").close(); state.deleteId=null;
    if(error)toast(error.message,"error");else{toast("Matériel supprimé.");await loadAll();}
  }
  async function deleteCategory(id) {
    if(!confirm("Supprimer cette catégorie ?"))return;
    const {error}=await state.client.from("categories").delete().eq("id",id);
    if(error)toast(error.message,"error");else{toast("Catégorie supprimée.");await loadAll();}
  }
  async function addCategory(e) {
    e.preventDefault();const f=new FormData(e.currentTarget);
    const {error}=await state.client.from("categories").insert({name:f.get("name").trim(),color:f.get("color")});
    if(error)toast(error.message,"error");else{e.currentTarget.reset();toast("Catégorie créée.");await loadAll();}
  }
  async function onAuth(session) {
    if(!session){state.user=null;state.profile=null;showLogin();return;}
    state.user=session.user;
    try {
      state.profile=await getProfile(state.user);
      if(!state.profile.is_active){await state.client.auth.signOut();showLogin("Ton compte a été créé, mais un administrateur doit encore l'activer.");return;}
      showApp(); await loadAll(); page("dashboard");
    } catch(e){showLogin("Erreur de chargement : "+e.message);}
  }
  async function init() {
    if(!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_URL.includes("VOTRE-PROJET")) {
      showLogin("Configuration manquante : renseigne les clés Supabase dans config.js."); return;
    }
    state.client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
    $("#google-login").addEventListener("click",async()=>{
      const {error}=await state.client.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.href.split("#")[0]}});
      if(error)$("#login-error").textContent=error.message;
    });
    $("#logout").addEventListener("click",()=>state.client.auth.signOut());
    state.client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>onAuth(session),0);});
    const {data:{session}}=await state.client.auth.getSession(); await onAuth(session);
  }
  document.addEventListener("click",e=>{
    const p=e.target.closest("[data-page]"); if(p){page(p.dataset.page);if(p.dataset.page==="users")renderUsers();}
    const a=e.target.closest("[data-action]");if(a?.dataset.action==="new-item")openEquipmentForm();
    const c=e.target.closest("[data-close]");if(c)$("#"+c.dataset.close).close();
  });
  $("#equipment-form").addEventListener("submit",saveEquipment);
  $("#category-form").addEventListener("submit",addCategory);
  $("#confirm-delete").addEventListener("click",deleteItem);
  $("#search-input").addEventListener("input",renderInventory);
  $("#filter-category").addEventListener("change",renderInventory);
  $("#filter-condition").addEventListener("change",renderInventory);
  init();
})();

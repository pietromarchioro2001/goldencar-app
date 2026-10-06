"use client";



import { ChangeEvent, useEffect, useState } from "react";

import BottomBar from "@/components/BottomBar";



type Photo = { id: string; name: string; type: string };

type Car = {

  id: string; marca: string; modello: string; versione: string; descrizione: string;

  dotazioni: string[]; cilindrata: string; carburante: string; immatricolazione: string;

  prezzo: string; chilometraggio: string; cambio: string; potenza: string; colore: string;

  posti: string; garanzia: string; foto: Photo[]; createdAt: string;

};



const KEY = "goldencar_vendite";

const DB = "goldencar_vendite_media";

const BRANDS = ["Alfa Romeo","Audi","BMW","Citroën","Cupra","Dacia","Fiat","Ford","Hyundai","Jeep","Kia","Land Rover","Mercedes-Benz","MINI","Nissan","Opel","Peugeot","Renault","SEAT","Skoda","Suzuki","Tesla","Toyota","Volkswagen","Volvo","Altro"];

const MODELS: Record<string,string[]> = {
  "Alfa Romeo":["Giulia","Stelvio","Tonale","Junior","Giulietta","MiTo"],
  "Audi":["A1","A3","A4","A5","A6","A7","A8","Q2","Q3","Q4","Q5","Q7","Q8","TT"],
  "BMW":["Serie 1","Serie 2","Serie 3","Serie 4","Serie 5","Serie 7","X1","X2","X3","X4","X5","X6","X7"],
  "Citroën":["C3","C4","C5 Aircross","C3 Aircross","Berlingo"],
  "Cupra":["Formentor","Leon","Ateca","Born","Terramar","Tavascan"],
  "Dacia":["Sandero","Duster","Jogger","Spring","Logan"],
  "Fiat":["500","500X","500L","Panda","Tipo","Punto","Doblo","Ducato"],
  "Ford":["Fiesta","Focus","Puma","Kuga","Mondeo","Mustang","Transit"],
  "Hyundai":["i10","i20","i30","Kona","Tucson","Santa Fe","IONIQ 5"],
  "Jeep":["Renegade","Compass","Avenger","Cherokee","Grand Cherokee","Wrangler"],
  "Kia":["Picanto","Rio","Ceed","Stonic","Sportage","Sorento","Niro","EV6"],
  "Land Rover":["Range Rover Evoque","Range Rover Sport","Discovery","Discovery Sport","Defender"],
  "Mercedes-Benz":["Classe A","Classe B","Classe C","Classe E","Classe S","CLA","GLA","GLC","GLE","GLS"],
  "MINI":["Cooper","Countryman","Clubman","Aceman"],
  "Nissan":["Micra","Juke","Qashqai","X-Trail","Ariya"],
  "Opel":["Corsa","Astra","Mokka","Crossland","Grandland","Combo"],
  "Peugeot":["108","208","308","408","2008","3008","5008","Partner"],
  "Renault":["Clio","Captur","Megane","Austral","Arkana","Kadjar","Koleos"],
  "SEAT":["Ibiza","Leon","Arona","Ateca","Tarraco"],
  "Skoda":["Fabia","Scala","Octavia","Superb","Kamiq","Karoq","Kodiaq","Enyaq"],
  "Suzuki":["Swift","Ignis","Vitara","S-Cross","Jimny"],
  "Tesla":["Model 3","Model Y","Model S","Model X"],
  "Toyota":["Aygo X","Yaris","Corolla","C-HR","RAV4","Yaris Cross","Land Cruiser"],
  "Volkswagen":["Polo","Golf","T-Roc","T-Cross","Tiguan","Passat","Touran","Touareg","ID.3","ID.4","ID.5","ID.7"],
  "Volvo":["EX30","EX40","XC40","XC60","XC90","S60","V60","V90"]
};

const FUELS = ["Benzina","Diesel","Ibrida","Ibrida Plug-in","Elettrica","GPL","Metano","Altro"];

const GEARS = ["Manuale","Automatico","Semiautomatico","Altro"];

const EQUIPMENT = ["Climatizzatore","Climatizzatore automatico","Navigatore","Apple CarPlay","Android Auto","Bluetooth","USB","Cruise Control","Cruise Control Adattivo","Limitatore di velocità","Sensori parcheggio anteriori","Sensori parcheggio posteriori","Telecamera posteriore","Telecamera 360°","Fari LED","Fari Full LED","Fari Matrix LED","Luci diurne LED","Cerchi in lega","Sedili riscaldati","Sedili ventilati","Sedili elettrici","Sedili in pelle","Keyless","Avviamento senza chiave","Tetto panoramico","Tetto apribile","Gancio traino","Barre portatutto","Volante multifunzione","Volante riscaldato","Specchietti elettrici","Specchietti richiudibili elettricamente","Specchietti riscaldati","Vetri elettrici","Vetri oscurati","Freno di stazionamento elettrico","Modalità di guida","Start & Stop","Lane Assist","Blind Spot","Riconoscimento segnali stradali","Frenata automatica d'emergenza","Monitoraggio pressione pneumatici","Ruotino di scorta"];



const empty = () => ({

  marca:"", modello:"", versione:"", descrizione:"", dotazioni:[] as string[], cilindrata:"",

  carburante:"", immatricolazione:"", prezzo:"", chilometraggio:"", cambio:"",

  potenza:"", colore:"", posti:"5", garanzia:"", foto:[] as Photo[]

});



function id(){ return Date.now()+"\_"+Math.random().toString(36).slice(2,8); }

function euro(v:string){ const n=Number(v.replace(/\\./g,"").replace(",",".")); return n?new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n):"—"; }

function km(v:string){ const n=Number(v.replace(/\\./g,"")); return n>=0&&v?new Intl.NumberFormat("it-IT").format(n)+" km":"—"; }



function db():Promise<IDBDatabase>{return new Promise((ok,no)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains("files"))r.result.createObjectStore("files")};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}

async function put(id:string,b:Blob){const d=await db();return new Promise<void>((ok,no)=>{const t=d.transaction("files","readwrite");t.objectStore("files").put(b,id);t.oncomplete=()=>{d.close();ok()};t.onerror=()=>no(t.error)})}

async function get(id:string){const d=await db();return new Promise<Blob|null>((ok,no)=>{const r=d.transaction("files","readonly").objectStore("files").get(id);r.onsuccess=()=>{d.close();ok(r.result||null)};r.onerror=()=>no(r.error)})}

async function del(id:string){const d=await db();return new Promise<void>((ok,no)=>{const t=d.transaction("files","readwrite");t.objectStore("files").delete(id);t.oncomplete=()=>{d.close();ok()};t.onerror=()=>no(t.error)})}



function I({n,s=21}:{n:string;s?:number}){const p={width:s,height:s,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};if(n==="plus")return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;if(n==="search")return <svg {...p}><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>;if(n==="car")return <svg {...p}><path d="M5 17h14l-1-6-2-4H8l-2 4-1 6Z"/><path d="M3.5 17v2M20.5 17v2M7 17h.01M17 17h.01"/></svg>;if(n==="camera")return <svg {...p}><path d="M4 7h3l1.5-2h7L17 7h3v12H4V7Z"/><circle cx="12" cy="13" r="3.5"/></svg>;if(n==="back")return <svg {...p}><path d="m15 18-6-6 6-6"/></svg>;if(n==="left")return <svg {...p}><path d="m14 18-6-6 6-6"/></svg>;if(n==="right")return <svg {...p}><path d="m10 6 6 6-6 6"/></svg>;if(n==="trash")return <svg {...p}><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>;if(n==="edit")return <svg {...p}><path d="m4 20 4-.8L19 8.2a2.1 2.1 0 0 0-3-3L5 16.2 4 20Z"/></svg>;return null}



export default function VenditePage(){

  const [cars,setCars]=useState<Car[]>([]);


  const [view,setView]=useState<"list"|"form"|"profile">("list"); const [selected,setSelected]=useState<Car|null>(null); const [editing,setEditing]=useState(false);

  const [draft,setDraft]=useState<any>(empty()); const [equipmentSearch,setEquipmentSearch]=useState(""); const [urls,setUrls]=useState<Record<string,string>>({}); const [remove,setRemove]=useState<Car|null>(null);



  useEffect(()=>{try{setCars(JSON.parse(localStorage.getItem(KEY)||"[]"))}catch{}},[]);

  useEffect(()=>{localStorage.setItem(KEY,JSON.stringify(cars));},[cars]);

  useEffect(()=>{let live=true; (async()=>{const x:any={};for(const c of cars)for(const p of c.foto){const b=await get(p.id);if(b)x[p.id]=URL.createObjectURL(b)}if(live)setUrls(x)})();return()=>{live=false}},[cars]);



  const list = cars;



  function update(k:string,v:any){setDraft((d:any)=>({...d,[k]:v}))}

  function newCar(){setDraft(empty());setEquipmentSearch("");setEditing(false);setView("form")}

  function edit(c:Car){setDraft({...c});setEquipmentSearch("");setEditing(true);setView("form")}

  async function photos(e:ChangeEvent<HTMLInputElement>){for(const f of Array.from(e.target.files||[])){const x=id();await put(x,f);setDraft((d:any)=>({...d,foto:[...d.foto,{id:x,name:f.name,type:f.type}]}))}e.target.value=""}

  async function removePhoto(x:string){await del(x);setDraft((d:any)=>({...d,foto:d.foto.filter((p:any)=>p.id!==x)}))}

  function equipment(x:string){update("dotazioni",draft.dotazioni.includes(x)?draft.dotazioni.filter((a:string)=>a!==x):[...draft.dotazioni,x])}

  function save(){if(!draft.marca||!draft.modello){alert("Inserisci almeno marca e modello.");return}const c:Car={...draft,id:editing?draft.id:id(),createdAt:editing?draft.createdAt:new Date().toISOString()};setCars(a=>editing?a.map(x=>x.id===c.id?c:x):[c,...a]);setSelected(c);setView("profile")}

  async function confirmDelete(){if(!remove)return;for(const p of remove.foto)await del(p.id);setCars(a=>a.filter(x=>x.id!==remove.id));setRemove(null);setSelected(null);setView("list")}



  return <main style={S.page}><div style={S.wrap}>

    {view==="list"&&<><div style={S.pageHeader}>

      <div style={S.logoBox}>LOGO</div>

      <h1 style={S.pageTitle}>VENDITE</h1>

    </div>

      <div style={S.archiveRow}>
        <div style={S.archiveCount}>
          {cars.length} {cars.length === 1 ? "veicolo" : "veicoli"} in archivio
        </div>
        <button style={S.newCarButton} onClick={newCar} aria-label="Nuova auto">
          <I n="plus" s={25}/>
        </button>
      </div>

      {list.length ? (
        <div style={S.grid}>
          {list.map(c => (
            <article
              key={c.id}
              style={S.card}
              onClick={() => { setSelected(c); setView("profile"); }}
            >
              <div style={S.cover}>
                {c.foto[0] && urls[c.foto[0].id]
                  ? <img src={urls[c.foto[0].id]} style={S.img}/>
                  : <I n="car" s={42}/>}
                <span style={S.photo}>
                  {c.foto.length} <I n="camera" s={13}/>
                </span>
              </div>
              <div style={S.cardBody}>
                <div style={S.cardTop}>
                  <div>
                    <b style={S.cardTitle}>{c.marca} {c.modello}</b>
                    {c.versione && <div style={S.version}>{c.versione}</div>}
                  </div>
                  <b>{euro(c.prezzo)}</b>
                </div>
                <div style={S.spec}>
                  {c.immatricolazione?.slice(0,4) || "—"} · {km(c.chilometraggio)} · {c.carburante || "—"} · {c.cambio || "—"}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </>}



    {view==="form"&&<Form draft={draft} update={update} photos={photos} removePhoto={removePhoto} urls={urls} equipment={equipment} equipmentSearch={equipmentSearch} setEquipmentSearch={setEquipmentSearch} save={save} back={()=>setView(selected?"profile":"list")} editing={editing}/>}

    {view==="profile"&&selected&&<Profile c={selected} urls={urls} back={()=>setView("list")} edit={()=>edit(selected)} remove={()=>setRemove(selected)}/>}

  </div><BottomBar/>

  {remove&&<div style={S.modalBg}><div style={S.modal}><div style={S.redIcon}><I n="trash"/></div><h2>Eliminare il veicolo?</h2><p>Il profilo e le foto verranno eliminati dall'app. Gli eventuali annunci su Subito e Facebook dovranno essere rimossi direttamente dai rispettivi siti.</p><div style={S.modalBtns}><button style={S.cancel} onClick={()=>setRemove(null)}>ANNULLA</button><button style={S.delete} onClick={confirmDelete}>ELIMINA</button></div></div></div>}

  </main>

}



function F({draft,update,l,k,placeholder,type="text",options,inputStyle}:{draft:any;update:any;l:string;k:string;placeholder?:string;type?:string;options?:string[];inputStyle?:any}){
  return (
    <label style={S.field}>
      {l && <small style={S.fieldSmall}>{l}</small>}
      {options ? (
        <select value={draft[k]} onChange={e=>update(k,e.target.value)} style={inputStyle || S.input}>
          <option value="">Seleziona</option>
          {options.map(x=><option key={x}>{x}</option>)}
        </select>
      ) : (
        <input type={type} value={draft[k]} onChange={e=>update(k,e.target.value)} placeholder={placeholder} style={inputStyle || S.input}/>
      )}
    </label>
  );
}

function Form({draft,update,photos,removePhoto,urls,equipment,equipmentSearch,setEquipmentSearch,save,back,editing}:{draft:any;update:any;photos:any;removePhoto:any;urls:any;equipment:any;equipmentSearch:string;setEquipmentSearch:any;save:any;back:any;editing:boolean}){
  const [draggedPhoto,setDraggedPhoto]=useState<string|null>(null); const [photosOpen,setPhotosOpen]=useState(false);
  const [marcaCustom,setMarcaCustom]=useState<boolean>(()=>!!draft.marca && !BRANDS.includes(draft.marca));
  const [modelloCustom,setModelloCustom]=useState<boolean>(()=>!!draft.modello && !!(draft.marca && MODELS[draft.marca]) && !MODELS[draft.marca].includes(draft.modello));

  const modelloOptions = draft.marca && MODELS[draft.marca] ? MODELS[draft.marca] : [];
  const marcaSelectValue = marcaCustom ? "__nuova__" : draft.marca;
  const modelloSelectValue = modelloCustom ? "__nuovo__" : draft.modello;

  function movePhoto(from:string,to:string){
    if(from===to)return;
    const items=[...draft.foto];
    const fromIndex=items.findIndex((p:any)=>p.id===from);
    const toIndex=items.findIndex((p:any)=>p.id===to);
    if(fromIndex<0||toIndex<0)return;
    const [item]=items.splice(fromIndex,1);
    items.splice(toIndex,0,item);
    update("foto",items);
  }

  const filteredEquipment=EQUIPMENT.filter(x=>x.toLowerCase().includes(equipmentSearch.trim().toLowerCase()));
  const searchValue=equipmentSearch.trim();
  const canAddSearch=!!searchValue && !EQUIPMENT.some(x=>x.toLowerCase()===searchValue.toLowerCase()) && !draft.dotazioni.some((x:string)=>x.toLowerCase()===searchValue.toLowerCase());

  return (
    <>
      <header style={S.formHeader}>
        <button style={S.back} onClick={back} aria-label="Indietro"><I n="back"/></button>
        <h1 style={S.formPageTitle}>{editing ? "MODIFICA AUTO" : "NUOVA AUTO"}</h1>
      </header>

      <section style={S.formTop}>
        <div style={S.photoColumn}>
          <div style={S.photoPanel}>
            <input id="vf" type="file" accept="image/*" multiple onChange={photos} style={{display:"none"}}/>

            {draft.foto.length ? (
              <>
                <div style={S.mainPhotoDrop}>
                  {urls[draft.foto[0].id]
                    ? <img src={urls[draft.foto[0].id]} style={S.mainPhotoImg}/>
                    : <I n="car" s={42}/>}
                  <span style={S.coverBadgeLarge}>COPERTINA</span>
                </div>

                <div style={S.photoThumbRow}>
                  {draft.foto.slice(0,5).map((p:any,i:number)=>(
                    <button
                      key={p.id}
                      type="button"
                      onClick={()=>setPhotosOpen(true)}
                      style={{...S.photoThumbItem,border:i===0?"2px solid #D4AF37":"2px solid transparent",padding:0}}
                      title="Apri gestione foto"
                    >
                      {urls[p.id] ? <img src={urls[p.id]} style={S.img}/> : null}
                      {i===0&&<span style={S.thumbStar}>★</span>}
                    </button>
                  ))}

                  <button
                    type="button"
                    style={S.photoAddSquare}
                    onClick={()=>document.getElementById("vf")?.click()}
                    aria-label="Aggiungi foto"
                  >
                    <I n="plus" s={25}/>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={()=>setPhotosOpen(true)}
                  style={S.photoManageButton}
                >
                  <I n="camera" s={15}/> GESTISCI FOTO
                </button>
              </>
            ) : (
              <div style={S.photoUploadEmpty} onClick={()=>document.getElementById("vf")?.click()} aria-label="Aggiungi foto">
                <div style={S.uploadIcon}><I n="camera" s={28}/></div>
                <span style={{fontSize:12,fontWeight:500}}>Aggiungi foto</span>
              </div>
            )}

            {photosOpen && (
              <div style={S.photoModalBg} onClick={()=>setPhotosOpen(false)}>
                <div style={S.photoModal} onClick={e=>e.stopPropagation()}>
                  <div style={S.photoModalHead}>
                    <div>
                      <small style={S.fieldSmall}>FOTO AUTO</small>
                      <h3 style={S.photoModalTitle}>Gestisci foto</h3>
                    </div>
                    <button type="button" style={S.photoModalClose} onClick={()=>setPhotosOpen(false)}>×</button>
                  </div>

                  <div style={S.photoModalHint}>
                    Trascina le foto per cambiarne l'ordine. La prima è la copertina.
                  </div>

                  <div style={S.photoManagerGrid}>
                    {draft.foto.map((p:any,i:number)=>(
                      <div
                        key={p.id}
                        draggable
                        onDragStart={()=>setDraggedPhoto(p.id)}
                        onDragEnd={()=>setDraggedPhoto(null)}
                        onDragOver={e=>e.preventDefault()}
                        onDrop={e=>{e.preventDefault();if(draggedPhoto)movePhoto(draggedPhoto,p.id);setDraggedPhoto(null)}}
                        style={{...S.photoManagerItem,...(draggedPhoto===p.id?S.photoThumbDragging:{})}}
                      >
                        {urls[p.id] ? <img src={urls[p.id]} style={S.img}/> : null}
                        {i===0&&<span style={S.coverBadgeLarge}>COPERTINA</span>}

                        <button
                          type="button"
                          onClick={()=>removePhoto(p.id)}
                          style={S.photoManagerDelete}
                          aria-label="Elimina foto"
                        >
                          <I n="trash" s={15}/>
                        </button>

                        <div style={S.photoManagerActions}>
                          <button
                            type="button"
                            disabled={i===0}
                            onClick={()=>i>0&&movePhoto(p.id,draft.foto[i-1].id)}
                            style={{...S.photoManagerMove,opacity:i===0?.35:1}}
                          >
                            <I n="left" s={14}/>
                          </button>
                          <button
                            type="button"
                            disabled={i===draft.foto.length-1}
                            onClick={()=>i<draft.foto.length-1&&movePhoto(p.id,draft.foto[i+1].id)}
                            style={{...S.photoManagerMove,opacity:i===draft.foto.length-1?.35:1}}
                          >
                            <I n="right" s={14}/>
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={()=>document.getElementById("vf")?.click()}
                      style={S.photoManagerAdd}
                    >
                      <I n="plus" s={28}/>
                      <span>Aggiungi</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={()=>setPhotosOpen(false)}
                    style={S.photoManagerDone}
                  >
                    FATTO
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={S.pricePanel}>
            <F draft={draft} update={update} l="PREZZO" k="prezzo" placeholder="es. 18.900 €"/>
          </div>
        </div>

        <div style={S.identityPanel}>
          <section style={S.identityBlock}>
            <div style={S.identityGridSingle}>
              <label style={S.field}>
                <small style={S.fieldSmall}>MARCA</small>
                <select
                  value={marcaSelectValue}
                  onChange={e=>{
                    const v=e.target.value;
                    if(v==="__nuova__"){ setMarcaCustom(true); setModelloCustom(true); update("marca",""); update("modello",""); }
                    else { setMarcaCustom(false); setModelloCustom(false); update("marca",v); update("modello",""); }
                  }}
                  style={S.input}
                >
                  <option value="">Seleziona</option>
                  {BRANDS.filter(x=>x!=="Altro").map(x=><option key={x} value={x}>{x}</option>)}
                  <option value="__nuova__">+ Nuova marca</option>
                </select>
                {marcaCustom ? (
                  <input value={draft.marca} onChange={e=>update("marca",e.target.value)} placeholder="Nuova marca" style={S.input}/>
                ) : null}
              </label>

              <label style={S.field}>
                <small style={S.fieldSmall}>MODELLO</small>
                <select
                  value={modelloSelectValue}
                  onChange={e=>{
                    const v=e.target.value;
                    if(v==="__nuovo__"){setModelloCustom(true);update("modello","");} else {setModelloCustom(false);update("modello",v);}
                  }}
                  style={S.input}
                >
                  <option value="">Seleziona</option>
                  {modelloOptions.map(x=><option key={x} value={x}>{x}</option>)}
                  <option value="__nuovo__">+ Nuovo modello</option>
                </select>
                {(marcaCustom || !modelloOptions.length || modelloCustom) ? (
                  <input value={draft.modello} onChange={e=>update("modello",e.target.value)} placeholder="Nuovo modello" style={S.input}/>
                ) : null}
              </label>

              <F draft={draft} update={update} l="VERSIONE" k="versione" placeholder="es. 1.5 TSI Life DSG"/>
            </div>
          </section>
        </div>
      </section>

      <section style={S.formCard}>
        <div style={S.sectionHeadSimple}>
          <small style={S.sectionNumber}>01</small>
          <div><h3 style={S.sectionTitle}>DATI TECNICI</h3><p style={S.sectionHint}>Le informazioni principali del veicolo</p></div>
        </div>
        <div style={S.techGrid}>
          <F draft={draft} update={update} l="IMMATRICOLAZIONE" k="immatricolazione" type="month"/>
          <F draft={draft} update={update} l="CHILOMETRAGGIO" k="chilometraggio" placeholder="es. 52.000 km"/>
          <F draft={draft} update={update} l="CARBURANTE" k="carburante" options={FUELS}/>
          <F draft={draft} update={update} l="CAMBIO" k="cambio" options={GEARS}/>
        </div>
      </section>

      <section style={S.formCard}>
        <div style={S.sectionHeadSimple}>
          <small style={S.sectionNumber}>02</small>
          <div><h3 style={S.sectionTitle}>CARATTERISTICHE</h3><p style={S.sectionHint}>Specifiche tecniche e informazioni aggiuntive</p></div>
        </div>
        <div style={S.formGrid}>
          <F draft={draft} update={update} l="POTENZA" k="potenza" placeholder="es. 150 CV"/>
          <F draft={draft} update={update} l="CILINDRATA" k="cilindrata" placeholder="es. 1498 cc"/>
          <F draft={draft} update={update} l="COLORE" k="colore" placeholder="es. Bianco"/>
          <F draft={draft} update={update} l="POSTI" k="posti" placeholder="es. 5"/>
          <div style={S.fullField}><F draft={draft} update={update} l="GARANZIA" k="garanzia" placeholder="es. 12 mesi"/></div>
        </div>
      </section>

      <section style={S.formCard}>
        <div style={S.sectionHeadSimple}>
          <small style={S.sectionNumber}>03</small>
          <div><h3 style={S.sectionTitle}>DOTAZIONI</h3><p style={S.sectionHint}>Cerca una dotazione o selezionala dall'elenco</p></div>
        </div>

        <div style={S.equipmentSearchWrap}>
          <I n="search" s={18}/>
          <input value={equipmentSearch} onChange={e=>setEquipmentSearch(e.target.value)} placeholder="Cerca dotazione..." style={S.equipmentSearch}/>
        </div>

        {draft.dotazioni.length>0&&<div style={S.selectedEquipment}>
          {draft.dotazioni.map((x:string)=><button key={x} type="button" style={S.selectedEquipmentRow} onClick={()=>equipment(x)}><span style={S.checkCircle}>✓</span><span>{x}</span></button>)}
        </div>}

        <div style={S.equipmentList}>
          {filteredEquipment.filter(x=>!draft.dotazioni.includes(x)).map(x=><button key={x} type="button" onClick={()=>equipment(x)} style={S.equipmentRow}><span style={S.emptyCircle}></span><span>{x}</span></button>)}
        </div>

        {searchValue && canAddSearch && <button type="button" style={S.addEquipmentRow} onClick={()=>{equipment(searchValue);setEquipmentSearch("")}}><span style={S.plusCircle}>+</span><span>Aggiungi <b>“{searchValue}”</b> come nuova dotazione</span></button>}
        {!filteredEquipment.length && !canAddSearch && <div style={S.noEquipment}>Nessuna dotazione trovata.</div>}
      </section>

      <section style={S.formCard}>
        <div style={S.sectionHeadSimple}>
          <small style={S.sectionNumber}>04</small>
          <div><h3 style={S.sectionTitle}>DESCRIZIONE</h3><p style={S.sectionHint}>Testo libero per presentare il veicolo</p></div>
        </div>
        <textarea value={draft.descrizione} onChange={e=>update("descrizione",e.target.value)} placeholder="Descrivi brevemente il veicolo, lo stato, gli interventi eseguiti e gli eventuali punti di interesse..." style={S.textarea}/>
      </section>

      <button style={S.save} onClick={save}>{editing ? "SALVA MODIFICHE" : "CREA PROFILO AUTO"}</button>
    </>
  );
}

function Profile({c,urls,back,edit,remove}:{c:Car;urls:any;back:any;edit:any;remove:any}){

 return <><header style={S.header}><button style={S.back} onClick={back}><I n="back"/></button><div style={{flex:1}}><small style={S.eyebrow}>PROFILO AUTO</small><h1 style={S.h2}>{c.marca} {c.modello}</h1></div><button style={S.action} onClick={edit}><I n="edit" s={18}/></button><button style={S.redAction} onClick={remove}><I n="trash" s={18}/></button></header>

 <section style={S.hero}>{c.foto[0]&&urls[c.foto[0].id]?<img src={urls[c.foto[0].id]} style={S.heroImg}/>:<div style={S.heroEmpty}><I n="car" s={55}/></div>}{c.foto.length>1&&<div style={S.thumbs}>{c.foto.slice(1).map(p=>urls[p.id]&&<img key={p.id} src={urls[p.id]} style={S.thumb}/>)}</div>}</section>

 <div style={S.intro}><div><h2 style={S.carName}>{c.marca} {c.modello}</h2><span style={S.version}>{c.versione}</span></div><strong style={S.bigPrice}>{euro(c.prezzo)}</strong></div>

 <div style={S.specGrid}>{[["IMMATRICOLAZIONE",c.immatricolazione?c.immatricolazione.split("-").reverse().join("/"):"—"],["KM",km(c.chilometraggio)],["CARBURANTE",c.carburante||"—"],["CAMBIO",c.cambio||"—"],["POTENZA",c.potenza?c.potenza+" CV":"—"],["CILINDRATA",c.cilindrata?c.cilindrata+" cc":"—"],["COLORE",c.colore||"—"],["POSTI",c.posti||"—"],["GARANZIA",c.garanzia||"—"]].map(([a,b])=><div style={S.specBox} key={a}><small>{a}</small><b>{b}</b></div>)}</div>

 {c.dotazioni.length>0&&<section style={S.info}><h3>DOTAZIONI</h3><div style={S.bullets}>{c.dotazioni.map(x=><div key={x}>✓ <span>{x}</span></div>)}</div></section>}

 {c.descrizione&&<section style={S.info}><h3>DESCRIZIONE</h3><p style={S.desc}>{c.descrizione}</p></section>}

 <section style={S.publish}><h3>ANNUNCIO</h3><div style={S.publishGrid}><button onClick={()=>alert("Il generatore Subito verrà collegato nella prossima fase.")}>SUBITO ↗</button><button onClick={()=>alert("Il generatore Facebook Marketplace verrà collegato nella prossima fase.")}>FACEBOOK MARKETPLACE ↗</button></div></section></>

}



const S:any={

 page:{minHeight:"100vh",background:"#ECEDEE",color:"#041E49",paddingBottom:85,fontFamily:"Arial,sans-serif"},

 wrap:{maxWidth:1120,margin:"0 auto",padding:"0 0 35px"},header:{display:"flex",alignItems:"center",gap:10,marginBottom:20,padding:"28px 22px 18px"},formHeader:{display:"flex",alignItems:"center",gap:14,marginBottom:20,padding:"28px 22px 12px"},

pageHeader:{display:"flex",alignItems:"center",gap:18,padding:"28px 22px 18px"},

logoBox:{width:74,height:74,borderRadius:22,background:"#FFFFFF",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(0,0,0,.08)",fontSize:13,fontWeight:700,color:"#9CA3AF",flexShrink:0},

pageTitle:{fontSize:31,fontWeight:800,color:"#041E49",letterSpacing:"-0.7px",margin:"3px 0 0"},

archiveRow:{margin:"0 18px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:14},archiveCount:{padding:0,fontSize:15,color:"#6B7280"},



newCarButton:{width:52,height:52,border:"none",borderRadius:18,background:"#D4AF37",boxShadow:"0 4px 12px rgba(0,0,0,.12)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#041E49"},

eyebrow:{fontSize:10,fontWeight:800,letterSpacing:1.5,color:"#8B95A5"},h1:{margin:"3px 0 0",fontSize:31},h2:{margin:"3px 0 0",fontSize:25},sub:{margin:"5px 0 0",fontSize:14,color:"#6B7280"},goldIcon:{marginLeft:"auto",width:50,height:50,border:0,borderRadius:16,background:"#D4AF37",color:"#041E49",display:"grid",placeItems:"center",cursor:"pointer"},search:{height:52,background:"#fff",borderRadius:18,display:"flex",alignItems:"center",gap:10,padding:"0 15px",color:"#7B8491",boxShadow:"0 4px 14px rgba(4,30,73,.05)"},searchInput:{flex:1,border:0,outline:0,fontSize:15},filters:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,margin:"12px 0 20px"},select:{height:44,border:"1px solid #DDE2E8",background:"#fff",borderRadius:13,padding:"0 10px",fontSize:13,color:"#374151"},grid:{margin:"16px 18px 0",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:16},card:{background:"#fff",borderRadius:24,overflow:"hidden",cursor:"pointer",boxShadow:"0 6px 18px rgba(4,30,73,.06)"},cover:{height:200,background:"#E6E9ED",display:"grid",placeItems:"center",position:"relative",color:"#A4ADB9"},img:{width:"100%",height:"100%",objectFit:"cover",display:"block"},photo:{position:"absolute",right:10,bottom:10,background:"rgba(4,30,73,.75)",color:"#fff",borderRadius:9,padding:"5px 8px",display:"flex",gap:4,fontSize:11},cardBody:{padding:15},cardTop:{display:"flex",justifyContent:"space-between",gap:10},cardTitle:{fontSize:19},version:{display:"block",fontSize:13,color:"#6B7280",marginTop:3},spec:{marginTop:11,fontSize:12,color:"#697382"},empty:{margin:"16px 18px 0",background:"#fff",borderRadius:25,padding:"55px 20px",textAlign:"center"},emptyIcon:{width:60,height:60,borderRadius:18,background:"#F1F3F5",margin:"0 auto 14px",display:"grid",placeItems:"center",color:"#9AA4B1"},goldBtn:{border:0,borderRadius:13,height:46,padding:"0 15px",background:"#D4AF37",fontWeight:800,display:"inline-flex",alignItems:"center",gap:7,cursor:"pointer"},back:{width:42,height:42,border:0,borderRadius:13,background:"#fff",display:"grid",placeItems:"center",cursor:"pointer"},action:{width:40,height:40,border:0,borderRadius:13,background:"#fff",display:"grid",placeItems:"center",cursor:"pointer"},redAction:{width:40,height:40,border:0,borderRadius:13,background:"#FCE9E9",color:"#C73A3A",display:"grid",placeItems:"center",cursor:"pointer"},hero:{margin:"0 18px",background:"#fff",borderRadius:25,overflow:"hidden"},heroImg:{width:"100%",height:420,objectFit:"cover"},heroEmpty:{height:300,display:"grid",placeItems:"center",color:"#A4ADB9",background:"#E7EAEE"},thumbs:{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:7,padding:8},thumb:{width:"100%",aspectRatio:"1",objectFit:"cover",borderRadius:9},intro:{margin:"20px 18px 15px",display:"flex",justifyContent:"space-between",alignItems:"end"},carName:{margin:0,fontSize:29},bigPrice:{fontSize:24},specGrid:{margin:"0 18px",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9},specBox:{background:"#fff",borderRadius:16,padding:14},info:{marginLeft:18,marginRight:18,background:"#fff",borderRadius:21,padding:18,marginTop:15},bullets:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginTop:13,color:"#B29122"},desc:{whiteSpace:"pre-wrap",lineHeight:1.6,color:"#374151"},publish:{marginLeft:18,marginRight:18,background:"#041E49",color:"#fff",borderRadius:21,padding:18,marginTop:15},publishGrid:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:9,marginTop:12},publishGridButton:{},formCard:{margin:"0 18px 14px",background:"#fff",borderRadius:23,padding:20,boxShadow:"0 5px 16px rgba(4,30,73,.04)"},sectionHead:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:17},sectionHeadSimple:{display:"flex",alignItems:"flex-start",gap:12,marginBottom:18},sectionNumber:{minWidth:32,height:32,borderRadius:10,background:"#F2E7BC",color:"#8B6D13",display:"grid",placeItems:"center",fontSize:11,fontWeight:900,letterSpacing:.5},sectionTitle:{margin:0,fontSize:15,fontWeight:900,color:"#041E49",letterSpacing:"-.1px"},sectionHint:{margin:"3px 0 0",fontSize:12,color:"#7A8491",lineHeight:1.35},photoAdd:{border:0,borderRadius:11,height:39,padding:"0 12px",display:"flex",alignItems:"center",gap:5,fontWeight:800,cursor:"pointer",background:"#F5F6F8",color:"#041E49"},photoEmpty:{height:145,border:"1.5px dashed #C9D0D9",borderRadius:16,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,color:"#788391",cursor:"pointer",background:"#FAFBFC"},photoGrid:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8},photoItem:{position:"relative",aspectRatio:"1.35",overflow:"hidden",borderRadius:12,background:"#E8EBEF"},coverBadge:{position:"absolute",left:6,bottom:6,background:"#D4AF37",padding:"4px 6px",borderRadius:6,fontSize:8,fontWeight:900},photoDel:{position:"absolute",right:5,top:5,width:29,height:29,border:0,borderRadius:8,background:"#fff",color:"#C73A3A",display:"grid",placeItems:"center"},formGrid:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12},fullField:{gridColumn:"1 / -1"},field:{display:"flex",flexDirection:"column",gap:6},fieldSmall:{fontSize:10,fontWeight:800,color:"#7C8796",letterSpacing:1},input:{height:45,border:"1px solid #DCE1E7",borderRadius:12,background:"#FAFBFC",padding:"0 11px",outline:0,boxSizing:"border-box",width:"100%",fontSize:13,color:"#041E49"},chips:{display:"flex",flexWrap:"wrap",gap:7},chip:{minHeight:36,border:"1px solid #DEE3E9",background:"#F7F8F9",borderRadius:10,padding:"0 10px",cursor:"pointer",color:"#374151"},chipOn:{background:"#EEF5E9",borderColor:"#B7D39D",color:"#315A1D",fontWeight:700},custom:{display:"flex",gap:8,marginTop:12},addButton:{height:45,border:0,borderRadius:12,background:"#041E49",color:"#fff",padding:"0 14px",fontWeight:800,cursor:"pointer",whiteSpace:"nowrap"},textarea:{width:"100%",minHeight:150,border:"1px solid #DCE1E7",borderRadius:13,padding:12,boxSizing:"border-box",resize:"vertical",fontSize:14,color:"#041E49",fontFamily:"inherit",outline:0},save:{width:"calc(100% - 36px)",margin:"4px 18px 22px",height:56,border:0,borderRadius:17,background:"#D4AF37",color:"#041E49",fontWeight:900,cursor:"pointer",fontSize:14},formPageTitle:{margin:0,fontSize:31,fontWeight:800,color:"#041E49",letterSpacing:"-0.7px"},formTop:{margin:"0 18px 14px",padding:18,background:"#fff",borderRadius:23,display:"grid",gridTemplateColumns:"minmax(0,1.05fr) minmax(0,1fr)",gap:24,alignItems:"start",boxShadow:"0 5px 16px rgba(4,30,73,.04)"},photoPanel:{background:"transparent",borderRadius:0,padding:0,minWidth:0,width:"100%",alignSelf:"start"},photoPanelHead:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:13},sectionEyebrow:{fontSize:10,fontWeight:900,letterSpacing:1.4,color:"#8B6D13"},photoPanelTitle:{margin:"3px 0 0",fontSize:17,fontWeight:900,color:"#041E49"},photoAddCompact:{border:0,borderRadius:11,height:40,padding:"0 12px",display:"flex",alignItems:"center",gap:6,fontWeight:900,cursor:"pointer",background:"#F5F6F8",color:"#041E49",whiteSpace:"nowrap"},mainPhotoDrop:{width:"100%",aspectRatio:"1 / 1",border:"1.5px dashed #C9D0D9",borderRadius:17,background:"#FAFBFC",display:"grid",placeItems:"center",position:"relative",overflow:"hidden",color:"#8793A1"},mainPhotoImg:{width:"100%",height:"100%",objectFit:"cover"},coverBadgeLarge:{position:"absolute",left:10,bottom:10,background:"#D4AF37",color:"#041E49",padding:"6px 9px",borderRadius:8,fontSize:9,fontWeight:900},photoThumbRow:{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8,marginTop:10},photoThumbItem:{position:"relative",aspectRatio:"1",minWidth:0,overflow:"hidden",borderRadius:12,background:"#E8EBEF",cursor:"grab",border:"2px solid transparent"},photoThumbDragging:{opacity:.55,borderColor:"#D4AF37"},thumbStar:{position:"absolute",left:5,top:5,width:18,height:18,borderRadius:6,background:"#D4AF37",color:"#041E49",fontSize:10,display:"grid",placeItems:"center"},photoDelSmall:{position:"absolute",right:4,top:4,width:23,height:23,border:0,borderRadius:7,background:"rgba(255,255,255,.94)",color:"#C73A3A",display:"grid",placeItems:"center"},photoHint:{marginTop:8,fontSize:11,color:"#8993A0"},photoUploadEmpty:{width:"100%",maxWidth:"none",height:235,aspectRatio:"1 / 1",border:"1.5px dashed #C9D0D9",borderRadius:17,background:"#FAFBFC",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:7,color:"#788391",cursor:"pointer",textAlign:"center",fontSize:12},photoMoveRow:{position:"absolute",left:5,bottom:5,display:"flex",gap:4,zIndex:2},photoMoveBtn:{width:24,height:24,border:0,borderRadius:7,background:"rgba(255,255,255,.94)",color:"#041E49",display:"grid",placeItems:"center",padding:0,cursor:"pointer"},photoAddSquare:{aspectRatio:"1",minWidth:0,border:"1.5px dashed #C9D0D9",borderRadius:12,background:"#F7F8FA",color:"#041E49",display:"grid",placeItems:"center",cursor:"pointer"},
photoManageButton:{marginTop:9,height:36,border:0,borderRadius:11,background:"#F5F6F8",color:"#041E49",display:"inline-flex",alignItems:"center",gap:6,padding:"0 11px",fontSize:11,fontWeight:800,cursor:"pointer"},
photoModalBg:{position:"fixed",inset:0,zIndex:80,background:"rgba(4,30,73,.48)",display:"flex",alignItems:"center",justifyContent:"center",padding:18},
photoModal:{width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",background:"#fff",borderRadius:24,padding:18,boxSizing:"border-box",boxShadow:"0 16px 45px rgba(4,30,73,.22)"},
photoModalHead:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:8},
photoModalTitle:{margin:"3px 0 0",fontSize:22,fontWeight:900,color:"#041E49"},
photoModalClose:{width:38,height:38,border:0,borderRadius:12,background:"#F1F3F5",color:"#041E49",fontSize:25,lineHeight:1,cursor:"pointer"},
photoModalHint:{fontSize:12,color:"#7C8796",marginBottom:14},
photoManagerGrid:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10},
photoManagerItem:{position:"relative",aspectRatio:"1",overflow:"hidden",borderRadius:14,background:"#E8EBEF",cursor:"grab",border:"2px solid transparent"},
photoManagerDelete:{position:"absolute",right:7,top:7,width:34,height:34,border:0,borderRadius:10,background:"rgba(255,255,255,.96)",color:"#C73A3A",display:"grid",placeItems:"center",cursor:"pointer",zIndex:3},
photoManagerActions:{position:"absolute",left:7,bottom:7,display:"flex",gap:5,zIndex:3},
photoManagerMove:{width:32,height:32,border:0,borderRadius:9,background:"rgba(255,255,255,.96)",color:"#041E49",display:"grid",placeItems:"center",cursor:"pointer"},
photoManagerAdd:{aspectRatio:"1",border:"1.5px dashed #C9D0D9",borderRadius:14,background:"#F7F8FA",color:"#041E49",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,fontSize:12,fontWeight:800,cursor:"pointer"},
photoManagerDone:{width:"100%",height:46,marginTop:14,border:0,borderRadius:14,background:"#D4AF37",color:"#041E49",fontWeight:900,cursor:"pointer"},uploadIcon:{width:48,height:48,borderRadius:17,background:"#F1F3F5",display:"grid",placeItems:"center",color:"#7F8A98",marginBottom:3},identityPanel:{display:"flex",flexDirection:"column",gap:22,minWidth:0},identityBlock:{background:"transparent",borderRadius:0,padding:0,boxShadow:"none"},panelLabel:{fontSize:10,fontWeight:900,letterSpacing:1.4,color:"#7C8796",marginBottom:13},identityGrid:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12},identityGridSingle:{display:"grid",gridTemplateColumns:"1fr",gap:12},photoColumn:{minWidth:0,width:"100%",display:"flex",flexDirection:"column",gap:18},pricePanel:{background:"transparent",borderRadius:0,padding:0,boxShadow:"none"},priceInput:{height:52,fontSize:15,borderRadius:14},techGrid:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10},equipmentSearchWrap:{height:47,border:"1px solid #DCE1E7",borderRadius:13,background:"#FAFBFC",display:"flex",alignItems:"center",gap:9,padding:"0 12px",color:"#7C8796",marginBottom:11},equipmentSearch:{flex:1,border:0,outline:0,background:"transparent",fontSize:14,color:"#041E49"},equipmentList:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:7},selectedEquipment:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:7,marginBottom:7},equipmentRow:{minHeight:42,border:"1px solid #E1E5EA",background:"#fff",borderRadius:11,padding:"8px 10px",display:"flex",alignItems:"center",gap:9,textAlign:"left",fontSize:13,color:"#374151",cursor:"pointer"},selectedEquipmentRow:{minHeight:42,border:"1px solid #B7D39D",background:"#F2F8EC",borderRadius:11,padding:"8px 10px",display:"flex",alignItems:"center",gap:9,textAlign:"left",fontSize:13,color:"#315A1D",cursor:"pointer",fontWeight:700},emptyCircle:{width:20,height:20,borderRadius:"50%",border:"1.5px solid #C8CFD8",flexShrink:0},checkCircle:{width:20,height:20,borderRadius:"50%",background:"#6FA44B",color:"#fff",display:"grid",placeItems:"center",fontSize:12,fontWeight:900,flexShrink:0},addEquipmentRow:{width:"100%",minHeight:45,marginTop:8,border:"1px dashed #D4AF37",background:"#FFFDF4",borderRadius:11,padding:"8px 11px",display:"flex",alignItems:"center",gap:9,textAlign:"left",fontSize:13,color:"#5E4B0D",cursor:"pointer"},plusCircle:{width:20,height:20,borderRadius:"50%",background:"#D4AF37",color:"#041E49",display:"grid",placeItems:"center",fontWeight:900,flexShrink:0},noEquipment:{padding:"12px 2px",fontSize:13,color:"#7C8796"},modalBg:{position:"fixed",inset:0,zIndex:20,background:"rgba(4,30,73,.35)",display:"grid",placeItems:"center",padding:20},modal:{maxWidth:430,width:"100%",background:"#fff",borderRadius:23,padding:22},redIcon:{width:47,height:47,borderRadius:14,background:"#FCE9E9",color:"#C73A3A",display:"grid",placeItems:"center"},modalBtns:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8},cancel:{height:43,border:"1px solid #D7DDE4",background:"#fff",borderRadius:12,fontWeight:800,cursor:"pointer"},delete:{height:43,border:0,background:"#C73A3A",color:"#fff",borderRadius:12,fontWeight:800,cursor:"pointer"}

};

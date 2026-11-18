const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const date = new Date();
const day = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
$("#today").textContent = date.toLocaleDateString("uz-UZ",{day:"numeric",month:"long",year:"numeric"});
const firstName = tg?.initDataUnsafe?.user?.first_name;
if (firstName) $("#welcome").textContent = `Assalomu alaykum, ${firstName}!`;
const initData = tg?.initData || "";
const values = {};
const keys = ["istigfor","salovat","quran","asma","namoz","tahajjud","kitob"];
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),1700)}
function render(){
  let done=0;
  $$(".task").forEach(card=>{
    const key=card.dataset.key, v=values[key]||{count:0,completed:false};
    const b=$(".counter b",card); if(b)b.textContent=v.count;
    const c=$('input[type="checkbox"]',card); if(c)c.checked=!!v.completed;
    if((v.count||0)>0||v.completed)done++;
  });
  const pct=Math.round(done/keys.length*100);
  $("#progressText").textContent=pct+"%";$("#progressBar").style.width=pct+"%";
}
async function save(key){
  const v=values[key];
  if(!initData){toast("Sinov ko‘rinishi: Telegram bot orqali ochilganda saqlanadi.");render();return}
  try{
    const r=await fetch("/api/day",{method:"POST",headers:{"Content-Type":"application/json","X-Telegram-Init-Data":initData},body:JSON.stringify({date:day,item:key,count:v.count||0,completed:!!v.completed})});
    if(!r.ok)throw new Error("save");
  }catch(e){toast("Saqlashda xatolik. Internetni tekshiring.");}
  render();
}
async function load(){
  keys.forEach(k=>values[k]={count:0,completed:false});
  if(initData){
    try{
      const r=await fetch(`/api/day?date=${day}`,{headers:{"X-Telegram-Init-Data":initData}});
      if(r.ok){const data=await r.json();data.entries.forEach(e=>values[e.item_key]={count:e.count,completed:!!e.completed});}
      else toast("Telegram tasdiqlash sozlanmagan.");
    }catch(e){toast("Server bilan aloqa yo‘q.");}
  }else{
    toast("Ko‘rib chiqish rejimi. Telegram ichida oching.");
  }
  render();
}
$$(".task").forEach(card=>{
  const key=card.dataset.key;
  $$("[data-step]",card).forEach(btn=>btn.addEventListener("click",()=>{
    values[key].count=Math.max(0,(values[key].count||0)+Number(btn.dataset.step));render();save(key);
  }));
  const checkbox=$('input[type="checkbox"]',card);
  if(checkbox)checkbox.addEventListener("change",()=>{values[key].completed=checkbox.checked;save(key)});
});
$("#sections").addEventListener("click",()=>toast("Qo‘shimcha bo‘limlar keyingi bosqichda qo‘shiladi."));
$("#report").addEventListener("click",()=>toast("Haftalik va oylik hisobot keyingi bosqichda qo‘shiladi."));
$("#settings").addEventListener("click",()=>toast("Sozlamalar keyingi bosqichda qo‘shiladi."));
load();

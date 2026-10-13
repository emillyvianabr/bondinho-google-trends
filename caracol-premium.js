let D = window.TRENDS_DATA || {series:[],term:'Parque do Caracol',updated:null};
const ORANGE = "#004B13", ORANGE2 = "#7FA98A", DARK = "#00320C", MUTED="#AAB0B7", GREEN="#23885A", RED="#C94A3A";
const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
let charts = {};

const marketFilter = document.querySelector("#marketFilter");
const yearFilter = document.querySelector("#yearFilter");
const startDate = document.querySelector("#startDate");
const endDate = document.querySelector("#endDate");

function fmt(v,d=1){ return Number.isFinite(v) ? v.toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d}) : "—"; }
function pct(v){ return Number.isFinite(v) ? `${v>=0?"+":""}${(v*100).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}%` : "—"; }
function mean(a){ return a.length ? a.reduce((x,y)=>x+y,0)/a.length : NaN; }
function stdev(a){ if(a.length<2) return NaN; const m=mean(a); return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1)); }
function selectedMarket(){ return marketFilter.value; }
function selectedYear(){ return yearFilter.value === "ALL" ? null : +yearFilter.value; }
function marketRows(code=selectedMarket()){ return D.series.filter(r => r.marketCode===code); }
function monthsComparable(curr, prev){ const maxMonth = Math.max(...curr.map(r=>r.month)); return [curr.filter(r=>r.month<=maxMonth), prev.filter(r=>r.month<=maxMonth)]; }
function colorMetric(v){ return v > 0.001 ? "positive" : v < -0.001 ? "negative" : ""; }
function updateLastUpdated(){
  const host=document.querySelector("#lastUpdated");
  if(!host)return;
  const raw=String(D.updated||"").trim();
  const date=raw?new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw)?`${raw}T12:00:00`:raw):null;
  host.textContent=date&&!isNaN(date)?date.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"}):"—";
}

// Cada item foi coletado SOZINHO (escala própria 0-100) em D.series.
// A consulta com os 5 JUNTOS (escala comum) fica em CMP e é a única usada para comparar níveis.
const ATTRACTION_ORDER = ["PARQUE","SKYGLASS","SNOWLAND","BONDINHOS","CASCATA"];
const SERIES_COLORS = {PARQUE:"#004B13",SKYGLASS:"#3B82C4",SNOWLAND:"#8E6CC9",BONDINHOS:"#E08A2E",CASCATA:"#C9A227"};
// Comparativo Parque × atrações: 5 itens na MESMA consulta (escala comum)
let CMP = window.CARACOL_COMPARISON_DATA || {series:[]};
function setupFilters(){
  const marketOrder = ATTRACTION_ORDER;
  marketFilter.innerHTML = marketOrder
    .filter(c => D.series.some(r=>r.marketCode===c))
    .map(c => `<option value="${c}">${D.series.find(r=>r.marketCode===c).market}</option>`)
    .join("");
  const years = [...new Set(D.series.map(r=>r.year))].sort((a,b)=>b-a);
  yearFilter.innerHTML = `<option value="ALL">Todos os anos</option>` + years.map(y=>`<option value="${y}">${y}</option>`).join("");
  marketFilter.value = ATTRACTION_ORDER.find(c=>D.series.some(r=>r.marketCode===c)) || "";
  yearFilter.value = "2026";
  const dates = D.series.map(r=>r.date).sort();
  startDate.min = dates[0].slice(0,7); startDate.max = dates.at(-1).slice(0,7);
  endDate.min = dates[0].slice(0,7); endDate.max = dates.at(-1).slice(0,7);
}

Chart.defaults.font.family = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
Chart.defaults.color = "#66707B";
Chart.defaults.font.size = 12;

function destroy(name){ if(charts[name]) charts[name].destroy(); }
function standardOptions(horizontal=false){
  return {
    responsive:true, maintainAspectRatio:false,
    plugins:{legend:{display:false},tooltip:{backgroundColor:"#1D232A",padding:11,titleFont:{weight:"700"}}},
    scales:{
      x:{grid:{display:false},border:{display:false},ticks:{maxRotation:0,autoSkip:true}},
      y:{grid:{color:"#EEF0F2"},border:{display:false},beginAtZero:true}
    }
  };
}
function lineOptions(){
  const o=standardOptions();
  o.scales.y.max=100;
  o.scales.y.title={display:true,text:"Índice de interesse"};
  return o;
}
function barColors(values){ return values.map(v=>v>=0 ? ORANGE : "#c5c8cc"); }

const LOW_VOLUME = 5; // média < 5 na escala conjunta (líder = 100) => baixo volume de busca
function cmpMean(code){ const v=cmpRows(code).map(r=>r.value); return v.length?mean(v):NaN; }
function isLowVolume(code){ const m=cmpMean(code); return Number.isFinite(m)&&m<LOW_VOLUME; }
function labelOf(code){ return namesFrom(code)+(isLowVolume(code)?"*":""); }
// Momentum: últimos 3 meses contra os MESMOS meses do ano anterior (neutraliza a sazonalidade)
function momentumYoY(rows,year){
  let s=[...rows].sort((a,b)=>a.date.localeCompare(b.date));
  if(year) s=s.filter(r=>r.year===year);
  const last=s.slice(-3); if(last.length<3) return NaN;
  const prev=last.map(r=>rows.find(x=>x.year===r.year-1&&x.month===r.month)).filter(Boolean);
  if(prev.length<3) return NaN;
  const pm=mean(prev.map(r=>r.value));
  return pm ? mean(last.map(r=>r.value))/pm-1 : NaN;
}
// Volatilidade: oscilação em torno da tendência linear, relativa à média (não conta crescimento como oscilação)
function detrendedCV(vals){
  const n=vals.length; if(n<4) return NaN;
  const m=mean(vals); if(!m) return NaN;
  const tm=(n-1)/2; let sxy=0,sxx=0;
  vals.forEach((v,i)=>{sxy+=(i-tm)*(v-m); sxx+=(i-tm)**2;});
  const b=sxy/sxx;
  return stdev(vals.map((v,i)=>v-(m+b*(i-tm))))/m;
}
function sortedVals(rows){ return [...rows].sort((a,b)=>a.date.localeCompare(b.date)).map(r=>r.value); }
function cmpRows(code){ return (CMP.series||[]).filter(r=>r.marketCode===code); }
function pctPlain(v){ return Number.isFinite(v) ? `${(v*100).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}%` : "—"; }
function rollingYoy(rows){ // últimos 12 meses vs 12 anteriores
  const s=[...rows].sort((a,b)=>a.date.localeCompare(b.date));
  const cur=s.slice(-12), prev=s.slice(-24,-12);
  if(cur.length<12||prev.length<12) return NaN;
  const pm=mean(prev.map(r=>r.value));
  return pm ? mean(cur.map(r=>r.value))/pm-1 : NaN;
}
function updateKPIs(){
  const code=selectedMarket(), year=selectedYear();
  let base = marketRows(code);
  if(year) base=base.filter(r=>r.year===year);
  const vals=base.map(r=>r.value);
  const avg=mean(vals);
  document.querySelector("#kpiAvg").textContent=fmt(avg);
  const lv=document.querySelector("#lowVolumeNote");
  if(lv){
    if(isLowVolume(code)){
      lv.hidden=false;
      lv.innerHTML=`<strong>Atenção: baixo volume de busca.</strong> ${namesFrom(code)} tem média de ${fmt(cmpMean(code))} na escala conjunta (em que o líder chega a 100). Percentuais, picos e sazonalidade desta série refletem muito ruído e não devem ser lidos como tendência confiável.`;
    } else lv.hidden=true;
  }
  const cmpBase=cmpRows(code).filter(r=>!year||r.year===year);
  const cmpAvg=mean(cmpBase.map(r=>r.value));
  const cmpTxt=Number.isFinite(cmpAvg)?` · escala conjunta: ${fmt(cmpAvg)}`:"";
  document.querySelector("#kpiAvgSub").textContent=(year ? `${year} · ${base[0]?.market||""}` : `período completo · ${base[0]?.market||""}`)+cmpTxt;

  let yoy=NaN;
  if(year){
    const cur=marketRows(code).filter(r=>r.year===year);
    const prev=marketRows(code).filter(r=>r.year===year-1);
    if(cur.length && prev.length){
      const [c,p]=monthsComparable(cur,prev); yoy=mean(c.map(r=>r.value))/mean(p.map(r=>r.value))-1;
    }
  }
  if(!year) yoy=rollingYoy(marketRows(code));
  const yoyEl=document.querySelector("#kpiYoy"); yoyEl.textContent=pct(yoy); yoyEl.className=colorMetric(yoy);
  document.querySelector("#kpiYoySub").textContent=year?`vs. ${year-1}`:"12 meses vs. 12 anteriores";

  let momentum=NaN;
  momentum=momentumYoY(marketRows(code),year);
  const mEl=document.querySelector("#kpiMomentum"); mEl.textContent=pct(momentum); mEl.className=colorMetric(momentum);

  const current=base.length ? [...base].sort((a,b)=>a.date.localeCompare(b.date)).at(-1) : null;
  const currentEl=document.querySelector("#kpiCurrent");
  const currentSub=document.querySelector("#kpiCurrentSub");
  if(currentEl) currentEl.textContent=current?fmt(current.value,0):"—";
  if(currentSub){
    const cm=current?cmpRows(code).find(r=>r.date===current.date):null;
    currentSub.textContent=current?`${months[current.month-1]}/${current.year} · ${year?"último mês do período":"último mês disponível"}`+(cm?` · escala conjunta: ${fmt(cm.value)}`:""):"último mês disponível";
  }

  const cv=detrendedCV(sortedVals(base));
  document.querySelector("#kpiVol").textContent=Number.isFinite(cv)?pctPlain(cv):"—";
}

function updateTrend(){
  destroy("trend");
  const code=selectedMarket(), yr=selectedYear();
  let data=marketRows(code);
  // Global year applies unless local date filter is active.
  const hasLocal = startDate.value || endDate.value;
  if(!hasLocal && yr) data=data.filter(r=>r.year===yr);
  if(startDate.value) data=data.filter(r=>r.date>=startDate.value+"-01");
  if(endDate.value){
    const [y,m]=endDate.value.split("-").map(Number);
    data=data.filter(r=>r.year<y || (r.year===y && r.month<=m));
  }
  data.sort((a,b)=>a.date.localeCompare(b.date));
  let chartRows=data;
  charts.trend=new Chart(document.querySelector("#trendChart"),{
    type:"line",
    data:{labels:chartRows.map(r=>new Date(r.date+"T00:00:00").toLocaleDateString("pt-BR",{month:"short",year:"2-digit"})),
      datasets:[{data:chartRows.map(r=>r.value),borderColor:ORANGE,backgroundColor:"rgba(0,75,19,.08)",pointRadius:2,pointHoverRadius:5,borderWidth:2.4,tension:.28,fill:true}]},
    options:lineOptions()
  });
}

function updateComparison(){
  destroy("comparison");
  const code=selectedMarket(), year=selectedYear();
  const title=document.querySelector("#comparisonTitle");
  if(!year){ title.textContent="Ano selecionado × anterior"; return; }
  title.textContent=`${year} × ${year-1}`;
  let current=marketRows(code).filter(r=>r.year===year);
  let previous=marketRows(code).filter(r=>r.year===year-1);

  const byCur=Object.fromEntries(current.map(r=>[r.month,r.value]));
  const byPrev=Object.fromEntries(previous.map(r=>[r.month,r.value]));
  charts.comparison=new Chart(document.querySelector("#comparisonChart"),{
    type:"line",
    data:{labels:months,datasets:[
      {label:String(year),data:months.map((_,i)=>byCur[i+1]??null),borderColor:ORANGE,backgroundColor:ORANGE,pointRadius:3,borderWidth:2.8,tension:.2},
      {label:String(year-1),data:months.map((_,i)=>byPrev[i+1]??null),borderColor:MUTED,backgroundColor:MUTED,pointRadius:2,borderWidth:2,tension:.2,borderDash:[6,5]}
    ]},
    options:{...lineOptions(),plugins:{...lineOptions().plugins,legend:{display:true,position:"bottom",labels:{usePointStyle:true,boxWidth:8}}}}
  });
}

function seasonIndexFor(code){
  // Cada ano é dividido pela própria média e só anos completos (12 meses) entram:
  // assim o crescimento do ano e o ano parcial não viram "sazonalidade".
  const data=marketRows(code), byYear={};
  data.forEach(r=>{(byYear[r.year]=byYear[r.year]||[]).push(r);});
  let years=Object.keys(byYear).filter(y=>byYear[y].length>=12);
  if(!years.length) years=Object.keys(byYear);
  const acc=Array.from({length:12},()=>[]);
  years.forEach(y=>{
    const m=mean(byYear[y].map(r=>r.value)); if(!m) return;
    byYear[y].forEach(r=>acc[r.month-1].push(r.value/m));
  });
  return acc.map(a=>a.length?mean(a):NaN);
}
function seasonColor(v){
  const t=Math.max(0,Math.min(1,(v-.65)/.7));
  const a=[243,248,243], b=[96,170,120];
  return `rgb(${a.map((x,i)=>Math.round(x+(b[i]-x)*t)).join(",")})`;
}
function updateSeasonality(){
  const vals=seasonIndexFor(selectedMarket());
  document.querySelector("#seasonalityGrid").innerHTML=months.map((m,i)=>`
    <div class="season-cell" style="background:${seasonColor(vals[i])}">
      <span>${m}</span><b>${fmt(vals[i],2)}</b>
    </div>`).join("");
}

function metricByMarket(metric){
  const yr=selectedYear();
  const codes=ATTRACTION_ORDER.filter(c=>D.series.some(r=>r.marketCode===c));
  let result=[];
  codes.forEach(code=>{
    const all=marketRows(code);

    if(metric==="yoy"){
      if(!yr){ const v=rollingYoy(all); if(Number.isFinite(v)) result.push({code,name:labelOf(code),v}); return; }
      const cur=all.filter(r=>r.year===yr), prev=all.filter(r=>r.year===yr-1);
      if(!cur.length||!prev.length) return;
      const [c,p]=monthsComparable(cur,prev);
      const prevMean=mean(p.map(r=>r.value));
      if(!Number.isFinite(prevMean) || prevMean===0) return;
      result.push({code,name:labelOf(code),v:mean(c.map(r=>r.value))/prevMean-1});
    }

    if(metric==="momentum"){
      const v=momentumYoY(all,yr);
      if(Number.isFinite(v)) result.push({code,name:labelOf(code),v});
    }

    if(metric==="vol"){
      const d=yr?all.filter(r=>r.year===yr):all;
      const v=detrendedCV(sortedVals(d));
      if(Number.isFinite(v)) result.push({code,name:labelOf(code),v});
    }
  });
  return result.sort((a,b)=>b.v-a.v);
}
function namesFrom(c){return D.series.find(r=>r.marketCode===c)?.market||c;}

function makeBar(id,key,data,isPct=false){
  destroy(key);
  charts[key]=new Chart(document.querySelector(id),{
    type:"bar",
    data:{labels:data.map(x=>x.name),datasets:[{data:data.map(x=>isPct?x.v*100:x.v),backgroundColor:isPct?barColors(data.map(x=>x.v)):ORANGE,borderRadius:7,borderSkipped:false,barThickness:data.length>=10?14:18,maxBarThickness:20}]},
    options:{...standardOptions(),indexAxis:data.length>=6?"y":"x",
      plugins:{legend:{display:false},tooltip:{backgroundColor:"#1D232A",callbacks:{label:(ctx)=>isPct?`${ctx.raw>=0?"+":""}${fmt(ctx.raw)}%`:fmt(ctx.raw)}}},
      scales:data.length>=6?{
        x:{grid:{color:"#EEF0F2"},border:{display:false},beginAtZero:true,ticks:{font:{size:11},padding:6,callback:v=>isPct?`${v}%`:v}},
        y:{grid:{display:false},border:{display:false},ticks:{font:{size:11},padding:7}}
      }:{
        x:{grid:{display:false},border:{display:false},ticks:{font:{size:11},padding:7}},
        y:{grid:{color:"#EEF0F2"},border:{display:false},beginAtZero:true,ticks:{font:{size:11},padding:6,callback:v=>isPct?`${v}%`:v}}
      }
    }
  });
}
function attractionRankingData(){
  // Ranking de NÍVEL só faz sentido na escala comum (consulta com os 5 juntos).
  const yr=selectedYear();
  const useCmp=(CMP.series||[]).length>0;
  const src=useCmp?CMP.series:D.series;
  return ATTRACTION_ORDER
    .filter(c=>src.some(r=>r.marketCode===c))
    .map(code=>{
      const rows=src.filter(r=>r.marketCode===code&&(!yr||r.year===yr));
      const latest=[...rows].sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
      return {name:(src.find(r=>r.marketCode===code)?.market||code)+(isLowVolume(code)?"*":""), v: latest ? latest.value : NaN};
    })
    .filter(x=>Number.isFinite(x.v))
    .sort((a,b)=>b.v-a.v);
}
function updateLowVolumeFoot(){
  const el=document.querySelector("#lowVolumeFoot"); if(!el) return;
  const low=ATTRACTION_ORDER.filter(isLowVolume);
  el.hidden=!low.length;
  if(low.length) el.textContent=`* Baixo volume de busca (${low.map(namesFrom).join(", ")}): variações percentuais e picos desta série oscilam muito por pouca base e devem ser lidos com cautela.`;
}
function updateMarketCharts(){
  updateLowVolumeFoot();
  makeBar("#rankingChart","ranking",attractionRankingData(),false);
  makeBar("#yoyChart","yoy",metricByMarket("yoy"),true);
  makeBar("#momentumChart","momentum",metricByMarket("momentum"),true);
  makeBar("#volatilityChart","volatility",metricByMarket("vol"),true);
}

function updateParkComparison(){
  const section=document.querySelector("#parkCompareCard");
  const rows0=(CMP.series||[]);
  if(!section) return;
  if(!rows0.length){ section.hidden=true; return; }
  section.hidden=false;
  const yr=selectedYear();
  const rows=rows0.filter(r=>!yr||r.year===yr);
  const dates=[...new Set(rows.map(r=>r.date))].sort();
  const order=ATTRACTION_ORDER.filter(c=>rows.some(r=>r.marketCode===c));
  const nameOf=c=>rows0.find(r=>r.marketCode===c)?.market||c;
  const label=d=>{const [y,m]=d.split("-");return `${months[+m-1]}/${y.slice(2)}`;};
  destroy("parkLine");
  charts.parkLine=new Chart(document.querySelector("#parkLineChart"),{
    type:"line",
    data:{labels:dates.map(label),datasets:order.map(c=>({
      label:nameOf(c)+(isLowVolume(c)?"*":""),
      data:dates.map(d=>rows.find(r=>r.date===d&&r.marketCode===c)?.value??null),
      borderColor:SERIES_COLORS[c],backgroundColor:SERIES_COLORS[c],
      borderWidth:c==="PARQUE"?3.5:2,pointRadius:0,pointHoverRadius:4,tension:.3,spanGaps:true
    }))},
    options:{...standardOptions(),plugins:{legend:{display:true,position:"bottom",labels:{usePointStyle:true,boxWidth:8}},tooltip:{backgroundColor:"#1D232A",mode:"index",intersect:false}},interaction:{mode:"index",intersect:false}}
  });
  const latest=order.map(c=>{
    const r=rows.filter(x=>x.marketCode===c).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
    return {code:c,name:nameOf(c),v:r?r.value:NaN};
  }).filter(x=>Number.isFinite(x.v)).sort((a,b)=>b.v-a.v);
  const note=document.querySelector("#parkCompareNote");
  if(note&&dates.length&&latest.length){
    const p=latest.find(x=>x.code==="PARQUE");
    note.textContent=`Consulta conjunta (escala comum). Em ${label(dates.at(-1))}, ${latest[0].name} lidera`+(p&&latest[0].code!=="PARQUE"?`; o Parque do Caracol está em ${latest.indexOf(p)+1}º de ${latest.length}.`:".");
  }
}

function updatePeaks(){
  let data=marketRows(selectedMarket());
  const yr=selectedYear(); if(yr)data=data.filter(r=>r.year===yr);

  data=[...data].sort((a,b)=>b.value-a.value).slice(0,5);
  const lowNote=isLowVolume(selectedMarket())?`<small style="display:block;margin-top:8px;color:#6B5200">Baixo volume de busca: picos desta série podem ser apenas ruído.</small>`:"";
  document.querySelector("#peaksTable").innerHTML=lowNote+data.map((r,i)=>`
    <div class="peak-row"><div class="peak-rank">${i+1}</div><div><strong>${months[r.month-1]} ${r.year}</strong><small>${r.market||namesFrom(r.marketCode)}</small></div><strong>${fmt(r.value,0)}</strong></div>`).join("");
}

function updateInsight(){
  const yr=selectedYear(), code=selectedMarket(), name=namesFrom(code);
  const all=marketRows(code), seasonal=seasonIndexFor(code);
  const valid=seasonal.map((v,i)=>[v,i]).filter(([v])=>Number.isFinite(v));
  const bestMonth=valid.length?valid.reduce((a,b)=>b[0]>a[0]?b:a)[1]:-1;
  const season=bestMonth>=0?` Considerando só anos completos, ${months[bestMonth]} é historicamente o mês mais forte (índice sazonal ${fmt(seasonal[bestMonth],2)}).`:"";
  let text;
  if(isLowVolume(code)){
    text=`${name} tem volume de busca muito baixo (média de ${fmt(cmpMean(code))} na escala conjunta). Com tão pouca base, variações percentuais, picos e sazonalidade refletem principalmente ruído; use esta série apenas como referência qualitativa.`;
  } else {
    let y=NaN, ref="";
    if(yr){
      const cur=all.filter(r=>r.year===yr), prev=all.filter(r=>r.year===yr-1);
      if(cur.length&&prev.length){const [c,p]=monthsComparable(cur,prev); y=mean(c.map(r=>r.value))/mean(p.map(r=>r.value))-1;}
      ref=`o interesse médio de ${yr} está ${Number.isFinite(y)?pct(y):"sem comparação disponível"} frente ao ano anterior (meses equivalentes)`;
    } else {
      y=rollingYoy(all);
      ref=`os últimos 12 meses estão ${Number.isFinite(y)?pct(y):"sem comparação disponível"} frente aos 12 anteriores`;
    }
    const mom=momentumYoY(all,yr);
    const momTxt=Number.isFinite(mom)?` Os últimos três meses estão ${pct(mom)} em relação aos mesmos meses do ano anterior.`:"";
    text=`Para ${name}, ${ref}.${momTxt}${season}`;
  }
  document.querySelector("#autoInsight").textContent=text;
}

function updateAll(){
  updateLastUpdated(); updateKPIs(); updateTrend(); updateComparison(); updateSeasonality(); updateMarketCharts(); updateParkComparison(); updatePeaks(); updateInsight();
}
marketFilter.addEventListener("change",updateAll);
yearFilter.addEventListener("change",()=>{startDate.value="";endDate.value="";updateAll();});
startDate.addEventListener("change",updateTrend);
endDate.addEventListener("change",updateTrend);
document.querySelector("#clearDates").addEventListener("click",()=>{startDate.value="";endDate.value="";updateTrend();});
document.querySelector("#resetFilters").addEventListener("click",()=>{marketFilter.value=ATTRACTION_ORDER.find(c=>D.series.some(r=>r.marketCode===c))||"";yearFilter.value="2026";startDate.value="";endDate.value="";updateAll();});


function normalizeHeader(h){
  return String(h??"").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/\s+/g,"_");
}
function parseDateValue(v){
  if(v instanceof Date && !isNaN(v)) return v;
  if(typeof v==="number"){
    const p=XLSX.SSF.parse_date_code(v);
    if(p) return new Date(p.y,p.m-1,p.d);
  }
  const s=String(v??"").trim();
  if(!s) return null;
  let d=new Date(s.length===7?s+"-01":s);
  if(!isNaN(d)) return d;
  const br=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(br) return new Date(+br[3],+br[2]-1,+br[1]);
  return null;
}
function rowsFromWorksheet(ws){
  const matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:true});
  if(matrix.length<2) throw new Error("A planilha está vazia.");
  const headers=matrix[0].map(normalizeHeader);
  const aliases={
    data:["data","date","time"],
    mercado_codigo:["mercado_codigo","marketcode","market_code","codigo_mercado"],
    mercado:["mercado","market","pais","country"],
    indice_trends:["indice_trends","value","valor","pao_de_acucar","pão_de_açúcar","pão_de_açucar","pao_de_açúcar"],
    ano:["ano","year"],
    mes_num:["mes_num","month","mesnumero","mes_numero"]
  };
  const findIdx=(keys)=>keys.map(k=>headers.indexOf(normalizeHeader(k))).find(i=>i>=0);
  const idx={}; Object.entries(aliases).forEach(([k,v])=>idx[k]=findIdx(v));
  if(idx.data===undefined || idx.mercado_codigo===undefined || idx.mercado===undefined || idx.indice_trends===undefined){
    throw new Error("Colunas obrigatórias não encontradas. Use data, mercado_codigo, mercado e indice_trends.");
  }
  const parsed=[];
  matrix.slice(1).forEach(row=>{
    if(row.every(v=>v===null||v==="")) return;
    const d=parseDateValue(row[idx.data]);
    const value=Number(row[idx.indice_trends]);
    if(!d || !Number.isFinite(value)) return;
    const code=String(row[idx.mercado_codigo]??"").trim().toUpperCase();
    const market=String(row[idx.mercado]??code).trim();
    parsed.push({
      date:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`,
      year:d.getFullYear(),
      month:d.getMonth()+1,
      marketCode:code,
      market,
      value
    });
  });
  if(!parsed.length) throw new Error("Nenhuma linha válida foi encontrada.");
  return parsed.sort((a,b)=>a.date.localeCompare(b.date)||a.marketCode.localeCompare(b.marketCode));
}
function refreshFiltersFromData(){
  const currentMarket=marketFilter.value;
  const currentYear=yearFilter.value;
  const markets=ATTRACTION_ORDER.filter(c=>D.series.some(r=>r.marketCode===c)).map(c=>[c,D.series.find(r=>r.marketCode===c).market]);
  marketFilter.innerHTML=markets.map(([c,n])=>`<option value="${c}">${n}</option>`).join("");
  const years=[...new Set(D.series.map(r=>r.year))].sort((a,b)=>b-a);
  yearFilter.innerHTML=`<option value="ALL">Todos os anos</option>`+years.map(y=>`<option value="${y}">${y}</option>`).join("");
  marketFilter.value=markets.some(([c])=>c===currentMarket)?currentMarket:(markets[0]?.[0]||"");
  yearFilter.value=years.includes(+currentYear)?currentYear:String(years[0]);
  const dates=D.series.map(r=>r.date).sort();
  startDate.min=dates[0].slice(0,7);startDate.max=dates.at(-1).slice(0,7);
  endDate.min=dates[0].slice(0,7);endDate.max=dates.at(-1).slice(0,7);
  startDate.value="";endDate.value="";
}

function loadComparisonSheet(wb){
  const name=wb.SheetNames.find(n=>normalizeHeader(n)==="comparativo_parque");
  if(!name) return;
  try{ CMP={...CMP,series:rowsFromWorksheet(wb.Sheets[name])}; }
  catch(err){ console.warn("Aba comparativo_parque inválida:",err); }
}
function workbookDataFromBuffer(buf,sourceFile,updatedAt){
    const wb=XLSX.read(buf,{type:"array",cellDates:true});
    const preferred=wb.SheetNames.find(n=>normalizeHeader(n)==="serie_mensal");
    const ws=wb.Sheets[preferred||wb.SheetNames[0]];
    const series=rowsFromWorksheet(ws);
    if(!series.length) throw new Error("A planilha não contém linhas válidas em serie_mensal.");
    loadComparisonSheet(wb);
    return {
      ...D,
      series,
      updated:updatedAt||D.updated||new Date().toISOString().slice(0,10),
      sourceFile
    };
}

async function loadRepositoryWorkbook(){
  const status=document.querySelector("#uploadStatus");
  const sources=[
    {path:"data/manual/dados.xlsx",label:"Base manual de contingência"},
    {path:"data/dados.xlsx",label:"Base automática"}
  ];
  status.textContent="Procurando base de dados…";
  status.className="upload-status";
  for(const source of sources){
    try{
      const response=await fetch(`${source.path}?v=${Date.now()}`, {cache:"no-store"});
      if(!response.ok) continue;
      const buf=await response.arrayBuffer();
      D=workbookDataFromBuffer(buf,source.path,response.headers.get("last-modified"));
      refreshFiltersFromData();
      updateAll();
      status.textContent=`${source.label} · ${D.series.length} linhas`;
      status.className="upload-status success";
      return true;
    }catch(err){
      console.warn(`Não foi possível usar ${source.path}:`,err);
    }
  }
  status.textContent="Planilhas indisponíveis · usando base de fallback";
  status.className="upload-status error";
  return false;
}

async function handleUpload(file){
  const status=document.querySelector("#uploadStatus");
  try{
    status.textContent="Lendo planilha…";status.className="upload-status";
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf,{type:"array",cellDates:true});
    const preferred=wb.SheetNames.find(n=>normalizeHeader(n)==="serie_mensal");
    const ws=wb.Sheets[preferred||wb.SheetNames[0]];
    const series=rowsFromWorksheet(ws);
    loadComparisonSheet(wb);
    D={
      ...D,
      series,
      updated:new Date().toISOString().slice(0,10),
      sourceFile:file.name
    };
    refreshFiltersFromData();
    updateAll();
    status.textContent=`${file.name} · ${series.length} linhas`;
    status.className="upload-status success";
  }catch(err){
    console.error(err);
    status.textContent=err.message||"Não foi possível ler o arquivo.";
    status.className="upload-status error";
  }
}
document.querySelector("#fileUpload").addEventListener("change",e=>{
  const file=e.target.files?.[0];
  if(file) handleUpload(file);
  e.target.value="";
});
document.querySelector("#showFormatHelp").addEventListener("click",()=>{
  document.querySelector("#formatHelp").classList.toggle("hidden");
});
document.querySelector("#downloadFilteredCsv")?.addEventListener("click",()=>{
  const market=selectedMarket(), year=selectedYear();
  const rows=D.series.filter(r=>r.marketCode===market&&(!year||r.year===year));
  const header=["data","ano","mes_num","mercado_codigo","mercado","indice_trends"];
  const escape=v=>`"${String(v??"").replaceAll('"','""')}"`;
  const csv=[header.join(","),...rows.map(r=>[r.date,r.year,r.month,r.marketCode,r.market,r.value].map(escape).join(","))].join("\r\n");
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob), link=document.createElement("a");
  link.href=url;link.download=`google-trends-${market.toLowerCase()}-${year||"todos"}.csv`;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});

if(D.series.length){
  setupFilters();
  updateAll();
}
loadRepositoryWorkbook().then(ok=>{
  if(!ok && !D.series.length){
    document.querySelector("#autoInsight").textContent="Nenhuma base pôde ser carregada. Verifique se data/dados.xlsx existe no repositório.";
  }
});


/* ---------- Balões explicativos nos títulos (passe o mouse, toque ou use Tab) ---------- */
const TIPS = {
  kpis:{what:"Resumo da atração escolhida no filtro “Parque / atração”, dentro do ano selecionado (ou do período completo, se estiver em “Todos os anos”).",
        read:"Cada item foi coletado sozinho no Google Trends, então estes números são relativos ao pico da própria atração. Para comparar o tamanho de uma atração com o de outra, use a seção “Comparação entre atrações”."},
  kpiCurrent:{what:"Índice de interesse no último mês do período selecionado.",
        read:"Vai de 0 a 100, em que 100 é o mês de maior interesse da própria série. Logo abaixo, “escala conjunta” mostra o valor na consulta com os 5 itens juntos, que é o número comparável entre atrações."},
  kpiAvg:{what:"Média mensal do índice no período selecionado.",
        read:"Resume o nível geral de interesse. Para saber o tamanho real frente às outras atrações, olhe o valor em “escala conjunta” logo abaixo."},
  kpiYoy:{what:"Quanto o interesse médio mudou em relação ao ano anterior.",
        read:"Com um ano selecionado, compara os meses equivalentes (ex.: jan–set de 2026 contra jan–set de 2025). Em “Todos os anos”, compara os últimos 12 meses com os 12 anteriores. Verde = alta, vermelho = queda. Em séries de baixo volume, percentuais grandes podem ser só ruído."},
  kpiMomentum:{what:"Se o interesse recente está ganhando ou perdendo força.",
        read:"Compara os últimos 3 meses com os mesmos 3 meses do ano anterior, para não confundir sazonalidade com tendência. Por exemplo, +10% significa 10% mais interesse do que no mesmo período do ano passado."},
  kpiVol:{what:"Quão irregular é o interesse de um mês para o outro.",
        read:"É a oscilação em torno da tendência, em % da média (o crescimento ao longo do tempo não conta como oscilação). Quanto maior, mais imprevisível é a série. Vale mais para comparar atrações entre si do que como número isolado."},
  trend:{what:"Evolução mês a mês do índice de interesse da atração escolhida no filtro.",
        read:"O eixo vai de 0 a 100, em que 100 é o mês de maior interesse da própria série. Observe a direção da linha e os picos. Os campos “De / Até” recortam apenas este gráfico. Para comparar atrações entre si, use o gráfico da seção de comparação."},
  behavior:{what:"Duas leituras do comportamento da atração selecionada: este ano contra o anterior e o perfil sazonal.",
        read:"Use o primeiro gráfico para ver se o ano está acima ou abaixo do anterior, e o segundo para saber quais meses costumam ser fortes."},
  yearCompare:{what:"O ano selecionado (linha verde contínua) contra o ano anterior (linha cinza tracejada), mês a mês.",
        read:"Onde a linha verde está acima da cinza, o interesse naquele mês cresceu em relação ao ano anterior. Só aparece quando há um ano selecionado."},
  seasonal:{what:"Quais meses do ano costumam ter mais ou menos interesse.",
        read:"Cada número compara o mês com a média do próprio ano: 1,00 é um mês médio e 1,50 é 50% acima da média. Quanto mais escuro o verde, mais forte o mês. Só anos completos entram, para que o crescimento do ano não pareça sazonalidade."},
  compareSection:{what:"O Parque do Caracol e as 4 atrações lado a lado.",
        read:"Esta seção não responde ao filtro de atração (o filtro de ano continua valendo). O gráfico de linhas e o ranking usam a consulta conjunta, comparável em tamanho; variação anual, momentum e volatilidade são relativos à série de cada item. O asterisco (*) marca séries de baixo volume de busca."},
  parkLine:{what:"Evolução mensal dos 5 itens, coletados juntos na mesma consulta do Google Trends.",
        read:"Como compartilham a mesma escala, a altura das linhas é comparável: quanto mais alta, maior o interesse relativo. O 100 é o maior ponto entre todos os itens no período."},
  ranking:{what:"A posição de cada item no último mês disponível do período.",
        read:"Barras maiores significam mais interesse relativo. Os valores estão na escala conjunta, por isso podem ser comparados entre os itens."},
  yoyChart:{what:"Quanto cada item cresceu ou caiu em relação ao ano anterior.",
        read:"Barras verdes indicam alta e cinzas indicam queda. Sem ano selecionado, compara 12 meses contra 12. É um percentual sobre a base de cada item: um item pequeno pode ter percentual grande com pouca mudança real (veja o *)."},
  momentumChart:{what:"Quais itens ganharam ou perderam força recentemente.",
        read:"Compara os últimos 3 meses com os mesmos meses do ano anterior. Barras para cima: ganhando força. Barras para baixo: perdendo força."},
  volChart:{what:"Quão irregular é o interesse de cada item ao longo do tempo.",
        read:"É a oscilação mensal em torno da tendência, em % da média. Barra alta significa série instável e difícil de prever. Não indica se o interesse está subindo ou caindo."},
  diagnostic:{what:"Os pontos de maior interesse da atração selecionada.",
        read:"Use para cruzar com campanhas, férias, feriados, eventos e notícias e entender o que gerou os picos."},
  peaks:{what:"Os 5 meses de maior índice da atração e do período selecionados.",
        read:"O número é o índice de 0 a 100 da própria série (100 é o maior mês). Em séries de baixo volume, picos podem ser apenas ruído."},
  insight:{what:"Um resumo em texto, gerado automaticamente a partir dos números do filtro atual.",
        read:"Muda quando você troca de atração ou de ano. É um apoio à leitura, não uma conclusão: confirme sempre nos gráficos."}
};
(function(){
  const pop=document.createElement("div");
  pop.className="tip-pop"; pop.setAttribute("role","tooltip");
  document.body.appendChild(pop);
  let current=null, via="hover";
  function place(el){
    const r=el.getBoundingClientRect(), pw=pop.offsetWidth, ph=pop.offsetHeight;
    const left=Math.min(Math.max(12,r.left),Math.max(12,window.innerWidth-pw-12));
    let top=r.bottom+10;
    if(top+ph>window.innerHeight-12) top=Math.max(12,r.top-ph-10);
    pop.style.left=left+"px"; pop.style.top=top+"px";
  }
  function show(el,how){
    const t=TIPS[el.dataset.tip]; if(!t) return;
    via=how||"hover";
    pop.innerHTML=`<p><b>O que mostra</b>${t.what}</p><p><b>Como ler</b>${t.read}</p>`;
    pop.style.visibility="visible"; pop.classList.add("show"); place(el); current=el;
  }
  function hide(){ pop.classList.remove("show"); current=null; }
  document.querySelectorAll("[data-tip]").forEach(el=>{ el.tabIndex=0; });
  let touchAt=0;
  document.addEventListener("touchstart",()=>{ touchAt=Date.now(); },{passive:true,capture:true});
  document.addEventListener("mouseover",e=>{
    const el=e.target.closest&&e.target.closest("[data-tip]");
    if(el){ if(el!==current) show(el); }
    else if(current && via==="hover" && Date.now()-touchAt>1000) hide(); // ignora o mouseover emulado após um toque
  });
  document.addEventListener("focusin",e=>{ const el=e.target.closest&&e.target.closest("[data-tip]"); if(el) show(el,"focus"); });
  document.addEventListener("focusout",hide);
  document.addEventListener("click",e=>{
    const el=e.target.closest&&e.target.closest("[data-tip]");
    if(el) show(el); else hide();
  });
  document.addEventListener("keydown",e=>{ if(e.key==="Escape") hide(); });
  window.addEventListener("scroll",()=>{
    if(!current) return;
    const r=current.getBoundingClientRect();
    const out=r.bottom<0||r.top>window.innerHeight;
    pop.style.visibility=out?"hidden":"visible"; // some só enquanto o título está fora da tela
    if(!out) place(current);
  },{passive:true});
})();

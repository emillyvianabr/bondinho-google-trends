let D = window.TRENDS_DATA || {series:[],geo2026:[],geoHistory:[],term:'Pão de Açúcar',updated:null};
const ORANGE = "#FF6600", ORANGE2 = "#FDBA8C", DARK = "#CC5200", MUTED="#AAB0B7", GREEN="#23885A", RED="#C94A3A";
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

function setupFilters(){
  const marketOrder = ["WORLD","BR","AR","CL","CO","UY","US","FR"];
  marketFilter.innerHTML = marketOrder
    .filter(c => D.series.some(r=>r.marketCode===c))
    .map(c => `<option value="${c}">${D.series.find(r=>r.marketCode===c).market}</option>`)
    .join("");
  const years = [...new Set(D.series.map(r=>r.year))].sort((a,b)=>b-a);
  yearFilter.innerHTML = `<option value="ALL">Todos os anos</option>` + years.map(y=>`<option value="${y}">${y}</option>`).join("");
  marketFilter.value = D.series.some(r=>r.marketCode==="WORLD") ? "WORLD" : "BR";
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

function updateKPIs(){
  const code=selectedMarket(), year=selectedYear();
  let base = marketRows(code);
  if(year) base=base.filter(r=>r.year===year);
  const vals=base.map(r=>r.value);
  const avg=mean(vals);
  document.querySelector("#kpiAvg").textContent=fmt(avg);
  document.querySelector("#kpiAvgSub").textContent=year ? `${year} · ${base[0]?.market||""}` : "período completo";

  let yoy=NaN;
  if(year){
    const cur=marketRows(code).filter(r=>r.year===year);
    const prev=marketRows(code).filter(r=>r.year===year-1);
    if(cur.length && prev.length){
      const [c,p]=monthsComparable(cur,prev); yoy=mean(c.map(r=>r.value))/mean(p.map(r=>r.value))-1;
    }
  }
  const yoyEl=document.querySelector("#kpiYoy"); yoyEl.textContent=pct(yoy); yoyEl.className=colorMetric(yoy);
  document.querySelector("#kpiYoySub").textContent=year?`vs. ${year-1}`:"selecione um ano";

  let momentum=NaN;
  if(year){
    const arr=marketRows(code).filter(r=>r.year===year).sort((a,b)=>a.month-b.month);
    if(arr.length>=6){
      momentum=mean(arr.slice(-3).map(r=>r.value))/mean(arr.slice(-6,-3).map(r=>r.value))-1;
    }
  }
  const mEl=document.querySelector("#kpiMomentum"); mEl.textContent=pct(momentum); mEl.className=colorMetric(momentum);

  const current=base.length ? [...base].sort((a,b)=>a.date.localeCompare(b.date)).at(-1) : null;
  const currentEl=document.querySelector("#kpiCurrent");
  const currentSub=document.querySelector("#kpiCurrentSub");
  if(currentEl) currentEl.textContent=current?fmt(current.value,0):"—";
  if(currentSub) currentSub.textContent=current?`${months[current.month-1]}/${current.year} · último mês disponível`:"último mês disponível";

  const cv=vals.length>1 && mean(vals)!==0 ? stdev(vals)/mean(vals) : NaN;
  document.querySelector("#kpiVol").textContent=Number.isFinite(cv)?pct(cv):"—";
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
      datasets:[{data:chartRows.map(r=>r.value),borderColor:ORANGE,backgroundColor:"rgba(245,123,37,.08)",pointRadius:2,pointHoverRadius:5,borderWidth:2.4,tension:.28,fill:true}]},
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
  const data=marketRows(code);
  const overall=mean(data.map(r=>r.value));
  return months.map((_,i)=>mean(data.filter(r=>r.month===i+1).map(r=>r.value))/overall);
}
function seasonColor(v){
  const t=Math.max(0,Math.min(1,(v-.65)/.7));
  const a=[255,246,239], b=[243,112,33];
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
  const codes=["BR","AR","CL","CO","UY","US","FR"].filter(c=>D.series.some(r=>r.marketCode===c));
  let result=[];
  codes.forEach(code=>{
    const all=marketRows(code);

    if(metric==="yoy"){
      if(!yr) return;
      const cur=all.filter(r=>r.year===yr), prev=all.filter(r=>r.year===yr-1);
      if(!cur.length||!prev.length) return;
      const [c,p]=monthsComparable(cur,prev);
      const prevMean=mean(p.map(r=>r.value));
      if(!Number.isFinite(prevMean) || prevMean===0) return;
      result.push({code,name:namesFrom(code),v:mean(c.map(r=>r.value))/prevMean-1});
    }

    if(metric==="momentum"){
      const d=(yr?all.filter(r=>r.year===yr):all).sort((a,b)=>a.date.localeCompare(b.date));
      if(d.length<6) return;
      const previous=mean(d.slice(-6,-3).map(r=>r.value));
      if(!Number.isFinite(previous) || previous===0) return;
      result.push({code,name:namesFrom(code),v:mean(d.slice(-3).map(r=>r.value))/previous-1});
    }

    if(metric==="vol"){
      const d=yr?all.filter(r=>r.year===yr):all;
      const vals=d.map(r=>r.value);
      const avg=mean(vals);
      if(vals.length<2 || !Number.isFinite(avg) || avg===0) return;
      result.push({code,name:namesFrom(code),v:stdev(vals)/avg});
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
function geoRankingData(){
  return (D.geo2026||[])
    .filter(x=>Number.isFinite(x.value))
    .sort((a,b)=>b.value-a.value)
    .slice(0,15)
    .map(x=>({name:x.country,v:x.value}));
}
function updateMarketCharts(){
  makeBar("#rankingChart","ranking",geoRankingData(),false);
  makeBar("#yoyChart","yoy",metricByMarket("yoy"),true);
  makeBar("#momentumChart","momentum",metricByMarket("momentum"),true);
  makeBar("#volatilityChart","volatility",metricByMarket("vol"),true);
}

function updatePeaks(){
  let data=marketRows(selectedMarket());
  const yr=selectedYear(); if(yr)data=data.filter(r=>r.year===yr);

  data=[...data].sort((a,b)=>b.value-a.value).slice(0,5);
  document.querySelector("#peaksTable").innerHTML=data.map((r,i)=>`
    <div class="peak-row"><div class="peak-rank">${i+1}</div><div><strong>${months[r.month-1]} ${r.year}</strong><small>${r.market||namesFrom(r.marketCode)}</small></div><strong>${fmt(r.value,0)}</strong></div>`).join("");
}

const CORE_GEO = new Set(["brasil","argentina","chile","colombia","uruguai","estados unidos","franca"]);
function normalizeCountryName(s){return String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();}
function isCoreCountry(country){return CORE_GEO.has(normalizeCountryName(country));}

function updateGeo(){
  const host=document.querySelector("#geoChart");
  const data=(D.geo2026||[]).filter(x=>Number.isFinite(x.value));
  if(host&&window.geoChartsReady){
    window.geoChartsReady.then(()=>{
      const table=new google.visualization.DataTable();
      table.addColumn("string","País");
      table.addColumn("number","Interesse relativo");
      table.addRows(data.map(x=>[x.country,x.value]));
      const chart=new google.visualization.GeoChart(host);
      chart.draw(table,{
        backgroundColor:"transparent",
        datalessRegionColor:"#ECEFF2",
        defaultColor:"#FFF0E6",
        colorAxis:{minValue:0,maxValue:100,colors:["#FFF0E6","#FFB078","#FF6600","#CC5200"]},
        legend:"none",
        region:"world",
        resolution:"countries",
        tooltip:{textStyle:{fontName:"Arial",fontSize:12}}
      });
    });
  }
  updateGeoRadar();
}

function geoSnapshots(){
  const hist=(D.geoHistory||[]).filter(x=>x.date&&x.country&&Number.isFinite(x.value));
  const dates=[...new Set(hist.map(x=>x.date))].sort();
  return {hist,dates};
}
function updateGeoRadar(){
  const host=document.querySelector("#geoRadar");
  const status=document.querySelector("#geoHistoryStatus");
  const subtitle=document.querySelector("#geoRadarSubtitle");
  if(!host)return;
  const {hist,dates}=geoSnapshots();
  const current=(D.geo2026||[]).filter(x=>Number.isFinite(x.value)&&!isCoreCountry(x.country));
  let rows=[];
  if(dates.length>=2){
    const prevDate=dates.at(-2), lastDate=dates.at(-1);
    const prev=new Map(hist.filter(x=>x.date===prevDate).map(x=>[normalizeCountryName(x.country),x.value]));
    const last=hist.filter(x=>x.date===lastDate&&!isCoreCountry(x.country));
    rows=last.map(x=>{const p=prev.get(normalizeCountryName(x.country));return {...x,delta:Number.isFinite(p)?x.value-p:null,previous:p};})
      .sort((a,b)=>(Number.isFinite(b.delta)?b.delta:-999)-(Number.isFinite(a.delta)?a.delta:-999)||b.value-a.value).slice(0,12);
    status.textContent=`${dates.length} snapshots · último ${lastDate.split("-").reverse().join("/")}`;
    subtitle.textContent="Priorizado pelo crescimento entre os dois snapshots geográficos mais recentes.";
  }else{
    rows=current.sort((a,b)=>b.value-a.value).slice(0,12).map(x=>({...x,delta:null}));
    status.textContent=`${Math.max(dates.length,1)} snapshot geográfico`;
    subtitle.textContent="Ainda sem histórico suficiente: ranking pelo interesse geográfico mais recente.";
  }
  host.innerHTML=rows.map((r,i)=>`
    <div class="geo-radar-item">
      <div class="geo-rank">${i+1}</div>
      <div class="geo-country"><strong>${r.country}</strong><small>fora do recorte principal</small></div>
      <div class="geo-metric"><strong>${fmt(r.value,Number.isInteger(r.value)?0:1)}</strong>
        ${Number.isFinite(r.delta)?`<small class="${r.delta>0?"up":r.delta<0?"down":""}">${r.delta>0?"+":""}${fmt(r.delta,1)} pts</small>`:`<small>interesse atual</small>`}
      </div>
    </div>`).join("");
}

function updateInsight(){
  const yr=selectedYear(), code=selectedMarket();
  let text="";
  if(yr){
    const yoy=metricByMarket("yoy");
    const mom=metricByMarket("momentum");
    if(false && yoy.length){
      const best=yoy[0], worst=yoy.at(-1);
      const hot=mom[0];
      text=`Em ${yr}, ${best.name} apresenta a maior variação anual entre os mercados exibidos (${pct(best.v)}), enquanto ${worst.name} registra a menor (${pct(worst.v)}). No recorte de momentum, ${hot?.name||"—"} aparece com o sinal mais favorável nos meses mais recentes. Use os picos e a sazonalidade para investigar se essa mudança é estrutural ou ligada a períodos específicos.`;
    } else {
      const all=marketRows(code), cur=all.filter(r=>r.year===yr), prev=all.filter(r=>r.year===yr-1);
      let y=NaN;if(cur.length&&prev.length){const [c,p]=monthsComparable(cur,prev);y=mean(c.map(r=>r.value))/mean(p.map(r=>r.value))-1;}
      const seasonal=seasonIndexFor(code); const bestMonth=seasonal.indexOf(Math.max(...seasonal));
      text=`No mercado ${namesFrom(code)}, o interesse médio de ${yr} está ${Number.isFinite(y)?pct(y):"sem comparação disponível"} frente ao ano anterior. Historicamente, ${months[bestMonth]} é o mês com maior índice sazonal relativo. O gráfico de tendência permite restringir uma janela específica para investigar picos ou quedas sem alterar os demais indicadores do dashboard.`;
    }
  } else text="Selecione um ano para gerar uma leitura comparativa automática contra o período anterior.";
  document.querySelector("#autoInsight").textContent=text;
}

function updateAll(){
  updateLastUpdated(); updateKPIs(); updateTrend(); updateComparison(); updateSeasonality(); updateMarketCharts(); updatePeaks(); updateGeo(); updateInsight();
}
marketFilter.addEventListener("change",updateAll);
yearFilter.addEventListener("change",()=>{startDate.value="";endDate.value="";updateAll();});
startDate.addEventListener("change",updateTrend);
endDate.addEventListener("change",updateTrend);
document.querySelector("#clearDates").addEventListener("click",()=>{startDate.value="";endDate.value="";updateTrend();});
document.querySelector("#resetFilters").addEventListener("click",()=>{marketFilter.value=D.series.some(r=>r.marketCode==="WORLD")?"WORLD":"BR";yearFilter.value="2026";startDate.value="";endDate.value="";updateAll();});


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
function geoRowsFromWorksheet(ws){
  if(!ws)return [];
  const matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:true});
  if(matrix.length<2)return [];
  const h=matrix[0].map(normalizeHeader);
  const c=(...names)=>names.map(n=>h.indexOf(normalizeHeader(n))).find(i=>i>=0);
  const ipais=c("pais","country","mercado");
  const ival=c("indice_trends_num","indice_trends","value","valor");
  const idisp=c("indice_trends_exibicao","display");
  if(ipais===undefined||ival===undefined)return [];
  return matrix.slice(1).map(r=>({country:String(r[ipais]??"").trim(),value:Number(r[ival]),display:idisp===undefined?String(r[ival]??""):String(r[idisp]??"")})).filter(x=>x.country&&Number.isFinite(x.value));
}
function geoHistoryFromWorksheet(ws){
  if(!ws)return [];
  const matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:true});
  if(matrix.length<2)return [];
  const h=matrix[0].map(normalizeHeader);
  const c=(...names)=>names.map(n=>h.indexOf(normalizeHeader(n))).find(i=>i>=0);
  const idate=c("data_snapshot","data","date");
  const ipais=c("pais","country");
  const ival=c("indice_trends_num","indice_trends","value","valor");
  if(idate===undefined||ipais===undefined||ival===undefined)return [];
  return matrix.slice(1).map(r=>{const d=parseDateValue(r[idate]);return {date:d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`:"",country:String(r[ipais]??"").trim(),value:Number(r[ival])};}).filter(x=>x.date&&x.country&&Number.isFinite(x.value));
}
function rebuildGeoFromSeries(series){
  const latestYear=Math.max(...series.map(r=>r.year));
  const latest=series.filter(r=>r.year===latestYear);
  const grouped={};
  latest.forEach(r=>(grouped[r.market]??=[]).push(r.value));
  return Object.entries(grouped).map(([country,vals])=>({country,value:mean(vals),display:fmt(mean(vals),1)}));
}
function refreshFiltersFromData(){
  const currentMarket=marketFilter.value;
  const currentYear=yearFilter.value;
  const markets=[...new Map(D.series.map(r=>[r.marketCode,r.market])).entries()].sort((a,b)=>a[1].localeCompare(b[1],"pt-BR"));
  marketFilter.innerHTML=markets.map(([c,n])=>`<option value="${c}">${n}</option>`).join("");
  const years=[...new Set(D.series.map(r=>r.year))].sort((a,b)=>b-a);
  yearFilter.innerHTML=`<option value="ALL">Todos os anos</option>`+years.map(y=>`<option value="${y}">${y}</option>`).join("");
  marketFilter.value=markets.some(([c])=>c===currentMarket)?currentMarket:(markets.some(([c])=>c==="WORLD")?"WORLD":markets[0]?.[0]||"");
  yearFilter.value=years.includes(+currentYear)?currentYear:String(years[0]);
  const dates=D.series.map(r=>r.date).sort();
  startDate.min=dates[0].slice(0,7);startDate.max=dates.at(-1).slice(0,7);
  endDate.min=dates[0].slice(0,7);endDate.max=dates.at(-1).slice(0,7);
  startDate.value="";endDate.value="";
}

function workbookDataFromBuffer(buf,sourceFile,updatedAt){
    const wb=XLSX.read(buf,{type:"array",cellDates:true});
    const preferred=wb.SheetNames.find(n=>normalizeHeader(n)==="serie_mensal");
    const ws=wb.Sheets[preferred||wb.SheetNames[0]];
    const series=rowsFromWorksheet(ws);
    if(!series.length) throw new Error("A planilha não contém linhas válidas em serie_mensal.");
    const geoSheetName=wb.SheetNames.find(n=>normalizeHeader(n)==="geo_2026");
    const histSheetName=wb.SheetNames.find(n=>normalizeHeader(n)==="geo_historico");
    const geo2026=geoSheetName?geoRowsFromWorksheet(wb.Sheets[geoSheetName]):rebuildGeoFromSeries(series);
    const geoHistory=histSheetName?geoHistoryFromWorksheet(wb.Sheets[histSheetName]):[];
    return {
      ...D,
      series,
      geo2026,
      geoHistory,
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
    const geoSheetName=wb.SheetNames.find(n=>normalizeHeader(n)==="geo_2026");
    const histSheetName=wb.SheetNames.find(n=>normalizeHeader(n)==="geo_historico");
    D={
      ...D,
      series,
      geo2026:geoSheetName?geoRowsFromWorksheet(wb.Sheets[geoSheetName]):rebuildGeoFromSeries(series),
      geoHistory:histSheetName?geoHistoryFromWorksheet(wb.Sheets[histSheetName]):[],
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

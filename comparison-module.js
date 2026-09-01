(function(){
  const C = window.ATTRACTION_TRENDS_DATA;
  if(!C || !Array.isArray(C.series) || !C.series.length) return;

  const DARK="#28333E", ORANGE="#FF6600", MUTED="#9AA1A9", GRID="#ECEEF0", GREEN="#23885A", RED="#C94A3A";
  const monthNames=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const marketOrder=["WORLD","BR","AR","CL","CO","UY","US","FR"];
  let trendChart=null, ratioChart=null, seasonChart=null, momentumChart=null;
  const $=s=>document.querySelector(s);
  const avg=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:NaN;
  const fmt=(v,d=1)=>Number.isFinite(v)?v.toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d}):"—";
  const pct=v=>Number.isFinite(v)?`${v>=0?"+":""}${fmt(v*100,1)}%`:"—";
  const status=v=>!Number.isFinite(v)?"Sem base":v>0.025?"Acelerando":v<-.025?"Desacelerando":"Estável";
  const statusClass=v=>!Number.isFinite(v)?"":v>0.025?"positive":v<-.025?"negative":"neutral";

  function getFilters(){ return {market:$("#marketFilter")?.value||"WORLD",year:$("#yearFilter")?.value||"ALL"}; }
  function filtered(code,year){
    return C.series.filter(r=>r.marketCode===code && (year==="ALL" || r.year===+year)).sort((a,b)=>a.date.localeCompare(b.date));
  }
  function allMarket(code){ return C.series.filter(r=>r.marketCode===code).sort((a,b)=>a.date.localeCompare(b.date)); }
  function labelPeriod(year){ return year==="ALL"?"jan/2024–ago/2026":String(year); }
  function momentum(rows,key){
    if(rows.length<6) return NaN;
    const recent=avg(rows.slice(-3).map(r=>r[key]));
    const previous=avg(rows.slice(-6,-3).map(r=>r[key]));
    return !Number.isFinite(previous)||previous===0?NaN:recent/previous-1;
  }
  function seasonality(code,key){
    const data=allMarket(code);
    const overall=avg(data.map(r=>r[key]));
    return monthNames.map((_,i)=>{
      const vals=data.filter(r=>r.month===i+1).map(r=>r[key]);
      return !vals.length||!Number.isFinite(overall)||overall===0?NaN:avg(vals)/overall;
    });
  }
  function comparableMomentumRows(code,year){
    let rows=filtered(code,year);
    if(year==="ALL") rows=allMarket(code);
    return rows;
  }

  function render(){
    const {market,year}=getFilters();
    const rows=filtered(market,year);
    if(!rows.length) return;
    const marketName=rows[0].market;
    const cAvg=avg(rows.map(r=>r.cristo)), bAvg=avg(rows.map(r=>r.bondinho));
    const ratio=bAvg===0?NaN:cAvg/bAvg;
    const share=(cAvg+bAvg)===0?NaN:cAvg/(cAvg+bAvg);
    const gap=cAvg-bAvg;
    const period=labelPeriod(year);

    $("#attractionRatio").textContent=Number.isFinite(ratio)?`${fmt(ratio,1)}×`:"—";
    $("#attractionRatioSub").textContent=`Cristo sobre Bondinho · ${marketName}`;
    $("#attractionShare").textContent=Number.isFinite(share)?`${fmt(share*100,1)}%`:"—";
    $("#attractionShareSub").textContent=`do interesse combinado · ${period}`;
    $("#attractionGap").textContent=`${gap>=0?"+":""}${fmt(gap,1)}`;
    $("#attractionGapSub").textContent=`pontos médios · ${marketName}`;
    $("#attractionTrendTitle").textContent=`Cristo × Bondinho · ${marketName}`;
    $("#attractionTrendSubtitle").textContent=`Evolução mensal · ${period}${year==="2026"?" · agosto parcial":""}`;
    $("#attractionPartialNote").textContent=year==="2026"||year==="ALL"?" Agosto/2026 é um mês ainda em andamento na data da coleta (12/08/2026), portanto pode pressionar o momentum para baixo.":"";

    if(trendChart) trendChart.destroy();
    trendChart=new Chart($("#attractionTrendChart"),{
      type:"line",
      data:{labels:rows.map(r=>year==="ALL"?`${monthNames[r.month-1]}/${String(r.year).slice(2)}`:monthNames[r.month-1]),datasets:[
        {label:"Cristo Redentor",data:rows.map(r=>r.cristo),borderColor:DARK,backgroundColor:DARK,pointRadius:2.5,pointHoverRadius:5,borderWidth:2.7,tension:.22},
        {label:"Pão de Açúcar / Bondinho",data:rows.map(r=>r.bondinho),borderColor:ORANGE,backgroundColor:ORANGE,pointRadius:2.5,pointHoverRadius:5,borderWidth:2.7,tension:.22}
      ]},
      options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},plugins:{legend:{position:"top",align:"start",labels:{usePointStyle:true,pointStyle:"circle",boxWidth:7,boxHeight:7,padding:16}},tooltip:{backgroundColor:"#1D232A",callbacks:{label:c=>`${c.dataset.label}: ${fmt(c.raw,0)}`}}},scales:{x:{grid:{display:false},ticks:{font:{size:9},maxTicksLimit:12,maxRotation:0,minRotation:0}},y:{beginAtZero:true,suggestedMax:100,grid:{color:GRID},border:{display:false},ticks:{font:{size:9}}}}}
    });

    const ranking=marketOrder.map(code=>{
      const rr=filtered(code,year); if(!rr.length)return null;
      const ca=avg(rr.map(r=>r.cristo)),ba=avg(rr.map(r=>r.bondinho));
      return {code,name:rr[0].market,ratio:ba===0?NaN:ca/ba};
    }).filter(Boolean).filter(r=>Number.isFinite(r.ratio)).sort((a,b)=>b.ratio-a.ratio);

    if(ratioChart) ratioChart.destroy();
    ratioChart=new Chart($("#attractionRatioChart"),{
      type:"bar",
      data:{labels:ranking.map(r=>r.name),datasets:[{label:"Cristo ÷ Bondinho",data:ranking.map(r=>r.ratio),backgroundColor:ranking.map(r=>r.code===market?ORANGE:"#D7DCE1"),borderRadius:5,maxBarThickness:22}]},
      options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:"#1D232A",callbacks:{label:c=>`${fmt(c.raw,1)}× o interesse relativo do Bondinho`}}},scales:{x:{beginAtZero:true,grid:{color:GRID},border:{display:false},ticks:{callback:v=>`${v}×`,font:{size:9}}},y:{grid:{display:false},border:{display:false},ticks:{font:{size:9.5}}}}}
    });

    // Sazonalidade: sempre histórico completo para revelar padrão recorrente.
    const cSeason=seasonality(market,"cristo"), bSeason=seasonality(market,"bondinho");
    if(seasonChart) seasonChart.destroy();
    seasonChart=new Chart($("#attractionSeasonChart"),{
      type:"line",
      data:{labels:monthNames,datasets:[
        {label:"Cristo Redentor",data:cSeason,borderColor:DARK,backgroundColor:DARK,pointRadius:3,pointHoverRadius:5,borderWidth:2.5,tension:.25},
        {label:"Bondinho",data:bSeason,borderColor:ORANGE,backgroundColor:ORANGE,pointRadius:3,pointHoverRadius:5,borderWidth:2.5,tension:.25},
        {label:"Média histórica",data:monthNames.map(()=>1),borderColor:MUTED,pointRadius:0,borderWidth:1.2,borderDash:[5,5]}
      ]},
      options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},plugins:{legend:{position:"top",align:"start",labels:{usePointStyle:true,boxWidth:7,boxHeight:7,padding:14}},tooltip:{backgroundColor:"#1D232A",callbacks:{label:c=>`${c.dataset.label}: ${fmt(c.raw,2)}`}}},scales:{x:{grid:{display:false},ticks:{font:{size:9}}},y:{grid:{color:GRID},border:{display:false},ticks:{font:{size:9},callback:v=>fmt(v,1)}}}}
    });
    const cBest=cSeason.indexOf(Math.max(...cSeason.filter(Number.isFinite))), bBest=bSeason.indexOf(Math.max(...bSeason.filter(Number.isFinite)));
    const cLow=cSeason.indexOf(Math.min(...cSeason.filter(Number.isFinite))), bLow=bSeason.indexOf(Math.min(...bSeason.filter(Number.isFinite)));
    $("#attractionSeasonSummary").innerHTML=`<strong>Cristo:</strong> pico sazonal em ${monthNames[cBest]} (${fmt(cSeason[cBest],2)}) e menor índice em ${monthNames[cLow]} (${fmt(cSeason[cLow],2)}). <strong>Bondinho:</strong> pico em ${monthNames[bBest]} (${fmt(bSeason[bBest],2)}) e menor índice em ${monthNames[bLow]} (${fmt(bSeason[bLow],2)}).`;

    // Momentum comparado, com a mesma regra do dashboard principal.
    const momRows=comparableMomentumRows(market,year);
    const cMom=momentum(momRows,"cristo"), bMom=momentum(momRows,"bondinho");
    const cEl=$("#cristoMomentum"), bEl=$("#bondinhoMomentum");
    cEl.textContent=pct(cMom); cEl.className=statusClass(cMom);
    bEl.textContent=pct(bMom); bEl.className=statusClass(bMom);
    $("#cristoMomentumStatus").textContent=status(cMom);
    $("#bondinhoMomentumStatus").textContent=status(bMom);

    const prevRows=momRows.slice(-6,-3), recentRows=momRows.slice(-3);
    const cPrev=avg(prevRows.map(r=>r.cristo)), cRecent=avg(recentRows.map(r=>r.cristo));
    const bPrev=avg(prevRows.map(r=>r.bondinho)), bRecent=avg(recentRows.map(r=>r.bondinho));
    if(momentumChart) momentumChart.destroy();
    momentumChart=new Chart($("#attractionMomentumChart"),{
      type:"bar",
      data:{labels:["3 meses anteriores","3 meses recentes"],datasets:[
        {label:"Cristo Redentor",data:[cPrev,cRecent],backgroundColor:DARK,borderRadius:5,maxBarThickness:38},
        {label:"Bondinho",data:[bPrev,bRecent],backgroundColor:ORANGE,borderRadius:5,maxBarThickness:38}
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"top",align:"start",labels:{usePointStyle:true,boxWidth:7,boxHeight:7,padding:14}},tooltip:{backgroundColor:"#1D232A",callbacks:{label:c=>`${c.dataset.label}: ${fmt(c.raw,1)}`}}},scales:{x:{grid:{display:false},ticks:{font:{size:9}}},y:{beginAtZero:true,grid:{color:GRID},border:{display:false},ticks:{font:{size:9}}}}}
    });

    let verdict="";
    if(!Number.isFinite(cMom)||!Number.isFinite(bMom)) verdict="Selecione um período com pelo menos seis meses para calcular o momentum.";
    else if(cMom<-.025 && bMom<-.025) verdict=`<strong>Os dois estão desacelerando.</strong> Cristo ${pct(cMom)} e Bondinho ${pct(bMom)}. ${cMom<bMom?"O Cristo perde força um pouco mais rapidamente neste recorte.":"O Bondinho perde força mais rapidamente neste recorte."}`;
    else if(cMom<-.025 && bMom>=-.025) verdict=`<strong>O Cristo está desacelerando</strong> (${pct(cMom)}), enquanto o Bondinho está ${status(bMom).toLowerCase()} (${pct(bMom)}).`;
    else if(bMom<-.025 && cMom>=-.025) verdict=`<strong>O Bondinho está desacelerando</strong> (${pct(bMom)}), enquanto o Cristo está ${status(cMom).toLowerCase()} (${pct(cMom)}).`;
    else if(cMom>.025 && bMom>.025) verdict=`<strong>Os dois estão acelerando.</strong> Cristo ${pct(cMom)} e Bondinho ${pct(bMom)}.`;
    else verdict=`Cristo está <strong>${status(cMom).toLowerCase()}</strong> (${pct(cMom)}) e Bondinho está <strong>${status(bMom).toLowerCase()}</strong> (${pct(bMom)}).`;
    $("#attractionMomentumVerdict").innerHTML=verdict;

    const leaderMonths=rows.filter(r=>r.cristo>r.bondinho).length;
    const maxGap=rows.reduce((best,r)=>!best||(r.cristo-r.bondinho)>(best.cristo-best.bondinho)?r:best,null);
    const top=ranking[0], close=[...ranking].sort((a,b)=>a.ratio-b.ratio)[0];
    $("#attractionCompareInsight").innerHTML=`No recorte de <strong>${marketName}</strong>, o Cristo Redentor registra em média <strong>${fmt(ratio,1)}×</strong> o interesse do Pão de Açúcar e lidera em <strong>${leaderMonths} de ${rows.length} meses</strong>. A maior distância mensal do período aparece em <strong>${monthNames[maxGap.month-1]}/${maxGap.year}</strong> (${fmt(maxGap.cristo,0)} contra ${fmt(maxGap.bondinho,0)}). Entre os mercados monitorados, a vantagem relativa do Cristo é mais forte em <strong>${top.name}</strong> (${fmt(top.ratio,1)}×) e mais equilibrada em <strong>${close.name}</strong> (${fmt(close.ratio,1)}×).`;
  }

  ["#marketFilter","#yearFilter"].forEach(id=>$(id)?.addEventListener("change",render));
  $("#resetFilters")?.addEventListener("click",()=>setTimeout(render,0));
  render();
})();

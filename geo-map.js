/* ==========================================================================
   Mapa-múndi interativo (D3) — interesse relativo por país (GeoMap do Google Trends)
   - Zoom: botões + / −, duplo clique, Ctrl/⌘ + rolagem, pinça no celular
   - Arraste para mover; atalhos por região
   - Escala de cor em raiz quadrada: realça diferenças entre países de menor interesse
   - Destaca no mapa o país selecionado no filtro "Mercado"
   Depende de: d3@7, topojson-client@3 e world-map-data.js (window.WORLD_MAP)
   ========================================================================== */
(function(){
  const REGIONS=[
    {id:"world",label:"Mundo",box:null},
    {id:"latam",label:"América Latina",box:[[-118,-56],[-33,33]]},
    {id:"na",label:"América do Norte",box:[[-170,14],[-50,72]]},
    {id:"eu",label:"Europa",box:[[-25,34],[45,72]]},
    {id:"af",label:"África",box:[[-20,-36],[52,38]]},
    {id:"as",label:"Ásia e Oceania",box:[[58,-48],[180,58]]}
  ];
  const CORE=new Set(["BR","AR","CL","CO","UY","US","FR"]); // mercados com série temporal no dashboard
  const NODATA="#D3DCE2";
  const STOPS=[[0,"#FFEBDD"],[.30,"#FFB078"],[.65,"#FF6600"],[1,"#CC5200"]];
  const KEY_TICKS=[0,10,25,50,100];
  const MAX_ZOOM=14;

  const regionNames=(typeof Intl!=="undefined"&&Intl.DisplayNames)?new Intl.DisplayNames(["pt-BR"],{type:"region"}):null;
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtNum=v=>Number.isInteger(v)?String(v):v.toLocaleString("pt-BR",{maximumFractionDigits:1});

  // Plano B para planilhas sem a coluna de código: descobre o ISO-2 pelo nome do país em português.
  const norm=t=>String(t??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  let nameIndex=null;
  function codeFromName(name){
    if(!regionNames||!window.WORLD_MAP) return "";
    if(!nameIndex){
      nameIndex=new Map();
      Object.values(window.WORLD_MAP.numToA2).concat(["XK"]).forEach(a2=>{
        try{ const n=regionNames.of(a2); if(n&&n!==a2) nameIndex.set(norm(n),a2); }catch(e){}
      });
    }
    return nameIndex.get(norm(name))||"";
  }

  // v (0–100) -> cor. A raiz quadrada afasta os tons baixos, onde está a maioria dos países.
  function colorFor(d3,v){
    const t=Math.sqrt(Math.max(0,Math.min(100,v))/100);
    for(let i=1;i<STOPS.length;i++){
      if(t<=STOPS[i][0]){
        const [t0,c0]=STOPS[i-1],[t1,c1]=STOPS[i];
        return d3.interpolateRgb(c0,c1)((t-t0)/(t1-t0));
      }
    }
    return STOPS[STOPS.length-1][1];
  }

  function build(host){
    const d3=window.d3, topojson=window.topojson, W=window.WORLD_MAP;
    if(!d3||!topojson||!W){
      host.innerHTML='<div class="geo-fallback">Não foi possível carregar o mapa. Os dados continuam disponíveis no ranking e no radar.</div>';
      return null;
    }
    const feats=topojson.feature(W.topo,W.topo.objects.countries).features.filter(f=>f.id!=="010"); // sem Antártida
    feats.forEach(f=>{ f.a2=W.numToA2[f.id]||W.nameToA2[f.properties.name]||null; });

    const gradient="linear-gradient(90deg,"+Array.from({length:11},(_,i)=>{const t=i/10;return colorFor(d3,t*t*100)+" "+(t*100)+"%";}).join(",")+")";
    const ticks=KEY_TICKS.map(v=>{
      const pos=Math.sqrt(v/100)*100;
      const tr=v===0?"0":v===100?"-100%":"-50%";
      return `<span style="left:${pos}%;transform:translateX(${tr})">${v}</span>`;
    }).join("");

    host.innerHTML=`
      <div class="geo-map">
        <svg class="geo-svg" role="img" aria-label="Mapa-múndi do interesse relativo por país. Arraste para mover; use os botões ou Ctrl e a rolagem para dar zoom."></svg>
        <div class="geo-regions" role="group" aria-label="Atalhos de região">${REGIONS.map(r=>`<button type="button" class="geo-chip" data-r="${r.id}">${r.label}</button>`).join("")}</div>
        <div class="geo-zoom" role="group" aria-label="Zoom">
          <button type="button" data-z="in" aria-label="Aproximar">+</button>
          <button type="button" data-z="out" aria-label="Afastar">−</button>
          <button type="button" data-z="reset" aria-label="Voltar à visão do mundo"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </div>
        <div class="geo-key">
          <div class="geo-key-title">Interesse relativo (0–100)</div>
          <div class="geo-key-bar" style="background:${gradient}"></div>
          <div class="geo-key-ticks">${ticks}</div>
          <div class="geo-key-nodata"><i></i>Sem dados</div>
        </div>
        <div class="geo-hint" hidden>Segure Ctrl (⌘ no Mac) e role para dar zoom</div>
        <div class="geo-tip" hidden></div>
      </div>`;

    const root=host.querySelector(".geo-map");
    const svg=d3.select(root.querySelector(".geo-svg"));
    const tip=root.querySelector(".geo-tip"), hint=root.querySelector(".geo-hint");
    const chips=[...root.querySelectorAll(".geo-chip")];
    const btnIn=root.querySelector('[data-z="in"]'), btnOut=root.querySelector('[data-z="out"]');

    const sphere=svg.append("path").attr("class","geo-sphere");
    const g=svg.append("g");
    const countries=g.selectAll("path").data(feats).join("path").attr("class","geo-c");

    let w=0,h=0,proj=null,path=null,current=d3.zoomIdentity,activeChip="world";
    let byCode=new Map(), positives=0, ranks=new Map(), selected=null, hintTimer=null, tipTimer=null;

    const zoom=d3.zoom().scaleExtent([1,MAX_ZOOM])
      .filter(ev=>{
        if(ev.type==="wheel") return ev.ctrlKey||ev.metaKey;           // não sequestra a rolagem da página
        if(ev.type&&ev.type.startsWith("touch")) return (ev.touches&&ev.touches.length>1)||current.k>1.001; // 1 dedo rola a página
        return !ev.button;
      })
      .wheelDelta(ev=>-ev.deltaY*(ev.deltaMode===1?0.05:ev.deltaMode?1:0.002)*((ev.ctrlKey||ev.metaKey)?10:1))
      .on("zoom",ev=>{
        current=ev.transform; g.attr("transform",current);
        if(ev.sourceEvent){ setChip(current.k<=1.001?"world":null); hideTip(); }
        btnIn.disabled=current.k>=MAX_ZOOM-.01; btnOut.disabled=current.k<=1.001;
      });
    svg.call(zoom); // arraste, pinça e duplo clique para aproximar

    svg.on("wheel.hint",ev=>{
      if(ev.ctrlKey||ev.metaKey) return;
      hint.hidden=false; clearTimeout(hintTimer); hintTimer=setTimeout(()=>{hint.hidden=true;},1800);
    },{passive:true});

    function setChip(id){ activeChip=id; chips.forEach(c=>c.classList.toggle("is-active",c.dataset.r===id)); }

    function layout(){
      const r=svg.node().getBoundingClientRect();
      w=Math.max(260,Math.round(r.width)); h=Math.max(180,Math.round(r.height));
      svg.attr("viewBox",`0 0 ${w} ${h}`);
      proj=d3.geoNaturalEarth1().fitExtent([[6,6],[w-6,h-6]],{type:"Sphere"});
      path=d3.geoPath(proj);
      sphere.attr("d",path({type:"Sphere"}));
      countries.attr("d",path);
      zoom.extent([[0,0],[w,h]]).translateExtent([[0,0],[w,h]]);
      svg.call(zoom.transform,d3.zoomIdentity);
      setChip("world");
    }

    function boxBounds(box){
      const [[w0,s0],[e0,n0]]=box; let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
      for(let i=0;i<=8;i++)for(let j=0;j<=8;j++){
        const p=proj([w0+(e0-w0)*i/8,s0+(n0-s0)*j/8]); if(!p) continue;
        x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);
      }
      return [[x0,y0],[x1,y1]];
    }
    function zoomToRegion(id){
      const reg=REGIONS.find(r=>r.id===id); if(!reg) return;
      setChip(id);
      if(!reg.box){ svg.transition().duration(600).call(zoom.transform,d3.zoomIdentity); return; }
      const [[x0,y0],[x1,y1]]=boxBounds(reg.box);
      const k=Math.max(1,Math.min(MAX_ZOOM,.92/Math.max((x1-x0)/w,(y1-y0)/h)));
      let tx=w/2-k*(x0+x1)/2, ty=h/2-k*(y0+y1)/2;
      tx=Math.min(0,Math.max(w-k*w,tx)); ty=Math.min(0,Math.max(h-k*h,ty)); // respeita os limites do mapa
      svg.transition().duration(650).call(zoom.transform,d3.zoomIdentity.translate(tx,ty).scale(k));
    }

    root.querySelector(".geo-regions").addEventListener("click",e=>{
      const b=e.target.closest(".geo-chip"); if(b) zoomToRegion(b.dataset.r);
    });
    root.querySelector(".geo-zoom").addEventListener("click",e=>{
      const b=e.target.closest("button"); if(!b||b.disabled) return;
      const z=b.dataset.z;
      if(z==="reset"){ setChip("world"); svg.transition().duration(450).call(zoom.transform,d3.zoomIdentity); return; }
      svg.transition().duration(250).call(zoom.scaleBy,z==="in"?1.7:1/1.7);
      setChip(null);
    });

    /* ---------- tooltip ---------- */
    function nameOf(d){
      const row=byCode.get(d.a2);
      if(row&&row.country) return row.country;
      if(d.a2&&regionNames){ try{ const n=regionNames.of(d.a2); if(n&&n!==d.a2) return n; }catch(e){} }
      return d.properties.name||"—";
    }
    function tipHtml(d){
      const row=byCode.get(d.a2), nm=esc(nameOf(d));
      let body;
      if(!row) body='<span class="geo-tip-v">Sem dados</span>';
      else if(row.value>0) body=`<span class="geo-tip-v">${fmtNum(row.value)}</span><span class="geo-tip-s">interesse relativo · ${ranks.get(d.a2)}º entre ${positives} países com interesse</span>`;
      else body='<span class="geo-tip-v">0</span><span class="geo-tip-s">volume de buscas muito baixo</span>';
      const tags=[];
      if(CORE.has(d.a2)) tags.push("Mercado monitorado");
      if(selected&&d.a2===selected) tags.push("Selecionado no filtro");
      return `<strong>${nm}</strong>${body}${tags.length?`<span class="geo-tip-t">${tags.join(" · ")}</span>`:""}`;
    }
    function placeTip(ev){
      const r=root.getBoundingClientRect();
      let x=ev.clientX-r.left+14, y=ev.clientY-r.top+14;
      const tw=tip.offsetWidth, th=tip.offsetHeight;
      if(x+tw>r.width-8) x=ev.clientX-r.left-tw-14;
      if(y+th>r.height-8) y=ev.clientY-r.top-th-14;
      tip.style.left=Math.max(8,x)+"px"; tip.style.top=Math.max(8,y)+"px";
    }
    function showTip(ev,d){
      tip.innerHTML=tipHtml(d); tip.hidden=false; placeTip(ev);
      clearTimeout(tipTimer);
      if(ev.pointerType&&ev.pointerType!=="mouse") tipTimer=setTimeout(hideTip,4500);
    }
    function hideTip(){ tip.hidden=true; }

    countries
      .on("pointerenter.tip pointermove.tip",function(ev,d){ if(ev.buttons) return; showTip(ev,d); })
      .on("pointerleave.tip",function(ev){ if(ev.pointerType==="mouse") hideTip(); })
      .on("pointerenter.raise",function(){ d3.select(this).raise(); if(selected) g.select(".is-selected").raise(); });
    sphere.on("click",hideTip).on("pointerdown",hideTip);

    /* ---------- dados ---------- */
    function paint(){
      countries
        .style("fill",d=>{const r=byCode.get(d.a2);return r?colorFor(d3,r.value):NODATA;})
        .classed("is-selected",d=>!!selected&&d.a2===selected);
      g.select(".is-selected").raise();
    }
    function update(rows,sel){
      byCode=new Map();
      (rows||[]).forEach(r=>{
        const code=String(r.code||"").toUpperCase()||codeFromName(r.country);
        if(code&&Number.isFinite(r.value)) byCode.set(code,r);
      });
      const vals=[...byCode.values()].map(r=>r.value).filter(v=>v>0).sort((a,b)=>b-a);
      positives=vals.length;
      ranks=new Map(); byCode.forEach((r,code)=>{ if(r.value>0) ranks.set(code,1+vals.filter(v=>v>r.value).length); });
      selected=(sel&&sel!=="WORLD")?sel:null;
      paint();
    }

    layout();
    let lastW=svg.node().getBoundingClientRect().width,lastH=svg.node().getBoundingClientRect().height,rz=null;
    if(typeof ResizeObserver!=="undefined"){
      new ResizeObserver(()=>{
        clearTimeout(rz);
        rz=setTimeout(()=>{
          const r=svg.node().getBoundingClientRect();
          if(Math.abs(r.width-lastW)>2||Math.abs(r.height-lastH)>2){ lastW=r.width;lastH=r.height; layout(); }
        },150);
      }).observe(host);
    }
    return {update};
  }

  window.GeoMap={
    render(host,rows,selected){
      if(!host) return;
      if(host.__geo===undefined) host.__geo=build(host);
      if(host.__geo) host.__geo.update(rows,selected);
    }
  };
})();

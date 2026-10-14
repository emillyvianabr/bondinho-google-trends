/* ---------- Balões explicativos nos títulos (passe o mouse, toque ou use Tab) ---------- */
const TIPS = {
  kpis:{what:"Resumo do tema “Pão de Açúcar” no mercado escolhido no filtro “Mercado” (Mundo ou um país).",
        read:"Os cinco indicadores mostram sempre a janela mais recente da série (último mês e últimos 12 meses): o filtro de ano não os altera. Cada mercado tem a sua própria escala de 0 a 100, então não compare estes números entre países."},
  kpiCurrent:{what:"Índice de interesse no último mês disponível do mercado.",
        read:"Vai de 0 a 100, em que 100 é o mês de maior interesse da própria série (não são 100 buscas). Se a coleta foi feita no meio do mês, o último valor pode estar em andamento."},
  kpiAvg:{what:"Média do índice nos últimos 12 meses do mercado.",
        read:"Resume o nível geral de interesse em um ano. Como cada mercado tem escala própria, não use esta média para comparar países: para isso, olhe o ranking do GeoMap."},
  kpiYoy:{what:"Quanto o interesse médio dos últimos 12 meses mudou frente aos 12 meses anteriores.",
        read:"+10% significa 10% mais interesse do que no ano anterior. Verde = alta, rosa = queda. Só aparece quando há 24 meses de dados."},
  kpiMomentum:{what:"Se o interesse recente está ganhando ou perdendo força.",
        read:"Compara a média dos 3 meses mais recentes com a dos 3 meses imediatamente anteriores. Como não desconta a sazonalidade, uma queda pode ser só o fim de uma alta temporada: confira o perfil sazonal antes de concluir."},
  kpiVol:{what:"Quão irregular é o interesse de um mês para o outro.",
        read:"É o desvio-padrão dos últimos 12 meses dividido pela média. Quanto maior, mais a série oscila e menos previsível ela é. Não diz se o interesse está subindo ou caindo."},
  trend:{what:"Evolução mês a mês do índice de interesse no mercado selecionado.",
        read:"O eixo vai de 0 a 100, em que 100 é o mês de maior interesse da própria série. Com um ano selecionado, só ele aparece; os campos “De / Até” recortam apenas este gráfico e têm prioridade sobre o filtro de ano."},
  behavior:{what:"Duas leituras do mercado selecionado: este ano contra o anterior e o perfil sazonal.",
        read:"Use o primeiro gráfico para ver se o ano está acima ou abaixo do anterior, e o segundo para saber quais meses costumam ser fortes."},
  yearCompare:{what:"O ano selecionado (linha laranja contínua) contra o ano anterior (linha cinza tracejada), mês a mês.",
        read:"Onde a linha laranja está acima da cinza, o interesse naquele mês cresceu em relação ao ano anterior. Só aparece quando há um ano selecionado."},
  seasonal:{what:"Quais meses do ano costumam ter mais ou menos interesse no mercado selecionado.",
        read:"Cada número compara o mês com a média do próprio ano: 1,00 é um mês médio e 1,50 é 50% acima da média. Quanto mais escuro o laranja, mais forte o mês. Só anos completos entram, para que o crescimento do ano ou um ano parcial não pareça sazonalidade."},
  compareSection:{what:"Os mercados lado a lado.",
        read:"Esta seção não responde ao filtro de mercado (o filtro de ano continua valendo). O ranking usa o GeoMap, que compara países na mesma escala; variação anual, momentum e volatilidade são relativos à série de cada mercado."},
  ranking:{what:"Os 15 países com maior interesse relativo pelo tema, segundo o GeoMap do Google Trends, no ano corrente (de 1º de janeiro até a data da coleta).",
        read:"Todos os países entram na mesma consulta e na mesma escala, então podem ser comparados entre si. O valor mostra a proporção das buscas de cada país dedicada ao tema, não o número absoluto de buscas: países pequenos podem ficar à frente de países grandes."},
  yoyChart:{what:"Quanto cada mercado cresceu ou caiu no ano selecionado em relação ao ano anterior.",
        read:"Compara os meses equivalentes (ex.: jan–set de 2026 contra jan–set de 2025) e exige um ano selecionado: em “Todos os anos” o gráfico fica vazio. Barras laranja indicam alta e cinzas indicam queda. É um percentual sobre a base de cada mercado: mercados pequenos podem ter percentuais grandes com pouca mudança real."},
  momentumChart:{what:"Quais mercados ganharam ou perderam força nos meses mais recentes.",
        read:"Compara a média dos 3 últimos meses do período selecionado com a dos 3 meses anteriores. Barras laranja: ganhando força. Barras cinzas: perdendo força. Não desconta a sazonalidade."},
  volChart:{what:"Quão irregular é o interesse de cada mercado ao longo do período.",
        read:"É o desvio-padrão do índice dividido pela média, no período selecionado. Barra alta significa série instável e difícil de prever. Não indica se o interesse está subindo ou caindo."},
  geoSection:{what:"Países fora do recorte principal de monitoramento.",
        read:"Use o GeoMap para encontrar países relevantes que ainda não têm série temporal neste dashboard (hoje: Brasil, Argentina, Chile, Colômbia, Uruguai, Estados Unidos e França, além do Mundo)."},
  geoMap:{what:"Mapa de calor do interesse relativo pelo tema em cada país, no ano corrente.",
        read:"Quanto mais intenso o laranja, maior o interesse relativo do país; cinza indica país sem dados. Passe o mouse (ou toque) sobre um país para ver o valor exato de 0 a 100. Para aproximar, use + / − , o duplo clique ou Ctrl + rolagem (pinça no celular) e arraste para mover; os botões de região dão atalho. A escala de cor realça as diferenças entre países de menor interesse, mas o número mostrado é sempre o índice real. O país escolhido no filtro “Mercado” fica contornado."},
  geoRadar:{what:"Países que merecem atenção, fora dos mercados que já têm série temporal no dashboard.",
        read:"Com um único snapshot, é o ranking pelo interesse atual. A cada atualização mensal um novo snapshot é guardado e, com dois ou mais, o ranking passa a priorizar o crescimento em pontos entre as duas últimas coletas."},
  diagnostic:{what:"Os pontos de maior interesse do mercado selecionado.",
        read:"Use para cruzar com campanhas, férias, feriados, eventos e notícias e entender o que gerou os picos."},
  peaks:{what:"Os 5 meses de maior índice do mercado e do ano selecionados.",
        read:"O número é o índice de 0 a 100 da própria série (100 é o maior mês). Sem ano selecionado, considera todo o histórico."},
  insight:{what:"Um resumo em texto, gerado automaticamente a partir dos filtros atuais.",
        read:"Só aparece com um ano selecionado e muda ao trocar de mercado ou de ano. É um apoio à leitura, não uma conclusão: confirme sempre nos gráficos."},
  cbSection:{what:"O Cristo Redentor e o Pão de Açúcar lado a lado.",
        read:"Os dois foram coletados juntos, na mesma consulta do Google Trends, por isso são comparáveis dentro de um mesmo mercado. Entre mercados, compare a razão Cristo ÷ Bondinho, e não os índices brutos. Mercado e ano seguem os filtros do dashboard."},
  cbRatio:{what:"Quantas vezes o Cristo tem mais interesse do que o Bondinho, em média.",
        read:"É a média do índice do Cristo dividida pela do Bondinho no período. 2,0× significa o dobro do interesse relativo."},
  cbShare:{what:"A fatia do Cristo no interesse somado dos dois atrativos.",
        read:"Média do Cristo ÷ (média do Cristo + média do Bondinho). 50% é empate; acima disso o Cristo concentra mais buscas."},
  cbGap:{what:"A diferença média, em pontos, entre os dois atrativos.",
        read:"Média do Cristo menos média do Bondinho, na escala de 0 a 100 compartilhada. Valor positivo: o Cristo está à frente."},
  cbTrend:{what:"Evolução mensal dos dois atrativos no mercado selecionado.",
        read:"Os dois usam a mesma escala: onde uma linha está acima da outra, aquele atrativo teve mais interesse no mês. O mês mais recente pode estar parcial."},
  cbRatioChart:{what:"Em que mercados o Cristo mais supera o Bondinho.",
        read:"Cada barra é a razão Cristo ÷ Bondinho do mercado, o que evita comparar escalas de 0 a 100 de consultas diferentes. O mercado selecionado aparece em laranja."},
  cbSeason:{what:"Quais meses costumam ser fortes para cada atrativo.",
        read:"Cada mês é comparado com a média do próprio ano de cada atrativo (1,00 = mês típico, linha tracejada), usando só anos completos, para que o crescimento do ano não pareça sazonalidade."},
  cbMomentum:{what:"Se o Cristo e o Bondinho estão ganhando ou perdendo força.",
        read:"Compara os 3 meses mais recentes com os 3 anteriores de cada atrativo. Acima de +2,5% é “acelerando”, abaixo de −2,5% é “desacelerando” e, entre os dois, “estável”. Não desconta a sazonalidade."}
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

/* A Stolzl é usada nos gráficos (canvas): carrega a fonte e redesenha quando ela estiver pronta. */
if(document.fonts&&document.fonts.load){
  Promise.all([document.fonts.load('400 12px Stolzl'),document.fonts.load('700 12px Stolzl')]).then(()=>{
    const m=document.querySelector("#marketFilter");
    if(m&&m.options.length) m.dispatchEvent(new Event("change"));
  }).catch(()=>{});
}

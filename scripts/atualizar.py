"""Atualiza o dashboard do Parque do Caracol com Google Trends (pytrends).

Seis consultas por execução, todas no Brasil:
  1-5) cada item (Parque, Skyglass, Snowland, Bondinhos, Pé da Cascata) SOZINHO -> escala própria (0-100)
  6)   os 5 itens JUNTOS                                                    -> escala comum, para compará-los

O Google reescala cada consulta de 0 a 100; por isso séries de consultas diferentes
NÃO são comparáveis entre si. Só a consulta 6 permite comparar um item com outro.
Se qualquer etapa falhar, nenhum arquivo publicado é substituído.
"""
from __future__ import annotations

import json
import shutil
import time
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from pytrends.request import TrendReq

ROOT = Path(__file__).resolve().parents[1]
DATA_XLSX = ROOT / "data" / "dados.xlsx"
DOWNLOAD_XLSX = ROOT / "downloads" / "dados.xlsx"
MANUAL_XLSX = ROOT / "data" / "manual" / "dados.xlsx"
HIST_DIR = ROOT / "data" / "historico"  # um snapshot de cada versão anterior da planilha

TERM = "Parque do Caracol"
GEO = "BR"
QUERY_START = "2023-01-01"    # histórico desde 2023
DISPLAY_START = "2023-01-01"  # primeiro mês exibido

# codigo: (nome exibido, consulta no Google Trends, é tema?)
# Consulta que começa com "/m/" ou "/g/" é um TEMA (ID do Knowledge Graph);
# qualquer outra coisa é um TERMO de pesquisa em texto.
PARQUE = ("PARQUE", "Parque do Caracol", "/g/120_fs71")  # tema: Parque estadual em Canela, RS
ATRACOES = {
    "SKYGLASS":  ("Skyglass",         "/g/11b6szk67v"),  # tema
    "SNOWLAND":  ("Snowland",         "/g/11bwgvhjpx"),  # tema
    "BONDINHOS": ("Bondinhos Canela", "/g/1tdhm_ck"),    # tema: Parque Bondinhos Aéreos Canela
    "CASCATA":   ("Pé da Cascata",    "/g/11r9dckt9t"),  # tema
}
ORDER = [PARQUE[0], *ATRACOES]
NAMES = {PARQUE[0]: PARQUE[1], **{c: v[0] for c, v in ATRACOES.items()}}
QUERY = {PARQUE[0]: PARQUE[2], **{c: v[1] for c, v in ATRACOES.items()}}


def is_topic(q: str) -> bool:
    return q.startswith(("/m/", "/g/"))


def client() -> TrendReq:
    # Sessão nova por consulta; retry interno do pytrends 4.9.2 quebra com urllib3 recente.
    return TrendReq(hl="pt-BR", tz=180)


def request_with_retry(fn, attempts=4):
    last = None
    for attempt in range(attempts):
        try:
            return fn()
        except Exception as exc:  # 429 / mudança de endpoint
            last = exc
            time.sleep(15 * (attempt + 1))
    raise RuntimeError(f"Google Trends indisponível após {attempts} tentativas: {last}")


def monthly_interest(codes: list[str]) -> pd.DataFrame:
    """Consulta `codes` JUNTOS e devolve mensal 0-100 (uma escala global), colunas = códigos."""
    queries = [QUERY[c] for c in codes]
    timeframe = f"{QUERY_START} {date.today().isoformat()}"

    def fetch():
        py = client()
        py.build_payload(queries, timeframe=timeframe, geo=GEO)
        return py.interest_over_time()

    raw = request_with_retry(fetch)
    if raw.empty:
        raise RuntimeError(f"Série vazia para {codes}")
    raw = raw.drop(columns=["isPartial"], errors="ignore")
    raw.index = pd.to_datetime(raw.index)
    raw = raw[raw.index >= pd.Timestamp(QUERY_START)]
    monthly = raw.resample("MS").mean()
    # descarta o mês corrente (incompleto)
    monthly = monthly[monthly.index < pd.Timestamp(date.today().replace(day=1))]
    maximum = monthly[queries].max().max()
    if pd.isna(maximum) or maximum <= 0:
        raise RuntimeError(f"Todas as séries vieram zeradas: {codes}")
    monthly[queries] = monthly[queries] * (100 / maximum)
    monthly = monthly[monthly.index >= pd.Timestamp(DISPLAY_START)]
    out = monthly[queries].round(1)
    out.columns = codes
    # valida: nenhuma série pode vir totalmente zerada (ID inválido / sem volume)
    for c in codes:
        if out[c].sum() == 0:
            raise RuntimeError(
                f"'{NAMES[c]}' ({QUERY[c]}) veio zerado. Confira o ID do tema / termo em ATRACOES."
            )
    return out


def long_rows(df: pd.DataFrame, scale: str) -> list[dict]:
    rows = []
    for code in df.columns:
        for dt, value in df[code].items():
            rows.append({
                "data": dt, "ano": dt.year, "mes_num": dt.month,
                "mes": dt.strftime("%b").title(), "mercado_codigo": code,
                "mercado": NAMES[code], "indice_trends": float(value),
                "termo_google_trends": QUERY[code],
                "tipo_consulta": "Tema" if is_topic(QUERY[code]) else "Termo",
                "escala": scale,
            })
    return rows


def read_old(sheet: str) -> pd.DataFrame:
    """Lê uma aba da última planilha publicada (vazio se não existir)."""
    if not DATA_XLSX.exists():
        return pd.DataFrame()
    try:
        df = pd.read_excel(DATA_XLSX, sheet_name=sheet)
        df["data"] = pd.to_datetime(df["data"])
        return df
    except Exception:
        return pd.DataFrame()


def collect():
    """Coleta os 5 itens sozinhos + os 5 juntos. Se uma consulta falhar, preserva
    o que já estava publicado para aquela parte e registra o status."""
    old_series, old_cmp = read_old("serie_mensal"), read_old("comparativo_parque")
    rows, status = [], []
    for code in ORDER:  # cada item sozinho
        try:
            rows += long_rows(monthly_interest([code]), "propria")
            status.append([code, NAMES[code], "sozinho", "atualizado"])
        except Exception as exc:
            prev = old_series[old_series["mercado_codigo"] == code] if not old_series.empty else pd.DataFrame()
            if prev.empty:
                raise RuntimeError(f"Sem coleta nem histórico para {NAMES[code]}: {exc}") from exc
            rows += prev.to_dict("records")
            status.append([code, NAMES[code], "sozinho", "PRESERVADO (coleta falhou)"])
            print(f"::warning::AVISO: {NAMES[code]} sem série nova; versão anterior preservada. Motivo: {exc}")
        time.sleep(3)
    series = pd.DataFrame(rows)
    try:  # os 5 juntos
        comparison = pd.DataFrame(long_rows(monthly_interest(ORDER), "comum_todos"))
        status.append(["TODOS", "Parque + 4 atrações", "juntos", "atualizado"])
    except Exception as exc:
        if old_cmp.empty:
            raise RuntimeError(f"Sem coleta nem histórico do comparativo: {exc}") from exc
        comparison = old_cmp
        status.append(["TODOS", "Parque + 4 atrações", "juntos", "PRESERVADO (coleta falhou)"])
        print(f"::warning::AVISO: comparativo sem série nova; versão anterior preservada. Motivo: {exc}")
    return series, comparison, status


LOW_VOLUME = 5  # média < 5 na escala conjunta (líder = 100) => baixo volume de busca


def seasonal_index(group: pd.DataFrame) -> pd.Series:
    """Cada ano dividido pela própria média; só anos completos (12 meses) entram."""
    full = group.groupby("ano").size()
    full = full[full >= 12].index
    base = group[group["ano"].isin(full)] if len(full) else group
    rel = base["indice_trends"] / base.groupby("ano")["indice_trends"].transform("mean")
    return rel.groupby(base["mes_num"]).mean()


def momentum_yoy(ordered: pd.DataFrame) -> tuple[float, float]:
    """Últimos 3 meses contra os MESMOS meses do ano anterior (neutraliza sazonalidade)."""
    last = ordered.tail(3)
    prev = ordered[ordered["data"].isin(last["data"] - pd.DateOffset(years=1))]
    if len(last) < 3 or len(prev) < 3:
        return np.nan, np.nan
    return last["indice_trends"].mean(), prev["indice_trends"].mean()


def detrended_cv(values) -> float:
    """Oscilação em torno da tendência linear, relativa à média."""
    y = np.asarray(values, dtype=float)
    if len(y) < 4 or y.mean() == 0:
        return np.nan
    t = np.arange(len(y))
    resid = y - np.polyval(np.polyfit(t, y, 1), t)
    return resid.std(ddof=1) / y.mean()


def derived_tables(series, comparison):
    latest = int(series["ano"].max())
    previous = latest - 1
    cmp_mean = comparison.groupby("mercado_codigo")["indice_trends"].mean()
    summaries, seasonal, peaks, dashboard = [], [], [], []
    for code, group in series.groupby("mercado_codigo", sort=False):
        market = group["mercado"].iloc[0]
        cur, prev = group[group.ano == latest], group[group.ano == previous]
        max_month = int(cur.mes_num.max()) if len(cur) else 12
        prev_eq = prev[prev.mes_num <= max_month]
        avg_cur, avg_prev = cur.indice_trends.mean(), prev_eq.indice_trends.mean()
        yoy = avg_cur / avg_prev - 1 if avg_prev else np.nan
        ordered = group.sort_values("data")
        recent, same_prev = momentum_yoy(ordered)
        momentum = recent / same_prev - 1 if same_prev else np.nan
        volatility = detrended_cv(ordered.indice_trends.values)
        volume = float(cmp_mean.get(code, np.nan))
        low = bool(volume < LOW_VOLUME) if not np.isnan(volume) else False
        status = ("Acelerando" if momentum > .025 else "Desacelerando" if momentum < -.025 else "Estável") \
            if pd.notna(momentum) else "Sem base"
        summaries.append([code, market, avg_prev, avg_cur, yoy, recent, same_prev, momentum, volatility, status, volume, low])
        idx = seasonal_index(group)
        seasonal.append([code, market] + [idx.get(m, np.nan) for m in range(1, 13)])
        best = int(idx.idxmax())
        dashboard.append([code, market, avg_cur, yoy, momentum, volatility, best, idx.get(best), low])
        for rank, (_, row) in enumerate(group.nlargest(5, "indice_trends").iterrows(), 1):
            peaks.append([code, market, rank, row.data, row.indice_trends, row.ano, row.mes])
    resumo = pd.DataFrame(summaries, columns=["mercado_codigo", "mercado", "media_anterior", "media_atual", "yoy_pct", "media_ultimos_3m", "media_mesmos_3m_ano_anterior", "momentum_yoy_pct", "volatilidade_sem_tendencia", "status_momentum", "volume_medio_escala_conjunta", "baixo_volume"])
    saz = pd.DataFrame(seasonal, columns=["mercado_codigo", "mercado", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"])
    picos = pd.DataFrame(peaks, columns=["mercado_codigo", "mercado", "rank_pico", "data", "indice_trends", "ano", "mes"])
    dash = pd.DataFrame(dashboard, columns=["mercado_codigo", "mercado", "media_atual", "yoy_pct", "momentum_yoy_pct", "volatilidade_sem_tendencia", "melhor_mes_num", "indice_melhor_mes", "baixo_volume"])
    return resumo, saz, picos, dash


def to_json_rows(df: pd.DataFrame) -> list[dict]:
    return [{"date": r.data.strftime("%Y-%m-%d"), "year": int(r.ano), "month": int(r.mes_num),
             "marketCode": r.mercado_codigo, "market": r.mercado, "value": float(r.indice_trends)}
            for r in df.itertuples()]


def write_outputs(series, comparison, status):
    updated = date.today().isoformat()
    old = read_old("serie_mensal")
    if not old.empty and len(series) < 0.9 * len(old):
        raise RuntimeError(
            f"Validação falhou: a nova série tem {len(series)} linhas e a publicada tem {len(old)}. "
            "Arquivos publicados preservados."
        )
    resumo, saz, picos, dash = derived_tables(series, comparison)
    DATA_XLSX.parent.mkdir(parents=True, exist_ok=True)
    DOWNLOAD_XLSX.parent.mkdir(parents=True, exist_ok=True)
    temp = DATA_XLSX.with_suffix(".tmp.xlsx")
    with pd.ExcelWriter(temp, engine="xlsxwriter", datetime_format="dd/mm/yyyy") as writer:
        series.to_excel(writer, sheet_name="serie_mensal", index=False)
        resumo.to_excel(writer, sheet_name="resumo_mercados", index=False)
        saz.to_excel(writer, sheet_name="sazonalidade", index=False)
        picos.to_excel(writer, sheet_name="picos", index=False)
        dash.to_excel(writer, sheet_name="dashboard_data", index=False)
        comparison.to_excel(writer, sheet_name="comparativo_parque", index=False)
        pd.DataFrame(status, columns=["codigo", "item", "consulta", "status"]).assign(
            data_execucao=updated).to_excel(writer, sheet_name="status_coleta", index=False)
    # a nova planilha já está pronta e válida: guarda a versão anterior antes de substituí-la
    if DATA_XLSX.exists():
        HIST_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(DATA_XLSX, HIST_DIR / f"dados_{updated}.xlsx")
    temp.replace(DATA_XLSX)
    shutil.copy2(DATA_XLSX, DOWNLOAD_XLSX)

    payload = {"series": to_json_rows(series), "term": TERM, "updated": updated}
    (ROOT / "data.js").write_text("window.TRENDS_DATA = " + json.dumps(payload, ensure_ascii=False, allow_nan=False) + ";\n", encoding="utf-8")
    cmp_payload = {"series": to_json_rows(comparison), "updated": updated,
                   "source": "Google Trends · Parque do Caracol × atrações (mesma consulta, escala comum)"}
    (ROOT / "comparison-data.js").write_text("window.CARACOL_COMPARISON_DATA = " + json.dumps(cmp_payload, ensure_ascii=False, allow_nan=False) + ";\n", encoding="utf-8")


def main():
    if MANUAL_XLSX.exists():
        shutil.copy2(MANUAL_XLSX, DATA_XLSX)
        shutil.copy2(MANUAL_XLSX, DOWNLOAD_XLSX)
        print("Base manual publicada; coleta automática ignorada.")
        return
    series, comparison, status = collect()
    if not any(st[3] == "atualizado" for st in status):
        raise RuntimeError("Nenhuma consulta funcionou nesta execução; arquivos publicados preservados.")
    if len(series) < 5 * 12 or comparison.empty:
        raise RuntimeError("Validação falhou; arquivos publicados foram preservados.")
    for code, query in QUERY.items():
        if not is_topic(query):
            print(f"AVISO: {NAMES[code]} está como TERMO ('{query}'), não como tema.")
    write_outputs(series, comparison, status)
    print(f"Atualização concluída em {date.today():%d/%m/%Y}: {len(series)} linhas + {len(comparison)} no comparativo.")


if __name__ == "__main__":
    main()

"""Atualiza o dashboard com Google Trends sem apagar a última base válida."""
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
TERM = "Pão de Açúcar"
COMPARE = ["Cristo Redentor", TERM]
START = "2024-01-01"
MARKETS = {
    "BR": ("Brasil", "BR"), "AR": ("Argentina", "AR"),
    "CL": ("Chile", "CL"), "CO": ("Colômbia", "CO"),
    "UY": ("Uruguai", "UY"), "US": ("Estados Unidos", "US"),
    "FR": ("França", "FR"), "WORLD": ("Mundo", ""),
}


def client() -> TrendReq:
     return TrendReq(hl="pt-BR", tz=180)


def request_with_retry(fn, attempts=4):
    last = None
    for attempt in range(attempts):
        try:
            return fn()
        except Exception as exc:  # pytrends pode devolver 429 ou mudar endpoints
            last = exc
            time.sleep(8 * (attempt + 1))
    raise RuntimeError(f"Google Trends indisponível após {attempts} tentativas: {last}")


def monthly_interest(py, terms, geo):
    timeframe = f"{START} {date.today().isoformat()}"
    def fetch():
        py.build_payload(terms, timeframe=timeframe, geo=geo)
        return py.interest_over_time()
    raw = request_with_retry(fetch)
    if raw.empty:
        raise RuntimeError(f"Série vazia para {geo or 'Mundo'}: {terms}")
    raw = raw.drop(columns=["isPartial"], errors="ignore")
    raw.index = pd.to_datetime(raw.index)
    return raw.resample("MS").mean().round().astype(int)


def collect_series(py):
    rows, comparison = [], []
    for code, (market, geo) in MARKETS.items():
        one = monthly_interest(py, [TERM], geo)
        for dt, value in one[TERM].items():
            rows.append({"data": dt, "ano": dt.year, "mes_num": dt.month,
                         "mes": dt.strftime("%b").title(), "mercado_codigo": code,
                         "mercado": market, "indice_trends": int(value),
                         "termo_google_trends": TERM})
        both = monthly_interest(py, COMPARE, geo)
        for dt, values in both.iterrows():
            comparison.append({"date": dt.strftime("%Y-%m-%d"), "year": dt.year,
                               "month": dt.month, "marketCode": code, "market": market,
                               "cristo": int(values[COMPARE[0]]), "bondinho": int(values[TERM])})
        time.sleep(2)
    return pd.DataFrame(rows), comparison


def collect_geo(py):
    def fetch():
        py.build_payload([TERM], timeframe=f"{date.today().year}-01-01 {date.today().isoformat()}")
        return py.interest_by_region(resolution="COUNTRY", inc_low_vol=True, inc_geo_code=False)
    raw = request_with_retry(fetch).reset_index()
    country_col = raw.columns[0]
    return pd.DataFrame({"pais": raw[country_col], "indice_trends_num": pd.to_numeric(raw[TERM], errors="coerce")})


def derived_tables(series):
    latest = int(series["ano"].max())
    previous = latest - 1
    summaries, seasonal, peaks, dashboard = [], [], [], []
    for code, group in series.groupby("mercado_codigo", sort=False):
        market = group["mercado"].iloc[0]
        cur, prev = group[group.ano == latest], group[group.ano == previous]
        max_month = int(cur.mes_num.max()) if len(cur) else 12
        prev_eq = prev[prev.mes_num <= max_month]
        avg_cur, avg_prev = cur.indice_trends.mean(), prev_eq.indice_trends.mean()
        yoy = avg_cur / avg_prev - 1 if avg_prev else np.nan
        ordered = group.sort_values("data")
        recent, before = ordered.tail(3).indice_trends.mean(), ordered.tail(6).head(3).indice_trends.mean()
        momentum = recent / before - 1 if before else np.nan
        volatility = ordered.indice_trends.std() / ordered.indice_trends.mean()
        summaries.append([code, market, avg_prev, avg_cur, yoy, recent, before, momentum, volatility,
                          "Acelerando" if momentum > .025 else "Desacelerando" if momentum < -.025 else "Estável"])
        monthly = group.groupby("mes_num").indice_trends.mean()
        idx = monthly / group.indice_trends.mean()
        seasonal.append([code, market] + [idx.get(m, np.nan) for m in range(1, 13)])
        best = int(idx.idxmax())
        dashboard.append([code, market, avg_cur, yoy, momentum, volatility, best, idx.get(best)])
        for rank, (_, row) in enumerate(group.nlargest(5, "indice_trends").iterrows(), 1):
            peaks.append([code, market, rank, row.data, row.indice_trends, row.ano, row.mes])
    resumo = pd.DataFrame(summaries, columns=["mercado_codigo","mercado","media_anterior","media_atual","yoy_pct","media_ultimos_3m","media_3m_anteriores","momentum_pct","volatilidade","status_momentum"])
    saz = pd.DataFrame(seasonal, columns=["mercado_codigo","mercado","Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"])
    picos = pd.DataFrame(peaks, columns=["mercado_codigo","mercado","rank_pico","data","indice_trends","ano","mes"])
    dash = pd.DataFrame(dashboard, columns=["mercado_codigo","mercado","media_atual","yoy_pct","momentum_pct","volatilidade","melhor_mes_num","indice_melhor_mes"])
    return resumo, saz, picos, dash


def write_outputs(series, geo, comparison):
    updated = date.today().isoformat()
    resumo, saz, picos, dash = derived_tables(series)
    geo = geo.copy()
    geo["indice_trends_exibicao"] = geo.indice_trends_num.fillna("")
    geo["termo_google_trends"], geo["ano"] = TERM, date.today().year
    old_hist = pd.DataFrame()
    if DATA_XLSX.exists():
        try: old_hist = pd.read_excel(DATA_XLSX, sheet_name="geo_historico")
        except Exception: pass
    snapshot = geo.assign(data_snapshot=pd.Timestamp(updated))[["data_snapshot","ano","pais","indice_trends_num","indice_trends_exibicao","termo_google_trends"]]
    history = pd.concat([old_hist, snapshot], ignore_index=True).drop_duplicates(["data_snapshot","pais"], keep="last")
    temp = DATA_XLSX.with_suffix(".tmp.xlsx")
    with pd.ExcelWriter(temp, engine="xlsxwriter", datetime_format="dd/mm/yyyy") as writer:
        series.to_excel(writer, "serie_mensal", index=False)
        resumo.to_excel(writer, "resumo_mercados", index=False)
        saz.to_excel(writer, "sazonalidade", index=False)
        picos.to_excel(writer, "picos", index=False)
        geo.to_excel(writer, f"geo_{date.today().year}", index=False)
        dash.to_excel(writer, "dashboard_data", index=False)
        history.to_excel(writer, "geo_historico", index=False)
        pd.DataFrame(comparison).to_excel(writer, "cristo_bondinho", index=False)
    temp.replace(DATA_XLSX)
    shutil.copy2(DATA_XLSX, DOWNLOAD_XLSX)
    series_json = [{"date": r.data.strftime("%Y-%m-%d"), "year": int(r.ano), "month": int(r.mes_num),
                    "marketCode": r.mercado_codigo, "market": r.mercado, "value": float(r.indice_trends)}
                   for r in series.itertuples()]
    geo_json = [{"country": r.pais, "value": None if pd.isna(r.indice_trends_num) else float(r.indice_trends_num),
                 "display": "" if pd.isna(r.indice_trends_num) else str(int(r.indice_trends_num))} for r in geo.itertuples()]
    hist_json = [{"date": pd.to_datetime(r.data_snapshot).strftime("%Y-%m-%d"), "country": r.pais,
                  "value": None if pd.isna(r.indice_trends_num) else float(r.indice_trends_num)} for r in history.itertuples()]
    payload = {"series": series_json, "geo2026": geo_json, "geoHistory": hist_json, "term": TERM, "updated": updated}
    (ROOT / "data.js").write_text("window.TRENDS_DATA = " + json.dumps(payload, ensure_ascii=False, allow_nan=False) + ";\n", encoding="utf-8")
    compare_payload = {"series": comparison, "updated": updated, "source": "Google Trends · comparação direta Cristo Redentor × Pão de Açúcar"}
    (ROOT / "comparison-data.js").write_text("window.ATTRACTION_TRENDS_DATA = " + json.dumps(compare_payload, ensure_ascii=False) + ";\n", encoding="utf-8")


def main():
    if MANUAL_XLSX.exists():
        shutil.copy2(MANUAL_XLSX, DATA_XLSX)
        shutil.copy2(MANUAL_XLSX, DOWNLOAD_XLSX)
        print("Base manual publicada; coleta automática ignorada.")
        return
    py = client()
    series, comparison = collect_series(py)
    geo = collect_geo(py)
    if len(series) < 100 or not comparison or geo.empty:
        raise RuntimeError("Validação falhou; arquivos publicados foram preservados.")
    write_outputs(series, geo, comparison)
    print(f"Atualização concluída em {date.today():%d/%m/%Y}.")


if __name__ == "__main__":
    main()

"""Konversi file Excel Data Pelayanan UPKD menjadi data.js untuk dashboard.

Pemakaian:
    pip install openpyxl
    python scripts/convert_excel.py "path/ke/Data Pelayanan UPKD.xlsx"
    python scripts/convert_excel.py "export-google-sheets.csv"   # juga bisa CSV

Hasil ditulis ke data.js di folder root dashboard.
"""
import csv
import json
import re
import sys
from datetime import datetime
from pathlib import Path


# Kolom (indeks 0-based) -> kategori. Header baris 1 = grup, baris 2 = nama indikator.
GROUPS = [
    ("penduduk", "Jumlah Penduduk", 2, 4),
    ("spm", "Capaian Pelayanan Kesehatan (SPM)", 5, 16),
    ("pmt", "Pemberian PMT", 17, 20),
    ("upkd", "Pelayanan di UPKD & Puskesmas", 21, 38),
]
PERCENT_HINT = ("PERSENTASE", "ANGKA BEBAS JENTIK")


def clean(s):
    return " ".join(str(s).split()) if s is not None else ""


def num_id(s):
    """Angka format Indonesia di CSV: '3.003' -> 3003, '54,1' -> 54.1."""
    s = clean(s).rstrip("%")
    if not re.fullmatch(r"-?[\d.,]+", s):
        return s or None
    v = float(s.replace(".", "").replace(",", "."))
    return int(v) if v.is_integer() else v


def read_rows(path):
    if str(path).lower().endswith(".csv"):
        with open(path, encoding="utf-8-sig", newline="") as f:
            rows = [[num_id(c) for c in r] for r in csv.reader(f)]
        width = max(len(r) for r in rows)
        return [r + [None] * (width - len(r)) for r in rows]
    import openpyxl
    wb = openpyxl.load_workbook(path, data_only=True)
    return [list(r) for r in wb.worksheets[0].iter_rows(values_only=True)]


def main(path):
    rows = read_rows(path)
    header = [clean(h) if h is not None else "" for h in rows[1]]

    indicators = []
    for key, label, start, end in GROUPS:
        for c in range(start, end + 1):
            name = clean(header[c])
            if key == "penduduk" and name.lower() == "total":
                name = "Total Penduduk"
            if not name:
                continue
            indicators.append({
                "id": f"{key}_{c}",
                "col": c,
                "category": key,
                "name": name,
                "percent": any(h in name.upper() for h in PERCENT_HINT),
            })

    villages, compare = [], {}
    for r in rows[2:]:
        first = clean(r[0]).upper()
        if isinstance(r[0], (int, float)) and r[1]:
            villages.append({
                "no": int(r[0]),
                "name": clean(r[1]).title(),
                "values": {i["id"]: r[i["col"]] for i in indicators},
            })
        elif first == "TARGET":
            # baris target: pembagi untuk % capaian & kontribusi desa
            for i in indicators:
                v = r[i["col"]]
                if isinstance(v, (int, float)) and v:
                    i["target"] = v
        elif first.startswith("DATA SPM"):
            compare = {
                "label": clean(r[0]).title(),
                "values": {i["id"]: r[i["col"]] for i in indicators
                           if i["category"] == "spm" and r[i["col"]] is not None},
            }

    for i in indicators:
        i.pop("col")

    data = {
        "title": "Data Pelayanan UPKD",
        "subtitle": "PKM Panumbangan",
        "period": "s.d. November 2026",
        "source": Path(path).name,
        "generated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "categories": [{"id": k, "label": l} for k, l, _, _ in GROUPS],
        "indicators": indicators,
        "villages": villages,
        "compare": compare,
    }
    out = Path(__file__).resolve().parent.parent / "data.js"
    out.write_text("window.UPKD_DATA = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n",
                   encoding="utf-8")
    print(f"OK: {len(villages)} desa, {len(indicators)} indikator -> {out}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])

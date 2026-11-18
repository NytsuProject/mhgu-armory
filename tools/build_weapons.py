#!/usr/bin/env python3
"""build_weapons.py — genera data/weapons/*.json y data/weapon-categories.json.

Fuentes (solo lectura):
  - research/mhgu-collection-tracker/docs/data/{catalog.js, stats/<slug>.json,
    materials/<slug>.json (solo `parents`, para linaje)}  [MIT código; datos Kiranico/mhgu.db]
  - research/MHGUDB-iOS/MHGUDB/Assets/databases/mhgu.db   [MIT] nombres ES/JA y parent_id
  - research/mhgu-collection-tracker/docs/data/hh_songs.json (melodías de cornamusa)

No inventa datos: lo que no casa con mhgu.db queda nEs=null y se marca en el resumen.
Uso: python -X utf8 tools/build_weapons.py
"""
import json
import re
import sqlite3
import struct
import sys
from pathlib import Path

from build_armor import cat_to_monster, material_monsters, load_monsters

ROOT = Path(__file__).resolve().parent.parent          # MHGU-ARMORY/
RESEARCH = ROOT.parent / "research"
TRACKER = RESEARCH / "mhgu-collection-tracker" / "docs" / "data"
DB = RESEARCH / "MHGUDB-iOS" / "MHGUDB" / "Assets" / "databases" / "mhgu.db"
GAME_TABLE = Path("C:/GU/Windows-MHGURecomp/data/romfs/nativeNX/table")
OUT = ROOT / "data"

# orden interno de clases del juego -> tabla weaponProcessW<NN>.wpd (verificado por nº de niveles)
WEAPON_TABLE = {
    "great_sword": "00", "sword_and_shield": "01", "hammer": "02", "lance": "03",
    "heavy_bowgun": "04", "light_bowgun": "06", "long_sword": "07", "switch_axe": "08",
    "gunlance": "09", "bow": "10", "dual_blades": "11", "hunting_horn": "12",
    "insect_glaive": "13", "charge_blade": "14",
}

# slug -> (archivo salida, wtype en mhgu.db, etiqueta ES)
CLASSES = {
    "great_sword":      ("great-sword.json",      "Great Sword",      "Gran espada"),
    "long_sword":       ("long-sword.json",       "Long Sword",       "Espada larga"),
    "sword_and_shield": ("sword-and-shield.json", "Sword and Shield", "Espada y escudo"),
    "dual_blades":      ("dual-blades.json",      "Dual Blades",      "Espadas dobles"),
    "hammer":           ("hammer.json",           "Hammer",           "Martillo"),
    "hunting_horn":     ("hunting-horn.json",     "Hunting Horn",     "Cornamusa"),
    "lance":            ("lance.json",            "Lance",            "Lanza"),
    "gunlance":         ("gunlance.json",         "Gunlance",         "Lanza pistola"),
    "switch_axe":       ("switch-axe.json",       "Switch Axe",       "Hacha espada"),
    "charge_blade":     ("charge-blade.json",     "Charge Blade",     "Hacha cargada"),
    "insect_glaive":    ("insect-glaive.json",    "Insect Glaive",    "Glaive insecto"),
    "light_bowgun":     ("light-bowgun.json",     "Light Bowgun",     "Ballesta ligera"),
    "heavy_bowgun":     ("heavy-bowgun.json",     "Heavy Bowgun",     "Ballesta pesada"),
    "bow":              ("bow.json",              "Bow",              "Arco"),
}

ELEMENTS_ES = {
    "Fire": "Fuego", "Water": "Agua", "Thunder": "Rayo", "Ice": "Hielo",
    "Dragon": "Dragón", "Poison": "Veneno", "Paralysis": "Parálisis",
    "Sleep": "Sueño", "Blast": "Explosión",
}


def load_catalog():
    text = (TRACKER / "catalog.js").read_text(encoding="utf-8")
    m = re.search(r"window\.CATALOG\s*=\s*", text)
    return json.loads(text[m.end():].rstrip().rstrip(";"))


def load_db_names():
    """wtype -> {nombre_en_lower: [filas]}; fila = (id, name, name_es, name_ja, parent_id)."""
    con = sqlite3.connect(f"file:{DB.as_posix()}?mode=ro", uri=True)
    cur = con.cursor()
    rows = cur.execute(
        "SELECT i._id, i.name, i.name_es, i.name_ja, w.parent_id, w.wtype "
        "FROM items i JOIN weapons w ON w._id = i._id"
    ).fetchall()
    con.close()
    by_type = {}
    for _id, name, es, ja, parent, wtype in rows:
        by_type.setdefault(wtype, {}).setdefault(name.lower(), []).append(
            {"id": _id, "name": name, "es": es, "ja": ja, "parent": parent}
        )
    return by_type


def strip_suffix(name, lv):
    suf = f" {lv}"
    return name[: -len(suf)] if name.endswith(suf) else name


def tree_monsters(slug, trees, mats, item_names, monsters):
    """Monstruo de origen por árbol. Primario: categoría de puntos de material de
    weaponProcessW<NN>.wpd (@16 u16 -> item (30<<16)|N del juego). Fallback DERIVED
    (solo si el árbol no tiene ninguna categoría de monstruo): nombres de material
    del tracker que contienen el nombre del monstruo (misma regla que armaduras)."""
    b = (GAME_TABLE / f"weaponProcessW{WEAPON_TABLE[slug]}.wpd").read_bytes()
    count = struct.unpack_from("<I", b, 4)[0]
    cats = {}
    for i in range(count):
        r = b[8 + i * 32: 8 + (i + 1) * 32]
        tid, _lv = struct.unpack_from("<HH", r, 0)
        n = struct.unpack_from("<H", r, 16)[0]
        if not n:
            continue
        nm = item_names.get((30 << 16) | n)
        if not nm:
            continue
        mid = cat_to_monster(nm[0], monsters)
        if mid:
            cats.setdefault(tid, set()).add(mid)
    mat_names, by_id, create = mats["mats"], mats["byId"], mats.get("create", {})
    mon_by_id = {m["id"]: m for m in monsters}

    def collect(node, names):
        if isinstance(node, dict):
            for v in node.values():
                collect(v, names)
        elif isinstance(node, list):
            if len(node) >= 2 and isinstance(node[0], int) and isinstance(node[1], int):
                if node[0] < len(mat_names):
                    names.add(mat_names[node[0]])
            else:
                for v in node:
                    collect(v, names)

    out = {}
    for t in trees:
        tid = t["id"]
        mids = set(cats.get(tid, ()))
        if not mids:
            names = set()
            collect(by_id.get(str(tid), {}), names)
            collect(create.get(str(tid), {}), names)
            fake = {nm: (nm, None, None) for nm in names}
            mids = material_monsters(names, fake, monsters)
        out[tid] = (sorted(mids), any(mon_by_id[i]["deviant"] for i in mids))
    return out


def build_class(slug, catalog, db_names, monsters, item_names):
    fname, wtype, label_es = CLASSES[slug]
    entries = catalog["weapons"][slug]["entries"]
    stats = json.loads((TRACKER / "stats" / f"{slug}.json").read_text(encoding="utf-8"))["byId"]
    mats = json.loads((TRACKER / "materials" / f"{slug}.json").read_text(encoding="utf-8"))
    parents = {int(k): v for k, v in mats["parents"].items()}
    dbidx = db_names.get(wtype, {})

    trees = []
    matched = {}   # (treeId, lv) -> fila db
    report = {"levels": 0, "esMatched": 0, "lineageOk": 0, "lineageBad": 0,
              "noEs": [], "lineageIssues": []}

    # orden de proceso: padres antes que hijos (los padres siempre tienen id menor
    # no garantizado; resolvemos por dependencias)
    entry_by_id = {e[0]: e for e in entries}
    pending = list(entry_by_id)
    done = set()
    order = []
    while pending:
        progressed = False
        for tid in list(pending):
            par = parents.get(tid)
            if par is None or par[0] in done:
                order.append(tid)
                done.add(tid)
                pending.remove(tid)
                progressed = True
        if not progressed:
            raise RuntimeError(f"{slug}: ciclo de linaje en {pending}")

    for tid in order:
        e = entry_by_id[tid]
        _id, display_name, rarity, final_name, max_level, stages, game_order, _mask, _fs, _cf = e
        levels_raw = stats.get(str(tid), [])
        par = parents.get(tid)
        levels = []
        prev_db = None
        tree_es_hits = 0
        for lv_obj in levels_raw:
            lv = lv_obj["lv"]
            name = lv_obj["n"]
            report["levels"] += 1
            key = f"{name} {lv}".lower()
            cands = dbidx.get(key, [])
            row = None
            if len(cands) == 1:
                row = cands[0]
            elif len(cands) > 1:
                # desambiguar por linaje: el padre en db debe coincidir con el nivel anterior
                expect = prev_db["id"] if prev_db else None
                filtered = [c for c in cands if c["parent"] == expect]
                if len(filtered) == 1:
                    row = filtered[0]
            if row:
                matched[(tid, lv)] = row
                report["esMatched"] += 1
                tree_es_hits += 1
                # verificación de linaje contra parent_id de mhgu.db
                if lv > 1:
                    expect = prev_db["id"] if prev_db else None
                elif par:
                    prow = matched.get((par[0], par[1]))
                    expect = prow["id"] if prow else None
                else:
                    expect = 0
                if expect is None:
                    pass  # sin evidencia suficiente; no se marca error
                elif row["parent"] == expect:
                    report["lineageOk"] += 1
                else:
                    report["lineageBad"] += 1
                    report["lineageIssues"].append(
                        {"tree": tid, "lv": lv, "name": name,
                         "dbParent": row["parent"], "expected": expect})
                prev_db = row
            else:
                report["noEs"].append({"tree": tid, "lv": lv, "name": name})
                prev_db = None

            out_lv = {"lv": lv, "n": name}
            if row:
                out_lv["nEs"] = strip_suffix(row["es"], lv) if row["es"] else None
                if row["ja"]:
                    out_lv["nJa"] = strip_suffix(row["ja"], lv)
            else:
                out_lv["nEs"] = None
            for k_src, k_dst in (("raw", "raw"), ("aff", "aff"), ("def", "def"),
                                 ("slots", "slots"), ("rar", "rar")):
                if k_src in lv_obj:
                    out_lv[k_dst] = lv_obj[k_src]
            if lv_obj.get("ele"):
                out_lv["ele"] = [
                    [ELEMENTS_ES.get(el[0], el[0]), el[0]] + el[1:]
                    for el in lv_obj["ele"]
                ]
            if lv_obj.get("sh"):
                out_lv["sh"] = lv_obj["sh"]
            if lv_obj.get("x"):
                out_lv["x"] = lv_obj["x"]
            levels.append(out_lv)

        name_es = None
        first = next((l for l in levels if l.get("nEs")), None)
        if first:
            name_es = first["nEs"]
        final_es = None
        if levels and levels[-1].get("nEs"):
            final_es = levels[-1]["nEs"]
        es_status = ("VERIFIED" if tree_es_hits == len(levels) and levels
                     else "PARTIAL" if tree_es_hits else "MISSING")
        trees.append({
            "id": tid, "name": display_name, "nameEs": name_es,
            "rarity": rarity, "order": game_order,
            "finalName": final_name or None, "finalNameEs": final_es,
            "maxLevel": max_level, "stages": stages,
            "parent": par, "levels": levels, "es": es_status,
            "dummy": "(DUMMY)" in display_name,
        })

    trees.sort(key=lambda t: t["order"] or t["id"])
    tm = tree_monsters(slug, trees, mats, item_names, monsters)
    for t in trees:
        mids, dev = tm[t["id"]]
        t["monsters"] = mids
        t["deviant"] = dev
    report["treesWithMonster"] = sum(1 for t in trees if t["monsters"])
    result = {
        "class": slug, "label": catalog["weapons"][slug]["label"], "labelEs": label_es,
        "trees": trees,
        "provenance": {
            "stats": "mhgu-collection-tracker docs/data (Kiranico, MIT code)",
            "lineage": "mhgu-collection-tracker materials.parents + mhgu.db weapons.parent_id",
            "namesEsJa": "mhgu.db items (MIT, gatheringhallstudios/MHGenDatabase)",
            "elementsEs": "traducción estándar MH (DERIVED)",
            "monsters": "categorías de puntos de weaponProcessW<NN>.wpd del juego (autoritativo); "
                        "fallback DERIVED por nombres de material del tracker",
        },
    }
    if slug == "hunting_horn":
        songs = json.loads((TRACKER / "hh_songs.json").read_text(encoding="utf-8"))
        con = sqlite3.connect(f"file:{DB.as_posix()}?mode=ro", uri=True)
        mel = {(r[0], r[1]): (r[2], r[3], r[4]) for r in con.execute(
            "SELECT notes, song, name_es, effect1_es, effect2_es FROM horn_melodies")}
        con.close()
        matched = 0
        for code, lst in songs.items():
            for s in lst:
                m = mel.get((code, s["s"]))
                if m:
                    s["ne"] = m[0]
                    s["ee"] = [e for e in (m[1], m[2]) if e]
                    matched += 1
        result["songs"] = songs
        report["songsEsMatched"] = matched
    (OUT / "weapons" / fname).write_text(
        json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return result, report


def main():
    catalog = load_catalog()
    db_names = load_db_names()
    con = sqlite3.connect(f"file:{DB.as_posix()}?mode=ro", uri=True)
    cur = con.cursor()
    monsters = load_monsters(cur)
    item_names = {r[0]: (r[1], r[2], r[3]) for r in cur.execute(
        "SELECT _id, name, name_es, name_ja FROM items")}
    con.close()
    (OUT / "weapons").mkdir(parents=True, exist_ok=True)
    categories = []
    full_report = {}
    for slug, (fname, wtype, label_es) in CLASSES.items():
        result, report = build_class(slug, catalog, db_names, monsters, item_names)
        full_report[slug] = report
        n_trees = len(result["trees"])
        categories.append({
            "slug": slug, "file": f"weapons/{fname}",
            "label": result["label"], "labelEs": label_es,
            "trees": n_trees, "levels": report["levels"],
        })
        print(f"{slug:18s} trees={n_trees:4d} levels={report['levels']:4d} "
              f"es={report['esMatched']:4d} lineageOk={report['lineageOk']:4d} "
              f"lineageBad={report['lineageBad']:3d} noEs={len(report['noEs']):3d} "
              f"mon={report['treesWithMonster']:4d}")
    (OUT / "weapon-categories.json").write_text(
        json.dumps({"classes": categories}, ensure_ascii=False, indent=1), encoding="utf-8")
    tools_out = ROOT / "tools" / "out"
    tools_out.mkdir(exist_ok=True)
    (tools_out / "weapons_build_report.json").write_text(
        json.dumps(full_report, ensure_ascii=False, indent=1), encoding="utf-8")
    tot = sum(r["levels"] for r in full_report.values())
    es = sum(r["esMatched"] for r in full_report.values())
    bad = sum(r["lineageBad"] for r in full_report.values())
    mon = sum(r["treesWithMonster"] for r in full_report.values())
    trees = sum(len(json.loads((OUT / "weapons" / f).read_text(encoding="utf-8"))["trees"])
                for f, _w, _l in CLASSES.values())
    print(f"TOTAL levels={tot} esMatched={es} ({es/tot:.1%}) lineageBad={bad} "
          f"treesWithMonster={mon}/{trees}")


if __name__ == "__main__":
    sys.exit(main())
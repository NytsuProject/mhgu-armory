#!/usr/bin/env python3
"""build_search_index.py — genera data/search-index.json para el buscador global.

Entradas: data/weapons/*.json, data/armor/{sets,pieces}.json, mhgu.db (monstruos).
Uso: python -X utf8 tools/build_search_index.py
"""
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT.parent / "research" / "MHGUDB-iOS" / "MHGUDB" / "Assets" / "databases" / "mhgu.db"


def main():
    weapons = []
    for f in sorted((ROOT / "data" / "weapons").glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        for t in d["trees"]:
            es, en = [], []
            for l in t["levels"]:
                if l.get("nEs") and l["nEs"] not in es:
                    es.append(l["nEs"])
                if l["n"] not in en:
                    en.append(l["n"])
            weapons.append({"t": "w", "c": d["class"], "id": t["id"],
                            "e": es, "n": en, "r": t["levels"][-1]["rar"],
                            "d": 1 if t.get("dummy") else 0})
    sets = json.loads((ROOT / "data" / "armor" / "sets.json").read_text(encoding="utf-8"))["sets"]
    armor_sets = [{"t": "a", "id": s["id"], "n": s["name"], "e": s["nameEs"],
                   "r": s["rarity"]} for s in sets]
    pieces = json.loads((ROOT / "data" / "armor" / "pieces.json").read_text(encoding="utf-8"))["pieces"]
    armor_pieces = [{"t": "p", "s": p["slot"], "id": p["sid"], "n": p["name"],
                     "e": p["nameEs"], "f": p["family"], "r": p["rarity"]} for p in pieces]
    con = sqlite3.connect(f"file:{DB.as_posix()}?mode=ro", uri=True)
    monsters = [{"t": "m", "id": r[0], "n": r[1], "e": r[2]}
                for r in con.execute("SELECT _id, name, name_es FROM monsters ORDER BY name")]
    con.close()
    out = {"weapons": weapons, "sets": armor_sets, "pieces": armor_pieces,
           "monsters": monsters}
    (ROOT / "data" / "search-index.json").write_text(
        json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("weapons", len(weapons), "sets", len(armor_sets),
          "pieces", len(armor_pieces), "monsters", len(monsters))


if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""build_armor.py — genera data/armor/pieces.json y data/armor/sets.json.

Fuentes (solo lectura):
  - research/mhgu-collection-tracker/docs/data/catalog.js (entradas armor)
  - research/mhgu-collection-tracker/docs/data/stats/armor_<slot>.json (stats del juego)
  - research/MHGUDB-iOS/.../mhgu.db (MIT): armor_families (conjuntos), items (nombres),
    skill_trees (habilidades ES)
  - Juego del usuario (fuente autoritativa, solo lectura):
      C:/GU/Windows-MHGURecomp/data/romfs/nativeNX/spa/table/armorSeriesData_spa.gmd
        -> nombres oficiales ES de piezas y existencia
      .../nativeNX/table/armorSeriesData.asd + armorBuildData.abd
        -> verificación independiente de stats (layout documentado en
           mhgu-collection-tracker/scripts/build-armor-data.mjs, MIT)

Rangos (DERIVED con evidencia): rareza 1-3 = LR, 4-7 = HR (sets S), 8-11 = G (sets X/GX/deviantes).
Uso: python -X utf8 tools/build_armor.py
"""
import json
import re
import sqlite3
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESEARCH = ROOT.parent / "research"
TRACKER = RESEARCH / "mhgu-collection-tracker" / "docs" / "data"
DB = RESEARCH / "MHGUDB-iOS" / "MHGUDB" / "Assets" / "databases" / "mhgu.db"
GAME_TABLE = Path("C:/GU/Windows-MHGURecomp/data/romfs/nativeNX/table")
GAME_SPA = Path("C:/GU/Windows-MHGURecomp/data/romfs/nativeNX/spa/table")
OUT = ROOT / "data" / "armor"

SLOTS = ["head", "chest", "arms", "waist", "legs"]
SLOT_ES = {"head": "Casco", "chest": "Pechera", "arms": "Brazales",
           "waist": "Faja", "legs": "Grebas"}
SLOT_HI = {"head": 20, "chest": 21, "arms": 22, "waist": 23, "legs": 24}
DB_SLOT = {"head": "Head", "chest": "Body", "arms": "Arms", "waist": "Waist", "legs": "Legs"}
EMPTY_ES = "(Ninguna)"
RES_ES = ["Fuego", "Agua", "Rayo", "Hielo", "Dragón"]


def rank_of(rarity):
    if rarity <= 3:
        return "LR"
    if rarity <= 7:
        return "HR"
    return "G"


def load_catalog():
    text = (TRACKER / "catalog.js").read_text(encoding="utf-8")
    m = re.search(r"window\.CATALOG\s*=\s*", text)
    return json.loads(text[m.end():].rstrip().rstrip(";"))


def gmd_strings(path):
    b = path.read_bytes()
    assert b[:4] == b"GMD\0", f"{path}: no es GMD"
    n = struct.unpack_from("<I", b, 0x24)[0]
    off = 0x28 + n + 1
    parts = b[off:].decode("utf-8").split("\0")
    if parts and parts[-1] == "":
        parts.pop()
    return parts


def s8(v):
    return v - 256 if v > 127 else v


def read_table(name, rec_size):
    b = (GAME_TABLE / name).read_bytes()
    count = struct.unpack_from("<I", b, 4)[0]
    assert len(b) - 8 == count * rec_size, f"{name}: tamaño inesperado"
    return count, b


def game_series():
    """Decodifica armorSeriesData.asd del juego del usuario (verificación independiente)."""
    count, b = read_table("armorSeriesData.asd", 127)
    bcount, bb = read_table("armorBuildData.abd", 20)
    curves = []
    for i in range(bcount):
        rec = bb[8 + i * 20: 8 + (i + 1) * 20]
        curves.append([v for v in rec if v])
    out = {}
    for i in range(count):
        r = b[8 + i * 127: 8 + (i + 1) * 127]
        sid = struct.unpack_from("<H", r, 0)[0]
        if sid != i:
            continue
        curve = curves[r[107]] if r[107] < len(curves) else []
        base = r[106]
        skills = []
        for si in range(5):
            sk = []
            for k in range(5):
                off = 28 + si * 15 + k * 3
                skid = struct.unpack_from("<H", r, off)[0]
                pts = s8(r[off + 2])
                if skid:
                    sk.append((skid, pts))
            skills.append(sk)
        out[sid] = {
            "rarity": r[103] + 1,
            "male": bool(r[13]), "female": bool(r[14]),
            "blademaster": bool(r[15]), "gunner": bool(r[16]),
            "res": [s8(r[o]) for o in (23, 24, 25, 26, 27)],
            "def": base, "maxDef": base + sum(curve),
            "slots": [r[108 + si] for si in range(5)],
            "skills": skills,
        }
    return out


CAT_ALIAS = {"S.Rathalos": "Silver Rathalos", "S. Magala": "Shagaru Magala",
             "Fatalis (Crimson)": "Crimson Fatalis", "Fatalis (Old)": "Old Fatalis",
             "Rathian (Any)": "Rathian", "Rathalos (Any)": "Rathalos"}
CAT_GENERIC = {"Monster", "Ore", "Insect", "Bone", "Hyper", "Deviant", "Herbivore",
               "Neopteron", "Bird Wyvern", "Rath", "Rath (Rare)"}


def load_monsters(cur):
    return [{"id": r[0], "name": r[1], "nameEs": r[2], "deviant": r[3] == "2"}
            for r in cur.execute("SELECT _id, name, name_es, class FROM monsters")]


def series_categories():
    """Categorías de puntos de material por serie (armorProcessA00.apd @22 + recetas)."""
    cats = {}

    def add(sid, cat):
        if sid and cat:
            cats.setdefault(sid, set()).add(cat)

    count, b = read_table("armorProcessA00.apd", 38)
    for i in range(count):
        r = b[8 + i * 38: 8 + (i + 1) * 38]
        s0, s1 = struct.unpack_from("<HH", r, 0)
        cat = struct.unpack_from("<H", r, 22)[0]
        add(s0, cat)
        add(s1, cat)
    for slot in range(5):
        count, b = read_table(f"armorCreateA0{slot}.acrd", 42)
        for i in range(count):
            r = b[8 + i * 42: 8 + (i + 1) * 42]
            sids = struct.unpack_from("<HHHH", r, 0)
            for k in range(7):
                it, _q, _key = struct.unpack_from("<HBB", r, 10 + k * 4)
                if it >> 16 == 30:
                    for sid in sids:
                        add(sid, it & 0xFFFF)
    return cats


def create_materials():
    mats = {}
    count, b = read_table("armorProcessA00.apd", 38)
    for i in range(count):
        r = b[8 + i * 38: 8 + (i + 1) * 38]
        s0, s1 = struct.unpack_from("<HH", r, 0)
        for off in (10, 13, 16, 19, 26, 29, 32, 35):
            it, _q = struct.unpack_from("<HB", r, off)
            if it and it >> 16 != 30:
                for sid in (s0, s1):
                    if sid:
                        mats.setdefault(sid, set()).add(it)
    for slot in range(5):
        count, b = read_table(f"armorCreateA0{slot}.acrd", 42)
        for i in range(count):
            r = b[8 + i * 42: 8 + (i + 1) * 42]
            sids = struct.unpack_from("<HHHH", r, 0)
            for k in range(7):
                it, _q, _key = struct.unpack_from("<HBB", r, 10 + k * 4)
                if it and it >> 16 != 30:
                    for sid in sids:
                        if sid:
                            mats.setdefault(sid, set()).add(it)
    return mats


def cat_to_monster(cat_name, monsters):
    core = re.sub(r"^(LR|HR|G) ", "", cat_name).replace(" Materials", "")
    if core in CAT_GENERIC:
        return None
    core = CAT_ALIAS.get(core, core)
    for m in monsters:
        if m["name"] == core:
            return m["id"]
    cand = [m for m in monsters if m["name"].startswith(core + " ")]
    return cand[0]["id"] if len(cand) == 1 else None


def material_monsters(ids, item_names, monsters):
    """Fallback DERIVED: nombres de materiales de la receta contienen el nombre del monstruo."""
    hits = set()
    for it in ids:
        nm = item_names.get(it)
        if not nm:
            continue
        texts = [nm[0], nm[1]]
        local = []
        for m in monsters:
            stem = m["name"].rsplit(" ", 1)[0] if " " in m["name"] else None
            if stem and "-" not in stem:
                stem = None
            if any(t and (m["name"] in t or (m["nameEs"] and m["nameEs"] in t)
                          or (stem and stem in t)) for t in texts):
                local.append(m)
            elif m["deviant"] and any(t and m["name"].split(" ")[0] in t for t in texts):
                local.append(m)
        for m in local:
            if not any(o is not m and m["name"] in o["name"] for o in local):
                hits.add(m["id"])
    return hits


def derive_set_es(piece_names):
    """Nombre ES de conjunto DERIVADO: secuencia común de tokens de las piezas ES oficiales."""
    names = [n for n in piece_names if n and n != EMPTY_ES]
    if not names:
        return None
    tokenized = [re.findall(r"[\wÁÉÍÓÚÜÑáéíóúüñ]+", n.lower()) for n in names]
    first = tokenized[0]
    best = []
    for i in range(len(first)):
        for j in range(i + 1, len(first) + 1):
            seq = first[i:j]
            if all(any(t[k:k + len(seq)] == seq for k in range(len(t) - len(seq) + 1))
                   for t in tokenized[1:]):
                if len(seq) > len(best):
                    best = seq
    if not best:
        return None
    while best and best[0] in ("de", "del", "la", "el", "los", "las"):
        best = best[1:]
    if not best:
        return None
    return " ".join(best).capitalize()


def main():
    catalog = load_catalog()
    con = sqlite3.connect(f"file:{DB.as_posix()}?mode=ro", uri=True)
    cur = con.cursor()
    item_names = {r[0]: (r[1], r[2], r[3]) for r in cur.execute(
        "SELECT _id, name, name_es, name_ja FROM items")}
    skill_es = {r[0]: r[1] for r in cur.execute(
        "SELECT name, name_es FROM skill_trees")}
    skill_by_id = {r[0]: r[1] for r in cur.execute(
        "SELECT _id, name FROM skill_trees")}
    families = cur.execute(
        "SELECT _id, name, rarity, head_id, body_id, arms_id, waist_id, legs_id "
        "FROM armor_families").fetchall()
    db_armor = {r[0]: r for r in cur.execute(
        "SELECT _id, slot, gender, hunter_type, num_slots, family FROM armor")}
    monsters = load_monsters(cur)
    con.close()

    spa = gmd_strings(GAME_SPA / "armorSeriesData_spa.gmd")
    assert len(spa) == 12870, f"GMD spa: {len(spa)} strings"
    gseries = game_series()

    report = {"pieces": 0, "gameVerified": 0, "gameMismatch": [], "esFromGame": 0,
              "esFromDb": 0, "esMissing": 0, "genderOverride": [], "dbGenderMismatch": [],
              "sets": 0, "setsIncomplete": 0, "gmdEmpty": 0, "unreleased": 0}
    cats = series_categories()
    cmats = create_materials()
    mon_by_id = {m["id"]: m for m in monsters}
    series_monsters = {}
    report["catUnmatched"] = []
    for sid, cs in cats.items():
        ids = set()
        for c in cs:
            nm = item_names.get((30 << 16) | c)
            mid = cat_to_monster(nm[0], monsters) if nm else None
            if mid:
                ids.add(mid)
            elif nm:
                core = re.sub(r"^(LR|HR|G) ", "", nm[0]).replace(" Materials", "")
                if core not in CAT_GENERIC and core not in CAT_ALIAS:
                    report["catUnmatched"].append({"sid": sid, "cat": nm[0]})
        series_monsters[sid] = ids
    report["setsNoMonster"] = []
    pieces = []
    piece_key = {}   # (slot, sid) -> pieza
    unreleased = []

    for si, slot in enumerate(SLOTS):
        stats = json.loads((TRACKER / "stats" / f"armor_{slot}.json").read_text(encoding="utf-8"))["byId"]
        entries = catalog["armor"][slot]["entries"]
        cat_ids = {e[0] for e in entries}
        # piezas presentes en tablas del juego pero ausentes del catálogo publicado:
        # placeholders DUMMY y variantes no publicadas (p.ej. Gammoth femenino).
        for k in sorted(stats, key=int):
            sid = int(k)
            if sid in cat_ids:
                continue
            st = stats[k]
            g = gseries.get(sid)
            spa_name = spa[sid * 10 + si] if sid * 10 + si < len(spa) else None
            reason = "DUMMY (placeholder del juego)" if (spa_name or "").upper() == "DUMMY" \
                else ("hueco vacío" if spa_name in (None, EMPTY_ES) else "variante no publicada")
            u = {"slot": slot, "sid": sid, "nameEs": spa_name, "reason": reason,
                 "rarity": st["rar"], "def": st["def"], "res": st["res"],
                 "deco": st["slots"], "sk": st["sk"], "rank": rank_of(st["rar"])}
            if g:
                u["gameGender"] = 2 if (g["male"] and g["female"]) else (0 if g["male"] else 1)
                u["cls"] = "A" if (g["blademaster"] and g["gunner"]) else ("G" if g["gunner"] else "B")
                u["v"] = "VERIFIED" if (st["rar"] == g["rarity"] and st["def"][0] == g["def"]
                                        and st["res"] == g["res"]) else "UNVERIFIED"
            else:
                u["v"] = "UNVERIFIED"
            unreleased.append(u)
            report["unreleased"] += 1
        for e in entries:
            sid, name, rarity, deco, _set, gender, pair_id, cls, order = e
            st = stats.get(str(sid))
            g = gseries.get(sid)
            spa_name = spa[sid * 10 + si] if sid * 10 + si < len(spa) else None
            if spa_name == EMPTY_ES:
                report["gmdEmpty"] += 1
                spa_name = None
            db_id = (SLOT_HI[slot] << 16) | sid
            db_names = item_names.get(db_id)
            name_es = spa_name or (db_names[1] if db_names else None)
            if spa_name:
                report["esFromGame"] += 1
            elif name_es:
                report["esFromDb"] += 1
            else:
                report["esMissing"] += 1
            name_ja = db_names[2] if db_names else None

            # verificación independiente contra la tabla del juego del usuario
            v = "UNVERIFIED"
            out_gender = gender
            if st and g:
                ok = (st["rar"] == g["rarity"]
                      and st["def"][0] == g["def"] and st["def"][1] == g["maxDef"]
                      and st["res"] == g["res"]
                      and st["slots"] == g["slots"][si])
                g_sk = [(skill_by_id.get(k, f"skill#{k}"), p) for k, p in g["skills"][si]]
                ok = ok and sorted(map(tuple, st["sk"])) == sorted(g_sk)
                # género autoritativo: bits del juego (r[13]=male, r[14]=female),
                # normalizado a 0=masc, 1=fem, 2=ambos. El catálogo Kiranico tiene
                # errores (p.ej. Gammoth: catálogo=fem, juego/db=masc).
                g_gen = 2 if (g["male"] and g["female"]) else (0 if g["male"] else 1)
                out_gender = g_gen
                if gender != g_gen:
                    report["genderOverride"].append(
                        {"slot": slot, "sid": sid, "catalog": gender, "game": g_gen})
                fam0 = db_armor.get(db_id)
                if fam0:
                    db_gen = {0: 1, 1: 0, 2: 2}[fam0[2]]  # db: 0=fem, 1=masc, 2=ambos
                    if db_gen != g_gen:
                        report["dbGenderMismatch"].append(
                            {"slot": slot, "sid": sid, "db": fam0[2], "game": g_gen})
                g_cls = "A" if (g["blademaster"] and g["gunner"]) else ("G" if g["gunner"] else "B")
                if cls != g_cls:
                    ok = False
                if ok:
                    report["gameVerified"] += 1
                    v = "VERIFIED"
                else:
                    report["gameMismatch"].append({"slot": slot, "sid": sid, "name": name})
            elif st:
                v = "PARTIAL"

            sk = []
            if st:
                for sname, pts in st["sk"]:
                    sk.append([sname, skill_es.get(sname), pts])
            fam = db_armor.get(db_id)
            family_id = fam[5] if fam else None
            p = {
                "slot": slot, "sid": sid, "name": name, "nameEs": name_es,
                "rarity": rarity, "rank": rank_of(rarity),
                "cls": cls, "gender": out_gender, "pair": pair_id or None,
                "family": family_id, "order": order,
                "def": st["def"] if st else None,
                "lv": st["lv"] if st else None,
                "res": st["res"] if st else None,
                "deco": st["slots"] if st else deco,
                "sk": sk, "v": v,
            }
            if name_ja:
                p["nameJa"] = name_ja
            pieces.append(p)
            piece_key[(slot, sid)] = p
            report["pieces"] += 1

    # conjuntos desde armor_families (mhgu.db, MIT)
    sets = []
    slot_field = {"head": 3, "chest": 4, "arms": 5, "waist": 6, "legs": 7}
    for fam in families:
        fid, fname, frar = fam[0], fam[1], fam[2]
        ps = {}
        es_names = []
        present = 0
        for slot in SLOTS:
            encoded = fam[slot_field[slot]]
            sid = encoded & 0xFFFF if encoded else None
            if sid and (slot, sid) in piece_key:
                ps[slot] = sid
                present += 1
                es_names.append(piece_key[(slot, sid)]["nameEs"])
            else:
                ps[slot] = None
        if present == 0:
            continue
        if present < 5:
            report["setsIncomplete"] += 1
        mids = series_monsters.get(fid) or set()
        if not mids:
            mids = material_monsters(cmats.get(fid, ()), item_names, monsters)
        set_es = derive_set_es(es_names)
        sets.append({
            "id": fid, "name": fname, "nameEs": set_es,
            "nameEsStatus": "DERIVED" if set_es else "MISSING",
            "rarity": frar, "rank": rank_of(frar), "pieces": ps,
            "monsters": sorted(mids),
            "deviant": any(mon_by_id[i]["deviant"] for i in mids),
        })
        report["sets"] += 1
    sets.sort(key=lambda s: (s["rarity"], s["id"]))
    # herencia estructural: variantes S/X/GX… del mismo conjunto base y piezas
    # emparejadas por género (pair_id del juego) comparten monstruo de origen.
    base_of = lambda n: re.sub(r"\s+(S|X|GX|XR|R|U|Z|EX)$", "", n)
    by_base = {}
    piece_set = {}
    for s in sets:
        by_base.setdefault(base_of(s["name"]), []).append(s)
        for sl, sid in s["pieces"].items():
            if sid:
                piece_set[(sl, sid)] = s
    for s in sets:
        if s["monsters"]:
            continue
        for o in by_base.get(base_of(s["name"]), []):
            if o is not s and o["monsters"]:
                s["monsters"] = o["monsters"]
                s["deviant"] = o["deviant"]
                break
        if s["monsters"]:
            continue
        inh = set()
        for sl, sid in s["pieces"].items():
            p = piece_key.get((sl, sid))
            if p and p.get("pair"):
                o = piece_set.get((sl, p["pair"]))
                if o and o["monsters"]:
                    inh.update(o["monsters"])
        if inh:
            s["monsters"] = sorted(inh)
            s["deviant"] = any(mon_by_id[i]["deviant"] for i in inh)
    report["setsWithMonster"] = sum(1 for s in sets if s["monsters"])
    report["setsNoMonster"] = [s["name"] for s in sets if not s["monsters"]]

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "pieces.json").write_text(json.dumps({
        "slots": SLOTS, "slotEs": SLOT_ES, "resEs": RES_ES,
        "gender": {"0": "Masculino", "1": "Femenino", "2": "Ambos"},
        "cls": {"B": "Espadachín", "G": "Artillero", "A": "Ambos"},
        "rankEs": {"LR": "Rango bajo", "HR": "Rango alto", "G": "Rango G"},
        "pieces": pieces,
        "provenance": {
            "stats": "mhgu-collection-tracker stats/armor_* (tablas del juego)",
            "verifiedAgainst": "armorSeriesData.asd + armorBuildData.abd del dump del usuario (MHGU 1.4.0)",
            "namesEs": "armorSeriesData_spa.gmd del juego (oficial) con fallback mhgu.db items.name_es",
            "skillsEs": "mhgu.db skill_trees.name_es (MIT)",
            "sets": "mhgu.db armor_families (MIT); nombre ES de conjunto DERIVADO de piezas oficiales",
            "rank": "DERIVED: rareza 1-3 LR, 4-7 HR (sets S), 8-11 G (sets X/GX/deviantes)",
            "monsters": "mhgu.db monsters (MIT); vínculo conjunto-monstruo vía categorías de puntos de armorProcessA00.apd y recetas armorCreateA0*.acrd (tablas del juego); fallback DERIVED por nombres de material",
        },
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT / "sets.json").write_text(json.dumps({
        "sets": sets,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT / "monsters.json").write_text(json.dumps({
        "monsters": monsters,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT / "unreleased.json").write_text(json.dumps({
        "note": "Piezas presentes en las tablas del juego pero no publicadas como "
                "equipamiento obtenible: placeholders DUMMY y variantes no publicadas "
                "(p.ej. versión femenina de Gammoth/Gourmew). Se conservan por "
                "procedencia; no forman parte del catálogo navegable.",
        "pieces": unreleased,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    tools_out = ROOT / "tools" / "out"
    tools_out.mkdir(exist_ok=True)
    (tools_out / "armor_build_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items()
                      if not isinstance(v, list)}, ensure_ascii=False, indent=1))
    print("gameMismatch:", len(report["gameMismatch"]),
          "genderOverride:", len(report["genderOverride"]),
          "dbGenderMismatch:", len(report["dbGenderMismatch"]))
    for m in report["gameMismatch"][:10]:
        print("  MISMATCH", m)
    for m in report["genderOverride"][:10]:
        print("  GENDER", m)
    for m in report["dbGenderMismatch"][:10]:
        print("  DB-GENDER", m)


if __name__ == "__main__":
    sys.exit(main())
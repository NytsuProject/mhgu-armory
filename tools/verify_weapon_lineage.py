"""Verificación independiente del linaje de armas contra las tablas del juego.

Decodifica weaponNNBaseData / weaponNNLevelData / weaponNNMsgData_spa del dump
del usuario (MHGU 1.4.0) y compara, árbol por árbol y nivel por nivel, con
data/weapons/*.json: conjunto de árboles, niveles, ranuras, mejoras
consecutivas y bifurcaciones con nivel de desbloqueo. Separa el informe entre
árboles con monstruo de origen y árboles sin monstruo (mineral/hueso/etc.).
Contrasta además con mhgu.db (parent_id) y con el CSV de Scrimas.
Solo lectura sobre el dump; no escribe nada fuera de tools/out/.
"""
import json
import sqlite3
import struct
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAME = Path("C:/GU/Windows-MHGURecomp/data/romfs/nativeNX")
DB = ROOT.parent / "research/MHGUDB-iOS/MHGUDB/Assets/databases/mhgu.db"
CSV = ROOT.parent / "research/MHGU-Save-editor/data/weapon-tree.csv"

CLASSES = [
    ("great-sword", 0), ("sword-and-shield", 1), ("hammer", 2), ("lance", 3),
    ("heavy-bowgun", 4), ("light-bowgun", 6), ("long-sword", 7), ("switch-axe", 8),
    ("gunlance", 9), ("bow", 10), ("dual-blades", 11), ("hunting-horn", 12),
    ("insect-glaive", 13), ("charge-blade", 14),
]


def gmd_strings(path):
    b = path.read_bytes()
    assert b[:4] == b"GMD\0"
    n = struct.unpack_from("<I", b, 0x24)[0]
    parts = b[0x28 + n + 1:].decode("utf-8").split("\0")
    if parts and parts[-1] == "":
        parts.pop()
    return parts


def table(name):
    b = (GAME / "table" / name).read_bytes()
    cnt = struct.unpack_from("<I", b, 4)[0]
    stride = (len(b) - 8) // cnt
    assert (len(b) - 8) % cnt == 0
    return [b[8 + i * stride:8 + (i + 1) * stride] for i in range(cnt)], stride


def decode_class(nn):
    base, st = table(f"weapon{nn:02d}BaseData.w{nn:02d}d")
    lvl, ls = table(f"weapon{nn:02d}LevelData.w{nn:02d}d")
    # campo de ranuras por clase: último byte en cuerpo a cuerpo, +10 en
    # ballestas, +12 en arco (layout derivado y comprobado al 100 % por clase)
    so = {4: 10, 6: 10, 10: 12}.get(nn, ls - 1)
    names = gmd_strings(GAME / "spa" / "table" / f"weapon{nn:02d}MsgData_spa.gmd")
    trees = {}
    for k, r in enumerate(base):
        kids = []
        tail = r[st - 10:]
        for j in range(5):
            lv, kid = tail[2 * j], tail[2 * j + 1]
            if kid:
                kids.append((kid, lv))
        trees[k] = {
            "firstRename": r[9], "lim": r[10], "rare": r[11] + 1,
            "nameEs": names[6 * k] if 6 * k < len(names) else None,
            "kids": kids, "levels": {},
        }
    for r in lvl:
        t, lv = r[4], r[5]
        trees.setdefault(t, {"firstRename": 0, "lim": 0, "rare": 0, "nameEs": None,
                             "kids": [], "levels": {}})["levels"][lv] = r[so]
    for g in trees.values():
        g["maxLv"] = max(g["levels"]) if g["levels"] else 0
    return trees


def main():
    report = {"classes": [], "totals": {}}
    tot = dict(trees_game=0, trees_ours=0, levels_game=0, levels_ours=0,
               branch_game=0, branch_ours=0, branch_ok=0, cons_ok=0, cons_bad=0,
               slot_ok=0, slot_bad=0, trees_missing=0, trees_extra=0,
               rename_ok=0, rename_bad=0,
               mon_trees=0, nomon_trees=0, mon_branch_ok=0, nomon_branch_ok=0,
               mon_cons_ok=0, nomon_cons_ok=0, mon_levels=0, nomon_levels=0)
    missing_detail, extra_detail, edge_bad, slot_bad_detail = [], [], [], []
    slot_bad_by_class = {}

    for slug, nn in CLASSES:
        game = decode_class(nn)
        ours = json.loads((ROOT / "data/weapons" / f"{slug}.json").read_bytes())
        ot = {t["id"]: t for t in ours["trees"]}

        # alineación de ids: nuestros ids vs índice de registro del juego
        off = None
        for cand in (0, 1, -1):
            if all(game.get(i + cand, {}).get("nameEs") == t["nameEs"]
                   for i, t in ot.items()
                   if t.get("nameEs") and t["nameEs"] != "MISSING" and not t.get("dummy")):
                off = cand
                break
        assert off is not None, f"{slug}: sin alineación de ids"

        gids = {i + off for i in ot}
        miss = [k for k in game if k not in gids]
        extra = [i for i in ot if i + off not in game]
        for k in miss:
            g = game[k]
            placeholder = (g["nameEs"] in ("(Ninguna)", "DUMMY", "", None)
                           and not g["kids"] and len(g["levels"]) <= 1)
            missing_detail.append(dict(cls=slug, game_id=k, nameEs=g["nameEs"],
                                       maxLv=g["maxLv"], rare=g["rare"],
                                       levels=len(g["levels"]),
                                       placeholder=placeholder))
        for i in extra:
            extra_detail.append(dict(cls=slug, our_id=i, nameEs=ot[i]["nameEs"]))

        # niveles y ranuras por árbol
        lv_ok = lv_bad = 0
        for i, t in ot.items():
            g = game.get(i + off)
            if not g:
                continue
            glv = set(g["levels"])
            olv = {l["lv"] for l in t["levels"]}
            if glv == olv and g["maxLv"] == t["maxLevel"]:
                lv_ok += 1
            else:
                lv_bad += 1
                edge_bad.append(dict(cls=slug, tree=i, kind="levels",
                                     game=sorted(glv), ours=sorted(olv),
                                     maxLvGame=g["maxLv"], maxLvOurs=t["maxLevel"]))
            first = t["stages"][0][0] if t.get("stages") else g["maxLv"]
            if t.get("dummy"):
                pass  # los DUMMY nombran cada nivel; byte 9 no es su primer renombre
            elif g["firstRename"] == first:
                tot["rename_ok"] += 1
            else:
                tot["rename_bad"] += 1
                edge_bad.append(dict(cls=slug, tree=i, kind="first-rename",
                                     game=g["firstRename"], ours=first))
            for l in t["levels"]:
                gs = g["levels"].get(l["lv"])
                os_ = l["slots"].count("◯")
                if gs is None:
                    continue
                if gs == os_:
                    tot["slot_ok"] += 1
                else:
                    tot["slot_bad"] += 1
                    slot_bad_by_class[slug] = slot_bad_by_class.get(slug, 0) + 1
                    slot_bad_detail.append(dict(cls=slug, tree=i, lv=l["lv"],
                                                game=gs, ours=os_))

        # bifurcaciones: juego padre->(hijo,lv) vs nuestro hijo->parent[padre,lv]
        g_edges = set()
        for k, g in game.items():
            for kid, lv in g["kids"]:
                if kid in game and k in gids and kid in gids:
                    g_edges.add((kid, k, lv))
        o_edges = {(i, t["parent"][0], t["parent"][1])
                   for i, t in ot.items() if t["parent"]}
        ok = g_edges & o_edges
        for e in g_edges - o_edges:
            edge_bad.append(dict(cls=slug, kind="branch-only-game", edge=list(e)))
        for e in o_edges - g_edges:
            edge_bad.append(dict(cls=slug, kind="branch-only-ours", edge=list(e)))

        # mejoras consecutivas nivel N -> N+1 dentro de cada árbol
        cons_ok = cons_bad = 0
        for i, t in ot.items():
            g = game.get(i + off)
            if not g:
                continue
            lvs = sorted(g["levels"])
            ours_lv = [l["lv"] for l in t["levels"]]
            n = max(0, len(lvs) - 1)
            if ours_lv == lvs and lvs == list(range(1, len(lvs) + 1)):
                cons_ok += n
            else:
                cons_bad += n
                edge_bad.append(dict(cls=slug, tree=i, kind="consecutive",
                                     game=lvs, ours=ours_lv))

        # partición monstruo / sin monstruo
        mon = [i for i, t in ot.items() if t.get("monsters")]
        nomon = [i for i, t in ot.items() if not t.get("monsters")]
        mon_b = sum(1 for (c, p, lv) in ok if c in mon)
        nomon_b = sum(1 for (c, p, lv) in ok if c in nomon)
        mon_c = nomon_c = 0
        for i, t in ot.items():
            g = game.get(i + off)
            if not g:
                continue
            n = max(0, len(g["levels"]) - 1)
            if i in mon:
                mon_c += n
            else:
                nomon_c += n
        mon_lv = sum(len(ot[i]["levels"]) for i in mon)
        nomon_lv = sum(len(ot[i]["levels"]) for i in nomon)

        cls_rep = dict(cls=slug, nn=nn, offset=off,
                       trees_game=len(game), trees_ours=len(ot),
                       levels_game=sum(len(g["levels"]) for g in game.values()),
                       levels_ours=sum(len(t["levels"]) for t in ot.values()),
                       trees_level_ok=lv_ok, trees_level_bad=lv_bad,
                       branch_game=len(g_edges), branch_ours=len(o_edges),
                       branch_ok=len(ok), cons_ok=cons_ok, cons_bad=cons_bad,
                       mon_trees=len(mon), nomon_trees=len(nomon),
                       mon_levels=mon_lv, nomon_levels=nomon_lv,
                       mon_branch_ok=mon_b, nomon_branch_ok=nomon_b,
                       mon_cons_ok=mon_c, nomon_cons_ok=nomon_c,
                       nomon_names=[ot[i]["nameEs"] or ot[i]["name"] for i in nomon])
        report["classes"].append(cls_rep)
        tot["trees_game"] += len(game)
        tot["trees_ours"] += len(ot)
        tot["levels_game"] += cls_rep["levels_game"]
        tot["levels_ours"] += cls_rep["levels_ours"]
        tot["branch_game"] += len(g_edges)
        tot["branch_ours"] += len(o_edges)
        tot["branch_ok"] += len(ok)
        tot["cons_ok"] += cons_ok
        tot["cons_bad"] += cons_bad
        tot["trees_missing"] += len(miss)
        tot["trees_extra"] += len(extra)
        tot["mon_trees"] += len(mon)
        tot["nomon_trees"] += len(nomon)
        tot["mon_branch_ok"] += mon_b
        tot["nomon_branch_ok"] += nomon_b
        tot["mon_cons_ok"] += mon_c
        tot["nomon_cons_ok"] += nomon_c
        tot["mon_levels"] += mon_lv
        tot["nomon_levels"] += nomon_lv

    # mhgu.db: parent_id de cada arma vs nuestra arista (por nombre ES + clase)
    db = sqlite3.connect(DB)
    rows = db.execute("""select w._id, w.parent_id, w.wtype, i.name_es
                         from weapons w join items i on i._id = w._id""").fetchall()
    by_name = {}
    for slug, nn in CLASSES:
        ours = json.loads((ROOT / "data/weapons" / f"{slug}.json").read_bytes())
        for t in ours["trees"]:
            for l in t["levels"]:
                if l.get("nEs") and l["nEs"] != "MISSING":
                    by_name.setdefault((slug, l["nEs"], l["lv"]),
                                       (t["id"], l["lv"], t["parent"]))
    wtype_slug = {"Great Sword": "great-sword", "Sword and Shield": "sword-and-shield",
                  "Hammer": "hammer", "Lance": "lance", "Heavy Bowgun": "heavy-bowgun",
                  "Light Bowgun": "light-bowgun", "Long Sword": "long-sword",
                  "Switch Axe": "switch-axe", "Gunlance": "gunlance", "Bow": "bow",
                  "Dual Blades": "dual-blades", "Hunting Horn": "hunting-horn",
                  "Insect Glaive": "insect-glaive", "Charge Blade": "charge-blade"}

    def resolve(slug, nes):
        # items.name_es = nombre ES del nivel + « N» (p. ej. «Hoja de erudito 8»)
        if not nes:
            return None
        head, _, tail = nes.rpartition(" ")
        if tail.isdigit():
            return by_name.get((slug, head, int(tail)))
        return None

    pos_to_id = {}
    for _id, pid, wt, nes in rows:
        slug = wtype_slug.get(wt)
        pos = resolve(slug, nes)
        if pos:
            pos_to_id[(slug, pos[0], pos[1])] = _id
    db_ok = db_bad = db_skip = 0
    db_bad_detail = []
    for _id, pid, wt, nes in rows:
        slug = wtype_slug.get(wt)
        pos = resolve(slug, nes)
        if not pos:
            db_skip += 1
            continue
        tid, lv, parent = pos
        if lv > 1:
            expect = pos_to_id.get((slug, tid, lv - 1), 0)
        elif parent:
            expect = pos_to_id.get((slug, parent[0], parent[1]), 0)
        else:
            expect = 0
        if pid == expect:
            db_ok += 1
        else:
            db_bad += 1
            db_bad_detail.append(dict(id=_id, name=nes, tree=tid, lv=lv,
                                      db_parent=pid, expected=expect))
    report["mhgu_db"] = dict(ok=db_ok, bad=db_bad, skipped=db_skip,
                             bad_detail=db_bad_detail[:40])

    # CSV de Scrimas (798 aristas del RomFS) vs juego y vs nuestros datos
    nn_slug = {nn: slug for slug, nn in CLASSES}
    csv_edges = set()
    with open(CSV, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            csv_edges.add((nn_slug[int(r["class"])], int(r["weapon"]),
                           int(r["parent"]), int(r["level"])))
    ours_all = set()
    for slug, nn in CLASSES:
        ours = json.loads((ROOT / "data/weapons" / f"{slug}.json").read_bytes())
        for t in ours["trees"]:
            if t["parent"]:
                ours_all.add((slug, t["id"], t["parent"][0], t["parent"][1]))
    report["scrimas_csv"] = dict(edges=len(csv_edges),
                                 ok=len(csv_edges & ours_all),
                                 only_csv=sorted(csv_edges - ours_all)[:20],
                                 only_ours=sorted(ours_all - csv_edges)[:20])

    report["totals"] = tot
    report["slot_bad_by_class"] = slot_bad_by_class
    report["placeholders_excluded"] = [m for m in missing_detail if m["placeholder"]]
    report["missing_trees"] = [m for m in missing_detail if not m["placeholder"]]
    report["extra_trees"] = extra_detail
    report["edge_problems"] = edge_bad[:60]
    report["slot_problems"] = slot_bad_detail[:40]
    out = ROOT / "tools/out/weapon_lineage_verify.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")

    print(json.dumps(tot, ensure_ascii=False, indent=1))
    print("placeholders excluded:", len(report["placeholders_excluded"]),
          "real missing:", len(report["missing_trees"]))
    print("slot bad by class:", slot_bad_by_class)
    print("extra trees:", extra_detail)
    print("edge problems:", len(edge_bad), json.dumps(edge_bad[:10], ensure_ascii=False))
    print("slot problems:", tot["slot_bad"], json.dumps(slot_bad_detail[:10], ensure_ascii=False))
    print("db:", db_ok, db_bad, db_skip, json.dumps(db_bad_detail[:10], ensure_ascii=False))
    print("scrimas:", json.dumps(report["scrimas_csv"], ensure_ascii=False))
    for c in report["classes"]:
        print(c["cls"], "trees", c["trees_ours"], "/", c["trees_game"],
              "lv", c["levels_ours"], "/", c["levels_game"],
              "branch", c["branch_ok"], "/", c["branch_game"],
              "cons", c["cons_ok"], c["cons_bad"],
              "mon", c["mon_trees"], "nomon", c["nomon_trees"],
              "nomonBranch", c["nomon_branch_ok"], "nomonCons", c["nomon_cons_ok"])


if __name__ == "__main__":
    main()
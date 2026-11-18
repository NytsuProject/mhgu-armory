#!/usr/bin/env python3
"""Exporta joyas de mhgu.db y actualiza los umbrales del catálogo compartido."""
import argparse
import json
import sqlite3
from pathlib import Path
from build_skill_levels import ARMOR, build as build_levels


# Indexación y paleta de MHGUDB/Model/Icon.swift (misma revisión que mhgu.db).
ITEM_COLORS = ('ffffff', 'f85858', '70c888', '90b0f8', 'f8d058', 'b890c0',
               '98d8f0', 'f89858', 'e890a0', 'c6f29f', 'a0a0a0')


def export(db):
    jewels = {i: dict(id=i, name=name, cost=slots, tint="#" + ITEM_COLORS[color], sk=[]) for i, name, slots, color in db.execute('''
        SELECT d._id, i.name_es, d.num_slots, i.icon_color FROM decorations d
        JOIN items i ON i._id = d._id ORDER BY d._id''')}
    for i, en, es, pts in db.execute('''
        SELECT d._id, t.name, t.name_es, x.point_value FROM decorations d
        JOIN item_to_skill_tree x ON x.item_id = d._id
        JOIN skill_trees t ON t._id = x.skill_tree_id ORDER BY d._id, x.point_value DESC'''):
        jewels[i]['sk'].append([en, es, pts])
    assert len(jewels) == db.execute('SELECT COUNT(*) FROM decorations').fetchone()[0]
    assert all(j['sk'] and j['name'] and j['cost'] in (1, 2, 3) for j in jewels.values())
    (ARMOR / 'decorations.json').write_text('[\n' + ',\n'.join(
        json.dumps(j, ensure_ascii=False) for j in jewels.values()) + '\n]\n', encoding='utf-8')
    build_levels(db)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('database', type=Path)
    with sqlite3.connect(parser.parse_args().database.resolve().as_uri() + '?mode=ro', uri=True) as db:
        export(db)

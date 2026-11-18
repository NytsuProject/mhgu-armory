#!/usr/bin/env python3
"""Exporta los puntos posibles por árbol y posición desde talisman-data.js y mhgu.db."""
import argparse
import json
import sqlite3
from pathlib import Path


def export(tables, db):
    names = dict(db.execute('SELECT name, name_es FROM skill_trees'))
    rows = {}
    for index, table in enumerate(tables['skill']):
        for tree_id, low, high in table:
            en = tables['names'][str(tree_id)]
            row = rows.setdefault(en, dict(en=en, es=names[en], points=[set(), set()]))
            row['points'][index % 2].update(n for n in range(low, high + 1) if n)
    for row in rows.values():
        row['points'] = [sorted(points) for points in row['points']]
    dest = Path(__file__).resolve().parents[1] / 'data/armor/talisman-skills.json'
    dest.write_text('[\n' + ',\n'.join(json.dumps(row, ensure_ascii=False)
                    for row in rows.values()) + '\n]\n', encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('tables', type=Path)
    parser.add_argument('database', type=Path)
    args = parser.parse_args()
    source = args.tables.read_text(encoding='utf-8').split('window.TALISMAN_DATA = ', 1)[1]
    with sqlite3.connect(args.database.resolve().as_uri() + '?mode=ro', uri=True) as db:
        export(json.loads(source.strip().rstrip(';')), db)

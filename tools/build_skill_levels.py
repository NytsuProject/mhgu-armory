#!/usr/bin/env python3
"""Exporta los niveles de las habilidades de pieces.json desde mhgu.db (MIT)."""
import argparse
import json
import sqlite3
from pathlib import Path

ARMOR = Path(__file__).resolve().parents[1] / 'data' / 'armor'


def build(db):
    pieces = json.loads((ARMOR / 'pieces.json').read_text(encoding='utf-8'))['pieces']
    trees = {en for piece in pieces for en, _, _ in piece['sk']}
    levels = {tree: [] for tree in sorted(trees - {'Torso Up'})}  # efecto por pieza, sin umbral
    for tree, points, name, desc in db.execute('''
        SELECT t.name, s.required_skill_tree_points, s.name_es, s.description_es
        FROM skills s JOIN skill_trees t ON t._id = s.skill_tree_id
        ORDER BY s.required_skill_tree_points < 0, abs(s.required_skill_tree_points)
    '''):
        if tree in levels:
            if not (points and name and desc):
                raise ValueError(f'Nivel incompleto: {tree} ({points})')
            levels[tree].append(dict(points=points, name=name, description=desc))
    for tree, rows in levels.items():
        if not rows:
            raise ValueError(f'Sin niveles: {tree}')
    (ARMOR / 'skill-levels.json').write_text(
        json.dumps(levels, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('database', type=Path)
    args = parser.parse_args()
    with sqlite3.connect(args.database.resolve().as_uri() + '?mode=ro', uri=True) as db:
        build(db)

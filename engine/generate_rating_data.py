"""Regenerate rating-data.js from the same SimC source used to build the WASM."""
from pathlib import Path
import argparse
import json
import re


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    args = parser.parse_args()
    text = (args.source / 'engine/dbc/generated/sc_scale_data.inc').read_text(encoding='utf8')
    table = re.search(r'__combat_ratings\[\]\[(\d+)\]\s*=\s*\{(.*?)\n\};', text, re.S)
    if not table:
        raise ValueError('Combat rating table not found')
    rows = {}
    for label, values in re.findall(r'// ([^\r\n]+)\s*\{([^}]+)\}', table[2]):
        values = re.sub(r'//[^\n]*', '', values)
        rows[label.strip()] = [float(number) for number in re.findall(r'[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?', values)]
    labels = {'crit': 'Crit - Melee', 'haste': 'Haste - Melee', 'mastery': 'Mastery',
              'versatility': 'Versatility - Damage Done', 'avoidance': 'Avoidance',
              'leech': 'Lifesteal', 'speed': 'Speed'}
    data = {key: rows[label] for key, label in labels.items()}
    if any(len(row) != int(table[1]) or any(value <= 0 for value in row) for row in data.values()):
        raise ValueError('Incomplete or invalid rating values')
    version = re.search(r'Combat rating values for level .*?, wow build ([\d.]+)', text)[1]
    output = (f'// SimC {version}: __combat_ratings, levels 1-{table[1]}. Rating per 1% or 1 mastery point.\n'
              '(function(root){const data=' + json.dumps(data, separators=(',', ':')) +
              ";if(typeof module!=='undefined')module.exports=data;else root.RatingData=data;})(globalThis);\n")
    (Path(__file__).resolve().parents[1] / 'rating-data.js').write_text(output, encoding='utf8')
    print(f'Generated {len(data)} rating tables for {table[1]} levels from {version}')


if __name__ == '__main__':
    main()

"""Refresh names for stat-changing SimC talents from Wowhead CN spell pages."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import json
import re
import subprocess
import sys
import requests

ROOT = Path(__file__).resolve().parents[1]
profiles = json.loads(subprocess.check_output([
    'node', '-e', "const m=require('./src/shared/model.js');console.log(JSON.stringify(Object.entries(m.classes).flatMap(([c,s])=>s.map(x=>[c,x]))))"
], cwd=ROOT, text=True, encoding='utf-8'))

def discover(profile):
    cls, spec = profile
    text = f'{cls}="Localization"\nlevel=90\nrace=human\nspec={spec}\n# wgm_discover_traits=1\n'
    run = subprocess.run(['node', 'engine/run.cjs', '-'], input=text, cwd=ROOT,
                         capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=45)
    if run.returncode:
        return profile, {}, run.stderr[-300:]
    spells = {int(spell): name for spell, name in re.findall(
        r'^trait: id=\d+ \| spell=(\d+) \| name=(.*?) \| rank=', run.stdout, re.M) if int(spell)}
    return profile, spells, None

all_spells = {}
with ThreadPoolExecutor(max_workers=3) as pool:
    for future in as_completed([pool.submit(discover, profile) for profile in profiles]):
        profile, spells, error = future.result()
        if error:
            print('Probe failed:', *profile, error, file=sys.stderr)
        all_spells.update(spells)
print(f'Probed {len(profiles)} profiles; {len(all_spells)} stat-changing talent spells', flush=True)

def translate(entry):
    spell, english = entry
    try:
        response = requests.get(f'https://www.wowhead.com/cn/spell={spell}', timeout=15,
                                headers={'User-Agent': 'Mozilla/5.0'})
        response.raise_for_status()
        title = re.search(rb'<title>(.*?)</title>', response.content, re.S)
        if not title:
            raise ValueError('missing title')
        name = title.group(1).decode('utf-8').split('—')[0].strip()
        if not name or not re.search('[\u3400-\u9fff]', name):
            raise ValueError(f'not Chinese: {name}')
        return spell, name, None
    except Exception as exc:
        return spell, None, f'{english}: {exc}'

names = {}
with ThreadPoolExecutor(max_workers=6) as pool:
    for future in as_completed([pool.submit(translate, entry) for entry in all_spells.items()]):
        spell, name, error = future.result()
        if name:
            names[spell] = name
        elif error:
            print('Name unavailable:', spell, error, file=sys.stderr)

target = ROOT / 'src/shared/data/talent-zh.js'
target.write_text('// Chinese talent names verified against Wowhead CN by spell ID.\n'
                  'window.TalentZh = ' + json.dumps(names, ensure_ascii=False, sort_keys=True,
                                                    separators=(',', ':')) + ';\n', encoding='utf-8')
print(f'Wrote {len(names)} Chinese names to {target}', flush=True)

"""Minimal no-threading build fixes for pinned SimC ac0f3a3c. No item formulas changed."""
from pathlib import Path
import sys

def patch(root):
    edits={
      'engine/report/charts.cpp':[
        ('void profilesets_insert_data(', '#ifndef SC_NO_THREADING\nvoid profilesets_insert_data('),
        ('}\n\n}  // anonymous namespace', '}\n#endif // SC_NO_THREADING\n\n}  // anonymous namespace'),
        ('  profilesets_populate_chart_data( chart, base_offset, MAX_PROFILESET_CHART_ENTRIES, results, baseline,', '#ifndef SC_NO_THREADING\n  profilesets_populate_chart_data( chart, base_offset, MAX_PROFILESET_CHART_ENTRIES, results, baseline,'),
        ('base_name, sim.profileset_metric.front(), c, true );','base_name, sim.profileset_metric.front(), c, true );\n#endif // SC_NO_THREADING')],
      'engine/report/report_text.cpp':[
        ('void print_profilesets( std::ostream& out, const profileset::profilesets_t& profilesets, const sim_t& sim )\n{', 'void print_profilesets( std::ostream& out, const profileset::profilesets_t& profilesets, const sim_t& sim )\n{\n#ifndef SC_NO_THREADING'),
        ('}\n\nvoid print_text_report(', '#endif // SC_NO_THREADING\n}\n\nvoid print_text_report(')],
      'engine/sim/profileset.cpp':[
        ('void profilesets_t::output_html( const sim_t&, std::ostream& ) const {}\n',''),
        ('void profilesets_t::output_text( const sim_t&, std::ostream& ) const {}\n','')],
      'engine/sim/proc_rng.cpp':[
        ('#include "proc_rng.hpp"','#include <vector>\n#include "proc_rng.hpp"')],
      'engine/sim/sim.cpp':[
        ('    if ( p->validate_actor() )\n      p->create_actions();',
         '#ifndef SC_NO_THREADING\n    if ( p->validate_actor() )\n      p->create_actions();\n#else\n    p->quiet = true;\n#endif // SC_NO_THREADING'),
        ('    if ( healers > 0 || healing > 0 )',
         '    // The stat-only adapter does not need synthetic healing targets.\n#ifndef SC_NO_THREADING\n    if ( healers > 0 || healing > 0 )'),
        ('        healing_targets_to_create--;\n      }\n    }',
         '        healing_targets_to_create--;\n      }\n    }\n#endif // SC_NO_THREADING')]
    }
    for rel,replacements in edits.items():
        p=root/rel;s=p.read_text(encoding='utf-8')
        if rel=='engine/sim/sim.cpp':
            s=s.replace('    if ( p->validate_actor() )\n#ifndef SC_NO_THREADING\n      p->create_actions();\n#else\n      p->quiet = true;\n#endif // SC_NO_THREADING',
                        '#ifndef SC_NO_THREADING\n    if ( p->validate_actor() )\n      p->create_actions();\n#else\n    p->quiet = true;\n#endif // SC_NO_THREADING')
        for a,b in replacements:
            if b and b in s:continue
            if not b and a not in s:continue
            if s.count(a)!=1:raise ValueError(f'Unexpected upstream code: {rel}: {a}')
            s=s.replace(a,b,1)
        p.write_text(s,encoding='utf-8',newline='\n')

if __name__=='__main__':patch(Path(sys.argv[1]))

// GPL-3.0-or-later. Small CLI adapter around SimulationCraft's item engine.
#include "simulationcraft.hpp"
#include "dbc/client_data.hpp"
#include "dbc/embellishment_data.hpp"
#include "item/enchants.hpp"
#include "class_modules/class_module.hpp"
#include "player/unique_gear.hpp"
#include <fstream>
#include <iostream>
#include <sstream>
#include <regex>
#include <set>
#include <filesystem>
#ifdef _WIN32
#include <windows.h>
#endif

namespace {
std::string trim(std::string s) {
  auto a=s.find_first_not_of(" \t\r\n");
  if(a==s.npos)return {};
  return s.substr(a,s.find_last_not_of(" \t\r\n")-a+1);
}
struct Row {std::string source,slot,value,label; int expected_level=0;};
slot_e parse_slot(const std::string& s) {
  if(s=="shoulder")return SLOT_SHOULDERS;
  if(s=="wrist")return SLOT_WRISTS;
  return util::parse_slot_type(s);
}
std::string error_chain(const std::exception& e) {
  std::string s=e.what();
  try {std::rethrow_if_nested(e);} catch(const std::exception& n){s+=" -> "+error_chain(n);} catch(...){}
  return s;
}
void validate(const std::string& value) {
  static const std::set<std::string> keys={"id","bonus_id","gem_id","gem_bonus_id","enchant_id","addon_id","drop_level","content_tuning","crafted_stats","crafting_quality","redirected_base_stats","titan_disc_id","context","ilevel"};
  std::istringstream parts(value);std::string part;std::getline(parts,part,',');
  // Names are informational. No arbitrary SimC directives or file access accepted.
  if(part.find_first_of("\r\n")!=part.npos)throw std::runtime_error("Invalid name token");
  std::set<std::string> seen;
  while(std::getline(parts,part,',')) {
    auto eq=part.find('=');auto key=part.substr(0,eq);
    if(eq==part.npos||!keys.count(key))throw std::runtime_error("Unsupported item option: "+key);
    if(!seen.insert(key).second)throw std::runtime_error("Duplicate item option: "+key);
    auto v=part.substr(eq+1);
    if(v.empty()||v.find_first_not_of("0123456789/")!=v.npos)throw std::runtime_error("Invalid numeric option: "+key);
  }
  if(!seen.count("id"))throw std::runtime_error("Missing item id");
}
std::string stat_text(const gear_stats_t& stats) {
  std::ostringstream out;bool first=true;
  for(int k=STAT_NONE+1;k<STAT_MAX;k++) {
    auto s=static_cast<stat_e>(k);double v=stats.get_stat(s);
    if(v==0)continue;
    if(!first)out<<", ";first=false;
    out<<util::stat_type_string(s)<<"="<<v;
  }
  return first?"(none)":out.str();
}
std::string pairs_text(const std::vector<stat_pair_t>& pairs) {
  gear_stats_t v;for(auto& p:pairs)v.add_stat(p.stat,p.value);return stat_text(v);
}
}

int main(int argc,char** argv) {
#ifdef _WIN32
  SetConsoleOutputCP(CP_UTF8);
#endif
  try {
    if(argc<2||argc>3){std::cerr<<"Usage: gear-resolver <input.simc|-> [output.txt]\n";return 1;}
    std::string text;
    if(std::string(argv[1])=="-")text.assign(std::istreambuf_iterator<char>(std::cin),{});
    else {std::ifstream f(std::filesystem::u8path(argv[1]),std::ios::binary);if(!f)throw std::runtime_error("Cannot open input");text.assign(std::istreambuf_iterator<char>(f),{});}
    if(text.size()>4*1024*1024)throw std::runtime_error("Input exceeds 4 MiB");
    if(text.compare(0,3,"\xef\xbb\xbf")==0)text.erase(0,3);
    std::vector<Row> rows;std::string source="equipped",label,name="Character",class_name,race_name="human",spec_name,version,professions;int level=0,expected=0;
    std::istringstream input(text);std::string line;
    const std::regex label_pattern("^# (.*) \\(([0-9]+)\\)$");
    while(std::getline(input,line)) {
      line=trim(line);std::smatch match;
      if(line.rfind("# WoW ",0)==0)version=line.substr(6);
      if(line.rfind("### ",0)==0){source=line.substr(4);label.clear();expected=0;continue;}
      if(std::regex_match(line,match,label_pattern)){label=match[1];expected=std::stoi(match[2]);continue;}
      bool comment=!line.empty()&&line[0]=='#';auto body=comment?trim(line.substr(1)):line;
      auto eq=body.find('=');if(eq==body.npos)continue;
      auto key=trim(body.substr(0,eq));auto val=trim(body.substr(eq+1));
      auto slot=parse_slot(key);
      if(slot!=SLOT_INVALID){rows.push_back({comment?source:"equipped",key,val,label,expected});label.clear();expected=0;continue;}
      if(comment)continue;
      if(key=="level")level=std::stoi(val);
      else if(key=="race")race_name=val;
      else if(key=="spec")spec_name=val;
      else if(key=="professions")professions=val;
      else if(util::parse_player_type(key)!=PLAYER_NONE){class_name=key;name=val;if(name.size()>1&&name.front()=='"'&&name.back()=='"')name=name.substr(1,name.size()-2);}
    }
    if(rows.empty())throw std::runtime_error("No equipment found");
    if(rows.size()>2000)throw std::runtime_error("Too many items");
    if(class_name.empty()||level<1||level>MAX_LEVEL)throw std::runtime_error("Missing/unsupported character class or level");
    dbc::init();
    module_t::init();
    unique_gear::register_hotfixes();
    unique_gear::register_special_effects();
    unique_gear::sort_special_effects();
    hotfix::apply();
    sim_t sim;sim.strict_parsing=true;sim.item_db_sources={"local"};
    auto* player=module_t::get(util::parse_player_type(class_name))->create_player(&sim,name,util::parse_race_type(race_name));
    player->true_level=level;
    player->_spec=dbc::translate_spec_str(player->type,spec_name);
    std::istringstream profs(professions);std::string prof;
    while(std::getline(profs,prof,'/')){auto eq=prof.find('=');if(eq==prof.npos)continue;auto p=util::parse_profession_type(prof.substr(0,eq));if(p!=PROFESSION_NONE)player->profession[p]=std::stoi(prof.substr(eq+1));}
    std::ostringstream out;
    out<<"SimC Gear Resolver 0.1 | SimC "<<SC_VERSION<<"\nData: "<<dbc::client_data_version_str(false)<<"\nSource: ac0f3a3c7ff9e521137c0ca1760d548330c697f3\nCharacter: "<<name<<" | "<<class_name<<"/"<<spec_name<<" | level="<<level<<"\nExport: "<<version<<"\n";
    out<<"Scope: item base stats + fixed gem/enchant stats. No combat, talents, set bonuses or proc averages.\n";
    if(!version.empty()&&trim(version.substr(0,version.find(',')))!=dbc::client_data_version_str(false))
      out<<"WARNING: export version differs from bundled data; compatibility has not been verified.\n";
    int ok=0,failed=0,mismatches=0;
    for(size_t n=0;n<rows.size();++n) {
      auto& row=rows[n];out<<"\n["<<n+1<<"] "<<row.source<<" / "<<row.slot<<" / "<<row.label<<"\n";
      try {
        validate(row.value);
        item_t item(player,row.value);item.slot=parse_slot(row.slot);item.parse_options();
        if(player->dbc->item(item.parsed.data.id).id==0)throw std::runtime_error("Item missing in bundled SimC data: "+std::to_string(item.parsed.data.id));
        if(item.parsed.redirect_item_id&&player->dbc->item(item.parsed.redirect_item_id).id==0)throw std::runtime_error("Redirected base item missing");
        for(auto id:item.parsed.bonus_id)if(player->dbc->item_bonus(id).empty())throw std::runtime_error("Bonus missing in bundled SimC data: "+std::to_string(id));
        for(auto id:item.parsed.gem_id)if(id&&player->dbc->item(id).id==0)throw std::runtime_error("Gem missing: "+std::to_string(id));
        if(item.parsed.enchant_id&&player->dbc->item_enchantment(item.parsed.enchant_id).id==0)throw std::runtime_error("Enchant missing: "+std::to_string(item.parsed.enchant_id));
        if(!item.initialize_data())throw std::runtime_error("Cannot initialize item data");
        item.init();
        // Initialize only the enchant, not the item's combat-specific proc handlers.
        if(item.parsed.enchant_id)enchant::initialize_item_enchant(item,item.parsed.enchant_stats,SPECIAL_EFFECT_SOURCE_ENCHANT,player->dbc->item_enchantment(item.parsed.enchant_id));
        if(item.parsed.addon_id)enchant::initialize_item_enchant(item,item.parsed.addon_stats,SPECIAL_EFFECT_SOURCE_ADDON,player->dbc->item_enchantment(item.parsed.addon_id));
        out<<"id="<<item.parsed.data.id<<" | "<<player->dbc->item(item.parsed.data.id).name<<" | ilevel="<<item.item_level()<<"\n";
        if(row.expected_level&&row.expected_level!=static_cast<int>(item.item_level())){++mismatches;out<<"WARNING: comment ilevel="<<row.expected_level<<" differs from calculated ilevel\n";}
        out<<"base: "<<stat_text(item.stats)<<"\ngems: "<<pairs_text(item.parsed.gem_stats)<<"\nenchant: "<<pairs_text(item.parsed.enchant_stats)<<"\nsocket_bonus: "<<pairs_text(item.parsed.socket_bonus_stats)<<"\n";
        out<<"total_for_spec: "<<stat_text(item.total_stats())<<"\n";
        gear_stats_t base_for_spec;
        for(int k=STAT_NONE+1;k<STAT_MAX;++k) {
          auto stat=static_cast<stat_e>(k);
          base_for_spec.add_stat(player->convert_hybrid_stat(stat),item.stats.get_stat(stat));
        }
        int sockets=0;for(auto color:item.parsed.data.socket_color)if(color!=SOCKET_COLOR_NONE)++sockets;
        bool embellished=false;
        for(const auto& emb:embellishment_data_t::data(false)) {
          if(std::find(item.parsed.bonus_id.begin(),item.parsed.bonus_id.end(),emb.bonus_id)!=item.parsed.bonus_id.end())embellished=true;
          for(const auto& effect:item.parsed.data.effects)if(effect.spell_id&&effect.spell_id==emb.spell_id)embellished=true;
        }
        out<<"base_for_spec: "<<stat_text(base_for_spec)<<"\n";
        out<<"gear_flags: sockets="<<sockets<<", set_id="<<item.parsed.data.id_set<<", embellishment="<<(embellished?1:0)<<"\n";
        if(item.parsed.addon_id)out<<"addon: "<<pairs_text(item.parsed.addon_stats)<<"\n";
        if(item.parsed.data.item_class==ITEM_CLASS_WEAPON)out<<"weapon: "<<item.encoded_weapon()<<"\n";
        for(auto& e:item.parsed.data.effects)if(e.spell_id)out<<"effect: spell_id="<<e.spell_id<<" trigger="<<static_cast<int>(e.type)<<" (not included in fixed stats)\n";
        for(auto* e:item.parsed.special_effects) {
          auto* driver=e->driver();
          bool passive=driver->flags(spell_attribute::SX_PASSIVE);
          out<<(passive?"passive gem/enchant effect: ":"triggered gem/enchant effect: ")<<e->name()<<" spell_id="<<driver->id()<<" (not added to rating totals)\n";
          if(passive)for(const auto& se:driver->effects()) {
            if(se.type()==E_APPLY_AURA&&se.subtype()==A_MOD_CRIT_DAMAGE_MULTIPLIER)
              out<<"  critical_damage_bonus="<<se.base_value()<<"%\n";
            else if(se.type()==E_APPLY_AURA&&se.subtype()==A_MOD_CRITICAL_HEALING_AMOUNT)
              out<<"  critical_healing_bonus="<<se.base_value()<<"%\n";
            else out<<"  effect_type="<<static_cast<int>(se.type())<<" aura_type="<<static_cast<int>(se.subtype())<<" raw_base_value="<<se.base_value()<<" (not flattened)\n";
          }
        }
        ++ok;
      }catch(const std::exception& e){++failed;out<<"ERROR: "<<error_chain(e)<<"\n";}
    }
    for(auto& group:sim.error_list)for(auto& msg:group.second)out<<"\nENGINE WARNING: "<<msg<<"\n";
    out<<"\nSummary: total="<<rows.size()<<" resolved="<<ok<<" failed="<<failed<<" ilevel_mismatches="<<mismatches<<"\n";
    if(argc==3){std::ofstream f(std::filesystem::u8path(argv[2]),std::ios::binary);if(!f)throw std::runtime_error("Cannot open output");f<<out.str();if(!f)throw std::runtime_error("Failed writing output");}
    else std::cout<<out.str();
    return failed||mismatches?2:0;
  }catch(const std::exception& e){std::cerr<<"ERROR: "<<error_chain(e)<<"\n";return 1;}
}

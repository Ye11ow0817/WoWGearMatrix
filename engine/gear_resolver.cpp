// GPL-3.0-or-later. Small CLI adapter around SimulationCraft's item engine.
#include "simulationcraft.hpp"
#include "dbc/client_data.hpp"
#include "dbc/spelltext_data.hpp"
#include "item/enchants.hpp"
#include "class_modules/class_module.hpp"
#include "player/unique_gear.hpp"
#include <fstream>
#include <iostream>
#include <sstream>
#include <regex>
#include <set>
#include <filesystem>
#include <array>
#include <cmath>
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
bool has_embellishment_limit(const item_t& item) {
  // 只统计“唯一装备：美化（2）”分类；美化效果表也包含幸运钥匙串等不限数量的效果。
  constexpr unsigned limit_category_bonus_type=35;
  constexpr int embellished_limit_category=512;
  std::vector<unsigned> pending(item.parsed.bonus_id.begin(),item.parsed.bonus_id.end());
  std::set<unsigned> visited;
  while(!pending.empty()) {
    const auto id=pending.back();pending.pop_back();
    if(!visited.insert(id).second)continue;
    for(const auto& bonus:item.player->dbc->item_bonus(id)) {
      if(bonus.type==limit_category_bonus_type&&bonus.value_1==embellished_limit_category)return true;
      if(bonus.type==ITEM_BONUS_APPLY_BONUS&&bonus.value_1>0)pending.push_back(bonus.value_1);
    }
  }
  return false;
}
slot_e parse_slot(const std::string& s) {
  if(s=="shoulder")return SLOT_SHOULDERS;
  if(s=="wrist")return SLOT_WRISTS;
  return util::parse_slot_type(s);
}
player_e parse_class(const std::string& name){
  if(name=="death_knight")return DEATH_KNIGHT;
  if(name=="demon_hunter")return DEMON_HUNTER;
  return util::parse_player_type(name);
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
std::array<double,12> character_values(player_t* p){
  return {p->get_attribute(ATTR_STRENGTH),p->get_attribute(ATTR_AGILITY),p->get_attribute(ATTR_STAMINA),p->get_attribute(ATTR_INTELLECT),p->composite_armor(),p->composite_rating(RATING_MELEE_CRIT),p->composite_rating(RATING_MELEE_HASTE),p->composite_rating(RATING_MASTERY),p->composite_rating(RATING_DAMAGE_VERSATILITY),p->composite_rating(RATING_AVOIDANCE),p->composite_rating(RATING_LEECH),p->composite_rating(RATING_SPEED)};
}
std::array<double,12> character_multipliers(player_t* p){
  return {p->composite_attribute_multiplier(ATTR_STRENGTH),p->composite_attribute_multiplier(ATTR_AGILITY),p->composite_attribute_multiplier(ATTR_STAMINA),p->composite_attribute_multiplier(ATTR_INTELLECT),p->composite_base_armor_multiplier()*p->composite_armor_multiplier(),p->composite_rating_multiplier(RATING_MELEE_CRIT),p->composite_rating_multiplier(RATING_MELEE_HASTE),p->composite_rating_multiplier(RATING_MASTERY),p->composite_rating_multiplier(RATING_DAMAGE_VERSATILITY),p->composite_rating_multiplier(RATING_AVOIDANCE),p->composite_rating_multiplier(RATING_LEECH),p->composite_rating_multiplier(RATING_SPEED)};
}
std::array<double,12> character_with_probe_gear(player_t* p){
  const auto saved=p->initial.stats;
  for(const auto stat:{STAT_ARMOR,STAT_STRENGTH,STAT_AGILITY,STAT_STAMINA,STAT_INTELLECT,STAT_CRIT_RATING,STAT_HASTE_RATING,STAT_MASTERY_RATING,STAT_VERSATILITY_RATING,STAT_AVOIDANCE_RATING,STAT_LEECH_RATING,STAT_SPEED_RATING})
    p->initial.stats.add_stat(stat,1000);
  p->reset();const auto values=character_values(p);
  p->initial.stats=saved;p->reset();
  return values;
}
std::array<double,3> armor_response(player_t* p){
  const auto saved=p->initial.stats;
  const auto baseline=character_values(p)[4];
  auto probe=[&](bool agility,bool mastery){
    p->initial.stats=saved;
    if(agility)p->initial.stats.add_stat(STAT_AGILITY,1000);
    if(mastery)p->initial.stats.add_stat(STAT_MASTERY_RATING,1000);
    p->reset();return character_values(p)[4]-baseline;
  };
  const auto values=std::array<double,3>{probe(true,false),probe(false,true),probe(true,true)};
  p->initial.stats=saved;p->reset();return values;
}
constexpr std::array<const char*,12> character_keys={"strength","agility","stamina","intellect","armor","crit_rating","haste_rating","mastery_rating","versatility_rating","avoidance_rating","leech_rating","speed_rating"};
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
    std::vector<Row> rows;std::string source="equipped",label,name="Character",class_name,race_name="human",spec_name,version,professions,talents;std::set<unsigned> disabled_traits,enabled_traits;bool discover_traits=false;int level=0,expected=0;
    std::istringstream input(text);std::string line;
    const std::regex label_pattern("^# (.*) \\(([0-9]+)\\)$");
    while(std::getline(input,line)) {
      line=trim(line);std::smatch match;
      if(line.rfind("# wgm_disable_traits=",0)==0){
        std::istringstream ids(line.substr(21));std::string token;
        while(std::getline(ids,token,'/'))if(!token.empty()&&token.find_first_not_of("0123456789")==token.npos)disabled_traits.insert(static_cast<unsigned>(std::stoul(token)));
        continue;
      }
      if(line.rfind("# wgm_enable_traits=",0)==0){
        std::istringstream ids(line.substr(20));std::string token;
        while(std::getline(ids,token,'/'))if(!token.empty()&&token.find_first_not_of("0123456789")==token.npos)enabled_traits.insert(static_cast<unsigned>(std::stoul(token)));
        continue;
      }
      if(line=="# wgm_discover_traits=1"){discover_traits=true;continue;}
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
      else if(key=="talents")talents=val;
      else if(key=="professions")professions=val;
      else if(parse_class(key)!=PLAYER_NONE){class_name=key;name=val;if(name.size()>1&&name.front()=='"'&&name.back()=='"')name=name.substr(1,name.size()-2);}
    }
    if(rows.size()>2000)throw std::runtime_error("Too many items");
    if(class_name.empty()||level<1||level>MAX_LEVEL)throw std::runtime_error("Missing/unsupported character class or level");
    const auto parsed_race=util::parse_race_type(race_name);
    const auto parsed_class=parse_class(class_name);
    const auto parsed_spec=dbc::translate_spec_str(parsed_class,spec_name);
    if(parsed_race==RACE_UNKNOWN||parsed_race==RACE_NONE||parsed_spec==SPEC_NONE)throw std::runtime_error("Missing/unsupported race or specialization");
    auto valid_trait=[&](const trait_data_t& trait){
      return trait.id_class==util::class_id(parsed_class)&&trait.row>0&&trait.col>0&&trait.max_ranks>0&&
        (std::all_of(trait.id_spec.begin(),trait.id_spec.end(),[](unsigned id){return id==0;})||
         std::find(trait.id_spec.begin(),trait.id_spec.end(),static_cast<unsigned>(parsed_spec))!=trait.id_spec.end()||
         trait_data_t::is_hero_trait_available(&trait,parsed_class,parsed_spec,false));
    };
    for(unsigned id:enabled_traits){const auto* trait=trait_data_t::find(id,false);if(!trait||!valid_trait(*trait))throw std::runtime_error("Invalid enabled trait: "+std::to_string(id));}
    auto apply_manual_traits=[&](player_t* actor,const std::set<unsigned>& ids){
      for(unsigned id:ids){const auto* data=trait_data_t::find(id,false);const auto text=std::to_string(id)+":"+std::to_string(data->max_ranks)+"/";
        switch(static_cast<talent_tree>(data->tree_index)){
          case talent_tree::CLASS:actor->class_talents_str+=text;break;
          case talent_tree::SPECIALIZATION:actor->spec_talents_str+=text;break;
          case talent_tree::HERO:actor->hero_talents_str+=text;break;
          default:break;
        }
      }
    };
    dbc::init();
    module_t::init();
    unique_gear::register_hotfixes();
    unique_gear::register_special_effects();
    unique_gear::sort_special_effects();
    hotfix::apply();
    sim_t sim;sim.strict_parsing=true;sim.item_db_sources={"local"};
    sim.use_optimal_buffs_and_debuffs(0);
    auto* player=module_t::get(parsed_class)->create_player(&sim,name,parsed_race);
    player->true_level=level;
    player->_spec=parsed_spec;
    player->talents_str=talents;
    apply_manual_traits(player,enabled_traits);
    std::vector<std::tuple<talent_tree,unsigned,unsigned>> all_traits;
    sim.register_actor_initializer(INIT_ACTOR_TALENTS+1,[&](player_t* actor){
      if(actor!=player)return;
      all_traits=actor->player_traits;
      actor->player_traits.erase(std::remove_if(actor->player_traits.begin(),actor->player_traits.end(),[&](const auto& trait){return disabled_traits.count(std::get<1>(trait))>0;}),actor->player_traits.end());
    },"wgm_trait_selection");
    // A naked character has no usable combat action list. This adapter only
    // needs SimC's initialization phases, so keep it active for stat queries.
    sim.register_actor_initializer(INIT_ACTOR_CREATE_ACTIONS+1,[&](player_t* actor){if(actor==player)actor->quiet=false;},"wgm_stat_only");
    std::istringstream profs(professions);std::string prof;
    while(std::getline(profs,prof,'/')){auto eq=prof.find('=');if(eq==prof.npos)continue;auto p=util::parse_profession_type(prof.substr(0,eq));if(p!=PROFESSION_NONE)player->profession[p]=std::stoi(prof.substr(eq+1));}
    sim.init();
    player->reset();
    std::ostringstream out;
    out<<"SimC Gear Resolver 0.1 | SimC "<<SC_VERSION<<"\nData: "<<dbc::client_data_version_str(false)<<"\nSource: ac0f3a3c7ff9e521137c0ca1760d548330c697f3\nCharacter: "<<name<<" | "<<class_name<<"/"<<spec_name<<" | level="<<level<<"\nExport: "<<version<<"\n";
    out<<"Scope: un-geared character stats with selected permanent talents; item fixed stats. No combat, temporary buffs, set bonuses or proc averages.\n";
    out<<"Context: race="<<race_name<<" | talents="<<talents<<"\n";
    out<<"raw_character: strength="<<player->dbc->race_base(player->race).strength+player->dbc->attribute_base(player->type,level).strength
       <<", agility="<<player->dbc->race_base(player->race).agility+player->dbc->attribute_base(player->type,level).agility
       <<", stamina="<<player->dbc->race_base(player->race).stamina+player->dbc->attribute_base(player->type,level).stamina
       <<", intellect="<<player->dbc->race_base(player->race).intellect+player->dbc->attribute_base(player->type,level).intellect<<"\n";
    out<<"initial_character: "<<stat_text(player->initial.stats)<<"\n";
    const auto character=character_values(player);
    const auto multipliers=character_multipliers(player);
    const auto response=parsed_class==DEMON_HUNTER&&parsed_spec==DEMON_HUNTER_VENGEANCE?armor_response(player):std::array<double,3>{};
    const auto character_with_gear=discover_traits?character_with_probe_gear(player):character;
    out<<"character_stats: ";for(size_t i=0;i<character.size();++i)out<<(i?", ":"")<<character_keys[i]<<"="<<character[i];out<<"\n";
    // Export the naked character-sheet values from SimC, including class and
    // specialization passives. Haste is stored internally as a time multiplier.
    const bool spell_role=player->primary_role()==ROLE_SPELL||player->primary_role()==ROLE_HEAL;
    out.precision(10);
    out<<"character_percent: crit="<<100*(spell_role?player->composite_spell_crit_chance():player->composite_melee_crit_chance())
       <<", haste="<<100*(1/(spell_role?player->composite_spell_haste():player->composite_melee_haste())-1)
       <<", mastery="<<100*player->composite_mastery_value()
       <<", versatility="<<100*player->composite_damage_versatility()
       <<", avoidance="<<100*player->composite_avoidance()
       <<", leech="<<100*player->composite_leech()
       <<", speed="<<100*player->composite_run_speed()<<"\n";
    out<<"character_factors: ";for(size_t i=0;i<multipliers.size();++i)out<<(i?", ":"")<<character_keys[i]<<"="<<multipliers[i];out<<"\n";
    if(parsed_class==DEMON_HUNTER&&parsed_spec==DEMON_HUNTER_VENGEANCE)
      out<<"character_response: armor_agility="<<response[0]<<", armor_mastery="<<response[1]<<", armor_joint="<<response[2]<<"\n";
    for(const auto& trait:all_traits){
      auto* data=trait_data_t::find(std::get<1>(trait),false);
      if(data)out<<"trait: id="<<std::get<1>(trait)<<" | spell="<<data->id_spell<<" | name="<<data->name<<" | rank="<<std::get<2>(trait)<<" | enabled="<<(disabled_traits.count(std::get<1>(trait))?0:1)<<" | origin="<<(enabled_traits.count(std::get<1>(trait))?"manual":"import")<<"\n";
    }
    // Isolate selected traits with SimC's own initialization. Only changes to
    // the displayed attributes become editable effects in the UI.
    std::set<unsigned> seen_traits;
    std::vector<std::tuple<talent_tree,unsigned,unsigned>> candidates=all_traits;
    if(discover_traits){
      for(auto tree:{talent_tree::CLASS,talent_tree::SPECIALIZATION,talent_tree::HERO})
        for(const auto& data:trait_data_t::data(util::class_id(parsed_class),tree,false))
          if(valid_trait(data))candidates.emplace_back(tree,data.id_trait_node_entry,data.max_ranks);
    }
    for(const auto& trait:candidates){
      const unsigned id=std::get<1>(trait);
      if(!seen_traits.insert(id).second)continue;
      const bool selected=std::any_of(all_traits.begin(),all_traits.end(),[&](const auto& entry){return std::get<1>(entry)==id;});
      try{
        sim_t trial;trial.strict_parsing=true;trial.item_db_sources={"local"};
        trial.use_optimal_buffs_and_debuffs(0);
        auto* candidate=module_t::get(parse_class(class_name))->create_player(&trial,name,util::parse_race_type(race_name));
        candidate->true_level=level;candidate->_spec=dbc::translate_spec_str(candidate->type,spec_name);candidate->talents_str=talents;
        const bool disabled=disabled_traits.count(id)>0;
        auto trial_enabled=enabled_traits;
        if(selected)trial_enabled.erase(id);else trial_enabled.insert(id);
        apply_manual_traits(candidate,trial_enabled);
        trial.register_actor_initializer(INIT_ACTOR_TALENTS+1,[&](player_t* actor){
          if(actor!=candidate)return;
          actor->player_traits.erase(std::remove_if(actor->player_traits.begin(),actor->player_traits.end(),[&](const auto& entry){const auto entry_id=std::get<1>(entry);return disabled?(disabled_traits.count(entry_id)>0&&entry_id!=id):(disabled_traits.count(entry_id)>0||(selected&&entry_id==id));}),actor->player_traits.end());
        },"wgm_trial_trait");
        trial.register_actor_initializer(INIT_ACTOR_CREATE_ACTIONS+1,[&](player_t* actor){if(actor==candidate)actor->quiet=false;},"wgm_trial_active");
        trial.init();candidate->reset();const auto without=character_values(candidate),without_factors=character_multipliers(candidate);
        const auto without_with_gear=discover_traits?character_with_probe_gear(candidate):without;
        const auto trial_response=parsed_class==DEMON_HUNTER&&parsed_spec==DEMON_HUNTER_VENGEANCE?armor_response(candidate):std::array<double,3>{};
        std::ostringstream delta,ratio_text,gear_delta;bool any=false,has_ratio=false,has_gear_delta=false;
        for(size_t i=0;i<character.size();++i){const auto difference=(!selected||disabled)?without[i]-character[i]:character[i]-without[i];if(std::abs(difference)>0.001){if(any)delta<<", ";any=true;delta<<character_keys[i]<<"="<<difference;}}
        for(size_t i=0;i<multipliers.size();++i){const auto with=(!selected||disabled)?without_factors[i]:multipliers[i],without_value=(!selected||disabled)?multipliers[i]:without_factors[i];if(without_value==0)continue;const auto ratio=with/without_value;if(std::abs(ratio-1)>0.00001){if(has_ratio)ratio_text<<", ";has_ratio=true;ratio_text<<character_keys[i]<<"="<<ratio;}}
        for(size_t i=0;i<character_with_gear.size();++i){const auto difference=(!selected||disabled)?without_with_gear[i]-character_with_gear[i]:character_with_gear[i]-without_with_gear[i];if(std::abs(difference)>0.001){if(has_gear_delta)gear_delta<<", ";has_gear_delta=true;gear_delta<<character_keys[i]<<"="<<difference;}}
        if(any||has_ratio||has_gear_delta){
          if(!selected){const auto* data=trait_data_t::find(id,false);out<<"trait: id="<<id<<" | spell="<<data->id_spell<<" | name="<<data->name<<" | rank="<<data->max_ranks<<" | enabled=0 | origin=available\n";}
          if(any)out<<"trait_effect: id="<<id<<" | stats: "<<delta.str()<<"\n";
          if(has_ratio)out<<"trait_multiplier: id="<<id<<" | stats: "<<ratio_text.str()<<"\n";
          if(has_gear_delta)out<<"trait_probe: id="<<id<<" | stats: "<<gear_delta.str()<<"\n";
          if(parsed_class==DEMON_HUNTER&&parsed_spec==DEMON_HUNTER_VENGEANCE){
            const auto sign=(!selected||disabled)?-1.0:1.0;
            out<<"trait_response: id="<<id<<" | armor_agility="<<sign*(response[0]-trial_response[0])
               <<", armor_mastery="<<sign*(response[1]-trial_response[1])
               <<", armor_joint="<<sign*(response[2]-trial_response[2])<<"\n";
          }
          const auto talent=(!selected||disabled)?candidate->find_talent_spell(id):player->find_talent_spell(id);
          if(talent.ok()){
            out<<"trait_spell: id="<<id<<" | rank="<<talent.rank();
            for(unsigned n=1;n<=talent->effect_count();++n){const auto& effect=talent->effectN(n);if(effect.ok())out<<" | e"<<n<<"="<<effect.base_value();}
            out<<"\n";
          }
        }
      }catch(const std::exception& e){out<<"WARNING: unable to isolate trait "<<id<<": "<<error_chain(e)<<"\n";}
    }
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
        const bool embellished=has_embellishment_limit(item);
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

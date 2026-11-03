# SimC 本地装备解析引擎原型

## Electron 角色属性适配器

`character_percent` 导出 SimC 裸装初始化后的暴击、急速、精通、全能、闪避、吸血、加速百分比。近战与法系分别使用对应的暴击/急速接口；急速把 SimC 内部的时间倍率转为面板百分比。加速使用 `composite_run_speed()` 的等级贡献，包含其专用衰减，不包含其他移动技能的速度增益。

适配器调用 SimC 的角色初始化，读取职业、种族、等级、专精和当前天赋编码。也接受无装备、无原始导出串的手动角色。`raw_character` 是职业与种族数据表相加的未加成值；`character_stats` 是无装备、无食物合剂等临时增益，但保留常驻被动及已选天赋的结果；`character_factors` 保存属性倍率。适配器遍历当前职业与专精的天赋，用 SimC 分别计算勾选前后的属性；`trait_effect` 记录脱装状态的数值差，`trait_multiplier` 记录上下文中的实际倍率差，`trait_probe` 用模拟装备值找出脱装状态下未显现的属性联动，`trait_spell` 保存按实际点数和专精解析的法术自身效果值。界面描述取 `trait_spell`，不把叠乘后的 `trait_multiplier` 当作天赋文字。编译时的 stat-only 路径跳过战斗动作列表和治疗目标的创建，不改变角色与天赋的属性计算。

本次新增 `base_for_spec`（只对装备本体做专精主属性转换）和 `gear_flags`（插孔数量、套装 ID、已知美化匹配）输出。Electron 会在调用前移除宝石、附魔参数，仅使用本体属性建立可编辑装备记录。CLI 保留原有包含宝石/附魔的报告功能及测试。

美化通过内置 embellishment 表的 bonus ID 或法术效果匹配，未覆盖该表的特殊内置效果需人工核对。新增代码在同目录 gear_resolver.cpp 中，原有 build.py 可从随附源码重建；manifest.json 的哈希已更新。

读取游戏内 `/simc` 导出文本，输出逐件装备属性的纯文本报告。运行时不联网、不上传角色信息、不进行战斗模拟。

`generate_talent_zh.py` 可在更新 SimC 数据后重新探测各职业专精中影响基础属性的天赋，并从 Wowhead CN 法术页生成 `src/shared/data/talent-zh.js`（相对于项目根目录）。这是开发时的生成步骤；应用运行时使用随包中文名称，不访问网络。尚无已核对中文名称时界面保留 SimC 英文原名。

在项目根目录执行 `node engine/generate_profile_catalog.cjs`，根据随包 WASM 生成 `src/shared/data/profile-catalog.js` 和 `src/shared/data/mastery-data.js`，包含满级时 40 个职业/专精的天赋、基础倍率与精通系数、26 个种族的原始主属性及属性倍率。`python engine/generate_rating_data.py --source engine/simc-source` 从同份源码生成 `src/shared/data/rating-data.js`。可选天赋使用 SimC 当前数据中的满级点数，导入时保留实际点数。用户更改角色选项时通过快速 SimC 路径重算基础属性，保留手动编辑产生的增幅前修正量；显示值随新选项和倍率更新。

装备显示名称按以下顺序选择：`data/item-names.json` 中按物品 ID 查询到的中文名、导出字符串的名称（`# 名称 (装等)` 注释，或装备行逗号前的名称）、SimC 数据库英文名称。字典中仍为英文的占位项不会覆盖导出名称。中文词库保持 Chrome 扩展的完整原始 JSON 格式，独立于 WASM，应用运行时不联网。

`python engine/update_item_names.py` 从 Chrome 商店下载扩展并提取原始 JSON，同时写入版本、来源和 SHA256 到 `data/item-names.source.json`。可用 `--fallback "本地扩展版本目录"` 指定商店获取失败时使用的已解压扩展目录。2026-10-27 已直接从商店取得扩展 0.2.4 的 175,747 个物品 ID；扩展包未附明确的数据再分发许可证，来源记录保留这一状态。

2026-09-23 的逐专精核查覆盖全部 40 个职业/专精、35 个属性天赋（79 个专精条目）。先前遗漏了武器与狂怒战士的“全副武装”：裸角色没有护甲，但装备护甲会转力量。SimC 满级法术值为武器/狂怒 10%，防护 4%。 “加固板甲”自身效果在武器/狂怒为耐力 10%、护甲 10%；防护当前 SimC 法术值为耐力 10%、护甲 16%。SimC 对某些护甲效果还叠加其他被动，故最终倍率不同于法术自身文字。配装计算按 SimC 的防护战士先锋力量转护甲及全副武装反馈公式、复仇恶魔猎手敏捷/精通转护甲、以及生存猎人双持时“突刺”额外敏捷计算。

## 运行

需要 Node.js；本次验证使用 Windows x64、Node.js 22.16.0。进入本目录后运行：

```powershell
node run.cjs ../tests/fixtures/sample.simc "$env:TEMP/wowgearmatrix-sample-result.txt"
```

解析自己的导出文件（支持中文路径）：

```powershell
node run.cjs "C:\Users\Administrator\Desktop\Simulationcraft导出字符串.txt" "装备属性.txt"
```

省略输出文件参数会直接输出到终端，也可使用 `parse.cmd 输入文件 输出文件`。输入参数为 `-` 时从标准输入读取，方便后续 Electron 通过子进程传入文本。

**实际计算由 SimC C++ 编译成的 WebAssembly 执行，Node 仅负责文件读写和启动。当前交付不是 Windows 原生 EXE。** Electron 已包含 Node 运行环境，后续可封装为应用的本地计算模块。

必须保留 `run.cjs`、`gear-resolver.js`、`gear-resolver.wasm` 三个文件在同一目录。数据库已编译进 wasm。

## 输出内容

- 身上装备、背包候选等来源；重复物品单独保留。
- 物品 ID、数据库英文名称、导出注释中的中文名称。
- 计算装等，并与导出注释中的装等比较。
- `base`：装备本体的原始属性。
- `gems`、`enchant`、`socket_bonus`：固定宝石、附魔及插槽奖励。
- `total_for_spec`：按职业专精转换通用主属性后的固定属性合计。
- 武器基础伤害区间和攻速。
- 特效法术 ID；触发效果不折算为固定属性。
- 样例的鹰之目戒指附魔：单列暴击伤害、暴击治疗百分比加成，不把百分比误加成暴击等级。

常见字段：`strength` 力量，`stamina` 耐力，`crit_rating` 暴击等级，`haste_rating` 急速等级，`mastery_rating` 精通等级，`versatility_rating` 全能等级，`armor` 护甲，`avoidance_rating` 闪避伤害等级，`speed_rating` 加速等级。

`strint`、`stragi`、`stragiint` 等是数据库里的可切换主属性。看角色适用的合计时使用 `total_for_spec`。数据库中显式存在的其他主属性仍可能保留；这不是完整角色面板，也不表示所有列出的主属性都会提高当前专精输出。

## 范围与限制

- 支持样例中的 bonus、制造属性、内容缩放、`redirected_base_stats`、宝石和附魔。
- 角色基础属性包含 SimC 初始化时生效的已选天赋与常驻效果；只影响装备数值的百分比天赋也会显示为选项。套装组合、食物、团队增益、战斗触发和 DPS 不纳入角色基础属性。
- 饰品、武器附魔等复杂效果主要输出法术 ID/名称；没有完整重建游戏内提示文本或图标。
- 百分比被动效果与固定属性分开。仅对已明确识别的暴击伤害/治疗效果给出友好数值，其余不会假装已经计算为完整提示。
- 未知物品、bonus、宝石、附魔会报错。每件装备独立处理，一件失败不会丢弃其他装备。
- 采用受限装备参数解析，不接受任意 SimC 脚本、文件包含或网络数据源。
- `crafting_quality` 在当前 SimC 中是兼容字段；实际制造装等按 bonus 处理。仅修改这个字段不保证改变装备品质结果。
- 未校验导出文本末尾的 Checksum；它不参与属性计算。
- 不同游戏版本会提示兼容性未验证；不会在线自动切换数据。

## 本次验证

提供的样例：16 件身上装备 + 10 件背包装备，26 件均解析成功，计算装等与全部 26 条注释一致。

回归检查覆盖槽位别名、同 ID 不同 bonus、移除宝石附魔、未知物品和 bonus、错误输入、版本警告、中文路径及 BOM/CRLF。在项目根目录运行：

```powershell
npm.cmd run test:engine
```

2026-10-27 更新后，10 项引擎检查与当时根目录的 16 个测试文件全部通过；`test-engine-update-ui.cjs` 已验证实际导入、三层名称回退、装备卡片显示和角色保存。历史记录见 [validation.txt](../docs/validation/validation.txt)。测试现分别位于 `tests/engine`、`tests/unit` 与 `tests/electron`。

**验证边界：这些检查证明程序运行、样例覆盖、装等一致和部分属性变化逻辑。未进入 WoW 对照逐件属性截图，不能把它当作已逐项完成游戏内数值验收。**

退出码：`0` 成功；`1` 输入/运行错误；`2` 至少一件装备失败或装等不匹配。报告的 Summary 和 WARNING/ERROR 行应由调用方保留。

## 源码与重建

- 上游：https://github.com/simulationcraft/simc
- 分支：`midnight`（2026-10-27 获取）
- 固定提交：`426ad85ecb1c5d9a1af166931478dabf29b42fdd`
- 引擎：`1210-01`
- 游戏数据：`12.1.5.70575`
- 热修数据日期：`2026-10-24`
- 测试过的编译器：Emscripten `3.1.8`，C++17，O1，禁用网络/线程/PTR。

随附 `simc-source.zip` 包含本次构建使用的引擎源码、生成数据、许可证及兼容修补。`patch_simc.py` 也可将这些修补应用到同一提交的干净源码。修补处理禁用线程时的报表代码、缺少的 `<vector>` 引用，以及仅计算属性时跳过战斗动作与虚拟治疗目标，不修改装备计算公式。源码目录的 `UPSTREAM_COMMIT` 在构建时写入 WASM 报告的 `Source` 字段。

解压源码后，在配置好 Emscripten 和 Python 3.10+ 的终端运行：

```powershell
python build.py --source ./simc-source --emxx em++
```

也可以用 `--emxx 完整路径/em++.py --em-config 完整路径/.emscripten` 指定工具链。源代码编译需要数分钟和较多内存。

另附 CMake 配置用于尝试原生 C++ 构建；本次只验证了 WebAssembly 版本，没有验证 Windows 原生 CMake 构建。

SimC 和本适配器按 GPL-3.0-or-later 提供；上游第三方组件保留各自许可证，详见 LICENSE/COPYING 与源码包内文件。

## 角色状态

`# wgm_state=auto` 根据专精选择已学习的常驻状态：武器战斗姿态、狂怒狂暴姿态、防护防御姿态、守护熊形态、野性猎豹形态、平衡枭兽形态、暗牧暗影形态。未学习时回落到无状态。可显式选择 `none`、`battle_stance`、`defensive_stance`、`berserker_stance`、`bear_form`、`cat_form`、`moonkin_form`、`shadowform`；跨职业或未学习的显式状态会报错。CLI 未指定时保持无状态，应用导入默认使用 auto。

仅执行所选状态的 SimC 原生动作，不运行战斗前动作列表或战斗。每次重置、装备属性探测、天赋差分均恢复所选状态；保留莱卡拉的教诲等形态绑定常驻属性，清除变形附带的乌索尔的活力等临时触发。团队增益继续关闭。暗影形态主要影响伤害，本工具不会把伤害加成当成主属性。

状态、可用选项和实际生效状态随角色保存；界面在“影响属性的天赋、被动”下勾选姿态与形态，互斥选项最多勾选一项；天赋按法术被动标记分组。切换状态及天赋会更新基础属性。原有角色须选择一次状态或重新导入。加速栏仍表示加速等级贡献，不表示包含猎豹形态等效果的完整移动速度。

在项目根目录验证：`node tests/unit/test-character-state.cjs`；Electron 交互测试：`npm.cmd run test:electron -- test-character-state-ui.cjs`。

## 基础属性快速更新

应用日常切换种族、职业、专精及天赋时使用 `# wgm_fast_profile=1`：仍由 SimC 初始化角色并输出完整裸装数值、百分比、倍率和属性联动，只跳过逐项隔离天赋的重复初始化。天赋选项、法术数值及主动/被动标记复用与同一引擎生成的 `profile-catalog.js`；已选天赋的点数与法术数值从当次 SimC 结果读取。首次导入仍完整发现天赋。主进程最多缓存 64 份成功的基础属性请求结果，重复选择无需再启动解析进程。

天赋说明展示所选点数的法术原始数值，不使用开关前后的面板百分比差值。例如地精的 1% 急速与 2% 狂野打击相乘，面板急速是 3.02%，但狂野打击说明仍为 `+2%急速`。特殊精通倍率、形态绑定加成及非第一法术效果使用对应的说明。

验证：`node tests/unit/test-fast-profile.cjs` 对照完整/快速 SimC 输出，并检查中文名称覆盖与法术数值；`tests/electron/test-character-state-ui.cjs` 覆盖勾选、重新导入、重启与重复选择缓存耗时。

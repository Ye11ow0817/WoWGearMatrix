# SimC 本地装备解析引擎原型

## Electron 0.2 适配器补充

本次新增 `base_for_spec`（只对装备本体做专精主属性转换）和 `gear_flags`（插孔数量、套装 ID、已知美化匹配）输出。Electron 会在调用前移除宝石、附魔参数，仅使用本体属性建立可编辑装备记录。CLI 保留原有包含宝石/附魔的报告功能及测试。

美化通过内置 embellishment 表的 bonus ID 或法术效果匹配，未覆盖该表的特殊内置效果需人工核对。新增代码在同目录 gear_resolver.cpp 中，原有 build.py 可从随附源码重建；manifest.json 的哈希已更新。

读取游戏内 `/simc` 导出文本，输出逐件装备属性的纯文本报告。运行时不联网、不上传角色信息、不进行战斗模拟。

## 运行

需要 Node.js；本次验证使用 Windows x64、Node.js 22.16.0。进入本目录后运行：

```powershell
node run.cjs sample.simc sample-result.txt
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
- 不应用天赋、套装组合、食物、团队增益、战斗触发或 DPS 计算。
- 饰品、武器附魔等复杂效果主要输出法术 ID/名称；没有完整重建游戏内提示文本或图标。
- 百分比被动效果与固定属性分开。仅对已明确识别的暴击伤害/治疗效果给出友好数值，其余不会假装已经计算为完整提示。
- 未知物品、bonus、宝石、附魔会报错。每件装备独立处理，一件失败不会丢弃其他装备。
- 采用受限装备参数解析，不接受任意 SimC 脚本、文件包含或网络数据源。
- `crafting_quality` 在当前 SimC 中是兼容字段；实际制造装等按 bonus 处理。仅修改这个字段不保证改变装备品质结果。
- 未校验导出文本末尾的 Checksum；它不参与属性计算。
- 不同游戏版本会提示兼容性未验证；不会在线自动切换数据。

## 本次验证

提供的样例：16 件身上装备 + 10 件背包装备，26 件均解析成功，计算装等与全部 26 条注释一致。

回归检查覆盖槽位别名、同 ID 不同 bonus、移除宝石附魔、未知物品和 bonus、错误输入、版本警告、中文路径及 BOM/CRLF：

```powershell
node test.cjs
```

**验证边界：这些检查证明程序运行、样例覆盖、装等一致和部分属性变化逻辑。未进入 WoW 对照逐件属性截图，不能把它当作已逐项完成游戏内数值验收。**

退出码：`0` 成功；`1` 输入/运行错误；`2` 至少一件装备失败或装等不匹配。报告的 Summary 和 WARNING/ERROR 行应由调用方保留。

## 源码与重建

- 上游：https://github.com/simulationcraft/simc
- 固定提交：`ac0f3a3c7ff9e521137c0ca1760d548330c697f3`
- 引擎：`1210-01`
- 游戏数据：`12.1.0.69814`
- 热修数据日期：`2026-09-12`
- 测试过的编译器：Emscripten `3.1.8`，C++17，O1，禁用网络/线程/PTR。

随附 `simc-source.zip` 包含本次构建使用的源码、生成数据、许可证以及四处兼容修补。`patch_simc.py` 也可将这些修补应用到同一提交的干净源码。修补涉及禁用线程时的报表代码及缺少的 `<vector>` 引用，没有修改装备计算公式。

解压源码后，在配置好 Emscripten 和 Python 3.10+ 的终端运行：

```powershell
python build.py --source ./simc-source --emxx em++
```

也可以用 `--emxx 完整路径/em++.py --em-config 完整路径/.emscripten` 指定工具链。源代码编译需要数分钟和较多内存。

另附 CMake 配置用于尝试原生 C++ 构建；本次只验证了 WebAssembly 版本，没有验证 Windows 原生 CMake 构建。

SimC 和本适配器按 GPL-3.0-or-later 提供；上游第三方组件保留各自许可证，详见 LICENSE/COPYING 与源码包内文件。

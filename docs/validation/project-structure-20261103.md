# 2026-11-03 项目目录整理验证

后续已逐项排查本记录中的九项界面测试失败，原因与修复见 [界面测试排查记录](ui-test-fixes-20261103.md)。下文保留目录整理时的验证状态。

本次将应用、测试、发布脚本、生成数据与验证记录按职责归位，修改相应路径。Electron、依赖版本、SimC/WASM 与词库数据未升级。结构与参考依据见 [项目结构](../project-structure.md)。

## 已通过

- 整理前与整理后运行 `npm.cmd test`：16 个逻辑测试文件均通过。
- `npm.cmd run test:engine`：原有 10 项 CLI/WASM 检查通过。
- 实际 Electron 界面测试：`test-engine-update-ui.cjs`、`test-character-state-ui.cjs`、`test-export-modes-ui.cjs`、`test-max-gem-colors-ui.cjs` 通过。
- 50 个 JavaScript/CommonJS 文件语法检查、PowerShell 发布脚本解析和 Python 引擎工具语法检查通过。
- ASAR 清单检查：入口为 `src/main/main.cjs`，HTML、preload、Web Worker、utility process、WASM、词库、图片和 SortableJS 均包含；测试、开发脚本与文档不在 ASAR 内。
- 12 个仅迁移文件的内容与整理前一致（忽略换行格式），涵盖 preload、CSS、预设、生成数据、样例与历史记录。
- `npm.cmd run dist:win` 成功生成 `dist/WoWGearMatrix-20261103-win-x64.exe`。
- 对 `win-unpacked` 和便携 EXE，均从其他工作目录启动，使用独立角色目录，完成真实 SimC 导入、preload/IPC、utility process、WASM、词库及插孔图片加载、搜索 Web Worker 的两条候选计算，以及第二次启动后的角色和搜索恢复验证。

Electron 和 electron-builder 的运行验证需要在受限子进程环境外执行。受限环境内，整理前已出现 GPU/renderer 启动失败；正常环境内的实际导入测试及上述打包运行验证均通过。

## 既有界面测试失败

已运行全部 13 个原有 Electron 测试脚本，其中 4 个通过、9 个失败。将整理前的 HEAD 文件提取到独立临时目录、连接相同依赖后，以下 9 个测试均在同一断言处复现相同失败：

| 测试 | 失败表现 |
| --- | --- |
| `test-base-percent-ui.cjs` | 占位百分比实际 `20.44`，预期 `20.4` |
| `test-comparison-ui.cjs` | 结果文案实际“计算完成 · 共 2 条”，断言仍匹配旧文案 |
| `test-config-layout.cjs` | 界面分类包含“自定义”，旧分类数组未包含 |
| `test-custom-tags-ui.cjs` | 标签列表包含“孔：0 孔”，旧数组未包含 |
| `test-profile-ui.cjs` | 未找到旧测试要求的天赋 `seer` |
| `test-result-export-ui.cjs` | 旧导出分组布局断言失败 |
| `test-speed-percent-ui.cjs` | 实际 `100 (8.44%)`，旧预期没有空格 |
| `test-ui.cjs` | 导入后取消“加固板甲”，耐力实际 `4600`，旧预期仍为 `5060` |
| `test-workspace-ui.cjs` | 抽屉布局高度实际 `161`，旧预期 `173` |

本次保留这些断言和行为差异。`scripts/verify-release.ps1` 仍默认执行原有 `test-ui.cjs`，因此一键发布的完整界面验收仍会在该既有断言处停止。本次验证了打包与目录迁移相关的运行流程，没有把所有既有界面测试标记为通过，也未执行完整的一键发布/源码归档流程。

## 本机证据

- `.tmp/structure-validation.json`：语法、依赖路径与 ASAR 检查摘要。
- `.tmp/structure-baseline-results/results.json`：9 项失败在整理前代码上的对照结果。
- `.tmp/structure-runtime-EbY0vs/`：打包目录启动与重启验证。
- `.tmp/structure-portable-e3779db2f46840b186c27c073aa84272/`：便携 EXE 启动与重启验证。

以上临时证据位于本机忽略目录，不随应用发布。角色验证使用隔离数据；未提交或推送本次修改。

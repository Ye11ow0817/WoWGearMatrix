# 项目结构

应用代码按 Electron 的进程职责划分，测试、开发脚本、资源与引擎分别存放。保留原生 JavaScript/CommonJS 和现有 electron-builder 流程；开发时直接加载源码，无需编译前端。

```text
WoWGearMatrix/
├── src/
│   ├── main/                 # 主进程、持久化、SimC utility process
│   │   ├── main.cjs          # package.json 的 main 入口
│   │   ├── storage.cjs
│   │   └── worker.cjs
│   ├── preload/preload.cjs   # contextBridge / IPC 桥接
│   ├── renderer/            # HTML、CSS、DOM 交互、搜索 Web Worker
│   └── shared/              # Node / 浏览器共用的业务逻辑
│       └── data/            # 生成的职业、天赋、评级与精通数据
├── tests/
│   ├── unit/                # 模型、搜索、属性、持久化；部分调用 WASM
│   ├── engine/              # CLI + WASM 集成回归
│   ├── electron/            # 实际窗口、IPC、导入、导出和重启测试
│   └── fixtures/            # SimC 样例输入与参考输出
├── scripts/
│   ├── release.ps1          # 完整发布：测试、打包、验证与源码归档
│   ├── package-win-portable.cjs # 仅生成 Windows 便携 EXE
│   ├── run-electron-tests.cjs   # Electron 界面测试运行器
│   └── verify-release.ps1   # 验证已有发布包
├── assets/                  # 随应用发布的界面图片
├── data/                    # 随应用发布的 JSON 词库及来源元数据
├── engine/                  # SimC 适配器、WASM、CLI、构建/生成工具和许可证
├── build/                   # 打包图标等构建资源
├── docs/
│   └── validation/          # 历史验证记录（保留当时的命令与路径）
├── dist/                    # 本机发布产物（Git 忽略）
├── .tmp/                    # 本机临时验证记录（Git 忽略）
├── package.json             # 开发入口、npm 命令、打包白名单
├── package-lock.json        # 锁定依赖
├── release.cmd              # Windows 一键发布入口
└── start-dev.cmd            # Windows 开发启动入口
```

## 放置与依赖规则

- `main` 处理 Node/Electron 特权操作，使用 `shared`，并通过 `worker.cjs` 调用 `engine`。
- `preload` 仅提供明确的桥接方法，保持独立脚本，以适配当前开启的 sandbox。
- `renderer` 使用浏览器 API 与 preload 暴露的接口。HTML 通过普通 script 标签加载 `shared`，搜索 Worker 通过 `importScripts` 加载所需模块。
- `shared` 的业务模块保持 Node/CommonJS 与浏览器全局变量两种入口，不依赖 `main`、`preload` 或界面 DOM。中文 JSON 词库由其 Node 分支加载。
- `shared/data` 保存生成模块；根目录 `data` 保存原始 JSON 词库和来源记录。更新时运行对应生成工具，避免直接修改生成结果。
- `engine` 保留为可独立重建和运行的子系统，WASM 与加载器仍位于同一目录。其源码包和许可证与发布源码一起交付。
- 测试脚本和应用中的文件定位以各自模块目录为基准；CLI 的用户输入/输出路径仍相对于调用者的工作目录。

## 数据更新入口

以下命令在项目根目录执行，详细前提见 [引擎说明](../engine/README.md)。

| 命令 | 输出 |
| --- | --- |
| `node engine/generate_profile_catalog.cjs` | `src/shared/data/profile-catalog.js`、`mastery-data.js` |
| `python engine/generate_rating_data.py --source engine/simc-source` | `src/shared/data/rating-data.js` |
| `python engine/generate_talent_zh.py` | `src/shared/data/talent-zh.js` |
| `python engine/update_item_names.py` | `data/item-names.json`、`item-names.source.json` |

## 开发与发布

常用命令见 [README](../README.md)。`npm run test:electron` 可接一个或多个 `tests/electron` 内的文件名；每个测试使用独立临时目录，支持重启检查的脚本会再运行一次恢复阶段，控制台打印日志和截图路径。

本次整理的检查结果与既有界面测试失败见 [2026-11-03 验证记录](validation/project-structure-20261103.md)。

`package.json` 的 `build.files` 只收录 `src`、指定的运行资源、WASM、许可证和 SortableJS；`tests`、`scripts`、文档与临时记录不进入应用 ASAR。`scripts/release.ps1` 从项目根目录构建和归档，排除依赖、发布目录与临时构建目录。`build/` 是打包资源，`dist/` 是发布输出，两者用途不同。

脚本文件统一使用英文小写与连字符，按职责命名；`start-dev` 表示开发启动，`package` 表示生成包，`release` 表示完整发布准备，`run-*-tests` 表示测试运行器，`verify-release` 表示成品验证。npm 命令使用冒号分组：`dist:win` 仅打包，`release:win` 执行完整流程，`test:release` 验证现有 EXE。发布准备在本机生成文件，不上传产物。历史验证记录保留执行时使用的旧名称。

## 参考依据

- [Electron 官方进程模型](https://www.electronjs.org/docs/latest/tutorial/process-model)：主进程、渲染进程、preload 与 utility process 的职责依据。该文档说明进程模型，没有规定本项目必须采用的目录树。
- [Electron Fiddle 的 src 目录](https://github.com/electron/fiddle/tree/main/src)：使用 `main`、`preload`、`renderer` 等目录组织应用。
- [electron-vite 的项目结构约定](https://electron-vite.org/guide/dev#project-structure)：明确推荐 `src/main`、`src/preload`、`src/renderer`。本项目参考其目录命名，不引入该构建工具。

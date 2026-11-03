# WoW配装

## 初次克隆并启动（Windows）

安装 Git 和 Node.js（建议使用 Node.js 22 LTS）。打开 PowerShell，执行：

```powershell
git clone https://github.com/Ye11ow0817/WoWGearMatrix.git
cd WoWGearMatrix
npm.cmd ci
npm.cmd start
```

首次安装依赖需要网络。以后进入项目目录执行 `npm.cmd start`，或双击 `启动开发版.cmd`，即可启动开发版。

装备中文名称使用独立的本地 JSON 词库，显示优先级为：词库中文名称 → SimC 导出字符串中的名称 → SimC 数据库英文名称。词库随应用打包，运行时不访问 Chrome 商店；版本与来源记录在 `data/item-names.source.json`。

## 开发

修改源码后重启开发版即可查看效果，无需重新打包；正式 EXE 需要重新构建才会包含修改。

## 一键发布

双击 `build.cmd`，或在 PowerShell 中执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build.ps1
```

脚本安装锁定依赖、运行逻辑测试、生成 Windows x64 单 EXE、运行隔离的发布包界面及重启测试，最后生成对应源码压缩包。首次构建需要网络。任何步骤失败即停止。

Electron 二进制默认从 npmmirror 下载，安装失败最多重试 3 次，并保留 Electron 自带的校验。已有 `ELECTRON_MIRROR` 或 `npm_config_electron_mirror` 配置会优先使用；如需改用官方下载，可在运行脚本前设置 `$env:ELECTRON_MIRROR = 'https://github.com/electron/electron/releases/download/'`。npm 的 `deprecated` 警告本身不会导致构建失败；若出现 `TypeError: terminated`，表示下载连接中断，应检查镜像或代理连接后重试。

输出：

- `dist/WoWGearMatrix-<yyyyMMdd>-win-x64.exe`：免安装启动文件，可单独复制运行，用户无需安装 Node.js。
- `dist/WoWGearMatrix-<yyyyMMdd>-source.zip`：运行 `build.ps1` 时生成的对应源码、锁文件、构建脚本及 SimC 源码和许可证，与 EXE 使用同一构建日期，供源码交付与重建使用。
- `dist/win-unpacked/`：构建中间产物，无需发送给用户。

仅打包可运行 `npm run dist:win`；单独验证已有 EXE 可运行 `powershell -ExecutionPolicy Bypass -File .\verify-release.ps1`，默认验证文件名时间最新的 EXE，也可用 `-ExePath` 指定文件。

发布文件名使用打包开始时的本地日期，格式为年月日（`yyyyMMdd`），例如 `WoWGearMatrix-20261009-win-x64.exe`。应用版本号仍在 `package.json` 修改。构建依赖固定于 `package-lock.json`；图标位于 `build/icon.ico`。

代码归档到 ASAR；发布文件仅包含运行代码、WASM 与许可证，排除测试、验证记录和开发工具。仅保留 Electron 必需的默认英文语言资源；应用界面固定中文。免安装 EXE 启动时会自动解压运行文件到临时目录。

当前 EXE 未进行代码签名。

## 本地数据

开发版和正式版均将数据保存在 `%APPDATA%\WoWGearMatrix`，角色文件为 `characters-v2.json`，备份为 `characters-v2.json.bak`。数据不随免安装程序的临时目录清理。

不读取或迁移旧目录的数据。新目录没有角色文件时，应用会创建默认角色。验证脚本使用独立临时数据，不改用户角色。

## 基础属性

导入 SimC 字符串后，应用使用随附 SimC 数据和角色初始化规则填写脱装、无食物合剂等临时增益的面板属性，保留种族、职业、专精与导出串中已选天赋的常驻效果。也可以不导入字符串，直接选择种族、职业、专精和属性天赋，并手动填写面板值。手动角色默认满级，可选属性天赋按满级点数计算；导入角色保留导出串中的实际点数。种族、职业、专精显示中文；天赋资料由随包 SimC 生成，已核对的名称显示 Wowhead CN 中文。天赋括号中显示该法术自身的数值，例如“先知之路（+3%智力）”；不同天赋叠乘后的实际属性由 SimC 规则计算。

只有重新导入或手动编辑属性才会改变显示值；切换种族、职业、专精或天赋会更新内部原始属性及倍率，不覆盖面板输入。手动编辑时按当前倍率反推增幅前的原始值。对装备数值的常驻倍率以及战士护甲与力量、复仇恶魔猎手精通与护甲等属性联动会用于组合属性汇总。装备条件、完整套装、触发效果与战斗中增益不属于基础属性；需要与游戏内脱装面板核对这些特殊效果。

筛选中的副属性和额外属性可按评级数值或百分比填写，同一条件的两个输入框会同步。百分比使用随包 SimC 12.1.5.70575 的等级换算表和递减曲线；精通另乘当前专精的精通法术首个效果系数。筛选条件中的百分比表示基础属性与装备合成后的最终面板值，与组合结果使用同一公式；直接输入百分比时，最低等级向上取整、最高等级向下取整。空输入框的上下按钮从显示的默认值开始增减，等级每次 ±10、百分比每次 ±1%；低于裸装基础百分比时等级归零，输入错误显示在对应属性旁。组合结果勾选“显示百分比”后，暴击、急速、精通、全能、闪避、吸血、加速使用基础属性中可编辑的裸装百分比与组合总等级计算面板值；急速按倍率合成，裸装已有等级不会重复计入。基础百分比缺失时结果显示“—”，需手动填写或重新导入 SimC 字符串。加速按 SimC 的加速等级专用公式计算移动速度加成，不包含其他移动技能或临时移动增益。自定义排序公式支持属性名称、数字、括号和四则运算，例如 `(暴击×0.8+急速×0.5)/2+智力×2`。

## 代码入口

- `main.cjs`、`preload.cjs`：窗口与进程通信。
- `renderer.js`、`index.html`、`style.css`：角色及装备界面。
- `model.js`、`presets.js`：数据模型、预设与组合计数。
- `search.js`、`search-ui.js`、`search-worker.js`：筛选、排序与后台计算。
- `worker.cjs`、`engine/`：本地 SimC 解析。
- `storage.cjs`：角色持久化。

## 许可与引擎

GPL-3.0-or-later。引擎数据版本、构建方法和随附源码见 `engine/README.md`、`engine/manifest.json`、`engine/COPYING`。发布时同时提供对应源码压缩包。

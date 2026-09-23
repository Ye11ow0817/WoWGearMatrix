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

## 开发

修改源码后重启开发版即可查看效果，无需重新打包；正式 EXE 需要重新构建才会包含修改。

## 一键发布

双击 `build.cmd`，或在 PowerShell 中执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build.ps1
```

脚本安装锁定依赖、运行逻辑测试、生成 Windows x64 单 EXE、运行隔离的发布包界面及重启测试，最后生成对应源码压缩包。首次构建需要网络。任何步骤失败即停止。

输出：

- `dist/WoWGearMatrix-0.3.0-win-x64.exe`：免安装启动文件，可单独复制运行，用户无需安装 Node.js。
- `dist/WoWGearMatrix-0.3.0-source.zip`：对应源码、锁文件、构建脚本及 SimC 源码和许可证，供源码交付与重建使用。
- `dist/win-unpacked/`：构建中间产物，无需发送给用户。

仅打包可运行 `npm run dist:win`；单独验证已有 EXE 可运行 `powershell -ExecutionPolicy Bypass -File .\verify-release.ps1`。

版本号在 `package.json` 修改。构建依赖固定于 `package-lock.json`；图标位于 `build/icon.ico`。

代码归档到 ASAR；发布文件仅包含运行代码、WASM 与许可证，排除测试、验证记录和开发工具。仅保留 Electron 必需的默认英文语言资源；应用界面固定中文。免安装 EXE 启动时会自动解压运行文件到临时目录。

当前 EXE 未进行代码签名。

## 本地数据

开发版和正式版均将数据保存在 `%APPDATA%\WoWGearMatrix`，角色文件为 `characters-v2.json`，备份为 `characters-v2.json.bak`。数据不随免安装程序的临时目录清理。

不读取或迁移旧目录的数据。新目录没有角色文件时，应用会创建默认角色。验证脚本使用独立临时数据，不改用户角色。

## 代码入口

- `main.cjs`、`preload.cjs`：窗口与进程通信。
- `renderer.js`、`index.html`、`style.css`：角色及装备界面。
- `model.js`、`presets.js`：数据模型、预设与组合计数。
- `search.js`、`search-ui.js`、`search-worker.js`：筛选、排序与后台计算。
- `worker.cjs`、`engine/`：本地 SimC 解析。
- `storage.cjs`：角色持久化。

## 许可与引擎

GPL-3.0-or-later。引擎数据版本、构建方法和随附源码见 `engine/README.md`、`engine/manifest.json`、`engine/COPYING`。发布时同时提供对应源码压缩包。

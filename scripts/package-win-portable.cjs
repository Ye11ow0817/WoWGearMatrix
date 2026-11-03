const { build, Platform, Arch } = require('electron-builder');
const path = require('node:path');

const now = new Date();
const pad = value => String(value).padStart(2, '0');
const timestamp = process.env.WOWGEARMATRIX_BUILD_TIMESTAMP ||
  `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
if (!/^\d{8}$/.test(timestamp)) {
  throw new Error('WOWGEARMATRIX_BUILD_TIMESTAMP must use yyyyMMdd format');
}
process.env.WOWGEARMATRIX_BUILD_TIMESTAMP = timestamp;

build({ projectDir: path.join(__dirname, '..'), targets: Platform.WINDOWS.createTarget('portable', Arch.x64) }).catch(error => {
  console.error(error);
  process.exitCode = 1;
});

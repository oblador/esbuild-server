import { exec } from 'child_process';

const openCmd =
  process.platform === 'darwin'
    ? 'open'
    : process.platform === 'win32'
    ? 'start'
    : 'xdg-open';

export function openUrl(url: string) {
  exec(`${openCmd} ${url}`);
}

import { homedir } from 'node:os';
import { resolve } from 'node:path';

export function desktopProfilePath(relative = '') {
  return resolve(process.env.DSH_PROFILE_DIR || resolve(homedir(), '.dsh/profiles/desktop'), relative);
}

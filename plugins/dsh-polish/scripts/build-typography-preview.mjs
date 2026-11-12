import { fileURLToPath } from 'node:url';
import { buildSettingsPreview } from './build-settings-preview.mjs';

export const typographyPreview = new URL('../../../temp/design/polish-type/index.html', import.meta.url);
export const buildTypographyPreview = () => buildSettingsPreview({
  entry: new URL('typography-preview.jsx', import.meta.url),
  destination: typographyPreview,
  baselineVersion: '0.1.11',
});
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await buildTypographyPreview(), null, 2));

import { open } from 'node:fs/promises';

// Read installed code without launching or modifying the user's DSH process.
export async function withInstalledHost(callback, app = '/Applications/DeepSeek Harness.app') {
  const file = await open(app + '/Contents/Resources/app.asar', 'r');
  try {
    const header = Buffer.alloc(16); await file.read(header, 0, header.length, 0);
    const json = Buffer.alloc(header.readUInt32LE(12)); await file.read(json, 0, json.length, 16);
    const tree = { files: JSON.parse(json.toString()).files }, base = 8 + header.readUInt32LE(4);
    function entry(path) { return path.split('/').filter(Boolean).reduce((node, part) => node.files[part], tree); }
    return await callback({ app, list: path => Object.keys(entry(path).files), async read(path) {
      const node = entry(path), bytes = Buffer.alloc(node.size);
      await file.read(bytes, 0, bytes.length, base + Number(node.offset)); return bytes.toString();
    } });
  } finally { await file.close(); }
}

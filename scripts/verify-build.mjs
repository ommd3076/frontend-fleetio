import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export async function collectDistFiles(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => compare(a.name, b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Build contains a symlink: ${path.relative(root, absolute)}`);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) files.push(path.relative(root, absolute).split(path.sep).join('/'));
      else throw new Error(`Build contains a nonregular file: ${absolute}`);
    }
  }
  await visit(root);
  return files.sort(compare);
}

function localReference(reference, owner) {
  const value = reference.trim();
  if (!value || value.startsWith('#') || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) {
    if (/^(?:file:|[a-z]:[\\/])/i.test(value)) throw new Error(`Local machine path in ${owner}: ${value}`);
    return null;
  }
  let pathname;
  try { pathname = decodeURIComponent(value.split(/[?#]/, 1)[0]); }
  catch { throw new Error(`Invalid encoded asset URL in ${owner}: ${value}`); }
  if (pathname.includes('\\') || pathname.includes('\0')) throw new Error(`Invalid local asset URL in ${owner}: ${value}`);
  if (/(?:^|\/)src\//.test(pathname) || /\.(?:tsx?|jsx?)(?:$|\/)/.test(pathname) && !/\.js$/.test(pathname)) {
    throw new Error(`Unbuilt source reference in ${owner}: ${value}`);
  }
  const resolved = path.posix.normalize(pathname.startsWith('/') ? pathname.slice(1) : path.posix.join(path.posix.dirname(owner), pathname));
  if (resolved === '..' || resolved.startsWith('../') || path.posix.isAbsolute(resolved)) throw new Error(`Asset escapes the build directory in ${owner}: ${value}`);
  return resolved;
}

export async function verifyBuild(distDirectory = 'dist') {
  const root = path.resolve(distDirectory), files = await collectDistFiles(root), available = new Set(files);
  const required = ['index.html', 'models/warehouse.glb', 'models/agv.obj', 'models/agv-lod.json', 'models/shelf.dae', 'models/ATTRIBUTION.md'];
  for (const file of required) if (!available.has(file)) throw new Error(`Required production file is missing: ${file}`);
  const index = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  const indexAssets = [];
  for (const match of index.matchAll(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi)) {
    const file = localReference(match[2], 'index.html');
    if (file) { if (!available.has(file)) throw new Error(`index.html references a missing asset: ${file}`); indexAssets.push(file); }
  }
  if (!indexAssets.some(file => /\.js$/.test(file)) || !indexAssets.some(file => /\.css$/.test(file))) throw new Error('Production index must reference built JavaScript and CSS.');

  const referencedWorkers = new Set();
  for (const file of files.filter(file => /\.(?:html|js|css)$/i.test(file))) {
    const source = await fs.readFile(path.join(root, file), 'utf8');
    if (/(?:["'`])(?:\/|\.\.?\/)?src\//.test(source) || /(?:["'`])(?:file:\/\/|[a-z]:[\\/])/i.test(source)) throw new Error(`Unresolved local source path in production file: ${file}`);
    if (/\b(?:import|export)\s+(?:[^;]*?\sfrom\s*)?["'](?:\.\.?\/|\/)[^"']*\.(?:ts|tsx|jsx)["']/.test(source)) throw new Error(`Unbuilt source import in production file: ${file}`);
    const references = file.endsWith('.css') ? [...source.matchAll(/url\(\s*(["']?)([^)]+?)\1\s*\)/gi)].map(match => match[2]) : [...source.matchAll(/["'`](\/assets\/[^"'`\s]+)["'`]/g)].map(match => match[1]);
    for (const reference of references) {
      const asset = localReference(reference, file);
      if (!asset) continue;
      if (!available.has(asset)) throw new Error(`${file} references a missing production asset: ${asset}`);
      if (/\bworker[-.][^/]*\.js$/i.test(asset)) referencedWorkers.add(asset);
    }
  }
  const workers = files.filter(file => /(?:^|\/)worker[-.][^/]*\.js$/i.test(file));
  if (!workers.length || !workers.some(file => referencedWorkers.has(file))) throw new Error('No built simulation worker is referenced by the production bundle.');
  for (const worker of workers) if (!(await fs.stat(path.join(root, worker))).size) throw new Error(`Empty production worker: ${worker}`);

  const dae = await fs.readFile(path.join(root, 'models/shelf.dae'), 'utf8');
  if (!/<COLLADA\b/.test(dae)) throw new Error('Shelving production asset is not a COLLADA document.');
  const textures = [...new Set([...dae.matchAll(/<init_from>([^<]+\.(?:jpe?g|png))<\/init_from>/gi)].map(match => `models/textures/${path.posix.basename(match[1].replaceAll('\\', '/'))}`))].sort(compare);
  if (!textures.length) throw new Error('Shelving contains no supplied texture references.');
  for (const file of [...required, ...textures]) {
    if (!available.has(file)) throw new Error(`Required production model texture is missing: ${file}`);
    if (!(await fs.stat(path.join(root, file))).size) throw new Error(`Empty required production file: ${file}`);
  }
  const warehouse = await fs.readFile(path.join(root, 'models/warehouse.glb'));
  if (warehouse.length < 20 || warehouse.readUInt32LE(0) !== 0x46546c67 || warehouse.readUInt32LE(8) !== warehouse.length) throw new Error('Warehouse production GLB has an invalid header or length.');
  const lod = JSON.parse(await fs.readFile(path.join(root, 'models/agv-lod.json'), 'utf8'));
  if (!lod.data?.attributes?.position?.array?.length) throw new Error('AGV overview geometry contains no positions.');
  const robot = await fs.readFile(path.join(root, 'models/agv.obj'), 'utf8');
  if (!/^v\s/m.test(robot) || !/^f\s/m.test(robot)) throw new Error('AGV production OBJ contains no vertices or faces.');
  return { result: 'DIST_INTEGRITY_OK', files: files.length, indexAssets: [...new Set(indexAssets)].sort(compare), workers, requiredModels: required.filter(file => file.startsWith('models/')), textures };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await verifyBuild(process.argv[2] ?? 'dist'), null, 2)); }
  catch (error) { console.error(`DIST_INTEGRITY_FAILED: ${error.message}`); process.exitCode = 1; }
}

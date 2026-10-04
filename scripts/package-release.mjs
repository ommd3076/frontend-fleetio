import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { collectDistFiles, verifyBuild } from './verify-build.mjs';

const VERSION = '1.0.0';
const sha256 = data => createHash('sha256').update(data).digest('hex');
const crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
  let crc = byte;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc >>> 0;
});
export function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}

export async function packageRelease({ distDirectory = 'dist', releaseDirectory = 'release' } = {}) {
  const root = path.resolve(distDirectory), output = path.resolve(releaseDirectory);
  const relation = path.relative(root, output);
  if (!relation || (relation !== '..' && !relation.startsWith(`..${path.sep}`) && !path.isAbsolute(relation))) throw new Error('Release output must be outside dist.');
  await verifyBuild(root);
  const files = await collectDistFiles(root);
  if (files.length > 65535) throw new Error('ZIP64 is required for more than 65535 files.');
  const local = [], central = [], manifestFiles = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file, 'utf8'), data = await fs.readFile(path.join(root, file)), crc = crc32(data);
    if (name.length > 65535 || data.length > 0xffffffff || offset > 0xffffffff) throw new Error(`ZIP64 or a shorter filename is required: ${file}`);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x0800, 6);
    // Store compression; fixed 1980-01-01 DOS date and zero time make the ZIP
    // independent of source mtimes, platform clocks and compression versions.
    header.writeUInt16LE(0x21, 12); header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26);
    local.push(header, name, data);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(0x0314, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(0x0800, 8);
    directory.writeUInt16LE(0x21, 14); directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(data.length, 20); directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(name.length, 28); directory.writeUInt32LE((0o100644 << 16) >>> 0, 38); directory.writeUInt32LE(offset, 42);
    central.push(directory, name);
    manifestFiles.push({ path: file, bytes: data.length, sha256: sha256(data) });
    offset += header.length + name.length + data.length;
  }
  const directorySize = central.reduce((sum, buffer) => sum + buffer.length, 0);
  if (offset > 0xffffffff || directorySize > 0xffffffff || offset + directorySize > 0xffffffff) throw new Error('ZIP64 is required for this archive size.');
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directorySize, 12); end.writeUInt32LE(offset, 16);
  const archive = Buffer.concat([...local, ...central, end]);
  const archiveName = `fleetio-${VERSION}.zip`;
  const manifest = { formatVersion: 1, name: 'FleetIO', version: VERSION, archive: archiveName, archiveBytes: archive.length, archiveSha256: sha256(archive), files: manifestFiles };
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, archiveName), archive);
  await fs.writeFile(path.join(output, `fleetio-${VERSION}.manifest.json`), JSON.stringify(manifest, null, 2) + '\n');
  return { result: 'RELEASE_PACKAGE_OK', archive: path.join(output, archiveName), manifest: path.join(output, `fleetio-${VERSION}.manifest.json`), files: files.length, bytes: archive.length, sha256: manifest.archiveSha256 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await packageRelease({ distDirectory: process.argv[2] ?? 'dist', releaseDirectory: process.argv[3] ?? 'release' }), null, 2)); }
  catch (error) { console.error(`RELEASE_PACKAGE_FAILED: ${error.message}`); process.exitCode = 1; }
}

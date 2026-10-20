import { lstat, readdir, realpath, unlink } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

// Next copies local .env files into standalone even when tracing excludes them.
// Strip only derived environment files, after confirming this is our build directory.
const workspace = await realpath(process.cwd());
const expected = resolve(workspace, '.next', 'standalone');
const actual = await realpath(expected);
const samePath = process.platform === 'win32' ? actual.toLowerCase() === expected.toLowerCase() : actual === expected;
if (!samePath || !(await lstat(expected)).isDirectory()) throw new Error('Standalone output must be a real directory within this workspace.');
let removed = 0;
async function inspect(directory) {
    const child = relative(actual, directory);
    if (child === '..' || child.startsWith(`..${sep}`)) throw new Error('Unexpected output path.');
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.name === 'node_modules') continue;
        const file = join(directory, entry.name);
        if (/^\.env(?:$|\.)/.test(entry.name)) {
            if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('Unexpected environment entry in standalone output.');
            await unlink(file);
            removed++;
        } else if (['scratch', 'local-backups', 'storage', '.git'].includes(entry.name)) {
            throw new Error('Private operational files were included in standalone output.');
        } else if (entry.isDirectory() && !entry.isSymbolicLink()) await inspect(file);
    }
}
await inspect(actual);
console.log(JSON.stringify({ standaloneSanitized: true, environmentFilesRemoved: removed }));

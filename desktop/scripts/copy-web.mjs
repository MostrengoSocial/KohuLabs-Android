// Copies what the desktop app shares with the phone (Kō's renderer and the fonts) into ui/vendor before each build,
// so there is one copy to keep up to date: web/.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), web = join(here, '..', '..', 'web'), out = join(here, '..', 'ui', 'vendor');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'fonts'), { recursive: true });
cpSync(join(web, 'js', 'signal.js'), join(out, 'signal.js'));
cpSync(join(web, 'assets', 'fonts'), join(out, 'fonts'), { recursive: true });

// Node mechanics checks share Vite's TypeScript transformer and extensionless import resolution.
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { transformSync } from 'rolldown/utils';

registerHooks({
  resolve(specifier, context, next) {
    return next(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? specifier + '.ts' : specifier, context);
  },
  load(url, context, next) {
    return url.endsWith('.ts')
      ? { format: 'module', shortCircuit: true,
          source: transformSync(new URL(url).pathname, fs.readFileSync(new URL(url), 'utf8')).code }
      : next(url, context);
  },
});

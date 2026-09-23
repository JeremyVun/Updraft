// Load one historical module against unchanged local dependencies for a bounded refactor-parity check.
import { execFileSync } from 'node:child_process';
import { transformSync } from 'rolldown/utils';
export const baselineRevision = process.env.BASELINE_REF ?? '188c9fa';
export async function importBaseline(path) {
  const url = new URL('../../' + path, import.meta.url);
  let source = execFileSync('git', ['show', `${baselineRevision}:${path}`], {encoding:'utf8'});
  source = source.replace(/from '([^']+)'/g, (_all,specifier) => {
    const target = specifier.startsWith('.')
      ? new URL(specifier + (/\.[a-z]+$/i.test(specifier) ? '' : '.ts'), url).href
      : import.meta.resolve(specifier);
    return `from '${target}'`;
  });
  return import('data:text/javascript;base64,'+Buffer.from(transformSync(path,source).code).toString('base64'));
}

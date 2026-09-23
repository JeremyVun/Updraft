// Inspect shader templates, excluding JavaScript's deliberately reversible smoothstep helpers.
import { parseSync } from 'rolldown/utils';

export function shaderTemplates(source, filename) {
  const { program, errors } = parseSync(filename, source);
  if (errors.length) throw new Error(`Cannot parse ${filename}: ${JSON.stringify(errors)}`);
  const templates = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'TemplateLiteral') {
      const start = node.start + 1, end = node.end - 1;
      const text = source.slice(start, end);
      if (/\b(?:float|vec[234]|void)\b/.test(text)) templates.push({start, end, text});
      return;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(program);
  return templates;
}

export function smoothstepCalls(text) {
  const calls = [];
  for (const match of text.matchAll(/\bsmoothstep\s*\(/g)) {
    const args = []; let start = match.index + match[0].length, depth = 0;
    for (let i = start; i < text.length; i++) {
      const char = text[i];
      if (char === ')' && depth === 0) {
        args.push(text.slice(start, i).trim());
        if (args.length === 3) calls.push({start: match.index, end: i + 1, args});
        break;
      }
      if ('({['.includes(char)) depth++;
      else if (')}]'.includes(char)) depth--;
      else if (char === ',' && depth === 0) { args.push(text.slice(start, i).trim()); start = i + 1; }
    }
  }
  return calls;
}

export function literalNumber(expression) {
  return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(expression) ? Number(expression) : null;
}

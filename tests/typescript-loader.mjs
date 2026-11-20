// Resolve this project's TypeScript paths for Node's built-in test runner.
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      return nextResolve(pathToFileURL(`${process.cwd()}/src/${specifier.slice(2)}.ts`).href, context);
    }
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  },
});

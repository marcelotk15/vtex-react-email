import { readFile } from 'node:fs/promises'
import path from 'node:path'

export async function compileInterfaceCss(source: string, from: string): Promise<string> {
  const [{ compile, optimize }, { Scanner }] = await Promise.all([
    import('@tailwindcss/node'),
    import('@tailwindcss/oxide'),
  ])
  const compiled = await compile(source, { base: path.dirname(from), from, onDependency() {} })
  const scanner = new Scanner({ sources: compiled.sources })
  return optimize(compiled.build(scanner.scan()), { minify: true }).code
}

export function tailwindPlugin(): import('esbuild').Plugin {
  return {
    name: 'preview-ui-tailwind',
    setup(build) {
      build.onLoad({ filter: /[/\\]styles[/\\]app\.css$/ }, async (args) => {
        const source = await readFile(args.path, 'utf8')
        return { contents: await compileInterfaceCss(source, args.path), loader: 'css' }
      })
    },
  }
}

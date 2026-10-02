import { describe, expect, it } from 'vitest'

import { formatHandlebarsSource } from './format-source'

describe('formatHandlebarsSource', () => {
  it('indents nested html and handlebars blocks', () => {
    const source =
      '<html><body>{{#each items}}<div class="row">{{name}}</div>{{else}}<p>empty</p>{{/each}}</body></html>'
    expect(formatHandlebarsSource(source)).toBe(
      [
        '<html>',
        '  <body>',
        '    {{#each items}}',
        '      <div class="row">',
        '        {{name}}',
        '      </div>',
        '    {{else}}',
        '      <p>',
        '        empty',
        '      </p>',
        '    {{/each}}',
        '  </body>',
        '</html>',
      ].join('\n'),
    )
  })

  it('keeps inline text and mustaches together', () => {
    expect(formatHandlebarsSource('<p>Olá {{name}}, bem-vindo!</p>')).toBe(
      ['<p>', '  Olá {{name}}, bem-vindo!', '</p>'].join('\n'),
    )
  })

  it('keeps void tags and quoted attributes on one line', () => {
    const source = '<div title="a > b"><img src="x.png" alt="{{label}}"/><br/></div>'
    expect(formatHandlebarsSource(source)).toBe(
      ['<div title="a > b">', '  <img src="x.png" alt="{{label}}"/>', '  <br/>', '</div>'].join('\n'),
    )
  })

  it('returns empty input unchanged', () => {
    expect(formatHandlebarsSource('')).toBe('')
  })
})

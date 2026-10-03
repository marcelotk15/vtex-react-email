# ADR 0002 — P1 compile API

Consulted on 2026-10-02. Complements ADR 0001 and sections 9, 10, 11, 14, 18, and 23 of RFC-001.

## Decision

The public compilation produces one document for one language. `compileEmail` receives the email definition, a catalog, the emission profile, and Tailwind. It does not receive a fixture, schema, or event JSON.

`defineEmail` stores `id`, `event`, `locale`, and the component. `event` is local metadata. Path analysis against an event schema is left for P2.

Evaluation is `evaluateArtifact`. It receives the already compiled string, the data, and the local simulator. The compiler validates Handlebars syntax with `compile` and does not execute the template.

The emission profile lists capabilities, form, arity, argument types, context, and evidence. The local simulator is a separate map of functions. A function present only in the simulator cannot be emitted. `formatCurrency` and `replace` remain `documented`. `eq` remains `experimental` and only appears in the merge trial, outside the DSL. Nothing in this phase is `verified`. The manifest stays `experimental`.

`each` creates item context; `fallback` uses the outer context. `if` and `unless` preserve context in both branches. `../` cannot go past the root. There is still no `@root`, `@index`, `@first`, `@last`, `this`, brackets, `With`, `Compare`, block helper in the DSL, object iteration, or subexpression. An expression in `className` produces `DSL002`. The Tailwind adapter reads `className` before calling the component; the compiler maps that failure to the same diagnostic.

Writing remains separate. `commitArtifacts` is called only after `ok`. An invalid name does not replace existing files. A failure mid-promotion restores the previous content.

## Import guard

The template loader rejects, with `DSL001`:

- a path whose segment is `fixtures`;
- the specifier `@vtex-email/preview`;
- the specifier `@react-email/preview`.

This check looks at static imports resolved by esbuild from the entry. It does not prove purity of a TypeScript program. It does not see dynamic `import()`, `fs.readFile` of a JSON, a fixture passed as a prop from another module, or a preview re-export inside `@react-email/components`. A file syntax error is not `DSL001`.

## What remains out of scope

The two-document trial, with `eq` and a literal, remains in `packages/react/src/golden-path.test.tsx` as a regression. Confirmation in Message Center, email clients, and other systems remains pending, as in ADR 0001.

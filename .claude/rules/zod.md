Source: https://zod.dev/llms.txt (official LLM docs index; full text at https://zod.dev/llms-full.txt). Condensed from https://zod.dev/v4/changelog, https://zod.dev/error-customization, https://zod.dev/error-formatting, https://zod.dev/api, https://zod.dev/compile

# Zod 4 (4.6)

Import with `import { z } from 'zod'`. Don't import `zod/v3`, `zod/mini` or `zod/compile` unless the file
already does.

## Zod 3 habits that are wrong now

- String formats are top-level functions: `z.email()`, `z.url()`, `z.httpUrl()` (http/https only), `z.uuid()`,
  `z.ipv4()`, `z.iso.datetime()`, `z.iso.date()`. `z.string().email()` and the other method forms are deprecated.
- Errors are customized through a single `error` param: `z.string().min(1, { error: 'Required' })` or
  `z.string({ error: (iss) => (iss.input === undefined ? 'Required' : 'Not a string') })`. `message` is
  deprecated. `invalid_type_error`, `required_error` and `errorMap` no longer exist.
- Read problems from `err.issues` (`.errors` is gone). `err.format()` and `err.flatten()` are deprecated.
  Use `z.treeifyError(err)` for nested output, `z.flattenError(err)` for forms
  (`{ formErrors, fieldErrors }`), and `z.prettifyError(err)` for a readable log string.
- Objects strip unknown keys by default. `z.strictObject()` / `.strict()` rejects them, and `z.looseObject()` /
  `.loose()` keeps them (`.passthrough()` is deprecated). To compose, use `A.extend(B.shape)`
  (`.merge()` is deprecated).
- `z.record(keySchema, valueSchema)` takes both arguments. Pass TS enums to `z.enum(...)` (`z.nativeEnum` is
  deprecated).
- `.default(v)` short-circuits on `undefined`, and `v` must match the output type. To default the input
  before parsing, use `.prefault(v)`.
- The input type of `z.coerce.*` is `unknown`. `z.number()` rejects `Infinity`, and `.int()` accepts only safe
  integers.
- `.refine()` no longer narrows types. Use `.superRefine()` / `.check()` to report several issues.
- Types: `z.infer<typeof S>` (same as `z.output`), plus `z.input<typeof S>` for the type before transforms.

## Env validation (`src/lib/env/`)

- One schema, server only: `server.ts` (starts with `import 'server-only'`, e.g. `API_URL: z.url()`), read at
  runtime. Export the parsed, typed object. Other code imports it and never touches `process.env`.
- No `NEXT_PUBLIC_*` value that differs between environments: Next inlines them at build time, and one image
  runs on stage and prod. A build-time constant, if ever needed, gets its own schema built from literal
  references (`{ NEXT_PUBLIC_X: process.env.NEXT_PUBLIC_X }`). Next inlines only literal accesses, so passing
  `process.env` whole yields `undefined` in the browser.
- Booleans from env: `z.stringbool()` (accepts true/false, 1/0, yes/no, on/off, y/n, enabled/disabled).
  Numbers: `z.coerce.number().int()`. Fixed sets: `z.enum([...])`.
- On failure, throw an error built with `z.prettifyError(result.error)` so every bad variable is listed.
  Never print secret values.

## Validation elsewhere

- Validate at trust boundaries: Route Handler and Server Action input (`safeParse`, then respond 400 with
  `z.flattenError`), `searchParams`, and backend responses whose shape matters at runtime. OpenAPI types are
  compile-time only.
- Use `safeParse` for user input. Use `parse` where a failure would be a bug.
- The CSP has no `'unsafe-eval'`. Zod probes `new Function` for its JIT, and in the browser that probe raises
  a CSP violation report. Client code that parses should call `z.config({ jitless: true })` once at startup.
  Never use `z.compile()`, which needs `new Function`.
- For Russian built-in messages: `z.config(z.locales.ru())`. User-facing form errors should still come from
  next-intl keys.

Source: https://react.dev/llms.txt (official LLM docs index). Condensed from https://react.dev/reference/rules, https://react.dev/learn/react-compiler/introduction, https://react.dev/learn/you-might-not-need-an-effect, https://react.dev/reference/react/useEffectEvent

# React 19.3 (with React Compiler, inside Next App Router)

React publishes no agent rules or Skills. Append `.md` to any react.dev URL to get Markdown. The experimental
`react-devtools-cdt-mcp` (https://react.dev/reference/dev-tools/react-devtools-cdt-mcp) can show the component
tree to agents through Chrome DevTools MCP. It is not set up here.

## Rules of React (the compiler depends on them)

- Components and hooks must be pure. The same props, state and context must give the same JSX. Never mutate
  props, state, or values created outside the render. Side effects go in event handlers or effects.
- Update state immutably: create new objects and arrays, never `push` or assign into state.
- Call hooks only at the top level of a component or custom hook. Never inside conditions, loops or
  callbacks, and never after an early `return`.
- Render components (`<Foo />`). Never call them as functions, and never pass hooks around as values.
- Never read or write `ref.current` while rendering. Do it only in effects and handlers.

## React Compiler is enabled (`reactCompiler: true`)

- In new code, don't add `useMemo`, `useCallback` or `React.memo` for performance. The compiler memoizes.
  Keep them only as an escape hatch, for example a value that must stay stable as an effect dependency.
  Don't remove existing ones without testing, because that can change the compiled output.
- `'use no memo'` at the top of a function opts that function out. Use it only as a temporary workaround,
  with a comment saying why.
- The compiler skips code that breaks the rules above, or that code misbehaves after compiling. Biome's
  React rules (`useHookAtTopLevel`, `useExhaustiveDependencies`) catch part of this. The nursery rule
  `useReactCompiler` is opt-in and reports the compiler's own diagnostics.

## Effects

- You usually don't need an effect. Compute derived values during render. Handle user actions in event
  handlers. Don't copy props or state into other state. Reset state with a `key`.
- Data fetching goes through TanStack Query (see `tanstack-query.md`), never `useEffect` plus `fetch`.
- For non-reactive logic that runs inside an effect, use `useEffectEvent` (stable since 19.2). Don't
  suppress the dependency check.
- Strict Mode is on by default in the App Router, so effects run twice in development. Always return a
  cleanup for subscriptions, timers and listeners.

## Server and Client Components

- Components are Server Components by default. `'use client'` marks a module and everything it imports as
  client code, so put it on the smallest interactive leaf.
- Server Components may be `async` and read data directly. Client Components cannot be `async`.
- Props passed into a Client Component must be serializable: no functions (Server Functions are the exception),
  no class instances.
- `'use server'` functions are public POST endpoints. Validate their input with Zod and check authorization
  inside each one.
- Use `import 'server-only'` to keep server modules out of client bundles.

## React 19 APIs to prefer

- `use(promise)` and `use(context)`. Forms that write to a backend use TanStack `useMutation` (next-example,
  `src/app/notes/_components/`); `<form action={fn}>` with `useActionState`, `useOptimistic` and
  `useFormStatus` fits Server Actions that only touch this server (for example setting a cookie).
- `ref` is a normal prop on function components, so don't use `forwardRef` in new code. `<MyContext value={v}>`
  works as a provider, no `.Provider` needed.
- `<Activity mode="hidden">` keeps the state of hidden UI. Before using `<ViewTransition>`, read
  `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`.
- Set `<title>` and `<meta>` through Next's `metadata` / `generateMetadata`, not inline in components. Only
  `error.tsx` / `global-error.tsx` render a React `<title>`: Client Components cannot export metadata.
- Inline `style={...}` may be blocked by the CSP (see `nextjs.md`). Use Tailwind classes.

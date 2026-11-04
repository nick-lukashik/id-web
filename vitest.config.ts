import { defineConfig } from 'vitest/config'

export default defineConfig({
    resolve: {
        tsconfigPaths: true,
    },
    test: {
        // Unit tests live next to the code; e2e/ belongs to Playwright.
        include: [
            'src/**/*.test.ts',
            'src/**/*.test.tsx',
        ],
        environment: 'node',
        // Test only: SESSION_SECRET has no default.
        env: {
            SESSION_SECRET: 'test-session-secret-0123456789abcdef',
        },
    },
})

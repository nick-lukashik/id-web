// Docker HEALTHCHECK (copied into the image): healthy when /health/ready
// answers 2xx, that is, this server is up and can render. The API's state is
// in the response body, not required (README, "Health semantics").
const port = process.env.PORT || '3000'

try {
    const response = await fetch(`http://127.0.0.1:${port}/health/ready`, {
        signal: AbortSignal.timeout(4000),
    })
    process.exit(response.ok ? 0 : 1)
} catch {
    process.exit(1)
}

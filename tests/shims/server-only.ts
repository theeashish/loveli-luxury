// Test shim. The real `server-only` package throws on import outside an RSC
// bundle; this empty module lets vitest load server-only files in plain Node
// while leaving the production guard in place for client bundles.
export {}

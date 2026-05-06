/**
 * Public re-exports for the catalog module. Server-only modules
 * (queries, mutations) are intentionally not re-exported here so that
 * client-component imports can reach types/schemas/slug/mappers without
 * pulling in `next/headers` and similar server-only dependencies.
 */

export * from './types'
export * from './schemas'
export * from './slug'
export * from './mappers'

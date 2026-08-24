# Seed Sprouter architecture

Seed Sprouter is a local-first Expo application. A garden bed is the aggregate root: planting cycles, mapped rows, progress photos, seed-packet photos, and reminder preferences are changed through the bed rather than as unrelated global records.

## Module boundaries

- `src/domain` owns entity creation, lifecycle rules, selectors, immutable aggregate updates, and the logical schema version. It has no React Native or Expo dependency.
- `src/services` owns device and network boundaries: verified persistence, durable media, local notifications, and Newcastle weather.
- `src/data` contains bundled reference data and search helpers. Crop estimates are suggestions, not persisted authority.
- `src/components` contains reusable visual and interaction components. The semantic `GardenIcon` vocabulary prevents screens from depending on vendor glyph names for primary navigation and actions.
- `src/theme` owns brand assets and visual tokens.
- `App.tsx` is currently the composition root and feature-flow coordinator. New large screens and forms should move into `src/features/<feature>` rather than increasing this file.

## Persistence invariants

1. Garden JSON and media use separate storage: records are checksummed and versioned; image URIs point to immutable files in the Documents directory.
2. A save is staged, decoded, independently snapshotted, committed, read back, and decoded again.
3. Old and unknown JSON fields are preserved by spread-based normalisation.
4. Schema changes are additive and backward-compatible. `schemaVersion` describes the logical model; the storage-envelope version describes encoding.
5. Deletion is a soft lifecycle transition (`deletedAt`). It never removes bed records, cycles, maps, or photos.
6. Notification categories carry a `kind` tag and may only cancel their own scheduled notifications.

## Scaling path

The nested bed aggregate is appropriate while data is local and each bed has a modest history. Before adding multi-user sync, normalise beds/cycles/rows/photos into independently revisioned records, add stable account-scoped IDs, and build a one-way export/import boundary. Do not perform that migration implicitly: create and verify a full backup first and preserve every unknown field and media URI.

# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# GARDEN DATA IS IRREPLACEABLE

Mandatory command for every agent changing persistence, migrations, media, cleanup, reset, import/export, or filesystem code:

> PRESERVE_GARDEN_DATA: Never delete, overwrite, truncate, relocate, reset, garbage-collect, or incompatibly transform saved garden-bed records, planting cycles, annotations, reminders, progress history, seed-packet images, or garden photos. Durable media must remain in the app Documents directory, never cache-only. All schema changes must be backward-compatible and must create and verify a recoverable backup before committing new data. If preservation cannot be proven, stop and request explicit user approval; never fall back to empty data over an existing unreadable store.

Before completing such a change, verify all of the following:

1. Existing stored schemas still load or migrate without losing unknown fields.
2. A failed or interrupted write leaves either the previous verified snapshot or the new verified snapshot recoverable.
3. Media writes use unique immutable filenames and are verified as non-empty after copying.
4. No cleanup command or code path can remove `garden-media`, `garden-data-backups`, or the SQLite store without explicit user authorization.

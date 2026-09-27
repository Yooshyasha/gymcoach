// Shared version stamp for both the full-account backup (app/api/backup) and
// the single-program export (app/api/programs/[id]/export): both produce a
// subset of the same importable shape, so they must agree on the version the
// backup importer's Zod schema checks against.
export const BACKUP_VERSION = 5;

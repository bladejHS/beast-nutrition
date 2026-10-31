// Human-friendly names for the provider `source` tags stored on synced rows.
export const SOURCE_LABELS: Record<string, string> = {
  healthkit: 'Apple Health',
  health_connect: 'Health Connect',
  garmin: 'Garmin',
  garmin_fit: 'Garmin (FIT)',
  withings: 'Withings',
  fitbit: 'Fitbit',
  googlehealth: 'Google Health',
  coros_mcp: 'COROS',
  imported: 'Imported',
  csv: 'CSV Import',
  csv_import: 'CSV Import',
};

/** Maps a stored `source` tag to a display label, falling back to the raw tag. */
export const prettifySource = (source: string): string =>
  SOURCE_LABELS[source] ?? SOURCE_LABELS[source.toLowerCase()] ?? source;

/** Rows written by the user directly rather than pulled from a provider. */
export const MANUAL_SOURCE = 'manual';

export const isManualSource = (source?: string | null): boolean =>
  (source ?? MANUAL_SOURCE) === MANUAL_SOURCE;

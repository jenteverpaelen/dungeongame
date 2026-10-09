/** Zero disables deletion; no retention period is chosen for an operator. */
export function parseBackupKeep(value: string | undefined): number {
  if (value === undefined || value === '') return 0;
  if (!/^(0|[1-9][0-9]*)$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error('BACKUP_KEEP must be a nonnegative safe integer (0 disables rotation)');
  }
  return Number(value);
}

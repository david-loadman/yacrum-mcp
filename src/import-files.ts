/**
 * The files of an import, read from the user's computer.
 *
 * ⛔ THIS SERVER CAN READ WHAT ITS USER CAN, AND A MODEL CHOOSES THE PATHS. So only
 * a regular file named .csv or .xlsx is read, never through a symlink, and every
 * limit is checked before anything is read or sent: a misled model cannot send
 * `~/.ssh/id_rsa` to Yacrum, and an export is refused here rather than half uploaded.
 * The limits are Yacrum's own, which it checks again.
 */

import { lstat, readFile } from 'node:fs/promises';
import { basename, isAbsolute } from 'node:path';

/** Refused on this computer, so the words must not say Yacrum refused it. */
export class NotSentError extends Error {}

const MAX_FILES = 12;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function importForm(source: string, paths: string[]): Promise<FormData> {
  if (paths.length > MAX_FILES) throw new NotSentError(`Upload at most ${MAX_FILES} files at once.`);
  let total = 0;
  for (const path of paths) {
    if (!isAbsolute(path)) throw new NotSentError(`${path} is not a full path. Give the whole path, from /, with no ~.`);
    if (!/\.(csv|xlsx)$/i.test(path)) throw new NotSentError(`${basename(path)} is not an Excel (.xlsx) or CSV file, so it was not read.`);
    const stat = await lstat(path).catch(() => null);
    if (!stat) throw new NotSentError(`${path} was not found.`);
    if (!stat.isFile()) throw new NotSentError(`${path} is not a regular file, so it was not read.`);
    if (stat.size > MAX_FILE_BYTES) throw new NotSentError(`${basename(path)} is larger than 10 MB.`);
    total += stat.size;
  }
  if (total > MAX_UPLOAD_BYTES) throw new NotSentError('Those files are larger than 25 MB together.');

  const form = new FormData();
  form.set('source', source);
  for (const path of paths) form.append('files', new Blob([await readFile(path)]), basename(path));
  return form;
}

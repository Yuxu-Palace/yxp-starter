import { version } from '../package.json';

export const VERSION = version;

export type Status = 'success' | 'error';

export interface Result {
  status: Status;
  message: string;
}

console.log('this package version is', VERSION);

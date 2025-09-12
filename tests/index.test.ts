import { version } from '../package.json';
import { MFT } from './utils';

MFT((getModule, { test, expect }) => {
  test('version check', () => {
    const { VERSION } = getModule();
    expect(VERSION).toBe(version);
  });
});

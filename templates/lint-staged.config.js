/**
 * @type {import('lint-staged').Configuration}
 */
export default {
  '*.{ts,tsx,js,jsx}': () => ['pnpm run check'],
  '*.{json,yml,yaml,md}': ['pnpm run format'],
};

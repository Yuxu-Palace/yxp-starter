/**
 * @type {import('lint-staged').Configuration}
 */
export default {
  '*.{ts,tsx,js,jsx}': () => ['pnpm run check'],
  '*.json': ['pnpm run format'],
};

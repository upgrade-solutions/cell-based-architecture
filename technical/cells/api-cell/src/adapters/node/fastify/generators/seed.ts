// Standalone seed script — reads product.core.json and writes examples to
// Postgres. Independent of the HTTP framework; re-exported from express.
export { generateSeed } from '../../express/generators/seed'

// In-memory + Drizzle store implementations are framework-agnostic — both
// adapters generate the same DataStore shape. Re-export so a fix to the
// store layer in express benefits fastify automatically.
export { generateStore } from '../../express/generators/store'

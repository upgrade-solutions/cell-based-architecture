// The Drizzle layer is identical to express — it returns table SQL strings
// and a generic resource→table lookup, neither of which touches the HTTP
// framework. Re-export so both adapters stay in sync with one source of truth.
export { generateDbConnection, generateDrizzleStore } from '../../express/generators/db'

// sql.js ships no types; the tests' stand-in for the SQL plugin (sqlStandIn.ts) types what it uses itself.
declare module "sql.js/dist/sql-asm.js" {
  const initSqlJs: (config?: unknown) => Promise<unknown>;
  export default initSqlJs;
}

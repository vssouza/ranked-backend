// src/types/pg.d.ts
declare module "pg" {
  export type QueryResult<T = any> = {
    rows: T[]
    rowCount: number | null
  }

  export type QueryResultRow = Record<string, any>

  export class Pool {
    constructor(config?: any)
    query<T extends QueryResultRow = any>(
      text: string,
      values?: any[]
    ): Promise<QueryResult<T>>
  }
}

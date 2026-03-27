declare module 'sql.js/dist/sql-asm.js' {
  function initSqlJs(): Promise<{
    Database: new (data?: ArrayLike<number> | Buffer | null) => any;
  }>;
  export = initSqlJs;
}

declare module 'sql.js' {
  interface Database {
    run(sql: string, params?: any[]): void;
    exec(sql: string): { columns: string[]; values: any[][] }[];
    prepare(sql: string): any;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
  }
  export { Database };
  export default function initSqlJs(config?: any): Promise<any>;
}

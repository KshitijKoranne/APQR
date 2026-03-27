import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

// On Vercel serverless: use /tmp (ephemeral but writable)
// Locally: use ./data/ (persistent)
const isVercel = process.env.VERCEL === '1';
const DB_DIR = isVercel ? '/tmp' : path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'qreview.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// ── Compatibility wrapper (sql.js → better-sqlite3 API) ──

class Statement {
  private db: SqlJsDatabase;
  private sql: string;
  private wrapper: DbWrapper | null;

  constructor(db: SqlJsDatabase, sql: string, wrapper?: DbWrapper) {
    this.db = db;
    this.sql = sql;
    this.wrapper = wrapper || null;
  }

  run(...params: any[]): { changes: number } {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    this.db.run(this.sql, flatParams);
    const changes = this.db.getRowsModified();
    // Auto-save after write operations
    if (this.wrapper && changes > 0) {
      this.wrapper.scheduleSave();
    }
    return { changes };
  }

  get(...params: any[]): any {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const stmt = this.db.prepare(this.sql);
    try {
      if (flatParams.length > 0) stmt.bind(flatParams);
      if (stmt.step()) {
        return stmt.getAsObject();
      }
      return undefined;
    } finally {
      stmt.free();
    }
  }

  all(...params: any[]): any[] {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const stmt = this.db.prepare(this.sql);
    const rows: any[] = [];
    try {
      if (flatParams.length > 0) stmt.bind(flatParams);
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
    } finally {
      stmt.free();
    }
    return rows;
  }
}

class DbWrapper {
  public raw: SqlJsDatabase;
  private _saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(raw: SqlJsDatabase) {
    this.raw = raw;
  }

  prepare(sql: string): Statement {
    return new Statement(this.raw, sql, this);
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  pragma(str: string): void {
    try { this.raw.exec(`PRAGMA ${str}`); } catch { /* ignore */ }
  }

  transaction<T>(fn: () => T): () => T {
    return () => {
      this.raw.exec('BEGIN TRANSACTION');
      try {
        const result = fn();
        this.raw.exec('COMMIT');
        this.save();
        return result;
      } catch (e) {
        this.raw.exec('ROLLBACK');
        throw e;
      }
    };
  }

  // Debounced save — batches multiple writes into one disk write
  scheduleSave(): void {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.save(), 100);
  }

  save(): void {
    try {
      const data = this.raw.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch { /* ignore save errors in serverless */ }
  }
}

// ── Singleton ─────────────────────────────────────────

let dbInstance: DbWrapper | null = null;
let initPromise: Promise<DbWrapper> | null = null;

async function initDb(): Promise<DbWrapper> {
  let SQL: any;

  // Try WASM build first, fall back to ASM.js (pure JS, no WASM needed)
  try {
    const sqlWasmPath = path.join(
      path.dirname(require.resolve('sql.js')),
      'sql-wasm.wasm'
    );

    if (fs.existsSync(sqlWasmPath)) {
      // Load WASM from file system directly as buffer
      const wasmBinary = fs.readFileSync(sqlWasmPath);
      SQL = await initSqlJs({ wasmBinary });
    } else {
      throw new Error('WASM file not found, using fallback');
    }
  } catch {
    // Fallback: use the ASM.js build (pure JavaScript, works everywhere)
    try {
      const initSqlAsmJs = require('sql.js/dist/sql-asm.js');
      SQL = await initSqlAsmJs();
    } catch {
      // Last resort: try default init
      SQL = await initSqlJs();
    }
  }

  let raw: SqlJsDatabase;

  // Try loading existing database
  if (fs.existsSync(DB_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_PATH);
      raw = new SQL.Database(fileBuffer);
      // Quick check if tables exist
      const tables = raw.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='products'");
      if (tables.length > 0 && tables[0].values.length > 0) {
        const wrapper = new DbWrapper(raw);
        dbInstance = wrapper;
        return wrapper;
      }
    } catch {
      // Corrupted file, create new
    }
  }

  // Create new database
  raw = new SQL.Database();
  const wrapper = new DbWrapper(raw);

  wrapper.pragma('journal_mode = WAL');
  wrapper.pragma('foreign_keys = ON');
  createTables(wrapper);
  seedDemoData(wrapper);
  wrapper.save();

  dbInstance = wrapper;
  return wrapper;
}

export async function getDbAsync(): Promise<DbWrapper> {
  if (dbInstance) return dbInstance;
  if (!initPromise) {
    initPromise = initDb();
  }
  return initPromise;
}

// Synchronous getter (for use after first init)
export function getDb(): DbWrapper {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call getDbAsync() first.');
  }
  return dbInstance;
}

// Helper to ensure DB is ready (call at start of every API route)
export async function ensureDb(): Promise<DbWrapper> {
  return getDbAsync();
}

export function resetAndSeed(): void {
  if (!dbInstance) return;
  dbInstance.exec('DELETE FROM batch_results');
  dbInstance.exec('DELETE FROM oos_results');
  dbInstance.exec('DELETE FROM deviations');
  dbInstance.exec('DELETE FROM change_controls');
  dbInstance.exec('DELETE FROM capas');
  dbInstance.exec('DELETE FROM complaints');
  dbInstance.exec('DELETE FROM batches');
  dbInstance.exec('DELETE FROM product_parameters');
  dbInstance.exec('DELETE FROM apqr_reports');
  dbInstance.exec('DELETE FROM products');
  seedDemoData(dbInstance);
  dbInstance.save();
}

// ── Schema ────────────────────────────────────────────

function createTables(db: DbWrapper) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      generic_name TEXT,
      api_grade TEXT,
      batch_size TEXT,
      batch_size_unit TEXT DEFAULT 'kg',
      shelf_life_months INTEGER,
      license_no TEXT,
      standard_yield REAL,
      therapeutic_category TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_parameters (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'cqa',
      unit TEXT,
      usl REAL,
      lsl REAL,
      target REAL,
      stage TEXT,
      is_critical INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      batch_number TEXT NOT NULL,
      manufacturing_date TEXT,
      status TEXT DEFAULT 'released',
      yield_percentage REAL,
      remarks TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(product_id, batch_number)
    );

    CREATE TABLE IF NOT EXISTS batch_results (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      parameter_id TEXT NOT NULL REFERENCES product_parameters(id) ON DELETE CASCADE,
      value REAL NOT NULL,
      specification_met INTEGER DEFAULT 1,
      remarks TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(batch_id, parameter_id)
    );

    CREATE TABLE IF NOT EXISTS deviations (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      batch_id TEXT REFERENCES batches(id),
      deviation_number TEXT NOT NULL,
      type TEXT DEFAULT 'minor',
      description TEXT,
      root_cause TEXT,
      capa_reference TEXT,
      investigation_status TEXT DEFAULT 'open',
      date_raised TEXT,
      date_closed TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS change_controls (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      cc_number TEXT NOT NULL,
      description TEXT,
      type TEXT DEFAULT 'process',
      impact_assessment TEXT,
      effective_date TEXT,
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS capas (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      capa_number TEXT NOT NULL,
      source_type TEXT,
      source_reference TEXT,
      description TEXT,
      action_taken TEXT,
      due_date TEXT,
      closure_date TEXT,
      effectiveness_review TEXT,
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      batch_id TEXT REFERENCES batches(id),
      complaint_number TEXT NOT NULL,
      type TEXT DEFAULT 'customer',
      description TEXT,
      investigation_summary TEXT,
      capa_reference TEXT,
      date_received TEXT,
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS oos_results (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      parameter_id TEXT NOT NULL REFERENCES product_parameters(id),
      observed_value REAL,
      oos_number TEXT NOT NULL,
      root_cause_category TEXT DEFAULT 'non_assignable',
      investigation_summary TEXT,
      batch_disposition TEXT,
      capa_reference TEXT,
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS apqr_reports (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      review_period_start TEXT NOT NULL,
      review_period_end TEXT NOT NULL,
      apqr_number TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      prepared_by TEXT,
      reviewed_by TEXT,
      approved_by TEXT,
      conclusions TEXT,
      recommendations TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_batches_product ON batches(product_id);
    CREATE INDEX IF NOT EXISTS idx_batch_results_batch ON batch_results(batch_id);
    CREATE INDEX IF NOT EXISTS idx_batch_results_param ON batch_results(parameter_id);
    CREATE INDEX IF NOT EXISTS idx_params_product ON product_parameters(product_id);
  `);
}

// ── Types ─────────────────────────────────────────────

export interface Product {
  id: string; name: string; code: string; generic_name: string | null;
  api_grade: string | null; batch_size: string | null; batch_size_unit: string;
  shelf_life_months: number | null; license_no: string | null;
  standard_yield: number | null; therapeutic_category: string | null;
  status: string; created_at: string; updated_at: string;
}

export interface ProductParameter {
  id: string; product_id: string; name: string; type: string;
  unit: string | null; usl: number | null; lsl: number | null;
  target: number | null; stage: string | null; is_critical: number; sort_order: number;
}

export interface Batch {
  id: string; product_id: string; batch_number: string;
  manufacturing_date: string | null; status: string;
  yield_percentage: number | null; remarks: string | null;
}

export interface BatchResult {
  id: string; batch_id: string; parameter_id: string;
  value: number; specification_met: number; remarks: string | null;
}

// ── Seed ──────────────────────────────────────────────

function uid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
function randN(m: number, s: number): number {
  const u = Math.random(), v = Math.random();
  return m + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * s;
}

function seedDemoData(db: DbWrapper) {
  const p1Id = uid();
  db.prepare(`INSERT INTO products (id,name,code,generic_name,api_grade,batch_size,batch_size_unit,shelf_life_months,license_no,standard_yield,therapeutic_category,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(p1Id,'Metformin Hydrochloride','MET-API-001','Metformin HCl','IP/BP/USP','500','kg',36,'API/MFG/2024/001',85.0,'Anti-diabetic','active');

  const paramDefs = [
    {name:'Assay',type:'cqa',unit:'%',usl:101,lsl:98,target:99.5,stage:'final',crit:1,mean:99.5,sd:0.35},
    {name:'Water Content',type:'cqa',unit:'% w/w',usl:0.5,lsl:null,target:0.2,stage:'final',crit:1,mean:0.22,sd:0.06},
    {name:'Residual Solvents (Methanol)',type:'cqa',unit:'ppm',usl:3000,lsl:null,target:500,stage:'final',crit:1,mean:450,sd:180},
    {name:'Related Substances (Total)',type:'cqa',unit:'%',usl:0.5,lsl:null,target:0.1,stage:'final',crit:1,mean:0.12,sd:0.04},
    {name:'Sulphated Ash',type:'cqa',unit:'%',usl:0.1,lsl:null,target:0.02,stage:'final',crit:0,mean:0.025,sd:0.01},
    {name:'Heavy Metals',type:'cqa',unit:'ppm',usl:10,lsl:null,target:2,stage:'final',crit:0,mean:2.5,sd:1.2},
    {name:'pH (1% Solution)',type:'ipc',unit:'',usl:6.68,lsl:6.48,target:6.58,stage:'dissolution',crit:0,mean:6.58,sd:0.03},
    {name:'Particle Size D90',type:'cpp',unit:'µm',usl:250,lsl:null,target:150,stage:'milling',crit:1,mean:145,sd:22},
  ];

  const paramIds: string[] = [];
  paramDefs.forEach((p, i) => {
    const pid = uid(); paramIds.push(pid);
    db.prepare(`INSERT INTO product_parameters (id,product_id,name,type,unit,usl,lsl,target,stage,is_critical,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(pid,p1Id,p.name,p.type,p.unit,p.usl,p.lsl,p.target,p.stage,p.crit,i);
  });

  const batchRefs: {id:string}[] = [];
  for (let i=1; i<=25; i++) {
    const batchId = uid(); batchRefs.push({id:batchId});
    const mo = Math.floor((i-1)*12/25)+1;
    const d = Math.floor(Math.random()*25)+1;
    const date = `2025-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    let y = Math.round(randN(84.5+i*0.08,1.8)*10)/10;
    let status = 'released';
    if(i===7){status='rejected';y=72.1}
    if(i===18){status='reprocessed';y=78.5}

    db.prepare(`INSERT INTO batches (id,product_id,batch_number,manufacturing_date,status,yield_percentage) VALUES (?,?,?,?,?,?)`)
      .run(batchId,p1Id,`MET-${String(i).padStart(3,'0')}-25`,date,status,y);

    paramDefs.forEach((p,pi) => {
      let val = Math.abs(randN(p.mean,p.sd));
      if(i===7&&pi===0) val=97.5;
      if(i===12&&pi===2) val=2850;
      if(i===15&&pi===3) val=0.42;
      val = Math.round(val*1000)/1000;
      let specMet = 1;
      if(p.usl!=null&&val>p.usl) specMet=0;
      if(p.lsl!=null&&val<p.lsl) specMet=0;
      db.prepare(`INSERT INTO batch_results (id,batch_id,parameter_id,value,specification_met) VALUES (?,?,?,?,?)`)
        .run(uid(),batchId,paramIds[pi],val,specMet);
    });
  }

  // Deviations
  [[uid(),'DEV-2025-001','major','Batch MET-007-25 failed assay (97.5% vs 98.0-101.0%)','RM lot variability','CAPA-2025-001','closed','2025-03-20','2025-04-15',6],
   [uid(),'DEV-2025-002','minor','Documentation error — missing operator signature','Training gap','CAPA-2025-002','closed','2025-05-10','2025-05-25',9],
   [uid(),'DEV-2025-003','major','Batch MET-018-25 reprocessing — crystallization yield below 70%','Temperature excursion','CAPA-2025-003','closed','2025-08-22','2025-09-30',17],
   [uid(),'DEV-2025-004','minor','Residual solvent 2850 ppm — within spec but elevated','Drying time insufficient',null,'closed','2025-06-05','2025-06-20',11],
   [uid(),'DEV-2025-005','critical','Environmental monitoring excursion — particle count exceeded','HEPA filter compromised','CAPA-2025-004','closed','2025-10-15','2025-11-30',null],
  ].forEach((d:any) => {
    db.prepare(`INSERT INTO deviations (id,product_id,batch_id,deviation_number,type,description,root_cause,capa_reference,investigation_status,date_raised,date_closed)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(d[0],p1Id,d[9]!=null?batchRefs[d[9]]?.id:null,d[1],d[2],d[3],d[4],d[5],d[6],d[7],d[8]);
  });

  // CAPAs
  [[uid(),'CAPA-2025-001','Deviation','DEV-2025-001','Strengthen incoming RM testing','Updated SOP. Additional assay test.','2025-05-15','2025-05-10','Effective — no repeat failures','effective'],
   [uid(),'CAPA-2025-002','Deviation','DEV-2025-002','Retrain operators on doc SOP','Training completed. Matrix updated.','2025-06-30','2025-06-15','Zero doc deviations Q3-Q4','effective'],
   [uid(),'CAPA-2025-003','Deviation','DEV-2025-003','Qualify jacket cooler','Cooler requalified. Redundant sensor.','2025-10-31','2025-10-20','Under review','closed'],
   [uid(),'CAPA-2025-004','Deviation','DEV-2025-005','Replace HEPA filters','Filters replaced. DOP test added.','2025-12-31',null,null,'open'],
  ].forEach((c:any) => {
    db.prepare(`INSERT INTO capas (id,product_id,capa_number,source_type,source_reference,description,action_taken,due_date,closure_date,effectiveness_review,status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(c[0],p1Id,c[1],c[2],c[3],c[4],c[5],c[6],c[7],c[8],c[9]);
  });

  // Change Controls
  [[uid(),'CC-2025-001','Drying temp 60→65°C','process','No CQA impact','2025-04-01','implemented'],
   [uid(),'CC-2025-002','HPLC column 250→150mm','analytical','Method equivalence OK','2025-07-15','implemented'],
   [uid(),'CC-2025-003','New vendor for API-SM','material','3 trial batches passed','2025-09-01','implemented'],
  ].forEach((cc:any) => {
    db.prepare(`INSERT INTO change_controls (id,product_id,cc_number,description,type,impact_assessment,effective_date,status)
      VALUES (?,?,?,?,?,?,?,?)`).run(cc[0],p1Id,cc[1],cc[2],cc[3],cc[4],cc[5],cc[6]);
  });

  // Complaints
  db.prepare(`INSERT INTO complaints (id,product_id,complaint_number,type,description,investigation_summary,date_received,status)
    VALUES (?,?,?,?,?,?,?,?)`).run(uid(),p1Id,'COMP-2025-001','customer','Discoloration in packaging','Cosmetic only. No API impact.','2025-03-10','closed');
  db.prepare(`INSERT INTO complaints (id,product_id,complaint_number,type,description,investigation_summary,date_received,status)
    VALUES (?,?,?,?,?,?,?,?)`).run(uid(),p1Id,'COMP-2025-002','market','Regulatory query on residual solvent spec','ICH Q3C compliant. Response submitted.','2025-08-05','closed');

  // Product 2: Atorvastatin
  const p2Id = uid();
  db.prepare(`INSERT INTO products (id,name,code,generic_name,api_grade,batch_size,batch_size_unit,shelf_life_months,license_no,standard_yield,therapeutic_category,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(p2Id,'Atorvastatin Calcium','ATV-API-001','Atorvastatin Calcium','USP/EP','200','kg',24,'API/MFG/2024/002',78.0,'Anti-hyperlipidemic','active');

  const p2Params = [
    {name:'Assay',unit:'%',usl:102,lsl:98,target:100,mean:100,sd:0.5},
    {name:'Water Content',unit:'% w/w',usl:4.0,lsl:null,target:2.5,mean:2.5,sd:0.4},
    {name:'Total Impurities',unit:'%',usl:0.5,lsl:null,target:0.15,mean:0.15,sd:0.05},
  ];
  const p2Pids: string[] = [];
  p2Params.forEach((p,i) => {
    const pid = uid(); p2Pids.push(pid);
    db.prepare(`INSERT INTO product_parameters (id,product_id,name,type,unit,usl,lsl,target,stage,is_critical,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(pid,p2Id,p.name,'cqa',p.unit,p.usl,p.lsl,p.target,'final',1,i);
  });
  for(let i=1;i<=12;i++){
    const bid=uid();
    const mo=Math.ceil(i*12/12);
    db.prepare(`INSERT INTO batches (id,product_id,batch_number,manufacturing_date,status,yield_percentage) VALUES (?,?,?,?,?,?)`)
      .run(bid,p2Id,`ATV-${String(i).padStart(3,'0')}-25`,`2025-${String(mo).padStart(2,'0')}-${String(Math.floor(Math.random()*20)+5).padStart(2,'0')}`,'released',Math.round(randN(79,2.5)*10)/10);
    p2Params.forEach((p,pi) => {
      let val=Math.abs(randN(p.mean,p.sd)); val=Math.round(val*1000)/1000;
      let sm=1; if(p.usl!=null&&val>p.usl)sm=0; if(p.lsl!=null&&val<p.lsl)sm=0;
      db.prepare(`INSERT INTO batch_results (id,batch_id,parameter_id,value,specification_met) VALUES (?,?,?,?,?)`).run(uid(),bid,p2Pids[pi],val,sm);
    });
  }
}

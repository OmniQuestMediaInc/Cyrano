/**
 * seed-loader.ts
 * Loads test seed data CSVs from tests/seed_data/ into typed in-memory records.
 * Used by integration test suites to validate services against Ghost Alpha scenarios.
 */
import * as fs from 'fs';
import * as path from 'path';

const SEED_DIR = path.resolve(__dirname, '../seed_data');

function parseCsv<T>(filename: string): T[] {
  const raw = fs.readFileSync(path.join(SEED_DIR, filename), 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h.trim()] = (values[i] ?? '').trim();
    });
    return record as unknown as T;
  });
}

// ── Wallet record ────────────────────────────────────────────────────────────
export interface WalletRecord {
  wallet_id: string;
  owner_id: string;
  owner_type: string;       // 'customer' | 'creator' | 'platform'
  balance_tokens: string;   // raw CSV string — cast to bigint in tests
  last_updated_utc: string;
}

// ── Transaction record ───────────────────────────────────────────────────────
export interface TransactionRecord {
  transaction_id: string;
  idempotency_key: string;
  timestamp_utc: string;
  type: string;
  customer_id: string;
  creator_id: string;
  wallet_from_id: string;
  wallet_to_id: string;
  gross_tokens: string;
  platform_fee_tokens: string;
  net_tokens_to_creator: string;
  status: string;
  notes: string;
}

// ── Customer record ──────────────────────────────────────────────────────────
export interface CustomerRecord {
  customer_id: string;
  username: string;
  display_name: string;
  email_synthetic: string;
  marketing_opt_in: string;
  created_at_utc: string;
  notes: string;
}

// ── Creator record ────────────────────────────────────────────────────────────
export interface CreatorRecord {
  creator_id: string;
  username: string;
  display_name: string;
  category: string;
  tier: string;
  fan_count: string;
  created_at_utc: string;
  notes: string;
}

// ── Demo scenario record ─────────────────────────────────────────────────────
export interface DemoScenarioRecord {
  scenario_id: string;
  scenario_name: string;
  goal: string;
  steps: string;
  primary_creator_id: string;
  primary_customer_id: string;
  content_ids: string;
  expected_outcome: string;
  notes: string;
}

// ── Price list record ─────────────────────────────────────────────────────────
export interface PriceListRecord {
  price_id: string;
  creator_id: string;
  content_id: string;
  min_tokens: string;
  max_tokens: string;
  current_price_tokens: string;
  discount_percent_future: string;
}

// ── Loader functions ──────────────────────────────────────────────────────────
export const loadWallets = () =>
  parseCsv<WalletRecord>('wallets_TEST DATA.csv');

export const loadTransactions = () =>
  parseCsv<TransactionRecord>('transactions_TEST DATA.csv');

export const loadCustomers = () =>
  parseCsv<CustomerRecord>('customers_TEST DATA.csv');

export const loadCreators = () =>
  parseCsv<CreatorRecord>('creators_TEST DATA.csv');

export const loadDemoScenarios = () =>
  parseCsv<DemoScenarioRecord>('demo_scenarios_TEST DATA.csv');

export const loadPriceList = () =>
  parseCsv<PriceListRecord>('price_list_TEST DATA.csv');

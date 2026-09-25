"""Check that every column the app names actually exists in the SQL schema.

`src/services/ledger.ts` talks to six tables by explicit column name: the row
mappers decide what an insert/upsert sends, `LEDGER_PULL_COLUMNS` decides what a
pull reads back. Nothing in TypeScript can see the migrations, so a renamed or
invented column compiles, type-checks and passes the unit tests, then fails at
runtime with a PostgREST 400 — or, worse on the read side, comes back undefined.
This script closes that gap by parsing the migrations with the real PostgreSQL
parser (libpg_query, via `pglast`) and comparing the resulting column inventory
against both lists in `ledger.ts`.

    pip install pglast
    python supabase/tools/check_ledger_schema.py      # run from the repo root

Exit code 0 means no drift. Columns the migrations have but the app never reads
are only reported as informational: `orders.keg_*`, `rate`, `unit`, `shortfall`,
`meter_*`, `delivered_qty`, `tanks.last_dipstick_*` and `sale_payments.reference`
are legacy or write-only on purpose (see the allowlist in `ledger.test.ts`).
"""

import glob
import re
import sys

from pglast import parse_sql
from pglast import ast

# The tables the sync layer mirrors, and the mapper that writes each of them.
TABLES = ('customers', 'tanks', 'sales', 'orders', 'sale_payments', 'payments')
MAPPERS = {
    'toCustomerRow': 'customers',
    'toTankRow': 'tanks',
    'toSaleRow': 'sales',
    'toOrderRow': 'orders',
    'toSalePaymentLegs': 'sale_payments',
    'toPaymentRow': 'payments'
}
LEDGER = 'src/services/ledger.ts'
# Migrations only: `supabase/seed.sql` used to be appended here, but it seeded an
# invented two-product catalogue and has been deleted — migrations alone
# provision a database now.
SQL_FILES = sorted(glob.glob('supabase/migrations/*.sql'))


def name_of(node):
    """pglast hands identifiers back as `String` nodes (or occasionally str)."""
    return getattr(node, 'sval', node)


def parse_columns(paths):
    """{table: {column}} from every `create table` and `alter table ... add column`."""
    tables = {}
    for path in paths:
        try:
            statements = parse_sql(open(path, encoding='utf-8').read())
        except Exception as exc:  # noqa: BLE001 — report the file and keep going
            print(f'  !! cannot parse {path}: {exc}')
            continue
        for raw in statements:
            stmt = raw.stmt
            if isinstance(stmt, ast.CreateStmt):
                table = str(name_of(stmt.relation.relname))
                for element in stmt.tableElts or ():
                    if isinstance(element, ast.ColumnDef):
                        tables.setdefault(table, set()).add(str(name_of(element.colname)))
            elif isinstance(stmt, ast.AlterTableStmt):
                table = str(name_of(stmt.relation.relname))
                for cmd in stmt.cmds or ():
                    # pglast enum members stringify to a bare number on modern
                    # Pythons, so read `.name` rather than `str(subtype)`.
                    subtype = getattr(getattr(cmd, 'subtype', None), 'name', '') or ''
                    if 'AddColumn' not in subtype:
                        continue
                    column = getattr(cmd, 'def_', None) or getattr(cmd, 'def', None)
                    if isinstance(column, ast.ColumnDef):
                        tables.setdefault(table, set()).add(str(name_of(column.colname)))
    return tables


def pull_columns(path=LEDGER):
    """{table: {column}} from the LEDGER_PULL_COLUMNS object literal."""
    source = open(path, encoding='utf-8').read()
    block = source.split('export const LEDGER_PULL_COLUMNS', 1)[1].split('\n};', 1)[0]
    pulled = {}
    for table, body in re.findall(r"(\w+):\s*((?:'[^']*'|\s|\+)+?)(?=,?\n\s*\w+:|\Z)", block, re.S):
        literals = ''.join(re.findall(r"'([^']*)'", body))
        pulled[table] = {c.strip() for c in literals.split(',') if c.strip()}
    return pulled


def mapper_columns(path=LEDGER):
    """{function: {column}} from each mapper's returned object literal."""
    source = open(path, encoding='utf-8').read()
    written = {}
    for fn in ('toCustomerRow', 'toTankRow', 'toSaleRow', 'toOrderRow', 'toPaymentRow'):
        body = source.split(f'export function {fn}(', 1)[1].split('\n}', 1)[0]
        written[fn] = set(re.findall(r'^\s{4}([a-z_][a-z0-9_]*):', body, re.M))
    legs = source.split('export function toSalePaymentLegs(', 1)[1].split('\n}', 1)[0]
    inner = legs.split('row: {', 1)[1].split('\n        }', 1)[0]
    written['toSalePaymentLegs'] = set(re.findall(r'^\s{10}([a-z_][a-z0-9_]*):', inner, re.M))
    return written


def main():
    db = parse_columns(SQL_FILES)
    pulled = pull_columns()
    written = mapper_columns()
    problems = []

    print(f'parsed {len(SQL_FILES)} SQL files\n')
    for table in TABLES:
        columns = db.get(table)
        if not columns:
            problems.append(f'[{table}] no migration ever created this table')
            continue
        requested = pulled.get(table, set())
        print(f'[{table}] {len(columns)} columns in SQL, {len(requested)} pulled')
        for missing in sorted(requested - columns):
            problems.append(f'[{table}] the pull asks for `{missing}`, which the database does not have')
        for extra in sorted(columns - requested):
            print(f'    (not pulled, by design) {extra}')

    print()
    for fn, table in MAPPERS.items():
        columns = written.get(fn, set())
        if not columns:
            problems.append(f'[{fn}] no columns were extracted - this checker has gone stale')
            continue
        print(f'[{fn}] -> {table}: {len(columns)} columns written')
        for missing in sorted(columns - db.get(table, set())):
            problems.append(f'[{fn}] writes `{missing}` into {table}, which the database does not have')

    print('\n' + '=' * 68)
    if problems:
        print(f'{len(problems)} PROBLEM(S):')
        for problem in problems:
            print(' -', problem)
        return 1
    print('No drift: every pulled and every written column exists in the SQL schema.')
    return 0


if __name__ == '__main__':
    sys.exit(main())

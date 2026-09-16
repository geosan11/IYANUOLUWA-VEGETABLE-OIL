import React, { useState } from 'react';
import { Customer, CustomerStatementRow } from '../../types';
import { formatNaira, formatDepotDate, formatDepotTime } from '../../services/businessLogic';
import {
  Printer,
  X,
  PaperPlaneTilt,
  ShareNetwork,
  FileText,
  CheckCircle,
  WarningCircle,
  Phone,
  MapPin,
  Coins
} from '@phosphor-icons/react';

interface Props {
  customer: Customer;
  rows: CustomerStatementRow[];
  balance: number;
  kegsOut: number;
  company: {
    name: string;
    phone: string;
    address: string;
    logo_url?: string | null;
  };
  onClose: () => void;
}

export const CustomerStatementModal: React.FC<Props> = ({
  customer,
  rows,
  balance,
  kegsOut,
  company,
  onClose
}) => {
  const [viewMode, setViewMode] = useState<'a4' | 'thermal'>('a4');
  const [copied, setCopied] = useState(false);
  const asOf = new Date().toISOString();

  // Financial aggregates
  const totalDebits = rows.reduce((sum, r) => sum + (r.debit || 0), 0);
  const totalCredits = rows.reduce((sum, r) => sum + (r.credit || 0), 0);

  const statementRef = `STMT-${customer.id.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

  const shareText = [
    `*${company.name.toUpperCase()}*`,
    `*CUSTOMER STATEMENT OF ACCOUNT*`,
    `Statement Ref: ${statementRef}`,
    `As of: ${formatDepotDate(asOf)} ${formatDepotTime(asOf)}`,
    `----------------------------------------`,
    `Customer: ${customer.name} (${customer.type.toUpperCase()})`,
    `Phone: ${customer.phone || 'N/A'}`,
    ``,
    `*FINANCIAL SUMMARY:*`,
    `Total Invoiced (Debits): ${formatNaira(totalDebits)}`,
    `Total Payments (Credits): ${formatNaira(totalCredits)}`,
    `*NET BALANCE OWED: ${formatNaira(balance)}*`,
    `Company Kegs on Loan: ${kegsOut} keg(s)`,
    `----------------------------------------`,
    `*RECENT TRANSACTIONS:*`,
    ...rows.slice(0, 8).map(r => {
      const amt = r.debit > 0 ? `+${formatNaira(r.debit)}` : r.credit > 0 ? `-${formatNaira(r.credit)}` : '—';
      return `• ${formatDepotDate(r.date)} | ${r.label} | ${amt} (Bal: ${formatNaira(r.runningBalance)})`;
    }),
    `----------------------------------------`,
    `Depot Contact: ${company.phone}`,
    `${company.address}`
  ].join('\n');

  const waHref = `https://wa.me/${(customer.phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(shareText)}`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Control Bar (Screen Only) */}
        <div className="no-print px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-400 flex items-center justify-center">
              <FileText className="w-5 h-5" weight="bold" />
            </div>
            <div>
              <h2 className="text-white font-heading font-bold text-sm sm:text-base">
                Customer Statement & Balance Sheet
              </h2>
              <p className="text-xs text-slate-400 font-sans">
                Official statement of account for {customer.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Format toggle */}
            <div className="hidden sm:flex items-center p-1 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('a4')}
                className={`px-3 py-1 rounded-lg font-sans font-semibold transition-all ${
                  viewMode === 'a4'
                    ? 'bg-brand-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                A4 Balance Sheet
              </button>
              <button
                type="button"
                onClick={() => setViewMode('thermal')}
                className={`px-3 py-1 rounded-lg font-sans font-semibold transition-all ${
                  viewMode === 'thermal'
                    ? 'bg-brand-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                80mm POS Slip
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scroll Body */}
        <div className="p-4 sm:p-6 max-h-[calc(85vh-130px)] overflow-y-auto">
          {viewMode === 'a4' ? (
            /* ========================================================================= */
            /* EXECUTIVE A4 CREDIT & DEBIT BALANCE SHEET DOCUMENT                        */
            /* ========================================================================= */
            <div
              id="statement-sheet-print-area"
              className="bg-white text-slate-900 p-6 sm:p-10 rounded-2xl shadow-sm border border-slate-200 mx-auto max-w-3xl space-y-6"
            >
              {/* Company Logo & Formal Letterhead Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b-2 border-slate-900/10">
                <div className="flex items-center gap-4">
                  {company.logo_url ? (
                    <img
                      src={company.logo_url}
                      alt={company.name}
                      className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-xl border border-slate-200 p-1 bg-white"
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-white flex flex-col items-center justify-center font-heading font-black shadow-md shrink-0">
                      <span className="text-xl tracking-tighter">IVO</span>
                      <span className="text-[9px] uppercase tracking-widest font-sans opacity-90">DEPOT</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <h1 className="font-heading font-extrabold text-lg sm:text-xl text-slate-950 uppercase tracking-tight leading-tight">
                      {company.name}
                    </h1>
                    <div className="text-[11px] font-sans text-slate-600 space-y-0.5">
                      <p className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                        <span>{company.address}</span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                        <span>Tel: {company.phone}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-left sm:text-right space-y-1 self-stretch sm:self-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                  <div className="inline-block px-3 py-1 rounded-lg bg-slate-950 text-white font-sans font-extrabold text-[11px] uppercase tracking-widest">
                    STATEMENT OF ACCOUNT
                  </div>
                  <div className="text-[12px] font-mono font-bold text-slate-900">
                    Ref: {statementRef}
                  </div>
                  <div className="text-[11px] font-sans text-slate-500">
                    Generated: {formatDepotDate(asOf)} {formatDepotTime(asOf)}
                  </div>
                </div>
              </div>

              {/* Account Profile & Summary KPI Blocks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Account Details */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 block">
                    Customer Account Particulars
                  </span>
                  <div className="font-heading font-extrabold text-base text-slate-900">
                    {customer.name}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-sans text-slate-600 pt-1">
                    <div>
                      <span className="text-slate-400 block">Category / Tier:</span>
                      <span className="font-bold capitalize text-slate-800">{customer.type} Customer</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Telephone:</span>
                      <span className="font-mono font-semibold text-slate-800">{customer.phone || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Credit Limit:</span>
                      <span className="font-mono font-semibold text-slate-800">{formatNaira(customer.credit_limit || 0)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Agreed Terms:</span>
                      <span className="font-semibold text-slate-800">{customer.credit_term_days || 7} Days</span>
                    </div>
                  </div>
                </div>

                {/* Balance Status Banner */}
                <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400">
                      Current Ledger Position
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        balance > 0
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : balance < 0
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {balance > 0 ? (
                        <>
                          <WarningCircle className="w-3 h-3 text-rose-400" weight="fill" />
                          <span>Debt Outstanding</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3 h-3 text-emerald-400" weight="fill" />
                          <span>Account Clear</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div>
                    <div className="text-[11px] font-sans text-slate-300">
                      Net Closing Balance Owed:
                    </div>
                    <div
                      className={`text-2xl sm:text-3xl font-heading font-black tracking-tight tabular-nums ${
                        balance > 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {formatNaira(balance)}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-sans text-slate-300">
                    <span>Company Kegs On Loan:</span>
                    <span className="font-mono font-bold text-amber-300 text-sm">
                      {kegsOut} kegs
                    </span>
                  </div>
                </div>
              </div>

              {/* 4 KPI Telemetry Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-sans uppercase text-slate-500 block">Total Debits</span>
                  <span className="text-sm font-bold text-rose-700">+{formatNaira(totalDebits)}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-sans uppercase text-slate-500 block">Total Credits</span>
                  <span className="text-sm font-bold text-emerald-700">-{formatNaira(totalCredits)}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-sans uppercase text-slate-500 block">Balance Owed</span>
                  <span className={`text-sm font-bold ${balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {formatNaira(balance)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-sans uppercase text-slate-500 block">Kegs on Loan</span>
                  <span className="text-sm font-bold text-slate-900">{kegsOut}</span>
                </div>
              </div>

              {/* Full Financial Ledger Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Transaction Ledger & Itemized Activity</span>
                  <span className="font-mono text-[11px] text-slate-400 font-normal">
                    {rows.length} Record{rows.length === 1 ? '' : 's'}
                  </span>
                </h3>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-[11.5px] font-sans">
                    <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Type / Ref</th>
                        <th className="py-2.5 px-3">Transaction Details</th>
                        <th className="py-2.5 px-3 text-right">Debit (+₦)</th>
                        <th className="py-2.5 px-3 text-right">Credit (-₦)</th>
                        <th className="py-2.5 px-3 text-right">Balance (₦)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                      {[...rows].reverse().map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2 px-3 whitespace-nowrap text-slate-600 text-[11px]">
                            {formatDepotDate(r.date)}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-sans font-extrabold uppercase tracking-wide ${
                                r.kind === 'sale'
                                  ? 'bg-amber-100 text-amber-800'
                                  : r.kind === 'payment'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : r.kind === 'keg_return'
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {r.kind === 'keg_return' ? 'Keg Return' : r.kind}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-800">
                            <div>{r.label}</div>
                            {r.note && <div className="text-[10px] text-slate-400 italic mt-0.5">{r.note}</div>}
                          </td>
                          <td className="py-2 px-3 text-right text-rose-600 font-semibold">
                            {r.debit > 0 ? formatNaira(r.debit) : '—'}
                          </td>
                          <td className="py-2 px-3 text-right text-emerald-600 font-semibold">
                            {r.credit > 0 ? formatNaira(r.credit) : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            {formatNaira(r.runningBalance)}
                          </td>
                        </tr>
                      ))}

                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                            No ledger transactions recorded on this account yet.
                          </td>
                        </tr>
                      )}
                    </tbody>

                    {/* Table Totals */}
                    {rows.length > 0 && (
                      <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-mono font-bold text-xs">
                        <tr>
                          <td colSpan={3} className="py-2.5 px-3 text-slate-800 font-sans uppercase">
                            Account Total Cumulative Movements:
                          </td>
                          <td className="py-2.5 px-3 text-right text-rose-700">
                            {formatNaira(totalDebits)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-emerald-700">
                            {formatNaira(totalCredits)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-950 font-black text-[13px]">
                            {formatNaira(balance)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Bank Remittance & Official Sign-off */}
              <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-slate-600 font-sans">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-brand-600" />
                    <span>Settlement Remittance Information</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Direct bank payments should quote customer account name and statement reference <b>{statementRef}</b> for immediate reconciliation.
                  </p>
                  <p className="text-[11px] font-mono text-slate-700">
                    Depot Support: {company.phone}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="border-b border-slate-300 pb-1 flex flex-col justify-end">
                    <div className="h-10" />
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                      Depot Cashier / Auditor
                    </span>
                  </div>
                  <div className="border-b border-slate-300 pb-1 flex flex-col justify-end">
                    <div className="h-10" />
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                      Customer Acceptance
                    </span>
                  </div>
                </div>
              </div>

              {/* Document Micro-footer */}
              <div className="text-center text-[10px] font-mono text-slate-400 pt-3 border-t border-dashed border-slate-200">
                Official Computer-Generated Balance Sheet · {company.name} · Certified Accurate
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* COMPACT 80MM THERMAL RECEIPT SLIP VIEW                                    */
            /* ========================================================================= */
            <div
              id="receipt-print-area"
              className="px-5 py-5 text-slate-900 font-mono bg-[#fbfbf8] max-w-sm mx-auto rounded-xl shadow-md border border-slate-200"
            >
              <div className="text-center border-b-2 border-dashed border-slate-300 pb-3 mb-3">
                {company.logo_url && (
                  <img
                    src={company.logo_url}
                    alt={company.name}
                    className="w-12 h-12 object-contain mx-auto mb-1 rounded"
                  />
                )}
                <h1 className="text-[14px] font-heading font-extrabold uppercase text-slate-950 leading-snug">
                  {company.name}
                </h1>
                <p className="text-[10.5px] font-sans text-slate-600 mt-0.5 leading-tight">{company.address}</p>
                <p className="text-[10.5px] font-mono tabular-nums text-slate-600 leading-tight">Tel: {company.phone}</p>
                <div className="mt-2.5 py-1 border-y border-dashed border-slate-300 tracking-wider text-[11px] font-mono font-bold text-slate-900 uppercase">
                  * * CUSTOMER STATEMENT * *
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[12px] border-b border-slate-200 pb-3 mb-3 font-mono tabular-nums">
                <div>
                  <span className="block text-[11px] font-sans uppercase text-slate-500">Customer</span>
                  <span className="font-bold">{customer.name}</span>
                </div>
                <div className="text-right">
                  <span className="block text-[11px] font-sans uppercase text-slate-500">As of</span>
                  <span className="font-bold">
                    {formatDepotDate(asOf)} {formatDepotTime(asOf)}
                  </span>
                </div>
              </div>

              <table className="w-full text-[11px] font-mono tabular-nums">
                <thead>
                  <tr className="text-slate-500 text-[10px] font-sans uppercase border-b border-slate-200">
                    <th className="text-left py-1">Date</th>
                    <th className="text-left py-1">Detail</th>
                    <th className="text-right py-1">Debt</th>
                    <th className="text-right py-1">Credit</th>
                    <th className="text-right py-1">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...rows].reverse().map((r, i) => (
                    <tr key={i}>
                      <td className="py-1.5 text-left whitespace-nowrap">{formatDepotDate(r.date)}</td>
                      <td className="py-1.5 text-left">
                        {r.label}
                        {r.paidStatus && r.kind === 'sale' ? ` [${r.paidStatus}]` : ''}
                      </td>
                      <td className="py-1.5 text-right">{r.debit > 0 ? formatNaira(r.debit) : ''}</td>
                      <td className="py-1.5 text-right">{r.credit > 0 ? formatNaira(r.credit) : ''}</td>
                      <td className="py-1.5 text-right font-bold">{formatNaira(r.runningBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-3 pt-3 border-t-2 border-dashed border-slate-300 space-y-1 text-[13px] font-mono tabular-nums">
                <div className="flex justify-between font-bold text-[15px] text-slate-950">
                  <span className="font-sans">Balance owed</span>
                  <span className={balance > 0 ? 'text-rose-700' : 'text-emerald-700'}>{formatNaira(balance)}</span>
                </div>
                <div className="flex justify-between text-slate-600 text-[12px]">
                  <span className="font-sans">Company kegs on loan</span>
                  <span className="font-bold">{kegsOut}</span>
                </div>
              </div>

              <div className="text-center text-[10px] font-sans text-slate-500 pt-3 mt-2 border-t border-dashed border-slate-300">
                Generated {formatDepotDate(asOf)} · {company.name}
              </div>
            </div>
          )}
        </div>

        {/* Action Controls Bar (Screen Only) */}
        <div className="no-print px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 font-sans hidden sm:block">
            Tip: Click <b>Print / Save PDF</b> and select <i>Save as PDF</i> in your print destination.
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-sans font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <ShareNetwork className="w-4 h-4" />
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>

            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-emerald-950"
            >
              <PaperPlaneTilt className="w-4 h-4" weight="bold" />
              <span>WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-heading font-extrabold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-brand-950"
            >
              <Printer className="w-4 h-4" weight="bold" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

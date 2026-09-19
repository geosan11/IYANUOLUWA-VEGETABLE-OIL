import React, { useState } from 'react';
import { Customer, CustomerStatementRow } from '../../types';
import { formatNaira, formatDepotDate, formatDepotTime } from '../../services/businessLogic';
import {
  Printer,
  X,
  PaperPlaneTilt,
  ShareNetwork,
  FileText
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Top Control Bar (Screen Only) */}
        <div className="no-print px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-4 shrink-0">
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

        {/* Modal Scroll Body — only scrolls when content genuinely exceeds
            the panel's own max-h-[90vh] cap, not on a fixed guess */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto overscroll-contain">
          {viewMode === 'a4' ? (
            <div
              id="statement-sheet-print-area"
              className="bg-white text-black p-8 sm:p-12 rounded-xl shadow-lg border-2 border-black mx-auto max-w-3xl space-y-6 font-sans"
            >
              {/* Formal Company Header & Document Title */}
              <div className="border-b-2 border-black pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-serif font-black uppercase tracking-tight text-black">
                    {company.name}
                  </h1>
                  <p className="text-[11px] font-semibold tracking-wide text-neutral-800 uppercase mt-0.5">
                    Depot Wholesale Operations · Vegetable &amp; Palm Oil Distribution
                  </p>
                  <p className="text-[11px] text-neutral-700 mt-1 leading-snug">
                    {company.address}
                  </p>
                  <p className="text-[11px] text-neutral-700 font-mono">
                    Tel: {company.phone} · RC / Reg: 3491820
                  </p>
                </div>

                <div className="border-2 border-black p-3 text-left sm:text-right self-stretch sm:self-auto min-w-[220px]">
                  <div className="text-[11px] font-mono font-black uppercase tracking-wider bg-black text-white px-2 py-0.5 text-center mb-1.5">
                    STATEMENT OF ACCOUNT
                  </div>
                  <div className="text-[11px] font-mono">
                    <span className="text-neutral-600">Ref:</span> <strong className="text-black">{statementRef}</strong>
                  </div>
                  <div className="text-[11px] font-mono">
                    <span className="text-neutral-600">Date:</span> <strong className="text-black">{formatDepotDate(asOf)}</strong>
                  </div>
                  <div className="text-[11px] font-mono">
                    <span className="text-neutral-600">Time:</span> {formatDepotTime(asOf)}
                  </div>
                </div>
              </div>

              {/* Customer Particulars & Statement Summary Ledger Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-black p-4 bg-neutral-50/50">
                {/* Customer Details */}
                <div className="space-y-1 text-[11px] border-b sm:border-b-0 sm:border-r border-black/30 pb-3 sm:pb-0 sm:pr-4">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-600">
                    Account Particulars
                  </div>
                  <div className="text-sm font-bold text-black uppercase">
                    {customer.name}
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1">
                    <div>
                      <span className="text-neutral-600">Category:</span>{' '}
                      <strong className="capitalize text-black">{customer.type}</strong>
                    </div>
                    <div>
                      <span className="text-neutral-600">Phone:</span>{' '}
                      <strong className="font-mono text-black">{customer.phone || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-neutral-600">Credit Limit:</span>{' '}
                      <strong className="font-mono text-black">{formatNaira(customer.credit_limit || 0)}</strong>
                    </div>
                    <div>
                      <span className="text-neutral-600">Agreed Terms:</span>{' '}
                      <strong className="text-black">{customer.credit_term_days || 7} Days</strong>
                    </div>
                  </div>
                </div>

                {/* Balance & Exposure Summary */}
                <div className="space-y-1 text-[11px] sm:pl-2">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-600">
                    Financial Ledger Position
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-neutral-700">Total Invoiced (Debits):</span>
                    <span className="font-mono font-bold text-black">+{formatNaira(totalDebits)}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-neutral-700">Total Payments (Credits):</span>
                    <span className="font-mono font-bold text-black">-{formatNaira(totalCredits)}</span>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-black pt-1 mt-1 font-bold text-xs">
                    <span className="uppercase text-black">Net Closing Balance Due:</span>
                    <span className="font-mono text-sm text-black underline decoration-2 underline-offset-2">
                      {formatNaira(balance)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-[11px] text-neutral-700 pt-0.5">
                    <span>Company Kegs On Loan:</span>
                    <span className="font-mono font-bold text-black">{kegsOut} keg(s)</span>
                  </div>
                </div>
              </div>

              {/* Formal Accounting Ledger Table */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono font-bold text-black uppercase tracking-wider">
                  <span>Itemized Financial Ledger &amp; Transactions</span>
                  <span>{rows.length} RECORD(S)</span>
                </div>

                <div className="border border-black overflow-hidden">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-black text-white uppercase text-[10px] tracking-wider font-mono">
                        <th className="py-2 px-2.5 border-r border-neutral-700">Date</th>
                        <th className="py-2 px-2.5 border-r border-neutral-700">Ref / Type</th>
                        <th className="py-2 px-2.5 border-r border-neutral-700">Particulars / Description</th>
                        <th className="py-2 px-2.5 text-right border-r border-neutral-700">Debit (₦)</th>
                        <th className="py-2 px-2.5 text-right border-r border-neutral-700">Credit (₦)</th>
                        <th className="py-2 px-2.5 text-right">Balance (₦)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/20 font-mono tabular-nums text-black">
                      {[...rows].reverse().map((r, i) => (
                        <tr key={i} className="hover:bg-neutral-100/60">
                          <td className="py-2 px-2.5 whitespace-nowrap border-r border-black/20 text-neutral-800 text-[10.5px]">
                            {formatDepotDate(r.date)}
                          </td>
                          <td className="py-2 px-2.5 whitespace-nowrap border-r border-black/20 text-[10px] font-bold uppercase">
                            {r.kind === 'keg_return' ? 'KEG RETURN' : r.kind.toUpperCase()}
                          </td>
                          <td className="py-2 px-2.5 border-r border-black/20 font-sans text-neutral-900 text-[11px]">
                            <div className="font-semibold">{r.label}</div>
                            {r.note && <div className="text-[10px] text-neutral-600 italic">{r.note}</div>}
                          </td>
                          <td className="py-2 px-2.5 text-right border-r border-black/20 font-bold">
                            {r.debit > 0 ? formatNaira(r.debit) : '—'}
                          </td>
                          <td className="py-2 px-2.5 text-right border-r border-black/20 font-bold">
                            {r.credit > 0 ? formatNaira(r.credit) : '—'}
                          </td>
                          <td className="py-2 px-2.5 text-right font-black">
                            {formatNaira(r.runningBalance)}
                          </td>
                        </tr>
                      ))}

                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-neutral-500 font-sans italic">
                            No ledger transactions recorded on this customer account yet.
                          </td>
                        </tr>
                      )}
                    </tbody>

                    {/* Accounting Double Underline Totals */}
                    {rows.length > 0 && (
                      <tfoot className="border-t-2 border-black border-b-4 border-double border-black bg-neutral-100/80 font-mono font-bold text-[11px] text-black">
                        <tr>
                          <td colSpan={3} className="py-2 px-2.5 uppercase font-sans border-r border-black/20">
                            Cumulative Account Total:
                          </td>
                          <td className="py-2 px-2.5 text-right border-r border-black/20 font-black">
                            {formatNaira(totalDebits)}
                          </td>
                          <td className="py-2 px-2.5 text-right border-r border-black/20 font-black">
                            {formatNaira(totalCredits)}
                          </td>
                          <td className="py-2 px-2.5 text-right font-black text-xs">
                            {formatNaira(balance)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Settlement Instructions & Terms */}
              <div className="border border-black p-3.5 bg-neutral-50 text-[10.5px] space-y-1 text-neutral-800 font-sans">
                <div className="font-bold uppercase tracking-wider text-black">
                  Remittance &amp; Payment Settlement Terms
                </div>
                <p>
                  All payments should quote customer account name and statement reference <strong>{statementRef}</strong>. Direct bank transfers or bank drafts are payable into authorized depot accounts. Any discrepancies must be reported in writing within 5 business days of statement date.
                </p>
              </div>

              {/* Formal Signatures & Accountability Block */}
              <div className="grid grid-cols-3 gap-6 pt-6 border-t border-black text-center text-[10px] uppercase font-mono">
                <div className="space-y-1">
                  <div className="border-b border-black pb-1 h-12 flex items-end justify-center text-neutral-400">
                    <span>Signature / Date</span>
                  </div>
                  <div className="font-bold text-black">Prepared By (Cashier / Staff)</div>
                  <div className="text-neutral-600 lowercase text-[9px]">accountability verified</div>
                </div>

                <div className="space-y-1">
                  <div className="border-b border-black pb-1 h-12 flex items-end justify-center text-neutral-400">
                    <span>Signature / Date</span>
                  </div>
                  <div className="font-bold text-black">Audited &amp; Approved By</div>
                  <div className="text-neutral-600 lowercase text-[9px]">depot manager / supervisor</div>
                </div>

                <div className="space-y-1">
                  <div className="border-b border-black pb-1 h-12 flex items-end justify-center text-neutral-400">
                    <span>Signature / Date</span>
                  </div>
                  <div className="font-bold text-black">Customer Acknowledgment</div>
                  <div className="text-neutral-600 lowercase text-[9px]">received &amp; confirmed</div>
                </div>
              </div>

              {/* Document Micro-footer */}
              <div className="text-center text-[9px] font-mono text-neutral-500 pt-2 border-t border-dotted border-black/40">
                Official Computer-Generated Financial Statement · Iyanuoluwa Oil Depot · Certified True &amp; Correct
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

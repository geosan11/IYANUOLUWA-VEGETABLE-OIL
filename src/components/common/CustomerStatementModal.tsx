import React from 'react';
import { Customer, CustomerStatementRow } from '../../types';
import { formatNaira, formatDepotDate, formatDepotTime } from '../../services/businessLogic';
import { Printer, X, PaperPlaneTilt, ShareNetwork } from '@phosphor-icons/react';

interface Props {
  customer: Customer;
  rows: CustomerStatementRow[];
  balance: number;
  kegsOut: number;
  company: { name: string; phone: string; address: string };
  onClose: () => void;
}

export const CustomerStatementModal: React.FC<Props> = ({ customer, rows, balance, kegsOut, company, onClose }) => {
  const asOf = new Date().toISOString();

  const shareText = [
    `${company.name}`,
    `Statement — ${customer.name}`,
    `As of ${formatDepotDate(asOf)} ${formatDepotTime(asOf)}`,
    ``,
    `Balance owed: ${formatNaira(balance)}`,
    `Company kegs on loan: ${kegsOut}`,
    ``,
    `Recent activity:`,
    ...rows.slice(0, 6).map(r => {
      const amt = r.debit > 0 ? `+${formatNaira(r.debit)}` : r.credit > 0 ? `-${formatNaira(r.credit)}` : '—';
      return `${formatDepotDate(r.date)}  ${r.label}  ${amt}  (bal ${formatNaira(r.runningBalance)})`;
    }),
    ``,
    `${company.phone}`
  ].join('\n');

  const waHref = `https://wa.me/${(customer.phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(shareText)}`;

  const nativeShare = () => {
    if (navigator.share) {
      navigator.share({ title: `Statement — ${customer.name}`, text: shareText }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(shareText);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl my-8">
        <div className="no-print px-5 pt-4 pb-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-brand-400 font-sans font-semibold text-sm">Customer statement</span>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pt-3 pb-4">
          <div
            id="receipt-print-area"
            className="px-5 py-5 text-slate-900 font-mono"
            style={{ backgroundColor: '#fbfbf8' }}
          >
            <div className="text-center border-b-2 border-dashed border-slate-300 pb-3 mb-3">
              <h1 className="text-[15px] font-heading font-extrabold uppercase text-slate-950 leading-tight">{company.name}</h1>
              <p className="text-[11px] font-sans text-slate-600">{company.address}</p>
              <p className="text-[11px] text-slate-600 tabular-nums">Tel: {company.phone}</p>
              <div className="mt-2 tracking-[0.3em] text-[11px] font-bold text-slate-800">* * CUSTOMER STATEMENT * *</div>
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
                  <th className="text-right py-1">Debit</th>
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
                      {r.note ? ` — ${r.note}` : ''}
                    </td>
                    <td className="py-1.5 text-right">{r.debit > 0 ? formatNaira(r.debit) : ''}</td>
                    <td className="py-1.5 text-right">{r.credit > 0 ? formatNaira(r.credit) : ''}</td>
                    <td className="py-1.5 text-right font-bold">{formatNaira(r.runningBalance)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-slate-400">
                      No activity on record.
                    </td>
                  </tr>
                )}
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
        </div>

        <div className="no-print px-5 pb-5 flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-100 font-sans font-bold text-[13px] flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" weight="bold" /> Print 80mm
          </button>
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-sans font-bold text-[13px] flex items-center justify-center gap-2"
          >
            <PaperPlaneTilt className="w-4 h-4" weight="bold" /> WhatsApp
          </a>
          <button
            onClick={nativeShare}
            className="px-3 py-2.5 rounded-xl border border-slate-700 text-slate-300"
            title="Share / copy"
          >
            <ShareNetwork className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

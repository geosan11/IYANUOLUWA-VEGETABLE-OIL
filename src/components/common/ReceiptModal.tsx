import React from 'react';
import { ReceiptData } from '../../types';
import { useStore } from '../../services/store';
import { formatNaira, formatDepotDate, formatDepotTime } from '../../services/businessLogic';
import { Printer, X, CheckCircle2, ShieldCheck } from 'lucide-react';

interface ReceiptModalProps {
  receipt: ReceiptData | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, onClose }) => {
  const { settings } = useStore();

  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const isOrder = receipt.type === 'order';
  const order = receipt.order;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Modal Action Bar (Hidden on print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2 text-brand-400 font-sans font-semibold text-[14px]">
            <CheckCircle2 className="w-5 h-5 text-brand-500" />
            <span>Transaction Processed Successfully</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Receipt Paper Container */}
        <div className="p-6 bg-white text-slate-900" id="receipt-print-area">
          {/* Header */}
          <div className="text-center border-b-2 border-dashed border-slate-300 pb-4 mb-4">
            {settings.company_logo_url ? (
              <img
                src={settings.company_logo_url}
                alt="Company Logo"
                className="h-14 mx-auto mb-2 object-contain"
              />
            ) : (
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-500 text-white font-extrabold text-xl mb-2 shadow-sm font-heading">
                IO
              </div>
            )}
            <h1 className="text-[18px] font-heading font-extrabold tracking-tight text-slate-950 uppercase">
              {settings.company_name}
            </h1>
            <p className="text-[12px] font-sans text-slate-600 mt-0.5">{settings.company_address}</p>
            <p className="text-[12px] font-mono tabular-nums text-slate-600">Tel: {settings.company_phone}</p>
            
            <div className="mt-3 inline-block px-3 py-1 bg-slate-100 rounded-full border border-slate-300 text-[12px] font-mono tabular-nums font-bold uppercase tracking-wider text-slate-800">
              OFFICIAL RECEIPT
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-2 text-[12px] border-b border-slate-200 pb-3 mb-3 font-mono tabular-nums">
            <div>
              <span className="text-slate-500 block text-[11px] font-sans uppercase">Receipt No:</span>
              <span className="font-bold text-slate-900">{receipt.receiptNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-[11px] font-sans uppercase">Date & Time:</span>
              <span className="font-bold text-slate-900">
                {formatDepotDate(receipt.date)} {formatDepotTime(receipt.date)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px] font-sans uppercase">Customer:</span>
              <span className="font-bold font-heading text-slate-900">{receipt.customer.name}</span>
              <span className="text-[11px] text-slate-500 block uppercase font-sans">({receipt.customer.type})</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-[11px] font-sans uppercase">Payment Method:</span>
              <span className="font-bold uppercase text-slate-900 px-1.5 py-0.5 bg-slate-100 rounded font-sans text-[11px]">
                {receipt.paymentMethod}
              </span>
            </div>
          </div>

          {/* Line Items / Details */}
          {isOrder && order ? (
            <div className="border-b-2 border-dashed border-slate-300 pb-3 mb-3">
              <div className="text-[12px] font-heading font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Order Dispense Details
              </div>
              <table className="w-full text-[12px] font-mono tabular-nums">
                <thead>
                  <tr className="text-slate-500 text-[11px] font-sans uppercase border-b border-slate-200 pb-1">
                    <th className="text-left py-1">Item Description</th>
                    <th className="text-center py-1">Qty</th>
                    <th className="text-right py-1">Rate</th>
                    <th className="text-right py-1">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2 text-left">
                      <div className="font-heading font-bold text-slate-900 text-[13px]">{receipt.product?.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {order.litres.toLocaleString()} Litres ({order.qty} {order.unit}s)
                      </div>
                      <div className="text-[11px] text-slate-600 font-sans font-medium">
                        Container:{' '}
                        {order.keg_source === 'company'
                          ? 'Company Keg (Returnable)'
                          : order.keg_source === 'own'
                          ? 'Customer-Owned Keg'
                          : 'Bulk Dispense'}
                      </div>
                      {receipt.tankLabel && (
                        <div className="text-[11px] text-slate-500 font-sans">
                          Source: {receipt.tankLabel}
                        </div>
                      )}
                    </td>
                    <td className="py-2 text-center align-top font-bold">
                      {order.qty} {order.unit}
                    </td>
                    <td className="py-2 text-right align-top">
                      ₦{order.rate.toLocaleString()}/L
                    </td>
                    <td className="py-2 text-right align-top font-bold text-slate-900">
                      {formatNaira(order.amount)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {order.note && (
                <div className="mt-2 text-[12px] font-sans text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="font-bold">Note:</span> {order.note}
                </div>
              )}
            </div>
          ) : (
            /* Payment Receipt Details */
            <div className="border-b-2 border-dashed border-slate-300 pb-3 mb-3">
              <div className="text-[12px] font-heading font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Credit Payment Received
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center my-2">
                <span className="text-[12px] font-sans text-emerald-800 block uppercase font-medium">
                  Amount Received & Credited
                </span>
                <span className="text-[28px] font-mono tabular-nums font-extrabold text-emerald-700">
                  {formatNaira(receipt.paymentAmount || 0)}
                </span>
              </div>
              
              {receipt.unappliedLeftover && receipt.unappliedLeftover > 0 ? (
                <div className="text-[12px] font-mono tabular-nums text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-200 mt-2">
                  <span className="font-bold font-sans">Note:</span> {formatNaira(receipt.unappliedLeftover)} added to this customer's store credit (all open invoices are fully settled).
                </div>
              ) : null}
            </div>
          )}

          {/* Balances & Totals */}
          <div className="space-y-1 text-[13px] font-mono tabular-nums border-b border-slate-200 pb-3 mb-3">
            {isOrder && order && (
              <>
                <div className="flex justify-between font-bold text-[15px] text-slate-950 pt-1">
                  <span className="font-sans">Grand Total:</span>
                  <span>{formatNaira(order.amount)}</span>
                </div>
                <div className="flex justify-between text-slate-600 text-[12px]">
                  <span className="font-sans">Paid Amount:</span>
                  <span className="font-bold">{formatNaira(order.paid_amount)}</span>
                </div>
              </>
            )}

            <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-100 text-[12px]">
              <span className="font-sans">Previous Balance:</span>
              <span>{formatNaira(receipt.previousBalance)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 text-[14px]">
              <span className="font-sans">Current Outstanding Balance:</span>
              <span className={receipt.newBalance > 0 ? 'text-rose-600 font-extrabold' : 'text-emerald-700'}>
                {formatNaira(receipt.newBalance)}
              </span>
            </div>
          </div>

          {/* Footer Sign-off */}
          <div className="text-center text-[11px] font-sans text-slate-500 pt-1 space-y-1">
            <div className="flex items-center justify-center gap-1 text-emerald-700 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Verified Authentic Depot Receipt</span>
            </div>
            <p>Thank you for your business!</p>
            <p className="text-[11px] font-mono tabular-nums text-slate-400">
              Cashier: {receipt.cashierName || 'Depot Cashier'} · Printed on {new Date().toLocaleDateString('en-GB')}
            </p>
          </div>
        </div>

        {/* Modal Action Buttons (Screen only) */}
        <div className="no-print p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[13px] font-sans font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-sans font-bold text-[13px] shadow-lg shadow-brand-500/25 transition-all transform active:scale-95"
          >
            <Printer className="w-[18px] h-[18px]" />
            <span>Print Receipt</span>
          </button>
        </div>

      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { ReceiptData } from '../../types';
import { useStore } from '../../services/store';
import { formatNaira, formatNairaWords, formatDepotDate, formatDepotTime } from '../../services/businessLogic';
import { packShort } from '../../constants/config';
import { Printer, X, CheckCircle, ShieldCheck, Receipt, SealCheck, Truck } from '@phosphor-icons/react';

interface ReceiptModalProps {
  receipt: ReceiptData | null;
  onClose: () => void;
}

export type ReceiptFormat = 'commercial' | 'dispatch';

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, onClose }) => {
  const { settings, tanks, products } = useStore();
  const [receiptFormat, setReceiptFormat] = useState<ReceiptFormat>('commercial');

  if (!receipt) return null;

  // Multi-tank FIFO draw: list each source tank when a sale spanned 2+ tanks.
  const allocs = receipt.order?.tank_allocations;
  const multiSource =
    allocs && allocs.length > 1
      ? allocs.map(a => ({
          label: tanks.find(t => t.id === a.tank_id)?.truck_label || a.tank_id,
          litres: a.litres
        }))
      : null;
  const sourceLine = multiSource
    ? multiSource.map(s => `${s.label} × ${s.litres.toLocaleString()} L`).join(', ')
    : receipt.tankLabel;

  const handlePrint = () => {
    window.print();
  };

  const isOrder = receipt.type === 'order';
  const order = receipt.order;

  const receiptLines = receipt.lines && receipt.lines.length > 0 ? receipt.lines : order ? [order] : [];
  const containerLabelFor = (mode: string | undefined) =>
    mode === 'bought'
      ? 'Purchased Outright'
      : mode === 'taken'
      ? 'Company Container (Returnable Loan)'
      : 'Bulk / Customer Container';
  const productName = (id: string) => products.find(p => p.id === id)?.name || 'Oil';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      {/* Same shape as Modal.tsx: a height-capped flex column with a pinned
          header/footer and only the middle scrolling — a tall receipt used
          to push the header's close button and the footer's Print/Close
          buttons off-screen, both reachable only by scrolling past the
          whole ticket first. */}
      <div className="relative w-full max-w-sm max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Top Modal Header (Hidden on print) — pinned */}
        <div className="no-print flex-shrink-0 px-5 pt-4 pb-3 border-b border-slate-800 bg-slate-900/95 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-brand-400 font-sans font-semibold text-sm">
              <CheckCircle className="w-5 h-5 text-brand-500" weight="bold" />
              <span>{isOrder ? 'Order transaction recorded' : 'Payment credit recorded'}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 2 Format Options Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-sans font-medium text-slate-400 px-0.5">
              <span>Select Print & Display Format:</span>
              <span className="text-brand-400 font-semibold">2 Options Available</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setReceiptFormat('commercial')}
                className={`flex items-center justify-center gap-2 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                  receiptFormat === 'commercial'
                    ? 'bg-brand-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Receipt className="w-3.5 h-3.5 shrink-0" weight={receiptFormat === 'commercial' ? 'bold' : 'thin'} />
                <span className="truncate">Commercial (With Prices)</span>
              </button>

              <button
                type="button"
                onClick={() => setReceiptFormat('dispatch')}
                className={`flex items-center justify-center gap-2 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                  receiptFormat === 'dispatch'
                    ? 'bg-brand-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <SealCheck className="w-3.5 h-3.5 shrink-0" weight={receiptFormat === 'dispatch' ? 'bold' : 'thin'} />
                <span className="truncate">Waybill (No Prices)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Thermal Ticket / Print Area — the one section that scrolls */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-4">
          <div className="receipt-edge-top no-print" aria-hidden="true" />
          <div
            className="px-5 py-5 text-slate-900 font-sans"
            id="receipt-print-area"
            style={{ ['--receipt-bg' as string]: '#fbfbf8', backgroundColor: '#fbfbf8' }}
          >
            {/* Header */}
            <div className="text-center border-b-2 border-dashed border-slate-300 pb-3 mb-3">
              {settings.company_logo_url ? (
                <img src={settings.company_logo_url} alt="Company Logo" className="h-12 mx-auto mb-2 object-contain" />
              ) : (
                <svg
                  viewBox="0 0 48 48"
                  className="w-11 h-11 mx-auto mb-2"
                  aria-hidden="true"
                >
                  <circle cx="24" cy="24" r="24" fill="#00B749" />
                  <path
                    d="M24 9c6.5 8 11 14.4 11 19.6A11 11 0 0 1 13 28.6C13 23.4 17.5 17 24 9Z"
                    fill="#ffffff"
                    fillOpacity="0.95"
                  />
                  <path
                    d="M24 15.5c3.6 4.9 6 8.7 6 11.9a6 6 0 1 1-12 0c0-3.2 2.4-7 6-11.9Z"
                    fill="#00893a"
                    fillOpacity="0.5"
                  />
                </svg>
              )}
              <h1 className="text-[14px] font-heading font-extrabold tracking-normal text-slate-950 uppercase leading-snug">
                {settings.company_name}
              </h1>
              <p className="text-[10.5px] font-sans text-slate-600 mt-0.5 leading-tight">{settings.company_address}</p>
              <p className="text-[10.5px] font-mono tabular-nums text-slate-600 leading-tight">Tel: {settings.company_phone}</p>

              {/* Format Badge Header */}
              {receiptFormat === 'commercial' ? (
                <div className="mt-2.5 py-1 border-y border-dashed border-slate-300 tracking-wider text-[11px] font-mono font-bold text-slate-900 uppercase">
                  * * OFFICIAL SALES RECEIPT * *
                </div>
              ) : (
                <div className="mt-2.5 space-y-1">
                  <div className="py-1 border-y border-dashed border-slate-300 tracking-wide text-[11px] font-mono font-bold text-slate-950 uppercase">
                    * * DELIVERY WAYBILL & DISPATCH * *
                  </div>
                  <div className="text-[10px] font-sans font-bold text-emerald-800 uppercase tracking-wide bg-emerald-100/80 py-0.5 px-2 rounded inline-block">
                    CONTENTS MANIFEST · NO PRICE TAGS
                  </div>
                </div>
              )}
            </div>

            {/* Metadata Section */}
            <div className="text-[11px] border-b border-slate-200 pb-3 mb-3 space-y-1.5 font-mono">
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-500 font-sans text-[10.5px] uppercase tracking-wider shrink-0">
                  {receiptFormat === 'commercial' ? 'Receipt No:' : 'Waybill Ref:'}
                </span>
                <span className="font-bold text-slate-900 tabular-nums text-right">{receipt.receiptNumber}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-500 font-sans text-[10.5px] uppercase tracking-wider shrink-0">Date & Time:</span>
                <span className="font-bold text-slate-900 tabular-nums text-right">
                  {formatDepotDate(receipt.date)} {formatDepotTime(receipt.date)}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-500 font-sans text-[10.5px] uppercase tracking-wider shrink-0">Cashier:</span>
                <span className="font-bold text-slate-900 text-right">{receipt.cashierName || 'Depot Cashier'}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-500 font-sans text-[10.5px] uppercase tracking-wider shrink-0 pt-0.5">
                  {isOrder ? 'Customer:' : 'Consignee:'}
                </span>
                <span className="font-bold text-slate-950 text-right break-words leading-tight">
                  {receipt.customer.name}
                  <span className="text-[10px] text-slate-500 font-sans uppercase font-normal ml-1">({receipt.customer.type})</span>
                </span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-500 font-sans text-[10.5px] uppercase tracking-wider shrink-0">
                  {receiptFormat === 'commercial' ? 'Payment Method:' : 'Release Status:'}
                </span>
                <span className="font-bold uppercase text-slate-900 text-right text-[11px]">
                  {receiptFormat === 'commercial' ? receipt.paymentMethod : 'Verified & Released'}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-500 font-sans text-[10.5px] uppercase tracking-wider shrink-0">Transaction:</span>
                <span className="font-bold uppercase text-emerald-700 text-right text-[11px]">Complete</span>
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════
                OPTION 1: COMMERCIAL RECEIPT (WITH PRICES & TOTALS)
               ════════════════════════════════════════════════════════════════ */}
            {receiptFormat === 'commercial' ? (
              <>
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
                          <th className="text-right py-1">Rate</th>
                          <th className="text-right py-1">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {receiptLines.map((l, li) => (
                          <React.Fragment key={l.id}>
                            <tr>
                              <td className="py-2 text-left">
                                <div className="font-heading font-bold text-slate-900 text-[13px]">
                                  {productName(l.product_id)}
                                  {l.variety_name ? ` — ${l.variety_name}` : ''}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {l.litres.toLocaleString()} Litres ({l.qty} × {packShort(l.pack_size_id)})
                                </div>
                                <div className="text-[11px] text-slate-600 font-sans font-medium">
                                  Container: {containerLabelFor(l.container_mode)}
                                </div>
                                {l.price_adjusted && l.price_adjust_reason && (
                                  <div className="text-[10px] text-amber-800 font-sans">
                                    Price adjusted — {l.price_adjust_reason}
                                  </div>
                                )}
                                {li === 0 && sourceLine && (
                                  <div className="text-[11px] text-slate-500 font-sans">Source: {sourceLine}</div>
                                )}
                              </td>
                              <td className="py-2 text-right align-top">
                                ₦{l.unit_price.toLocaleString()}/{packShort(l.pack_size_id)}
                              </td>
                              <td className="py-2 text-right align-top font-bold text-slate-900">
                                {formatNaira(l.oil_amount)}
                              </td>
                            </tr>
                            {l.container_mode === 'bought' && l.container_amount ? (
                              <tr className="bg-amber-50/50">
                                <td className="py-2 text-left">
                                  <div className="font-heading font-bold text-amber-900 text-[12px]">
                                    Container bought outright
                                  </div>
                                  <div className="text-[10px] text-amber-700 font-sans">
                                    {packShort(l.pack_size_id)} × {l.qty} · no return obligation
                                  </div>
                                </td>
                                <td className="py-2 text-right align-top text-amber-900">
                                  {formatNaira(l.container_unit_price || 0)}/unit
                                </td>
                                <td className="py-2 text-right align-top font-bold text-amber-950">
                                  {formatNaira(l.container_amount || 0)}
                                </td>
                              </tr>
                            ) : null}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>

                    {(order.variety_name || order.pricing_tier) && (
                      <div className="mt-2 text-[11px] font-sans text-slate-600 flex flex-wrap gap-x-3 gap-y-0.5">
                        {order.variety_name && (
                          <span><span className="font-bold">Spec:</span> {order.variety_name}</span>
                        )}
                        {order.pricing_tier && (
                          <span><span className="font-bold">Price tier:</span> <span className="capitalize">{order.pricing_tier}</span></span>
                        )}
                      </div>
                    )}

                    {order.price_adjust_reason && (
                      <div className="mt-2 text-[11px] font-sans text-amber-900 bg-amber-50 p-2 rounded border border-amber-200">
                        <span className="font-bold">Price adjustment:</span> {order.price_adjust_reason}
                      </div>
                    )}

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
                  {isOrder && order && (() => {
                    const oilSubtotal = receiptLines.reduce((s, l) => s + l.oil_amount, 0);
                    const containerSubtotal = receiptLines.reduce((s, l) => s + (l.container_amount || 0), 0);
                    const grandTotal = receiptLines.reduce((s, l) => s + l.line_amount, 0);
                    const paidTotal = receiptLines.reduce((s, l) => s + (l.paid_amount || 0), 0);
                    return (
                    <>
                      {/* A real breakdown only when it adds information — an
                          outright-purchased container is a second, separate
                          charge worth itemizing; otherwise Subtotal would just
                          repeat Grand Total and add noise. */}
                      {containerSubtotal > 0 && (
                        <>
                          <div className="flex justify-between text-slate-600 text-[12px]">
                            <span className="font-sans">Oil Subtotal:</span>
                            <span>{formatNaira(oilSubtotal)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600 text-[12px]">
                            <span className="font-sans">Containers Bought:</span>
                            <span>{formatNaira(containerSubtotal)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between font-bold text-[15px] text-slate-950 pt-1">
                        <span className="font-sans">Grand Total:</span>
                        <span>{formatNaira(grandTotal)}</span>
                      </div>
                      <div className="text-[10px] font-sans text-slate-500 text-right -mt-0.5">
                        {formatNairaWords(grandTotal)}
                      </div>
                      <div className="flex justify-between text-slate-600 text-[12px]">
                        <span className="font-sans">Paid Amount:</span>
                        <span className="font-bold">{formatNaira(paidTotal)}</span>
                      </div>
                      {receipt.amountTendered != null && (
                        <>
                          <div className="flex justify-between text-slate-600 text-[12px]">
                            <span className="font-sans">Cash Tendered:</span>
                            <span className="font-bold">{formatNaira(receipt.amountTendered)}</span>
                          </div>
                          <div className="flex justify-between text-slate-900 text-[12px] font-bold">
                            <span className="font-sans">Change Due:</span>
                            <span>{formatNaira(receipt.changeDue || 0)}</span>
                          </div>
                        </>
                      )}
                    </>
                    );
                  })()}

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
                <div className="text-center text-[11px] font-sans text-slate-500 pt-1 space-y-1 border-t-2 border-dashed border-slate-300 mt-1">
                  <div className="flex items-center justify-center gap-1 text-emerald-700 font-semibold pt-2">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verified authentic depot receipt</span>
                  </div>
                  <p>Thank you for your business!</p>
                  <p className="text-[11px] tabular-nums text-slate-400">
                    Cashier: {receipt.cashierName || 'Depot Cashier'} · Printed {new Date().toLocaleDateString('en-GB')}
                  </p>
                  <div className="receipt-barcode mt-2 mx-auto w-3/4" aria-hidden="true" />
                  <p className="text-[10px] tracking-[0.2em] text-slate-600 font-bold">{receipt.receiptNumber}</p>
                </div>
              </>
            ) : (
              /* ════════════════════════════════════════════════════════════════
                  OPTION 2: WAYBILL / CONTENTS ONLY (NO PRICES, NO RATES)
                 ════════════════════════════════════════════════════════════════ */
              <>
                {isOrder && order ? (
                  <div className="border-b-2 border-dashed border-slate-300 pb-3 mb-3">
                    <div className="flex items-center justify-between text-[12px] font-heading font-bold text-slate-800 uppercase tracking-wider mb-2">
                      <span>Dispatched Contents Manifest</span>
                      <span className="text-[10px] font-sans font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        Goods Release
                      </span>
                    </div>

                    {/* Contents Table (No Prices / Rates) */}
                    <table className="w-full text-[12px] font-mono tabular-nums mb-3">
                      <thead>
                        <tr className="text-slate-500 text-[11px] font-sans uppercase border-b border-slate-200 pb-1 text-left">
                          <th className="py-1">Commodity & Spec</th>
                          <th className="text-center py-1">Units</th>
                          <th className="text-right py-1">Volume</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {receiptLines.map((l, li) => (
                          <React.Fragment key={l.id}>
                            <tr>
                              <td className="py-2 text-left">
                                <div className="font-heading font-bold text-slate-950 text-[13px]">
                                  {productName(l.product_id)}
                                </div>
                                {l.variety_name && (
                                  <div className="text-[11px] font-sans font-semibold text-slate-700">Spec: {l.variety_name}</div>
                                )}
                                <div className="text-[11px] text-slate-600 font-sans mt-0.5">
                                  Packaging: <span className="font-semibold text-slate-800">{containerLabelFor(l.container_mode)}</span>
                                </div>
                                {li === 0 && sourceLine && (
                                  <div className="text-[11px] text-slate-500 font-sans">Dispensed from: {sourceLine}</div>
                                )}
                              </td>
                              <td className="py-2 text-center align-top font-bold text-slate-900">
                                {l.qty} × {packShort(l.pack_size_id)}
                              </td>
                              <td className="py-2 text-right align-top font-bold text-slate-950">
                                {l.litres.toLocaleString()} Litres
                              </td>
                            </tr>
                            {l.container_mode === 'bought' && (
                              <tr className="bg-amber-50/50">
                                <td className="py-2 text-left">
                                  <div className="font-heading font-bold text-amber-950 text-[12px]">Empty containers released</div>
                                  <div className="text-[10px] text-amber-800 font-sans">
                                    {packShort(l.pack_size_id)} · customer owns outright (no return)
                                  </div>
                                </td>
                                <td className="py-2 text-center align-top font-bold text-amber-950">{l.qty}</td>
                                <td className="py-2 text-right align-top font-sans text-[11px] text-amber-900 font-medium">
                                  {l.qty} Units
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>

                    {/* Cargo Handover Summary Box */}
                    <div className="bg-slate-100/90 border border-slate-200 rounded-lg p-2.5 space-y-1 text-[12px] font-sans">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Cargo Handover Summary
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-slate-600">Total Quantity:</span>
                        <span className="font-mono font-bold text-slate-950">
                          {receiptLines.reduce((s, l) => s + l.qty, 0)}
                        </span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-slate-600">Total Net Volume:</span>
                        <span className="font-mono font-bold text-slate-950">
                          {receiptLines.reduce((s, l) => s + l.litres, 0).toLocaleString()} Litres
                        </span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-slate-600">Container Custody:</span>
                        <span className="font-semibold text-slate-900">
                          {receiptLines.some(l => l.container_mode === 'taken')
                            ? 'Includes returnable company containers'
                            : 'No returnable containers'}
                        </span>
                      </div>
                      <div className="flex justify-between font-medium pt-1 border-t border-slate-200">
                        <span className="text-slate-600">Dispense Inspection:</span>
                        <span className="text-emerald-700 font-bold">✓ Quality & Volume Audited</span>
                      </div>
                    </div>

                    {order.note && (
                      <div className="mt-2 text-[11px] font-sans text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                        <span className="font-bold">Delivery / Yard Note:</span> {order.note}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Payment Receipt — Non-Priced Voucher Slip */
                  <div className="border-b-2 border-dashed border-slate-300 pb-3 mb-3">
                    <div className="text-[12px] font-heading font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      Credit Payment Voucher Slip
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center my-2">
                      <span className="text-[12px] font-sans text-emerald-800 block uppercase font-bold">
                        Payment Recorded & Ledger Credited
                      </span>
                      <p className="text-[11px] font-sans text-emerald-700 mt-1">
                        Depot credit account payment confirmed for consignee <span className="font-bold">{receipt.customer.name}</span>.
                      </p>
                    </div>
                  </div>
                )}


                {/* Footer Sign-off (Non-Priced) */}
                <div className="text-center text-[11px] font-sans text-slate-500 pt-1 space-y-1 border-t-2 border-dashed border-slate-300 mt-1">
                  <div className="flex items-center justify-center gap-1 text-emerald-700 font-semibold pt-1">
                    <Truck className="w-4 h-4" />
                    <span>Official depot transit & gate waybill</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Non-priced copy · Issued for driver haulage, loading check & gate pass
                  </p>
                  <p className="text-[11px] tabular-nums text-slate-400">
                    Printed {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <div className="receipt-barcode mt-2 mx-auto w-3/4" aria-hidden="true" />
                  <p className="text-[10px] tracking-[0.2em] text-slate-600 font-bold">{receipt.receiptNumber}</p>
                </div>
              </>
            )}
          </div>
          <div className="receipt-edge-bottom no-print" aria-hidden="true" />
        </div>

        {/* Modal Action Buttons (Screen only) — pinned */}
        <div className="no-print flex-shrink-0 p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="text-xs font-sans text-slate-400 hidden sm:block">
            Format:{' '}
            <span className="font-semibold text-brand-400">
              {receiptFormat === 'commercial' ? 'Full Commercial Receipt' : 'Waybill (No Prices)'}
            </span>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
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
              <Printer className="w-[18px] h-[18px]" weight="bold" />
              <span>
                {receiptFormat === 'commercial' ? 'Print Commercial Receipt' : 'Print Waybill (No Prices)'}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};


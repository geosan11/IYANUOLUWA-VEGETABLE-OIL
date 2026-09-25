import React, { useState } from 'react';
import { ReceiptData } from '../../types';
import { useStore } from '../../services/store';
import { formatNaira, formatDepotDate, formatDepotTime } from '../../services/businessLogic';
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
  const productName = (id: string) => products.find(p => p.id === id)?.name || 'Product (removed)';

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
            className="px-4 py-4 text-black font-sans"
            id="receipt-print-area"
            style={{ ['--receipt-bg' as string]: '#fbfbf8', backgroundColor: '#fbfbf8' }}
          >
            {/* Header */}
            <div className="text-center border-b-2 border-dashed border-black pb-2 mb-2">
              {settings.company_logo_url ? (
                <img src={settings.company_logo_url} alt="Company Logo" className="h-10 mx-auto mb-1.5 object-contain grayscale" />
              ) : (
                <svg
                  viewBox="0 0 48 48"
                  className="w-9 h-9 mx-auto mb-1.5"
                  aria-hidden="true"
                >
                  <circle cx="24" cy="24" r="24" fill="#000000" />
                  <path
                    d="M24 9c6.5 8 11 14.4 11 19.6A11 11 0 0 1 13 28.6C13 23.4 17.5 17 24 9Z"
                    fill="#ffffff"
                    fillOpacity="0.95"
                  />
                </svg>
              )}
              <h1 className="text-[14px] font-heading font-extrabold tracking-normal text-black uppercase leading-snug">
                {settings.company_name}
              </h1>
              <p className="text-[10.5px] font-sans text-black mt-0.5 leading-tight">{settings.company_address}</p>
              <p className="text-[10.5px] font-mono tabular-nums text-black leading-tight">Tel: {settings.company_phone}</p>

              {/* Format Badge Header */}
              {receiptFormat === 'commercial' ? (
                <div className="mt-2 py-1 border-y border-dashed border-black tracking-wider text-[11px] font-mono font-bold text-black uppercase">
                  * * OFFICIAL SALES RECEIPT * *
                </div>
              ) : (
                <div className="mt-2 py-1 border-y border-dashed border-black tracking-wide text-[11px] font-mono font-bold text-black uppercase">
                  * * DELIVERY WAYBILL & DISPATCH * * (NO PRICE TAGS)
                </div>
              )}
            </div>

            {/* Metadata Section */}
            <div className="text-[10.5px] border-b border-black pb-2 mb-2 space-y-0.5">
              <div className="flex justify-between items-center gap-1.5">
                <span className="text-black font-sans uppercase tracking-wider shrink-0">
                  {receiptFormat === 'commercial' ? 'Receipt No:' : 'Waybill Ref:'}
                </span>
                <span className="font-bold font-mono text-black tabular-nums text-right text-[10px] break-all">{receipt.receiptNumber}</span>
              </div>
              <div className="flex justify-between items-center gap-1.5">
                <span className="text-black font-sans uppercase tracking-wider shrink-0">Date & Time:</span>
                <span className="font-bold font-mono text-black tabular-nums text-right">
                  {formatDepotDate(receipt.date)} {formatDepotTime(receipt.date)}
                </span>
              </div>
              <div className="flex justify-between items-center gap-1.5">
                <span className="text-black font-sans uppercase tracking-wider shrink-0">Cashier:</span>
                <span className="font-bold font-sans text-black text-right truncate max-w-[160px]">{receipt.cashierName || 'Depot Cashier'}</span>
              </div>
              <div className="flex justify-between items-start gap-1.5">
                <span className="text-black font-sans uppercase tracking-wider shrink-0 pt-0.5">
                  {isOrder ? 'Customer:' : 'Consignee:'}
                </span>
                <span className="font-bold font-sans text-black text-right break-words leading-tight">
                  {receipt.customer.name}
                  <span className="text-[9.5px] text-black uppercase font-normal ml-1">({receipt.customer.type})</span>
                </span>
              </div>
              {receiptFormat === 'commercial' ? (
                receipt.paymentMethod === 'split' && receipt.paymentSplits && receipt.paymentSplits.length > 0 ? (
                  <div className="space-y-0.5">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-black font-sans text-[10.5px] uppercase tracking-wider shrink-0">Payment Method:</span>
                      <span className="font-bold uppercase text-black text-right text-[11px]">
                        {receipt.paymentSplits.map(s => s.method.toUpperCase()).join(' + ')}
                      </span>
                    </div>
                    {receipt.paymentSplits.map((sp, i) => (
                      <div key={i} className="flex justify-between items-start gap-2 pl-2 border-l-2 border-black">
                        <span className="text-black font-sans text-[10px] uppercase tracking-wider shrink-0 pt-0.5">
                          {sp.method === 'cash' ? 'Cash' : sp.method === 'transfer' ? 'Transfer' : sp.method === 'pos' ? 'Card/POS' : sp.method.toUpperCase()}:
                        </span>
                        <span className="font-bold text-black text-right text-[11px] tabular-nums">
                          {formatNaira(sp.amount)}
                          {sp.reference && (
                            <span className="block text-[9px] font-normal text-black normal-case">Ref: {sp.reference}</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-black font-sans text-[10.5px] uppercase tracking-wider shrink-0">Payment Method:</span>
                    <span className="font-bold uppercase text-black text-right text-[11px]">{receipt.paymentMethod}</span>
                  </div>
                )
              ) : (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-black font-sans text-[10.5px] uppercase tracking-wider shrink-0">Release Status:</span>
                  <span className="font-bold uppercase text-black text-right text-[11px]">Verified &amp; Released</span>
                </div>
              )}
            </div>

            {/* ════════════════════════════════════════════════════════════════
                OPTION 1: COMMERCIAL RECEIPT (WITH PRICES & TOTALS)
               ════════════════════════════════════════════════════════════════ */}
            {receiptFormat === 'commercial' ? (
              <>
                {/* Line Items / Details */}
                {isOrder && order ? (
                  <div className="border-b-2 border-dashed border-black pb-2 mb-2">
                    <div className="text-[12px] font-heading font-semibold text-black uppercase tracking-wider mb-1.5">
                      Order Dispense Details
                    </div>
                    <table className="w-full text-[11px] font-mono tabular-nums border-collapse">
                      <thead>
                        <tr className="text-black text-[10px] font-sans uppercase border-b border-black pb-1">
                          <th className="text-left py-1 pr-1 font-semibold">Item</th>
                          <th className="text-right py-1 px-1 font-semibold whitespace-nowrap">Rate</th>
                          <th className="text-right py-1 pl-1 font-semibold whitespace-nowrap">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/10">
                        {receiptLines.map((l, li) => (
                          <React.Fragment key={l.id}>
                            <tr>
                              <td className="py-1 pr-1 text-left align-top">
                                <div className="font-heading font-bold text-black text-[11.5px] leading-tight break-words">
                                  {productName(l.product_id)}
                                  {l.variety_name ? ` — ${l.variety_name}` : ''}
                                </div>
                                <div className="text-[10px] text-black font-sans">
                                  {l.litres.toLocaleString()}L ({l.qty} × {packShort(l.pack_size_id)})
                                </div>
                                {l.container_mode !== 'none' && (
                                  <div className="text-[9.5px] text-black font-sans leading-tight">
                                    Container: {containerLabelFor(l.container_mode)}
                                  </div>
                                )}
                                {l.price_adjusted && l.price_adjust_reason && (
                                  <div className="text-[9.5px] text-black font-sans">
                                    Price adjusted — {l.price_adjust_reason}
                                  </div>
                                )}
                                {li === 0 && sourceLine && (
                                  <div className="text-[10px] text-black font-sans">Source: {sourceLine}</div>
                                )}
                              </td>
                              <td className="py-1 px-1 text-right align-top text-[10.5px] whitespace-nowrap">
                                <div>₦{l.unit_price.toLocaleString()}</div>
                                <div className="text-[9px] text-black font-sans">/{packShort(l.pack_size_id)}</div>
                              </td>
                              <td className="py-1 pl-1 text-right align-top font-bold text-black text-[11.5px] whitespace-nowrap">
                                {formatNaira(l.oil_amount)}
                              </td>
                            </tr>
                            {l.container_mode === 'bought' && l.container_amount ? (
                              <tr>
                                <td className="py-1 pr-1 text-left align-top">
                                  <div className="font-heading font-bold text-black text-[11px] leading-tight">
                                    Container bought outright
                                  </div>
                                  <div className="text-[9.5px] text-black font-sans">
                                    {packShort(l.pack_size_id)} × {l.qty} · no return obligation
                                  </div>
                                </td>
                                <td className="py-1 px-1 text-right align-top text-black text-[10.5px] whitespace-nowrap">
                                  <div>{formatNaira(l.container_unit_price || 0)}</div>
                                  <div className="text-[9px] text-black font-sans">/unit</div>
                                </td>
                                <td className="py-1 pl-1 text-right align-top font-bold text-black text-[11.5px] whitespace-nowrap">
                                  {formatNaira(l.container_amount || 0)}
                                </td>
                              </tr>
                            ) : null}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>

                    {order.note && (
                      <div className="mt-1.5 text-[12px] font-sans text-black border border-black p-1.5 rounded">
                        <span className="font-bold">Note:</span> {order.note}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Payment Receipt Details */
                  <div className="border-b-2 border-dashed border-black pb-2 mb-2">
                    <div className="text-[12px] font-heading font-semibold text-black uppercase tracking-wider mb-1.5">
                      Credit Payment Received
                    </div>
                    <div className="border border-black rounded-lg p-2 text-center my-1.5">
                      <span className="text-[12px] font-sans text-black block uppercase font-medium">
                        Amount Received & Credited
                      </span>
                      <span className="text-[26px] font-mono tabular-nums font-extrabold text-black">
                        {formatNaira(receipt.paymentAmount || 0)}
                      </span>
                    </div>

                    {receipt.unappliedLeftover && receipt.unappliedLeftover > 0 ? (
                      <div className="text-[12px] font-mono tabular-nums text-black border border-black p-1.5 rounded mt-1.5">
                        <span className="font-bold font-sans">Note:</span> {formatNaira(receipt.unappliedLeftover)} added to this customer's store credit (all open invoices are fully settled).
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Balances & Totals */}
                <div className="space-y-0.5 text-[13px] font-mono tabular-nums border-b border-black pb-2 mb-2">
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
                          <div className="flex justify-between text-black text-[12px]">
                            <span className="font-sans">Oil Subtotal:</span>
                            <span>{formatNaira(oilSubtotal)}</span>
                          </div>
                          <div className="flex justify-between text-black text-[12px]">
                            <span className="font-sans">Containers Bought:</span>
                            <span>{formatNaira(containerSubtotal)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between items-baseline font-bold text-[14px] text-black pt-1">
                        <span className="font-sans">Grand Total:</span>
                        <span className="font-mono tabular-nums">{formatNaira(grandTotal)}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-black text-[11.5px]">
                        <span className="font-sans">Paid Amount:</span>
                        <span className="font-bold font-mono tabular-nums">{formatNaira(paidTotal)}</span>
                      </div>
                      {receipt.paymentMethod === 'split' && receipt.paymentSplits && receipt.paymentSplits.length > 0 && (
                        <div className="pl-2 border-l-2 border-black space-y-0.5 mt-0.5">
                          {receipt.paymentSplits.map((sp, i) => (
                            <div key={i} className="flex justify-between text-black text-[10.5px]">
                              <span className="font-sans">
                                {sp.method === 'cash' ? 'Cash' : sp.method === 'transfer' ? 'Transfer' : sp.method === 'pos' ? 'Card/POS' : sp.method.toUpperCase()}
                                {sp.reference ? ` (${sp.reference})` : ''}:
                              </span>
                              <span className="font-mono tabular-nums font-semibold">{formatNaira(sp.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {receipt.amountTendered != null && (
                        <>
                          <div className="flex justify-between items-baseline text-black text-[11.5px]">
                            <span className="font-sans">Cash Tendered:</span>
                            <span className="font-bold font-mono tabular-nums">{formatNaira(receipt.amountTendered)}</span>
                          </div>
                          <div className="flex justify-between items-baseline text-black text-[11.5px] font-bold">
                            <span className="font-sans">Change Due:</span>
                            <span className="font-mono tabular-nums">{formatNaira(receipt.changeDue || 0)}</span>
                          </div>
                        </>
                      )}
                    </>
                    );
                  })()}

                  <div className="flex justify-between items-baseline text-black pt-1 border-t border-black/20 text-[11px]">
                    <span className="font-sans">Previous Balance:</span>
                    <span className="font-mono tabular-nums">{formatNaira(receipt.previousBalance)}</span>
                  </div>
                  <div className="flex justify-between items-baseline font-bold text-black text-[12.5px]">
                    <span className="font-sans">Outstanding Balance:</span>
                    <span className="font-mono tabular-nums font-extrabold">
                      {formatNaira(receipt.newBalance)}
                    </span>
                  </div>
                </div>

                {/* Footer Sign-off */}
                <div className="text-center text-[11px] font-sans text-black pt-1 space-y-0.5 border-t-2 border-dashed border-black mt-1">
                  <div className="flex items-center justify-center gap-1 text-black font-semibold pt-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verified authentic depot receipt</span>
                  </div>
                  <p>Thank you for your business!</p>
                  <p className="text-[10px] tracking-[0.2em] text-black font-bold pt-0.5">{receipt.receiptNumber}</p>
                </div>
              </>
            ) : (
              /* ════════════════════════════════════════════════════════════════
                  OPTION 2: WAYBILL / CONTENTS ONLY (NO PRICES, NO RATES)
                 ════════════════════════════════════════════════════════════════ */
              <>
                {isOrder && order ? (
                  <div className="border-b-2 border-dashed border-black pb-2 mb-2">
                    <div className="flex items-center justify-between text-[12px] font-heading font-bold text-black uppercase tracking-wider mb-1.5">
                      <span>Dispatched Contents Manifest</span>
                      <span className="text-[10px] font-sans font-medium text-black border border-black px-1.5 py-0.5 rounded">
                        Goods Release
                      </span>
                    </div>

                    {/* Contents Table (No Prices / Rates) */}
                    <table className="w-full text-[12px] font-mono tabular-nums mb-2">
                      <thead>
                        <tr className="text-black text-[11px] font-sans uppercase border-b border-black pb-1 text-left">
                          <th className="py-1">Commodity & Spec</th>
                          <th className="text-center py-1">Units</th>
                          <th className="text-right py-1">Volume</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/10">
                        {receiptLines.map((l, li) => (
                          <React.Fragment key={l.id}>
                            <tr>
                              <td className="py-1.5 text-left">
                                <div className="font-heading font-bold text-black text-[13px]">
                                  {productName(l.product_id)}
                                </div>
                                {l.variety_name && (
                                  <div className="text-[11px] font-sans font-semibold text-black">Spec: {l.variety_name}</div>
                                )}
                                {l.container_mode !== 'none' && (
                                  <div className="text-[11px] text-black font-sans mt-0.5">
                                    Packaging: <span className="font-semibold text-black">{containerLabelFor(l.container_mode)}</span>
                                  </div>
                                )}
                                {li === 0 && sourceLine && (
                                  <div className="text-[11px] text-black font-sans">Dispensed from: {sourceLine}</div>
                                )}
                              </td>
                              <td className="py-1.5 text-center align-top font-bold text-black">
                                {l.qty} × {packShort(l.pack_size_id)}
                              </td>
                              <td className="py-1.5 text-right align-top font-bold text-black">
                                {l.litres.toLocaleString()} Litres
                              </td>
                            </tr>
                            {l.container_mode === 'bought' && (
                              <tr>
                                <td className="py-1.5 text-left">
                                  <div className="font-heading font-bold text-black text-[12px]">Empty containers released</div>
                                  <div className="text-[10px] text-black font-sans">
                                    {packShort(l.pack_size_id)} · customer owns outright (no return)
                                  </div>
                                </td>
                                <td className="py-1.5 text-center align-top font-bold text-black">{l.qty}</td>
                                <td className="py-1.5 text-right align-top font-sans text-[11px] text-black font-medium">
                                  {l.qty} Units
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>

                    {/* Cargo Handover Summary — condensed to 2 lines */}
                    <div className="border border-black rounded-lg p-2 space-y-1 text-[11.5px] font-sans">
                      <div className="flex justify-between font-medium">
                        <span className="text-black">Qty / Volume:</span>
                        <span className="font-mono font-bold text-black">
                          {receiptLines.reduce((s, l) => s + l.qty, 0)} units · {receiptLines.reduce((s, l) => s + l.litres, 0).toLocaleString()} L
                        </span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-black">Custody / Check:</span>
                        <span className="font-semibold text-black text-right">
                          {receiptLines.some(l => l.container_mode === 'taken') ? 'Returnable containers · ' : ''}Audited ✓
                        </span>
                      </div>
                    </div>

                    {order.note && (
                      <div className="mt-1.5 text-[11px] font-sans text-black border border-black p-1.5 rounded">
                        <span className="font-bold">Delivery / Yard Note:</span> {order.note}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Payment Receipt — Non-Priced Voucher Slip */
                  <div className="border-b-2 border-dashed border-black pb-2 mb-2">
                    <div className="text-[12px] font-heading font-semibold text-black uppercase tracking-wider mb-1.5">
                      Credit Payment Voucher Slip
                    </div>
                    <div className="border border-black rounded-lg p-2 text-center my-1.5">
                      <span className="text-[12px] font-sans text-black block uppercase font-bold">
                        Payment Recorded & Ledger Credited
                      </span>
                      <p className="text-[11px] font-sans text-black mt-1">
                        Depot credit account payment confirmed for consignee <span className="font-bold">{receipt.customer.name}</span>.
                      </p>
                    </div>
                  </div>
                )}

                {/* Footer Sign-off (Non-Priced) */}
                <div className="text-center text-[11px] font-sans text-black pt-1 space-y-0.5 border-t-2 border-dashed border-black mt-1">
                  <div className="flex items-center justify-center gap-1 text-black font-semibold pt-1">
                    <Truck className="w-4 h-4" />
                    <span>Official depot transit & gate waybill</span>
                  </div>
                  <p className="text-[10px] text-black">
                    Non-priced copy · Issued for driver haulage, loading check & gate pass
                  </p>
                  <p className="text-[10px] tracking-[0.2em] text-black font-bold pt-0.5">{receipt.receiptNumber}</p>
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


import React, { useMemo, useState } from 'react';
import { useStore } from '../services/store';
import { usePermissions } from '../services/permissions';
import { lookupPackPrice } from '../services/pricing';
import { PACK_SIZES, packLitres } from '../constants/config';
import { CustomerType, PackPrice, ProductPackConfig } from '../types';
import { Stack as Boxes, Tag as Tags, Package, Warehouse, Lock, FloppyDisk as Save, Check } from '@phosphor-icons/react';

const TIERS: CustomerType[] = ['retail', 'agent', 'corporate'];
type Tab = 'prices' | 'packs' | 'stock';

export const InventoryScreen: React.FC = () => {
  const { products, packPrices, stockView, bulkSetPackPrices, updateProductPackConfig } = useStore();
  const { isOwner } = usePermissions();

  const [tab, setTab] = useState<Tab>('prices');
  const [activeProductId, setActiveProductId] = useState<string>(products[0]?.id || '');
  const activeProduct = products.find(p => p.id === activeProductId) || products[0] || null;
  const [activeVarietyId, setActiveVarietyId] = useState<string>(activeProduct?.varieties[0]?.id || '');

  // Local edit buffers, keyed so they reset when the product/variety changes.
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [packDraft, setPackDraft] = useState<ProductPackConfig[] | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const flashSaved = (msg: string) => {
    setSavedFlash(msg);
    window.setTimeout(() => setSavedFlash(null), 2500);
  };

  // Reset buffers when the selected product changes.
  const onSelectProduct = (id: string) => {
    setActiveProductId(id);
    const p = products.find(pr => pr.id === id);
    setActiveVarietyId(p?.varieties[0]?.id || '');
    setPriceEdits({});
    setPackDraft(null);
  };

  if (!isOwner) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-3">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
          <Lock className="w-6 h-6 text-slate-400" />
        </div>
        <h1 className="text-lg font-heading font-bold text-slate-900 dark:text-white">Owner only</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Inventory pricing and pack configuration can only be changed by the depot owner.
        </p>
      </div>
    );
  }

  if (!activeProduct) {
    return (
      <div className="max-w-md mx-auto py-16 text-center text-sm text-slate-500">
        Add a product in Settings first.
      </div>
    );
  }

  const enabledSizeIds = new Set(activeProduct.pack_config.map(c => c.pack_size_id));

  return (
    <div className="space-y-5 pb-20">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 flex items-center justify-center">
          <Boxes className="w-5 h-5 text-brand-600 dark:text-brand-400" />
        </div>
        <div>
          <h1 className="text-lg font-heading font-bold text-slate-900 dark:text-white leading-tight">Inventory & pricing</h1>
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            Pack-size price matrix, container rules and read-only stock.
          </p>
        </div>
      </div>

      {savedFlash && (
        <div className="flex items-center gap-2 text-[13px] font-sans font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2">
          <Check className="w-4 h-4" /> {savedFlash}
        </div>
      )}

      {/* Product selector */}
      <div className="flex flex-wrap gap-2">
        {products.map(p => (
          <button
            key={p.id}
            onClick={() => onSelectProduct(p.id)}
            className={`px-3.5 py-2 rounded-xl text-[13px] font-sans font-semibold border transition-colors ${
              p.id === activeProduct.id
                ? 'bg-brand-500 text-slate-950 border-brand-500'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-fit">
        {([
          ['prices', 'Price matrix', Tags],
          ['packs', 'Pack sizes & containers', Package],
          ['stock', 'Stock', Warehouse]
        ] as [Tab, string, typeof Tags][]).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-sans font-semibold transition-colors ${
              tab === id
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Icon className="w-3.5 h-3.5" weight={tab === id ? 'bold' : 'thin'} /> {label}
          </button>
        ))}
      </div>

      {tab === 'prices' && (
        <PriceMatrix
          product={activeProduct}
          activeVarietyId={activeVarietyId || activeProduct.varieties[0]?.id || ''}
          onSelectVariety={setActiveVarietyId}
          enabledSizeIds={enabledSizeIds}
          packPrices={packPrices}
          edits={priceEdits}
          setEdits={setPriceEdits}
          onSave={rows => {
            bulkSetPackPrices(rows);
            setPriceEdits({});
            flashSaved('Prices saved.');
          }}
        />
      )}

      {tab === 'packs' && (
        <PackConfigEditor
          currentConfig={activeProduct.pack_config}
          fallbackContainerPrice={activeProduct.keg_sell_price ?? 0}
          draft={packDraft}
          setDraft={setPackDraft}
          onSave={config => {
            updateProductPackConfig(activeProduct.id, config);
            setPackDraft(null);
            flashSaved('Pack configuration saved.');
          }}
        />
      )}

      {tab === 'stock' && <StockView productId={activeProduct.id} stockView={stockView} />}
    </div>
  );
};

/* ------------------------------------------------------------------ */

const PriceMatrix: React.FC<{
  product: ReturnType<typeof useStore>['products'][number];
  activeVarietyId: string;
  onSelectVariety: (id: string) => void;
  enabledSizeIds: Set<string>;
  packPrices: PackPrice[];
  edits: Record<string, string>;
  setEdits: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSave: (rows: PackPrice[]) => void;
}> = ({ product, activeVarietyId, onSelectVariety, enabledSizeIds, packPrices, edits, setEdits, onSave }) => {
  const sizes = PACK_SIZES.filter(s => enabledSizeIds.has(s.id));
  const key = (varietyId: string, sizeId: string, tier: CustomerType) =>
    `${product.id}|${varietyId}|${sizeId}|${tier}`;

  const cellValue = (sizeId: string, tier: CustomerType) => {
    const k = key(activeVarietyId, sizeId, tier);
    if (k in edits) return edits[k];
    const p = lookupPackPrice(packPrices, product.id, activeVarietyId, sizeId, tier);
    return p === null ? '' : String(p);
  };

  const dirty = Object.keys(edits).length > 0;

  const handleSave = () => {
    const rows: PackPrice[] = [];
    for (const variety of product.varieties) {
      for (const size of sizes) {
        for (const tier of TIERS) {
          const k = key(variety.id, size.id, tier);
          const raw = k in edits ? edits[k] : lookupPackPrice(packPrices, product.id, variety.id, size.id, tier);
          const num = raw === '' || raw === null || raw === undefined ? NaN : Number(raw);
          if (Number.isFinite(num) && num > 0) {
            rows.push({ product_id: product.id, variety_id: variety.id, pack_size_id: size.id, tier, price: num });
          }
        }
      }
    }
    onSave(rows);
  };

  if (sizes.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[13px] text-amber-800 dark:text-amber-300">
        This product sells no pack sizes yet. Enable some in <b>Pack sizes &amp; containers</b> first.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Variety pills */}
      <div className="flex flex-wrap gap-1.5">
        {product.varieties.map(v => (
          <button
            key={v.id}
            onClick={() => onSelectVariety(v.id)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-sans font-semibold border transition-colors ${
              v.id === activeVarietyId
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
            }`}
          >
            {v.name}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-100 dark:bg-slate-950 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans">
            <tr>
              <th className="text-left px-3 py-2.5">Pack size</th>
              {TIERS.map(t => (
                <th key={t} className="text-right px-3 py-2.5 capitalize">{t}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {sizes.map(size => (
              <tr key={size.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/40">
                <td className="px-3 py-2.5 font-sans font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                  {size.label}
                </td>
                {TIERS.map(tier => {
                  const val = cellValue(size.id, tier);
                  const perLitre = val ? Math.round(Number(val) / (packLitres(size.id) || 1)) : 0;
                  return (
                    <td key={tier} className="px-3 py-2 text-right">
                      <div className="relative w-32 ml-auto">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[13px] font-bold">₦</span>
                        <input
                          type="number"
                          step="50"
                          min="0"
                          value={val}
                          onChange={e =>
                            setEdits(prev => ({ ...prev, [key(activeVarietyId, size.id, tier)]: e.target.value }))
                          }
                          placeholder="set price"
                          className={`w-full pl-6 pr-2 py-2 rounded-lg bg-white dark:bg-slate-900 border text-right font-mono tabular-nums font-bold text-[13px] focus:outline-none focus:border-brand-500 ${
                            val ? 'border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white' : 'border-amber-300 dark:border-amber-700'
                          }`}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 pr-1">
                        {perLitre ? `≈ ₦${perLitre.toLocaleString()}/L` : '—'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500">
          Prices are per pack, per customer tier. Empty cells are treated as “not priced” and block the sale.
        </p>
        <button
          onClick={handleSave}
          disabled={!dirty}
          className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-sans font-bold text-[13px] flex items-center gap-2 shadow-sm"
        >
          <Save className="w-4 h-4" weight="bold" /> Save prices
        </button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */

const PackConfigEditor: React.FC<{
  currentConfig: ProductPackConfig[];
  fallbackContainerPrice: number;
  draft: ProductPackConfig[] | null;
  setDraft: React.Dispatch<React.SetStateAction<ProductPackConfig[] | null>>;
  onSave: (config: ProductPackConfig[]) => void;
}> = ({ currentConfig, fallbackContainerPrice, draft, setDraft, onSave }) => {
  // Expand to all 9 sizes so every size has a row to toggle.
  const rows = useMemo(() => {
    const byId = new Map((draft ?? currentConfig).map(c => [c.pack_size_id, c]));
    return PACK_SIZES.map(size => {
      const cfg = byId.get(size.id);
      return {
        size,
        enabled: !!cfg,
        returnable: cfg?.returnable ?? false,
        container_buy_price: cfg?.container_buy_price ?? 0
      };
    });
  }, [draft, currentConfig]);

  const mutate = (sizeId: string, patch: Partial<{ enabled: boolean; returnable: boolean; container_buy_price: number }>) => {
    const next: ProductPackConfig[] = rows
      .map(r => {
        const merged = { ...r, ...(r.size.id === sizeId ? patch : {}) };
        return merged;
      })
      .filter(r => r.enabled)
      .map((r, i) => ({
        pack_size_id: r.size.id,
        returnable: r.returnable,
        container_buy_price: Number(r.container_buy_price) || 0,
        sort: i
      }));
    setDraft(next);
  };

  const dirty = draft !== null;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-100 dark:bg-slate-950 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans">
            <tr>
              <th className="text-left px-3 py-2.5">Sells this size</th>
              <th className="text-left px-3 py-2.5">Returnable container</th>
              <th className="text-right px-3 py-2.5">Container buy price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map(r => (
              <tr key={r.size.id} className={r.enabled ? '' : 'opacity-55'}>
                <td className="px-3 py-2.5">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={e => mutate(r.size.id, { enabled: e.target.checked })}
                      className="w-4 h-4 rounded accent-brand-500"
                    />
                    <span className="font-sans font-semibold text-slate-800 dark:text-slate-200">{r.size.label}</span>
                  </label>
                </td>
                <td className="px-3 py-2.5">
                  <label className="flex items-center gap-2 cursor-pointer text-[12px] text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={r.returnable}
                      disabled={!r.enabled}
                      onChange={e => mutate(r.size.id, { returnable: e.target.checked })}
                      className="w-4 h-4 rounded accent-brand-500"
                    />
                    Regulars return it
                  </label>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="relative w-32 ml-auto">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[13px] font-bold">₦</span>
                    <input
                      type="number"
                      step="50"
                      min="0"
                      value={r.container_buy_price || ''}
                      disabled={!r.enabled}
                      placeholder={String(fallbackContainerPrice || 0)}
                      onChange={e => mutate(r.size.id, { container_buy_price: Number(e.target.value) })}
                      className="w-full pl-6 pr-2 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-right font-mono tabular-nums font-bold text-[13px] focus:outline-none focus:border-brand-500 disabled:opacity-50"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500">
          Charged when a customer buys the container outright. Falls back to the product’s container price if left at 0.
        </p>
        <button
          onClick={() => draft && onSave(draft)}
          disabled={!dirty}
          className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-sans font-bold text-[13px] flex items-center gap-2 shadow-sm"
        >
          <Save className="w-4 h-4" weight="bold" /> Save configuration
        </button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */

const StockView: React.FC<{
  productId: string;
  stockView: Record<string, { tankLitres: number; kegsOut: number }>;
}> = ({ productId, stockView }) => {
  const s = stockView[productId] || { tankLitres: 0, kegsOut: 0 };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="text-[11px] font-sans uppercase tracking-wider text-slate-500">Bulk oil in tanks</div>
        <div className="text-2xl font-heading font-extrabold text-slate-900 dark:text-white tabular-nums mt-1">
          {s.tankLitres.toLocaleString()} <span className="text-sm font-sans font-medium text-slate-400">L</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1">Change deliveries in Truck Intake.</div>
      </div>
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="text-[11px] font-sans uppercase tracking-wider text-slate-500">Containers on loan</div>
        <div className="text-2xl font-heading font-extrabold text-slate-900 dark:text-white tabular-nums mt-1">
          {s.kegsOut.toLocaleString()}
        </div>
        <div className="text-[11px] text-slate-400 mt-1">Returnable kegs/drums out with customers.</div>
      </div>
      <div className="sm:col-span-2 flex items-center gap-2 text-[11px] text-slate-500 px-1">
        <Package className="w-3.5 h-3.5" /> Read-only. Stock changes flow from Truck Intake and sales.
      </div>
    </div>
  );
};

export default InventoryScreen;

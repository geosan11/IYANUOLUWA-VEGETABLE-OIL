import React, { useMemo, useState } from 'react';
import { useStore } from '../services/store';
import { usePermissions } from '../services/permissions';
import { lookupPackPrice } from '../services/pricing';
import { PACK_SIZES, packLitres } from '../constants/config';
import { CustomerType, PackPrice, ProductPackConfig, Product, SupplyModel } from '../types';
import { Modal } from '../components/common/Modal';
import {
  Stack as Boxes,
  Tag as Tags,
  Package,
  Warehouse,
  Lock,
  FloppyDisk as Save,
  Check,
  Plus,
  PencilSimple as Edit2,
  Trash,
  Database,
  Warning as AlertTriangle,
  CheckCircle as CheckCircle2
} from '@phosphor-icons/react';

const TIERS: CustomerType[] = ['retail', 'agent', 'corporate'];
type Tab = 'prices' | 'packs' | 'containers' | 'stock';

export const InventoryScreen: React.FC = () => {
  const {
    products,
    packPrices,
    stockView,
    bulkSetPackPrices,
    updateProductPackConfig,
    addProduct,
    updateProduct,
    deleteProduct,
    settings,
    updateSettings,
    kegInventory
  } = useStore();
  const { isOwner } = usePermissions();

  const [tab, setTab] = useState<Tab>('prices');
  const [activeProductId, setActiveProductId] = useState<string>(products[0]?.id || '');
  const activeProduct = products.find(p => p.id === activeProductId) || products[0] || null;
  const [activeVarietyId, setActiveVarietyId] = useState<string>(activeProduct?.varieties[0]?.id || '');

  // Local edit buffers, keyed so they reset when the product/variety changes.
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [packDraft, setPackDraft] = useState<ProductPackConfig[] | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [errorFlash, setErrorFlash] = useState<string | null>(null);

  // Product Add / Edit Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productFormName, setProductFormName] = useState('');
  const [productFormSupplyModel, setProductFormSupplyModel] = useState<SupplyModel>('bulk_truck');
  const [productFormVarieties, setProductFormVarieties] = useState('Standard');
  const [productFormKegPrice, setProductFormKegPrice] = useState('3500');

  // Empty Kegs & Container Pricing tab state
  const [outrightKegPrice, setOutrightKegPrice] = useState<string>(
    (settings.outright_keg_price ?? 3500).toString()
  );
  const [kegDepositPrice, setKegDepositPrice] = useState<string>(
    (settings.keg_deposit_price ?? 2000).toString()
  );

  const flashSaved = (msg: string) => {
    setSavedFlash(msg);
    window.setTimeout(() => setSavedFlash(null), 3000);
  };

  const flashError = (msg: string) => {
    setErrorFlash(msg);
    window.setTimeout(() => setErrorFlash(null), 4000);
  };

  // Reset buffers when the selected product changes.
  const onSelectProduct = (id: string) => {
    setActiveProductId(id);
    const p = products.find(pr => pr.id === id);
    setActiveVarietyId(p?.varieties[0]?.id || '');
    setPriceEdits({});
    setPackDraft(null);
  };

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductFormName('');
    setProductFormSupplyModel('bulk_truck');
    setProductFormVarieties('Standard');
    setProductFormKegPrice('3500');
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProductFormName(prod.name);
    setProductFormSupplyModel(prod.supply_model);
    setProductFormVarieties(prod.varieties.map(v => v.name).join(', '));
    setProductFormKegPrice((prod.keg_sell_price ?? 3500).toString());
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = productFormName.trim();
    if (!cleanName) return;

    const varietyNames = productFormVarieties
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
    const safeVarieties = varietyNames.length > 0 ? varietyNames : ['Standard'];

    const parsedKegPrice = parseFloat(productFormKegPrice) || 3500;

    if (editingProduct) {
      // Edit existing product
      const updatedVars = safeVarieties.map((vName, idx) => {
        const existing = editingProduct.varieties[idx];
        return {
          id: existing ? existing.id : `var-${Date.now()}-${idx}`,
          name: vName
        };
      });

      updateProduct(editingProduct.id, {
        name: cleanName,
        supply_model: productFormSupplyModel,
        varieties: updatedVars,
        keg_sell_price: parsedKegPrice
      });
      flashSaved(`Updated product: ${cleanName}`);
    } else {
      // Create new product
      const newVarieties = safeVarieties.map((vName, idx) => ({
        id: `var-${Date.now()}-${idx}`,
        name: vName
      }));

      const newProd = addProduct({
        name: cleanName,
        supply_model: productFormSupplyModel,
        litres_per_ton: productFormSupplyModel === 'bulk_truck' ? 1090 : null,
        litres_per_keg: 25,
        keg_sell_price: parsedKegPrice,
        varieties: newVarieties,
        pack_config: [
          { pack_size_id: 'sz_25', returnable: true, container_buy_price: parsedKegPrice }
        ],
        color_light: productFormSupplyModel === 'bulk_truck' ? '#F59E0B' : '#E11D48',
        color_dark: productFormSupplyModel === 'bulk_truck' ? '#B45309' : '#9F1239'
      });
      setActiveProductId(newProd.id);
      setActiveVarietyId(newProd.varieties[0]?.id || '');
      flashSaved(`Added new product: ${cleanName}`);
    }

    setIsProductModalOpen(false);
  };

  const handleDeleteProduct = (prod: Product) => {
    if (products.length <= 1) {
      flashError('Depot must have at least one registered product.');
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to delete "${prod.name}"? This removes its pricing matrix and configuration.`
    );
    if (!confirmed) return;

    const res = deleteProduct(prod.id);
    if (!res.success) {
      flashError(res.error || 'Cannot delete product.');
    } else {
      const remaining = products.filter(p => p.id !== prod.id);
      if (remaining[0]) {
        onSelectProduct(remaining[0].id);
      }
      flashSaved(`Product "${prod.name}" deleted.`);
    }
  };

  const handleSaveContainerPrices = () => {
    const numOutright = parseFloat(outrightKegPrice) || 3500;
    const numDeposit = parseFloat(kegDepositPrice) || 2000;
    updateSettings({
      outright_keg_price: numOutright,
      keg_deposit_price: numDeposit
    });
    flashSaved('Saved company 25L keg and container pricing.');
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 flex items-center justify-center">
            <Boxes className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h1 className="text-lg font-heading font-bold text-slate-900 dark:text-white leading-tight">Inventory & pricing</h1>
            <p className="text-[12px] text-slate-500 dark:text-slate-400">
              Pack-size price matrix, container rules, 25L fleet pricing and stock.
            </p>
          </div>
        </div>

        {/* Action Button: Add Product */}
        <button
          onClick={handleOpenAddProduct}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 text-[12px] font-sans font-bold shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" weight="bold" />
          <span>Add Product</span>
        </button>
      </div>

      {savedFlash && (
        <div className="flex items-center gap-2 text-[13px] font-sans font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2 animate-in fade-in">
          <Check className="w-4 h-4" /> {savedFlash}
        </div>
      )}

      {errorFlash && (
        <div className="flex items-center gap-2 text-[13px] font-sans font-medium text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl px-3 py-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4" /> {errorFlash}
        </div>
      )}

      {/* Product selector & Management toolbar */}
      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-sans uppercase font-bold tracking-wider text-slate-400 mr-1">
            Product:
          </span>
          {products.map(p => (
            <button
              key={p.id}
              onClick={() => onSelectProduct(p.id)}
              className={`px-3.5 py-2 rounded-xl text-[13px] font-sans font-semibold border transition-colors ${
                p.id === activeProduct.id
                  ? 'bg-brand-500 text-slate-950 border-brand-500 font-bold shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Selected Product Edit / Trash actions */}
        <div className="flex items-center gap-2 self-end md:self-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800/60 w-full md:w-auto justify-end">
          <button
            onClick={() => handleOpenEditProduct(activeProduct)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[12px] font-sans font-medium transition-colors"
            title="Edit product name and specifications"
          >
            <Edit2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
            <span>Edit</span>
          </button>
          <button
            onClick={() => handleDeleteProduct(activeProduct)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-[12px] font-sans font-medium transition-colors"
            title="Delete this product"
          >
            <Trash className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-fit">
        {([
          ['prices', 'Price matrix', Tags],
          ['packs', 'Pack sizes & containers', Package],
          ['containers', 'Empty Kegs & Container Pricing', Database],
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

      {tab === 'containers' && (
        <ContainerPricingView
          outrightPrice={outrightKegPrice}
          setOutrightPrice={setOutrightKegPrice}
          depositPrice={kegDepositPrice}
          setDepositPrice={setKegDepositPrice}
          onSave={handleSaveContainerPrices}
          kegInventory={kegInventory}
        />
      )}

      {tab === 'stock' && <StockView productId={activeProduct.id} stockView={stockView} />}

      {/* Product Add / Edit Modal */}
      {isProductModalOpen && (
        <Modal
          isOpen
          onClose={() => setIsProductModalOpen(false)}
          title={
            <span className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              <span>{editingProduct ? `Edit ${editingProduct.name}` : 'Add New Product'}</span>
            </span>
          }
          subtitle="Configure product name, supply logistics model and container terms"
        >
          <form onSubmit={handleSaveProduct} className="space-y-4">
            <div>
              <label htmlFor="product-name" className="block text-xs font-sans font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Product Name *
              </label>
              <input
                id="product-name"
                type="text"
                required
                value={productFormName}
                onChange={e => setProductFormName(e.target.value)}
                placeholder="e.g. Pure Groundnut Oil, Refined Soya Oil"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-sans font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Supply & Logistics Model *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setProductFormSupplyModel('bulk_truck')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    productFormSupplyModel === 'bulk_truck'
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-950 dark:text-amber-200 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="font-heading font-bold text-[13px]">Bulk Yard Tank</div>
                  <div className="text-[11px] font-sans mt-0.5 opacity-80">
                    Delivered via truck into depot bulk tanks and pumped to containers.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setProductFormSupplyModel('pre_kegged')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    productFormSupplyModel === 'pre_kegged'
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-950 dark:text-rose-200 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="font-heading font-bold text-[13px]">Pre-Kegged Jerrycans</div>
                  <div className="text-[11px] font-sans mt-0.5 opacity-80">
                    Delivered pre-packaged in 25L kegs / pallets (e.g. Palm Oil).
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="product-varieties" className="block text-xs font-sans font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Varieties / Grades (comma-separated)
              </label>
              <input
                id="product-varieties"
                type="text"
                value={productFormVarieties}
                onChange={e => setProductFormVarieties(e.target.value)}
                placeholder="Standard, Premium Grade A"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-[11px] font-sans text-slate-500 mt-1">
                Each variety generates individual pricing tiers in the matrix.
              </p>
            </div>

            <div>
              <label htmlFor="product-keg-price" className="block text-xs font-sans font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default 25L Container Outright Buy Price (₦)
              </label>
              <input
                id="product-keg-price"
                type="number"
                step="100"
                min="0"
                value={productFormKegPrice}
                onChange={e => setProductFormKegPrice(e.target.value)}
                placeholder="3500"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono tabular-nums text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-sans text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans text-xs font-bold shadow-sm"
              >
                {editingProduct ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </form>
        </Modal>
      )}
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
                          step="1"
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
                      step="1"
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

/* ------------------------------------------------------------------ */

const ContainerPricingView: React.FC<{
  outrightPrice: string;
  setOutrightPrice: React.Dispatch<React.SetStateAction<string>>;
  depositPrice: string;
  setDepositPrice: React.Dispatch<React.SetStateAction<string>>;
  onSave: () => void;
  kegInventory: ReturnType<typeof useStore>['kegInventory'];
}> = ({ outrightPrice, setOutrightPrice, depositPrice, setDepositPrice, onSave, kegInventory }) => {
  return (
    <div className="space-y-6">
      {/* Fleet Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-sans font-bold uppercase tracking-wider text-slate-500">
            Total Depot Keg Fleet
          </div>
          <div className="text-2xl font-heading font-extrabold text-slate-900 dark:text-white tabular-nums mt-1">
            {kegInventory.totalCompanyKegs.toLocaleString()}{' '}
            <span className="text-sm font-sans font-medium text-slate-400">Kegs (25L)</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Total standard 25L company kegs owned by depot.
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-sans font-bold uppercase tracking-wider text-slate-500">
            Empty Kegs In Depot Yard
          </div>
          <div className="text-2xl font-heading font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
            {kegInventory.kegsAtDepot.toLocaleString()}{' '}
            <span className="text-sm font-sans font-medium text-slate-400">Available</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Ready for filling and dispensing to customers.
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-sans font-bold uppercase tracking-wider text-slate-500">
            Kegs Out On Customer Loan
          </div>
          <div className="text-2xl font-heading font-extrabold text-amber-600 dark:text-amber-400 tabular-nums mt-1">
            {kegInventory.totalKegsOut.toLocaleString()}{' '}
            <span className="text-sm font-sans font-medium text-slate-400">Circulating</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Unreturned loan containers tracked in Keg Ledger.
          </div>
        </div>
      </div>

      {/* Pricing Configuration Form */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="text-base font-heading font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span>Standard 25L Company Keg Pricing Rules</span>
          </h3>
          <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
            Configure financial rules when company containers leave the depot or are redeemed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Outright Buy Price */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <label htmlFor="outright-price" className="block text-xs font-sans font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Outright Purchase Price (₦)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₦</span>
              <input
                id="outright-price"
                type="number"
                step="100"
                min="0"
                value={outrightPrice}
                onChange={e => setOutrightPrice(e.target.value)}
                placeholder="3500"
                className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono tabular-nums text-base font-bold text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <p className="text-[11px] font-sans text-slate-500 dark:text-slate-400 leading-relaxed">
              Default price billed per container when a customer buys company 25L kegs outright and retains them permanently (Zero return debt).
            </p>
          </div>

          {/* Deposit Refund Rate */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <label htmlFor="deposit-price" className="block text-xs font-sans font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Keg Return / Deposit Refund Rate (₦)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₦</span>
              <input
                id="deposit-price"
                type="number"
                step="100"
                min="0"
                value={depositPrice}
                onChange={e => setDepositPrice(e.target.value)}
                placeholder="2000"
                className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono tabular-nums text-base font-bold text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <p className="text-[11px] font-sans text-slate-500 dark:text-slate-400 leading-relaxed">
              Standard refund credit credited to customer ledger when they return undamaged company 25L kegs.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="text-[12px] font-sans text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Applies automatically at POS Checkout and Keg Ledger.</span>
          </div>

          <button
            type="button"
            onClick={onSave}
            className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[13px] flex items-center gap-2 shadow-sm transition-all"
          >
            <Save className="w-4 h-4" weight="bold" />
            <span>Save Container Pricing</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default InventoryScreen;

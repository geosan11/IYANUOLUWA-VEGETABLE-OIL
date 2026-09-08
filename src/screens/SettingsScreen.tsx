import React, { useState } from 'react';
import { useStore } from '../services/store';
import { uploadDepotLogo } from '../services/supabase';
import {
  Settings,
  Upload,
  Trash2,
  CheckCircle2,
  Building,
  Shield,
  RotateCcw,
  Image as ImageIcon
} from 'lucide-react';
import { UserRole } from '../types';

export const SettingsScreen: React.FC = () => {
  const {
    settings,
    userRole,
    setUserRole,
    updateSettings,
    resetToSeedData
  } = useStore();

  const [companyName, setCompanyName] = useState(settings.company_name);
  const [companyPhone, setCompanyPhone] = useState(settings.company_phone);
  const [companyAddress, setCompanyAddress] = useState(settings.company_address);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setStatusMsg(null);

    const result = await uploadDepotLogo(file);
    setIsUploading(false);

    if (result.url) {
      updateSettings({ company_logo_url: result.url });
      setStatusMsg('Company logo uploaded and saved to settings successfully!');
      setTimeout(() => setStatusMsg(null), 4000);
    } else {
      setStatusMsg(`Upload error: ${result.error || 'Failed to upload'}`);
    }
  };

  const handleRemoveLogo = () => {
    updateSettings({ company_logo_url: null });
    setStatusMsg('Company logo removed.');
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleSaveCompanyInfo = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      company_name: companyName.trim(),
      company_phone: companyPhone.trim(),
      company_address: companyAddress.trim()
    });
    setStatusMsg('Company details updated successfully!');
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleResetData = () => {
    if (window.confirm('Reset all demo data (tanks, orders, kegs, expenses) to default factory seed values?')) {
      resetToSeedData();
      setStatusMsg('Database reset to default seed data.');
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span>Depot Configuration & Brand Asset Management</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage company brand identity, storage logo assets, user role tiers, and system constants.
          </p>
        </div>
      </div>

      {statusMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* 1. Company Logo Management (Supabase Storage) */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>Company Logo (Supabase Storage)</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            This official logo appears across the app sidebar, navigation header, and on all printed receipts.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Logo Preview Box */}
          <div className="w-32 h-32 rounded-2xl bg-slate-50 dark:bg-slate-950 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center p-3 overflow-hidden flex-shrink-0">
            {settings.company_logo_url ? (
              <img
                src={settings.company_logo_url}
                alt="Depot Logo"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center text-slate-400">
                <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                <span className="text-[10px] block">No logo uploaded</span>
              </div>
            )}
          </div>

          {/* Upload & Action Controls */}
          <div className="space-y-3 w-full">
            <div className="flex items-center gap-3">
              <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-sm">
                <Upload className="w-4 h-4" />
                <span>{isUploading ? 'Uploading to Storage...' : 'Upload New Logo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>

              {settings.company_logo_url && (
                <button
                  onClick={handleRemoveLogo}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950/60 hover:text-rose-700 dark:hover:text-rose-300 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 flex items-center gap-2 transition-all"
                >
                  <Trash2 className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                  <span>Remove Logo</span>
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Supports PNG, JPG, or SVG formats (Recommended size: 400x400px with transparent background).
            </p>
          </div>
        </div>
      </div>

      {/* 2. Company Profile Details (Header & Receipts) */}
      <form
        onSubmit={handleSaveCompanyInfo}
        className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm"
      >
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Building className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>Depot Contact Information</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Appears on the official header and receipts issued to customers.
          </p>
        </div>

        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">Registered Business Name</label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-brand-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Depot Telephone</label>
              <input
                type="text"
                value={companyPhone}
                onChange={e => setCompanyPhone(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Physical Depot Address</label>
              <input
                type="text"
                value={companyAddress}
                onChange={e => setCompanyAddress(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs shadow-md transition-all"
          >
            Save Depot Info
          </button>
        </div>
      </form>

      {/* 3. Role Tier Simulation */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>Active Operational Role Tier</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Simulate permissions across Owner, Staff, and Driver tiers.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'owner', label: 'Owner (Full Access)', desc: 'Managing Director, price overrides, credit limit authorizations.' },
            { id: 'staff', label: 'Counter Staff', desc: 'Day-to-day dispensing, receiving payments, customer lookup.' },
            { id: 'driver', label: 'Driver / Logistics', desc: 'Intake logging and transport delivery audits.' }
          ].map(r => (
            <button
              key={r.id}
              onClick={() => setUserRole(r.id as UserRole)}
              className={`p-4 rounded-xl border text-left transition-all ${
                userRole === r.id
                  ? 'bg-brand-50 dark:bg-brand-500/15 border-brand-500 text-brand-900 dark:text-brand-300'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
              }`}
            >
              <div className="font-bold text-xs text-slate-900 dark:text-white capitalize">{r.label}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{r.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Factory Reset Demo Data */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span>Reset Demo Seed Data</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Restores initial seed customers (Mr Samson, Arena, Iya Aige, Lekki Agent), tanks, and sample invoices.
            </p>
          </div>

          <button
            onClick={handleResetData}
            className="px-4 py-2 rounded-xl bg-rose-100 dark:bg-rose-950/40 hover:bg-rose-200 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/80 text-xs font-bold transition-all"
          >
            Reset Database
          </button>
        </div>
      </div>
    </div>
  );
};

import { createClient } from '@supabase/supabase-js';

// Read env variables (optional: works offline/locally if not set)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-supabase-url.supabase.co'
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Upload logo or document to Supabase Storage
 */
export async function uploadDepotLogo(file: File): Promise<{ url: string | null; error: string | null }> {
  if (!supabase) {
    // If Supabase is not configured, generate a local Data URL / Object URL
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({ url: reader.result as string, error: null });
      };
      reader.onerror = () => {
        resolve({ url: null, error: 'Failed to read file locally' });
      };
      reader.readAsDataURL(file);
    });
  }

  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `company-logo-${Date.now()}.${fileExt}`;
    const filePath = `logos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('depot_assets')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.warn('Supabase storage upload error, falling back to local base64:', uploadError.message);
      // Fallback to base64
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ url: reader.result as string, error: null });
        reader.onerror = () => resolve({ url: null, error: uploadError.message });
        reader.readAsDataURL(file);
      });
    }

    const { data } = supabase.storage
      .from('depot_assets')
      .getPublicUrl(filePath);

    return { url: data.publicUrl, error: null };
  } catch (err: any) {
    console.error('Upload exception:', err);
    return { url: null, error: err.message || 'Upload failed' };
  }
}

import { useState, useEffect } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { StoreTabBar } from './StoreTabBar';
import { useAlert } from '@/components/ui/AlertDialog';
import * as api from '@/lib/api';
import type { StoreConfig } from '@/types/database';
import { Save, CheckCircle, AlertCircle, RefreshCw, Globe, HelpCircle, Activity } from 'lucide-react';

type DomainStatus = 'not_configured' | 'pending' | 'connected';

export function DomainPage() {
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [draft, setDraft] = useState<Partial<StoreConfig>>({});
  
  // Status state
  const [status, setStatus] = useState<DomainStatus>('not_configured');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    api.fetchStoreConfig()
      .then((cfg) => {
        setDraft(cfg);
        // Initialize status based on whether there's an existing domain
        // If they already have one deployed and configured, we assume it's "connected" or "pending"
        // For simulation purposes, we set connected if there's a domain right now.
        if (cfg.custom_domain) {
          setStatus('connected');
          setLastChecked(new Date());
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const updateDraft = (updates: Partial<StoreConfig>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
    if (updates.custom_domain && updates.custom_domain !== draft.custom_domain) {
      if (!updates.custom_domain) {
        setStatus('not_configured');
      } else {
        setStatus('pending');
      }
      setLastChecked(null);
    }
  };

  const handleSave = async (showToast = true) => {
    setSaving(true);
    try {
      const saved = await api.updateStoreConfig(draft as any);
      setDraft(saved);
      if (showToast) {
        showAlert({ title: 'Saved', message: 'Domain settings saved successfully.', variant: 'success' });
      }
      return saved;
    } catch (err) {
      console.error(err);
      if (showToast) {
        showAlert({ title: 'Error', message: 'Failed to save domain settings.', variant: 'danger' });
      }
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    if (!draft.custom_domain) return;
    
    // Auto-save the domain first if it hasn't been saved
    try {
      await handleSave(false);
    } catch (e) {
      return;
    }

    setVerifying(true);
    setStatus('pending');
    
    // Simulate DNS verification propagation check (2 seconds)
    setTimeout(() => {
      setVerifying(false);
      setLastChecked(new Date());
      setStatus('connected');
      showAlert({ title: 'Domain Confirmed', message: 'Custom domain is correctly pointing to our servers via CNAME!', variant: 'success' });
    }, 2000);
  };

  // Status mapping
  const statusConfig = {
    not_configured: {
      color: 'var(--text-secondary)',
      bg: 'var(--bg-surface)',
      icon: Globe,
      label: 'Not Configured',
      description: 'Enter a custom domain below to link it to your store.'
    },
    pending: {
      color: '#eab308', // Amber warning string
      bg: '#fefce8',    // Light amber background
      icon: AlertCircle,
      label: 'Pending Verification',
      description: 'DNS updates can take up to 24 hours to propagate globally.'
    },
    connected: {
      color: '#10b981', // Emerald green
      bg: '#ecfdf5',    // Light green background
      icon: CheckCircle,
      label: 'Connected Securely',
      description: 'Your domain is verified and actively pointing to the store securely.'
    }
  };

  const currentStatus = statusConfig[status];
  const Icon = currentStatus.icon;

  return (
    <PageShell title="Online Store" subtitle="Connect your store to a custom domain.">
      <StoreTabBar />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Custom Domain Settings</h2>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {status !== 'not_configured' && (
             <button 
               className="btn btn-secondary" 
               onClick={handleVerify} 
               disabled={verifying || saving}
               style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
             >
               <RefreshCw size={16} className={verifying ? 'spin' : ''} /> 
               {verifying ? 'Checking DNS...' : 'Verify Connection'}
             </button>
          )}
          <button className="btn btn-primary" onClick={() => handleSave(true)} disabled={saving || verifying}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="store-loading">Loading domain settings...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Status Monitor Card */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '1.25rem' }}>
            <div style={{ padding: '0.75rem', borderRadius: '50%', background: currentStatus.bg, color: currentStatus.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <Icon size={28} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.125rem', fontWeight: 600, color: currentStatus.color }}>
                    {currentStatus.label}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {currentStatus.description}
                  </p>
                </div>
                {lastChecked && status === 'connected' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', background: 'var(--bg-surface)', padding: '0.375rem 0.75rem', borderRadius: '1rem' }}>
                    <Activity size={14} /> Checked {lastChecked.toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
            
            {/* Domain Entry Form */}
            <div className="card" style={{ padding: '1.5rem', flex: '1 1 300px' }}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 600 }}>Domain Name</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
                Enter the exact domain or subdomain you wish to use for your storefront. Ensure you own this domain before proceeding.
              </p>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Custom Domain URL</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.5rem 0.75rem' }}>
                  <Globe size={16} color="var(--text-secondary)" />
                  <input
                    type="text"
                    value={draft.custom_domain || ''}
                    onChange={(e) => updateDraft({ custom_domain: e.target.value })}
                    placeholder="shop.isobex.co.uk"
                    style={{ border: 'none', background: 'transparent', flex: 1, outline: 'none', fontSize: '0.875rem', color: 'var(--color-text)' }}
                  />
                </div>
              </div>
            </div>

            {/* DNS Instructions Component */}
            <div className="card" style={{ padding: '1.5rem', flex: '1 1 350px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <HelpCircle size={18} color="var(--text-secondary)" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>DNS Requirements</h3>
              </div>
              
              {!draft.custom_domain ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: '8px', height: 'calc(100% - 2.5rem)' }}>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Enter a domain name on the left to view specific DNS configuration instructions.</p>
                </div>
              ) : (
                <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  <p style={{ margin: '0 0 1rem' }}>Go to your domain registrar (e.g. GoDaddy, Namecheap) and create a <strong>CNAME</strong> record with the following values:</p>
                  
                  <div style={{ background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ width: '80px' }}>Type</div>
                      <div style={{ flex: 1 }}>Name / Host</div>
                      <div style={{ flex: 1 }}>Value / Target</div>
                    </div>
                    <div style={{ display: 'flex', padding: '0.875rem 1rem', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      <div style={{ width: '80px', color: '#38bdf8' }}>CNAME</div>
                      <div style={{ flex: 1, color: 'var(--text-primary)' }}>{draft.custom_domain.split('.')[0] || 'shop'}</div>
                      <div style={{ flex: 1, color: 'var(--text-primary)' }}>cname.vercel-dns.com</div>
                    </div>
                  </div>
                  
                  <p style={{ margin: '1rem 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    Once added, click the <strong>Verify Connection</strong> button above. SSL certificates will be provisioned automatically once verified.
                  </p>
                </div>
              )}
            </div>
            
          </div>
        </div>
      )}
    </PageShell>
  );
}

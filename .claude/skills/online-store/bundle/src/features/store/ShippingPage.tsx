import { useState, useEffect } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { StoreTabBar } from './StoreTabBar';
import * as api from '@/lib/api';
import type { ShippingZone, ShippingRate } from '@/types/database';
import { Plus, Trash2, Truck, ChevronDown, ChevronUp } from 'lucide-react';

export function ShippingPage() {
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.fetchShippingZones(), api.fetchShippingRates()])
      .then(([z, r]) => {
        setZones(z);
        setRates(r);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const addRate = async (zoneId: string) => {
    try {
      const newRate = await api.createShippingRate({
        zone_id: zoneId,
        name: 'Standard Delivery',
        price: 5.0,
        estimated_days_min: 3,
        estimated_days_max: 5,
        sort_order: rates.filter((r) => r.zone_id === zoneId).length,
        is_active: true,
      });
      setRates((prev) => [...prev, newRate]);
    } catch (err) {
      console.error('Failed to add rate:', err);
    }
  };

  const updateRate = (id: string, field: string, value: any) => {
    setRates((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const saveRate = async (rate: ShippingRate) => {
    try {
      await api.updateShippingRate(rate.id, rate);
    } catch (err) {
      console.error('Failed to save rate:', err);
    }
  };

  const deleteRate = async (id: string) => {
    try {
      await api.deleteShippingRate(id);
      setRates((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Failed to delete rate:', err);
    }
  };

  return (
    <PageShell title="Online Store" subtitle="Configure shipping zones and rates.">
      <StoreTabBar />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Shipping</h2>
      </div>

      {loading ? (
        <div className="store-loading">Loading shipping configuration...</div>
      ) : zones.length === 0 ? (
        <div className="module-placeholder">
          <div className="module-placeholder-icon"><Truck size={48} /></div>
          <h3>No Shipping Zones</h3>
          <p>Run the store schema migration to create default shipping zones.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {zones.map((zone) => {
            const zoneRates = rates.filter((r) => r.zone_id === zone.id);
            const isOpen = editingZoneId === zone.id;
            return (
              <div key={zone.id} className="card" style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem 1.25rem',
                    cursor: 'pointer',
                    background: isOpen ? 'var(--bg-surface, #f8fafc)' : 'transparent',
                  }}
                  onClick={() => setEditingZoneId(isOpen ? null : zone.id)}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{zone.name}</h3>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {zoneRates.length} rate{zoneRates.length !== 1 ? 's' : ''} configured
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {isOpen && (
                  <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border-color)' }}>
                    {zoneRates.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 1rem' }}>
                        No rates configured for this zone yet.
                      </p>
                    ) : (
                      <table className="products-table shipping-table" style={{ marginBottom: '1rem' }}>
                        <thead>
                          <tr>
                            <th>Rate Name</th>
                            <th>Price (£)</th>
                            <th>Est. Days</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {zoneRates.map((rate) => (
                            <tr key={rate.id} className="products-table-row">
                              <td className="product-name-cell" data-label="Rate Name">
                                <input
                                  type="text"
                                  className="form-input"
                                  value={rate.name}
                                  onChange={(e) => updateRate(rate.id, 'name', e.target.value)}
                                  onBlur={() => saveRate(rate)}
                                  style={{ width: '100%', maxWidth: '100%' }}
                                />
                                <div className="mobile-only-detail" style={{ width: '100%' }}>
                                  <button
                                    className="btn btn-danger btn-sm"
                                    onClick={() => deleteRate(rate.id)}
                                    style={{ flex: 1, justifyContent: 'center' }}
                                  >
                                    Delete Rate
                                  </button>
                                </div>
                              </td>
                              <td data-label="Price (£)">
                                <input
                                  type="number"
                                  className="form-input"
                                  value={rate.price}
                                  onChange={(e) => updateRate(rate.id, 'price', Number(e.target.value))}
                                  onBlur={() => saveRate(rate)}
                                  step="0.01"
                                  min="0"
                                  style={{ width: '100%', maxWidth: '90px' }}
                                />
                              </td>
                              <td data-label="Est. Days">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end', width: '100%', maxWidth: '140px' }}>
                                  <input
                                    type="number"
                                    className="form-input"
                                    value={rate.estimated_days_min}
                                    onChange={(e) => updateRate(rate.id, 'estimated_days_min', Number(e.target.value))}
                                    onBlur={() => saveRate(rate)}
                                    min="0"
                                    style={{ width: '55px', minWidth: '55px' }}
                                  />
                                  <span>–</span>
                                  <input
                                    type="number"
                                    className="form-input"
                                    value={rate.estimated_days_max}
                                    onChange={(e) => updateRate(rate.id, 'estimated_days_max', Number(e.target.value))}
                                    onBlur={() => saveRate(rate)}
                                    min="0"
                                    style={{ width: '55px', minWidth: '55px' }}
                                  />
                                </div>
                              </td>
                              <td className="desktop-only" data-label="Actions">
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                  <button
                                    className="btn btn-ghost btn-icon-sm text-danger"
                                    onClick={() => deleteRate(rate.id)}
                                    title="Delete rate"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={() => addRate(zone.id)}>
                      <Plus size={14} /> Add Rate
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}

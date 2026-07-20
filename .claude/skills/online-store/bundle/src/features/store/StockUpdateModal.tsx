import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, CameraOff, Plus, Minus, Check, Search } from 'lucide-react';
import * as api from '@/lib/api';
import type { BarcodeLookupResult } from '@/lib/api';
import type { StockMovement, StockMovementType } from '@/types/database';
import './StockUpdateModal.css';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdjusted?: (movement: StockMovement) => void;
}

type Mode = 'add' | 'remove' | 'set';

const MOVEMENT_TYPES: { value: StockMovementType; label: string }[] = [
  { value: 'received', label: 'Stock received' },
  { value: 'stocktake', label: 'Stock take correction' },
  { value: 'damaged', label: 'Damaged / write-off' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'manual', label: 'Other' },
];

export function StockUpdateModal({ open, onClose, onAdjusted }: Props) {
  const [manualInput, setManualInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [target, setTarget] = useState<BarcodeLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<Mode>('add');
  const [amount, setAmount] = useState<string>('1');
  const [movementType, setMovementType] = useState<StockMovementType>('received');
  const [reason, setReason] = useState('');
  const [recent, setRecent] = useState<StockMovement[]>([]);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastScanRef = useRef<number>(0);

  const reset = useCallback(() => {
    setTarget(null);
    setError(null);
    setAmount('1');
    setReason('');
    setMode('add');
    setMovementType('received');
    setManualInput('');
  }, []);

  // Keyboard wedge / manual input: focus the input on open
  useEffect(() => {
    if (open && !scanning) {
      inputRef.current?.focus();
    }
  }, [open, scanning, target]);

  // Stop camera on close
  useEffect(() => {
    if (!open) {
      stopCamera();
      reset();
    }
  }, [open, reset]);

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        /* ignore */
      }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const startCamera = async () => {
    setError(null);
    setScanning(true);
    // Wait a tick for the #stock-reader element to mount
    setTimeout(async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          setError('No cameras found.');
          setScanning(false);
          return;
        }
        const back = devices.find(
          (d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment')
        );
        const camId = back ? back.id : devices[0].id;

        const html5 = new Html5Qrcode('stock-reader');
        scannerRef.current = html5;
        await html5.start(
          camId,
          { fps: 10, qrbox: { width: 250, height: 100 }, aspectRatio: 2.0 },
          (decodedText) => {
            if (Date.now() - lastScanRef.current < 1500) return;
            lastScanRef.current = Date.now();
            handleBarcode(decodedText);
          },
          () => {}
        );
      } catch (e: any) {
        setError(e?.message || 'Failed to start camera. Check permissions.');
        setScanning(false);
      }
    }, 80);
  };

  const handleBarcode = async (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    setError(null);
    setLookupBusy(true);
    try {
      const result = await api.lookupByBarcode(code);
      if (!result) {
        setError(`No product found for barcode: ${code}`);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      } else {
        setTarget(result);
        setManualInput('');
        if (navigator.vibrate) navigator.vibrate(60);
        await stopCamera();
      }
    } catch (e: any) {
      setError(e?.message || 'Lookup failed.');
    } finally {
      setLookupBusy(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) handleBarcode(manualInput);
  };

  const computedDelta = (): number => {
    if (!target) return 0;
    const n = Number(amount);
    if (!Number.isFinite(n)) return 0;
    if (mode === 'add') return Math.abs(Math.trunc(n));
    if (mode === 'remove') return -Math.abs(Math.trunc(n));
    // set
    return Math.trunc(n) - target.stock_quantity;
  };

  const handleSave = async () => {
    if (!target) return;
    const delta = computedDelta();
    if (delta === 0) {
      setError('No change in quantity.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const movement = await api.adjustStock({
        target,
        delta,
        movement_type: movementType,
        reason: reason.trim() || null,
        source: 'scan',
      });
      setRecent((prev) => [movement, ...prev].slice(0, 5));
      onAdjusted?.(movement);
      reset();
      // Re-focus input for next scan
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (e: any) {
      setError(e?.message || 'Failed to save adjustment.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const newQty = target ? Math.max(0, target.stock_quantity + computedDelta()) : 0;

  return (
    <div className="stock-modal-overlay" onClick={onClose}>
      <div className="stock-modal" onClick={(e) => e.stopPropagation()}>
        <div className="stock-modal-header">
          <h2>Scan to Update Stock</h2>
          <button className="stock-modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="stock-modal-body">
          {!target && (
            <>
              <form onSubmit={handleManualSubmit} className="stock-scan-input">
                <Search size={16} />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Scan or type barcode then press Enter"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  autoFocus
                  disabled={lookupBusy}
                />
                <button type="submit" className="btn btn-primary" disabled={lookupBusy || !manualInput.trim()}>
                  {lookupBusy ? 'Looking up…' : 'Find'}
                </button>
              </form>

              <div className="stock-camera-section">
                {!scanning ? (
                  <button className="btn btn-secondary" onClick={startCamera}>
                    <Camera size={16} />
                    <span>Use device camera</span>
                  </button>
                ) : (
                  <>
                    <div id="stock-reader" className="stock-reader" />
                    <button className="btn btn-secondary" onClick={stopCamera}>
                      <CameraOff size={16} />
                      <span>Stop camera</span>
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {target && (
            <div className="stock-target">
              <div className="stock-target-header">
                <div>
                  <div className="stock-target-name">{target.product_name}</div>
                  {target.variant_label && (
                    <div className="stock-target-variant">{target.variant_label}</div>
                  )}
                  <div className="stock-target-meta">
                    {target.sku && <span>SKU: {target.sku}</span>}
                    <span>Barcode: {target.barcode}</span>
                  </div>
                </div>
                <div className="stock-target-qty">
                  <span className="qty-label">Current</span>
                  <span className="qty-value">{target.stock_quantity}</span>
                </div>
              </div>

              <div className="stock-mode-tabs">
                <button
                  className={`mode-tab ${mode === 'add' ? 'active' : ''}`}
                  onClick={() => setMode('add')}
                >
                  <Plus size={14} /> Add
                </button>
                <button
                  className={`mode-tab ${mode === 'remove' ? 'active' : ''}`}
                  onClick={() => setMode('remove')}
                >
                  <Minus size={14} /> Remove
                </button>
                <button
                  className={`mode-tab ${mode === 'set' ? 'active' : ''}`}
                  onClick={() => setMode('set')}
                >
                  Set to
                </button>
              </div>

              <div className="stock-form-row">
                <label>
                  <span>{mode === 'set' ? 'New quantity' : 'Quantity'}</span>
                  <input
                    type="number"
                    min={0}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <label>
                  <span>Reason</span>
                  <select
                    value={movementType}
                    onChange={(e) => setMovementType(e.target.value as StockMovementType)}
                  >
                    {MOVEMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="stock-form-full">
                <span>Note (optional)</span>
                <input
                  type="text"
                  placeholder="e.g. PO-1234, shelf B3"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>

              <div className="stock-preview">
                <span>New quantity:</span>
                <strong>{newQty}</strong>
                <span className={`delta ${computedDelta() >= 0 ? 'pos' : 'neg'}`}>
                  ({computedDelta() >= 0 ? '+' : ''}{computedDelta()})
                </span>
              </div>

              <div className="stock-modal-actions">
                <button className="btn btn-secondary" onClick={reset} disabled={saving}>
                  Scan another
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving || computedDelta() === 0}>
                  <Check size={16} />
                  <span>{saving ? 'Saving…' : 'Save adjustment'}</span>
                </button>
              </div>
            </div>
          )}

          {error && <div className="stock-error">{error}</div>}

          {recent.length > 0 && (
            <div className="stock-recent">
              <h4>Just updated</h4>
              <ul>
                {recent.map((m) => (
                  <li key={m.id}>
                    <span className={`delta-pill ${m.quantity_delta >= 0 ? 'pos' : 'neg'}`}>
                      {m.quantity_delta >= 0 ? '+' : ''}{m.quantity_delta}
                    </span>
                    <span className="recent-name">{m.product_name || m.barcode}</span>
                    <span className="recent-after">→ {m.quantity_after}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

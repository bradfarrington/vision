import { useState, useMemo } from 'react';
import { X, Printer, Check, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import './BarcodeLabelPrinter.css';

// ─── Avery L7160 specs (mm) ─────────────────────────────────
const COLS = 3;
const ROWS = 7;
const LABELS_PER_SHEET = COLS * ROWS; // 21

const LABEL_WIDTH_MM = 63.5;
const LABEL_HEIGHT_MM = 38.1;
const MARGIN_TOP_MM = 15.1;
const MARGIN_LEFT_MM = 7.2;
const GAP_H_MM = 2.5;
const GAP_V_MM = 0;

// ─── Types ──────────────────────────────────────────────────
export interface LabelData {
  barcode: string;
  productName: string;
  variantLabel?: string;
}

interface BarcodeLabelPrinterProps {
  open: boolean;
  onClose: () => void;
  mode: 'single' | 'bulk';
  singleLabel?: LabelData;
  bulkLabels?: LabelData[];
}

// ─── Build print HTML ───────────────────────────────────────
function buildPrintHTML(labels: (LabelData | null)[]): string {
  const totalSheets = Math.ceil(labels.length / LABELS_PER_SHEET);
  const sheets: string[] = [];

  for (let s = 0; s < totalSheets; s++) {
    const sheetLabels = labels.slice(s * LABELS_PER_SHEET, (s + 1) * LABELS_PER_SHEET);
    // Pad to 21
    while (sheetLabels.length < LABELS_PER_SHEET) {
      sheetLabels.push(null);
    }

    const cells = sheetLabels
      .map((label) => {
        if (!label) {
          return `<div class="cell"></div>`;
        }
        const nameHtml = `<div class="lbl-name">${escapeHtml(label.productName)}</div>`;
        const variantHtml = label.variantLabel
          ? `<div class="lbl-variant">${escapeHtml(label.variantLabel)}</div>`
          : '';
        const barcodeImg = `<img class="lbl-barcode" src="https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(label.barcode)}&scale=2&height=12" alt="" />`;
        const codeText = `<div class="lbl-code">${escapeHtml(label.barcode)}</div>`;
        return `<div class="cell filled">${nameHtml}${variantHtml}${barcodeImg}${codeText}</div>`;
      })
      .join('\n');

    sheets.push(`<div class="sheet">${cells}</div>`);
  }

  return `<!DOCTYPE html>
<html>
<head>
  <title>Print Barcode Labels — Avery L7160</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      width: 210mm;
      height: 297mm;
      padding-top: ${MARGIN_TOP_MM}mm;
      padding-left: ${MARGIN_LEFT_MM}mm;
      display: grid;
      grid-template-columns: repeat(${COLS}, ${LABEL_WIDTH_MM}mm);
      grid-template-rows: repeat(${ROWS}, ${LABEL_HEIGHT_MM}mm);
      column-gap: ${GAP_H_MM}mm;
      row-gap: ${GAP_V_MM}mm;
      page-break-after: always;
    }
    .sheet:last-child {
      page-break-after: auto;
    }
    .cell {
      width: ${LABEL_WIDTH_MM}mm;
      height: ${LABEL_HEIGHT_MM}mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      overflow: hidden;
      padding: 2mm 3mm;
    }
    .lbl-name {
      font-size: 8pt;
      font-weight: 700;
      line-height: 1.2;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #000;
    }
    .lbl-variant {
      font-size: 7pt;
      font-weight: 500;
      color: #333;
      margin-top: 0.5mm;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .lbl-barcode {
      margin-top: 1.5mm;
      height: 14mm;
      max-width: 55mm;
      mix-blend-mode: multiply;
    }
    .lbl-code {
      margin-top: 2mm;
      font-family: 'Courier New', monospace;
      font-size: 7pt;
      letter-spacing: 0.5mm;
      font-weight: 500;
      color: #000;
    }
    @media screen {
      body { background: #e2e8f0; padding: 20px; }
      .sheet {
        background: #fff;
        margin: 0 auto 20px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      }
      .cell.filled {
        border: 1px dashed #cbd5e1;
        border-radius: 2px;
      }
    }
  </style>
</head>
<body>
  ${sheets.join('\n')}
  <script>
    // Wait for all barcode images to load, then print
    const imgs = document.querySelectorAll('img.lbl-barcode');
    let loaded = 0;
    const total = imgs.length;
    if (total === 0) {
      window.print();
    } else {
      imgs.forEach(img => {
        img.onload = img.onerror = () => {
          loaded++;
          if (loaded >= total) window.print();
        };
        // If already cached
        if (img.complete) {
          loaded++;
          if (loaded >= total) window.print();
        }
      });
    }
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Component ──────────────────────────────────────────────
export function BarcodeLabelPrinter({
  open,
  onClose,
  mode,
  singleLabel,
  bulkLabels,
}: BarcodeLabelPrinterProps) {
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [previewPage, setPreviewPage] = useState(0);

  // Build the full label arrays
  const allLabels = useMemo(() => {
    if (mode === 'single' && singleLabel) {
      return [singleLabel];
    }
    if (mode === 'bulk' && bulkLabels) {
      return bulkLabels.filter((l) => l.barcode);
    }
    return [];
  }, [mode, singleLabel, bulkLabels]);

  const totalSheets = Math.max(1, Math.ceil(allLabels.length / LABELS_PER_SHEET));

  if (!open) return null;

  const handlePrint = () => {
    let printLabels: (LabelData | null)[];

    if (mode === 'single' && singleLabel) {
      // Build a sheet with the label at the selected position
      printLabels = Array.from({ length: LABELS_PER_SHEET }, () => null);
      const pos = selectedPosition ?? 0;
      printLabels[pos] = singleLabel;
    } else {
      // Bulk — fill sequentially
      printLabels = [...allLabels];
    }

    const html = buildPrintHTML(printLabels);
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  // For bulk preview — get current page labels
  const pageLabels = allLabels.slice(
    previewPage * LABELS_PER_SHEET,
    (previewPage + 1) * LABELS_PER_SHEET
  );

  return (
    <div className="label-printer-overlay" onClick={onClose}>
      <div className="label-printer-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="label-printer-header">
          <h3>
            <Printer size={18} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />
            {mode === 'single' ? 'Print Label — Choose Position' : 'Print All Barcode Labels'}
          </h3>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="label-printer-body">
          {mode === 'single' && singleLabel ? (
            <>
              <p className="label-printer-subtitle">
                Click the position on the <strong>Avery L7160</strong> sheet where you'd like this label printed.
                Choose a position that hasn't already been used on your label sheet.
              </p>

              {/* Label being printed */}
              <div className="label-bulk-summary">
                <Tag size={16} />
                <div>
                  <strong>{singleLabel.productName}</strong>
                  {singleLabel.variantLabel && <span> — {singleLabel.variantLabel}</span>}
                </div>
              </div>

              {/* Position picker grid */}
              <div className="label-sheet-preview">
                {Array.from({ length: LABELS_PER_SHEET }, (_, i) => (
                  <div
                    key={i}
                    className={`label-cell ${selectedPosition === i ? 'selected' : ''}`}
                    onClick={() => setSelectedPosition(i)}
                  >
                    <span className="label-cell-check">
                      <Check size={8} />
                    </span>
                    {selectedPosition === i ? (
                      <>
                        <span className="label-cell-name">{singleLabel.productName}</span>
                        {singleLabel.variantLabel && (
                          <span className="label-cell-variant">{singleLabel.variantLabel}</span>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize: '0.6rem' }}>
                        {`R${Math.floor(i / COLS) + 1} C${(i % COLS) + 1}`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="label-printer-subtitle">
                Printing <strong>{allLabels.length} label{allLabels.length !== 1 ? 's' : ''}</strong> across{' '}
                <strong>{totalSheets} sheet{totalSheets !== 1 ? 's' : ''}</strong> onto{' '}
                <strong>Avery L7160</strong> (3 × 7 = 21 labels per sheet).
              </p>

              <div className="label-bulk-summary">
                <Printer size={16} />
                <span>
                  {allLabels.length} labels → {totalSheets} sheet{totalSheets !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Page navigation */}
              {totalSheets > 1 && (
                <div className="label-sheet-pagination">
                  <button
                    disabled={previewPage === 0}
                    onClick={() => setPreviewPage((p) => p - 1)}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span>Sheet {previewPage + 1} of {totalSheets}</span>
                  <button
                    disabled={previewPage === totalSheets - 1}
                    onClick={() => setPreviewPage((p) => p + 1)}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}

              {/* Preview grid */}
              <div className="label-sheet-preview">
                {Array.from({ length: LABELS_PER_SHEET }, (_, i) => {
                  const label = pageLabels[i] || null;
                  return (
                    <div
                      key={i}
                      className={`label-cell ${label ? 'filled' : 'disabled'}`}
                    >
                      {label ? (
                        <>
                          <span className="label-cell-name">{label.productName}</span>
                          {label.variantLabel && (
                            <span className="label-cell-variant">{label.variantLabel}</span>
                          )}
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="label-printer-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handlePrint}
            disabled={mode === 'single' && selectedPosition === null}
          >
            <Printer size={16} />
            {mode === 'single' ? 'Print Label' : `Print ${allLabels.length} Labels`}
          </button>
        </div>
      </div>
    </div>
  );
}

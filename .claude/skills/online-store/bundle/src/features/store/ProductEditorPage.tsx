import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/layout/PageShell';
import { useData } from '@/context/DataContext';
import { useAlert } from '@/components/ui/AlertDialog';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { BarcodeLabelPrinter } from './BarcodeLabelPrinter';
import type { LabelData } from './BarcodeLabelPrinter';
import * as api from '@/lib/api';
import type {
  ProductType,
  Collection,
  ProductMedia as ProductMediaType,
  VariantOptionEntry,
  ProductReview,
} from '@/types/database';
import {
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  X,
  Image,
  Upload,
  GripVertical,
  Check,
  FileText,
  Printer,
} from 'lucide-react';
import './StorePage.css';

interface OptionGroupDraft {
  name: string;
  values: string[];
}

interface VariantDraft {
  option_values: VariantOptionEntry[];
  price_override: string;
  compare_at_price: string;
  sku: string;
  barcode: string;
  stock_quantity: string;
}

export function ProductEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state } = useData();
  const { showAlert, showConfirm } = useAlert();
  const isNew = !id;

  // ─── Product fields ─────────────────────────
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [productType, setProductType] = useState<ProductType>('physical');
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [continueSelling, setContinueSelling] = useState(false);
  const [stockQuantity, setStockQuantity] = useState('0');
  const [minStockThreshold, setMinStockThreshold] = useState('0');
  const [packQuantity, setPackQuantity] = useState('1');

  // ─── Associations ───────────────────────────
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [selectedCompatibilityIds, setSelectedCompatibilityIds] = useState<string[]>([]);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);

  // ─── Media ──────────────────────────────────
  const [images, setImages] = useState<ProductMediaType[]>([]);
  const [documents, setDocuments] = useState<ProductMediaType[]>([]);

  // ─── Options & Variants ────────────────────
  const [optionGroups, setOptionGroups] = useState<OptionGroupDraft[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [newOptionName, setNewOptionName] = useState('');
  const [selectedVariants, setSelectedVariants] = useState<Set<number>>(new Set());
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkCompareAt, setBulkCompareAt] = useState('');

  // ─── State ──────────────────────────────────
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [previewBarcode, setPreviewBarcode] = useState<string | null>(null);

  // ─── Label printer state ──────────────────
  const [labelPrinterOpen, setLabelPrinterOpen] = useState(false);
  const [labelPrinterMode, setLabelPrinterMode] = useState<'single' | 'bulk'>('single');
  const [labelPrinterData, setLabelPrinterData] = useState<{ single?: LabelData; bulk?: LabelData[] }>({});

  // ─── Load data ──────────────────────────────
  const loadProduct = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [product, labelIds, collectionIds, compatibilityIds, imageItems, docItems, options, existingVariants, collections, existingReviews] =
        await Promise.all([
          api.fetchProduct(id),
          api.fetchProductLabelIds(id),
          api.fetchProductCollectionIds(id),
          api.fetchProductCompatibilityIds(id),
          api.fetchProductImages(id),
          api.fetchProductDocuments(id),
          api.fetchProductOptions(id),
          api.fetchProductVariants(id),
          api.fetchCollections(),
          api.fetchProductReviews(id),
        ]);

      setName(product.name);
      setDescription(product.description || '');
      setProductType(product.product_type);
      setPrice(String(product.price));
      setCompareAtPrice(product.compare_at_price ? String(product.compare_at_price) : '');
      setSku(product.sku || '');
      setBarcode(product.barcode || '');
      setIsVisible(product.is_visible);
      setContinueSelling(product.continue_selling_when_out_of_stock ?? false);
      setStockQuantity(String(product.stock_quantity));
      setMinStockThreshold(String(product.min_stock_threshold));
      setPackQuantity(String(product.pack_quantity ?? 1));
      setSelectedLabelIds(labelIds);
      setSelectedCollectionIds(collectionIds);
      setSelectedCompatibilityIds(compatibilityIds);
      setAllCollections(collections);
      setImages(imageItems);
      setDocuments(docItems);

      // Convert options to draft format
      const drafts: OptionGroupDraft[] = options.map((g) => ({
        name: g.name,
        values: (g.values || []).map((v) => v.value),
      }));
      setOptionGroups(drafts);

      // Convert existing variants to draft format
      const varDrafts: VariantDraft[] = existingVariants.map((v) => ({
        option_values: v.option_values,
        price_override: v.price_override ? String(v.price_override) : '',
        compare_at_price: v.compare_at_price ? String(v.compare_at_price) : '',
        sku: v.sku || '',
        barcode: v.barcode || '',
        stock_quantity: String(v.stock_quantity),
      }));
      setVariants(varDrafts);
      setReviews(existingReviews);
    } catch (err) {
      console.error('Failed to load product:', err);
      showAlert({ title: 'Error', message: 'Failed to load product.', variant: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [id, showAlert]);

  useEffect(() => {
    if (isNew) {
      api.fetchCollections().then(setAllCollections).catch(console.error);
    } else {
      loadProduct();
    }
  }, [isNew, loadProduct]);

  // ─── Generate variant combinations ────────
  const generateVariants = useCallback((groups: OptionGroupDraft[]) => {
    const validGroups = groups.filter((g) => g.name.trim() && g.values.length > 0);
    if (validGroups.length === 0) {
      setVariants([]);
      return;
    }

    // Cartesian product
    const combos: VariantOptionEntry[][] = validGroups.reduce<VariantOptionEntry[][]>(
      (acc, group) => {
        const newCombos: VariantOptionEntry[][] = [];
        const groupValues = group.values.filter((v) => v.trim());
        for (const combo of acc) {
          for (const val of groupValues) {
            newCombos.push([
              ...combo,
              {
                group_id: '',
                group_name: group.name,
                value_id: '',
                value: val,
              },
            ]);
          }
        }
        return newCombos;
      },
      [[]]
    );

    // Preserve existing variant data where the combination matches
    const newVariants: VariantDraft[] = combos.map((combo) => {
      const label = combo.map((c) => `${c.group_name}:${c.value}`).join('|');
      const existing = variants.find((v) => {
        const existingLabel = v.option_values
          .map((ov) => `${ov.group_name}:${ov.value}`)
          .join('|');
        return existingLabel === label;
      });

      return existing || {
        option_values: combo,
        price_override: '',
        compare_at_price: '',
        sku: '',
        barcode: '',
        stock_quantity: '0',
      };
    });

    setVariants(newVariants);
  }, [variants]);

  // ─── Option group handlers ────────────────
  const addOptionGroup = () => {
    if (!newOptionName.trim()) return;
    const newGroups = [...optionGroups, { name: newOptionName.trim(), values: [] }];
    setOptionGroups(newGroups);
    setNewOptionName('');
  };

  const removeOptionGroup = (index: number) => {
    const newGroups = optionGroups.filter((_, i) => i !== index);
    setOptionGroups(newGroups);
    generateVariants(newGroups);
  };

  const addOptionValue = (groupIndex: number, value: string) => {
    if (!value.trim()) return;
    const newGroups = optionGroups.map((g, i) =>
      i === groupIndex ? { ...g, values: [...g.values, value.trim()] } : g
    );
    setOptionGroups(newGroups);
    generateVariants(newGroups);
  };

  const removeOptionValue = (groupIndex: number, valueIndex: number) => {
    const newGroups = optionGroups.map((g, i) =>
      i === groupIndex
        ? { ...g, values: g.values.filter((_, vi) => vi !== valueIndex) }
        : g
    );
    setOptionGroups(newGroups);
    generateVariants(newGroups);
  };

  // ─── Variant handlers ─────────────────────
  const updateVariant = (index: number, field: keyof VariantDraft, value: string) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  };

  // ─── Image upload ─────────────────────────
  const uploadToStorage = async (
    file: File,
    bucketName: string
  ): Promise<string> => {
    const { supabase } = await import('@/lib/supabase');
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `products/${id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(storagePath);

    return urlData.publicUrl;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !id) return;

    for (const file of Array.from(files)) {
      try {
        const publicUrl = await uploadToStorage(file, 'product-images');
        const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

        const newMedia = await api.addProductMedia({
          product_id: id,
          media_url: publicUrl,
          media_type: mediaType as 'image' | 'video',
          file_name: file.name,
          sort_order: images.length,
        });

        setImages((prev) => [...prev, newMedia]);
      } catch (err) {
        console.error('Image upload failed:', err);
      }
    }

    e.target.value = '';
  };

  // ─── Document upload ──────────────────────
  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !id) return;

    for (const file of Array.from(files)) {
      try {
        const publicUrl = await uploadToStorage(file, 'product-documents');

        const newMedia = await api.addProductMedia({
          product_id: id,
          media_url: publicUrl,
          media_type: 'document',
          file_name: file.name,
          sort_order: documents.length,
        });

        setDocuments((prev) => [...prev, newMedia]);
      } catch (err) {
        console.error('Document upload failed:', err);
      }
    }

    e.target.value = '';
  };

  const handleRemoveImage = async (mediaId: string) => {
    try {
      await api.deleteProductMedia(mediaId);
      setImages((prev) => prev.filter((m) => m.id !== mediaId));
    } catch (err) {
      console.error('Failed to remove image:', err);
    }
  };

  const handleRemoveDocument = async (mediaId: string) => {
    try {
      await api.deleteProductMedia(mediaId);
      setDocuments((prev) => prev.filter((m) => m.id !== mediaId));
    } catch (err) {
      console.error('Failed to remove document:', err);
    }
  };

  // ─── Save ─────────────────────────────────
  // ─── Multi-select variant helpers ─────────
  const toggleVariantSelected = (index: number) => {
    setSelectedVariants((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedVariants.size === variants.length) {
      setSelectedVariants(new Set());
    } else {
      setSelectedVariants(new Set(variants.map((_, i) => i)));
    }
  };

  const applyBulkPricing = () => {
    if (selectedVariants.size === 0) return;
    setVariants((prev) =>
      prev.map((v, i) => {
        if (!selectedVariants.has(i)) return v;
        return {
          ...v,
          ...(bulkPrice !== '' ? { price_override: bulkPrice } : {}),
          ...(bulkCompareAt !== '' ? { compare_at_price: bulkCompareAt } : {}),
        };
      })
    );
    setSelectedVariants(new Set());
    setBulkPrice('');
    setBulkCompareAt('');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert({ title: 'Missing Name', message: 'Please enter a product name.', variant: 'warning' });
      return;
    }

    const hasVariants = variants.length > 0;

    if (!hasVariants) {
      if (!price || isNaN(Number(price))) {
        showAlert({ title: 'Invalid Price', message: 'Please enter a valid price.', variant: 'warning' });
        return;
      }
    } else {
      const missingPrice = variants.some((v) => !v.price_override || isNaN(Number(v.price_override)));
      if (missingPrice) {
        showAlert({ title: 'Missing Variant Prices', message: 'Please enter a valid price for every variant.', variant: 'warning' });
        return;
      }
    }

    setSaving(true);
    try {
      const productData = {
        name: name.trim(),
        description: description.trim() || null,
        product_type: productType,
        price: Number(price),
        compare_at_price: compareAtPrice ? Number(compareAtPrice) : null,
        sku: sku.trim() || null,
        barcode: barcode.trim() || null,
        is_visible: isVisible,
        continue_selling_when_out_of_stock: continueSelling,
        stock_quantity: Number(stockQuantity) || 0,
        min_stock_threshold: Number(minStockThreshold) || 0,
        pack_quantity: Number(packQuantity) || 1,
      };

      let productId = id;

      if (isNew) {
        const created = await api.createProduct(productData as any);
        productId = created.id;
      } else {
        await api.updateProduct(id!, productData);
      }

      // Save associations
      await Promise.all([
        api.assignProductLabels(productId!, selectedLabelIds),
        api.assignProductCollections(productId!, selectedCollectionIds),
        api.assignProductCompatibilities(productId!, selectedCompatibilityIds),
      ]);

      // Save options & variants
      if (optionGroups.length > 0) {
        await api.saveProductOptions(
          productId!,
          optionGroups.filter((g) => g.name.trim() && g.values.length > 0)
        );

        const variantInserts = variants.map((v) => ({
          product_id: productId!,
          option_values: v.option_values,
          price_override: v.price_override ? Number(v.price_override) : null,
          compare_at_price: v.compare_at_price ? Number(v.compare_at_price) : null,
          sku: v.sku.trim() || null,
          barcode: v.barcode.trim() || null,
          stock_quantity: Number(v.stock_quantity) || 0,
        }));

        await api.saveProductVariants(productId!, variantInserts);
      }

      showAlert({ title: 'Saved', message: 'Product saved successfully.', variant: 'success' });
      navigate('/store');
    } catch (err) {
      console.error('Failed to save product:', err);
      showAlert({ title: 'Error', message: 'Failed to save product.', variant: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const openLabelPrinter = (pMode: 'single' | 'bulk', label?: LabelData, labels?: LabelData[]) => {
    setLabelPrinterMode(pMode);
    setLabelPrinterData({ single: label, bulk: labels });
    setLabelPrinterOpen(true);
  };

  const handlePrintAllLabels = () => {
    const labels: LabelData[] = [];
    if (variants.length > 0) {
      for (const v of variants) {
        const bc = v.barcode?.trim();
        if (!bc) continue;
        labels.push({
          barcode: bc,
          productName: name,
          variantLabel: v.option_values.map((o) => o.value).join(' / '),
        });
      }
    } else if (barcode.trim()) {
      labels.push({ barcode: barcode.trim(), productName: name });
    }
    if (labels.length === 0) return;
    openLabelPrinter('bulk', undefined, labels);
  };

  // ─── Delete ───────────────────────────────
  const handleDelete = async () => {
    if (!id) return;
    const ok = await showConfirm({
      title: 'Delete Product',
      message: 'Are you sure you want to delete this product? This cannot be undone.',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await api.deleteProduct(id);
      navigate('/store');
    } catch (err) {
      console.error('Failed to delete product:', err);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    const ok = await showConfirm({
      title: 'Delete Review',
      message: 'Are you sure you want to delete this review?',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await api.deleteProductReview(reviewId);
      setReviews(prev => prev.filter(r => r.id !== reviewId));
      showAlert({ title: 'Deleted', message: 'Review deleted successfully.', variant: 'success' });
    } catch (err) {
      console.error(err);
      showAlert({ title: 'Error', message: 'Failed to delete review.', variant: 'danger' });
    }
  };

  const handleUpdateReviewStatus = async (reviewId: string, status: 'approved' | 'rejected' | 'pending') => {
    try {
      await api.updateProductReviewStatus(reviewId, status);
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, status } : r));
      showAlert({ title: 'Updated', message: `Review marked as ${status}.`, variant: 'success' });
    } catch (err) {
      console.error(err);
      showAlert({ title: 'Error', message: 'Failed to update review.', variant: 'danger' });
    }
  };

  if (loading) {
    return (
      <PageShell title="Online Store" subtitle="Loading product...">
        <div className="store-loading">Loading...</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Online Store"
      subtitle={isNew ? 'Create a new product' : `Editing: ${name}`}
    >
      <div className="product-editor-header">
        <button className="btn btn-ghost" onClick={() => navigate('/store')}>
          <ArrowLeft size={16} /> Back to Products
        </button>
        <div className="product-editor-header-actions">
          {!isNew && (
            <button className="btn btn-danger" onClick={handleDelete}>
              <Trash2 size={16} /> Delete
            </button>
          )}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save Product'}
          </button>
        </div>
      </div>

      <div className="product-editor-grid">
        {/* Left column — main content */}
        <div className="product-editor-main">
          {/* Basic Info */}
          <div className="editor-card">
            <h3 className="editor-card-title">Basic Information</h3>
            <div className="form-group">
              <label className="form-label">Product Name</label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Fiber Laser 50W"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-input form-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this product..."
                rows={4}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Product Type</label>
              <div className="radio-group">
                <label className={`radio-option ${productType === 'physical' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="productType"
                    value="physical"
                    checked={productType === 'physical'}
                    onChange={() => setProductType('physical')}
                  />
                  <span>Physical</span>
                </label>
                <label className={`radio-option ${productType === 'digital' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="productType"
                    value="digital"
                    checked={productType === 'digital'}
                    onChange={() => setProductType('digital')}
                  />
                  <span>Digital</span>
                </label>
              </div>
            </div>
          </div>

          {/* Pricing — only for single products (no variants) */}
          {variants.length === 0 && (
            <div className="editor-card">
              <h3 className="editor-card-title">Pricing</h3>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Price (£)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Compare at Price (£)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={compareAtPrice}
                    onChange={(e) => setCompareAtPrice(e.target.value)}
                    placeholder="Original price if on sale"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="media-cards-grid">
          {/* Product Images */}
          <div className="editor-card">
            <h3 className="editor-card-title">Product Images</h3>
            <p className="form-hint">Images shown on your storefront. The first image is the hero.</p>
            {images.length > 0 && (
              <div className="media-gallery">
                {images.map((m, idx) => (
                  <div key={m.id} className="media-item">
                    {m.media_type === 'video' ? (
                      <div className="media-file-icon">
                        <Image size={24} />
                        <span>{m.file_name || 'Video'}</span>
                      </div>
                    ) : (
                      <img src={m.media_url} alt={m.file_name || `Image ${idx + 1}`} />
                    )}
                    <button
                      className="media-remove-btn"
                      onClick={() => handleRemoveImage(m.id)}
                    >
                      <X size={14} />
                    </button>
                    {idx === 0 && <span className="media-hero-badge">Hero</span>}
                  </div>
                ))}
              </div>
            )}
            {!isNew ? (
              <label className="media-upload-btn">
                <Upload size={16} />
                <span>Upload Images</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
              </label>
            ) : (
              <p className="form-hint">Save the product first, then you can upload images.</p>
            )}
          </div>

          {/* Related Documents */}
          <div className="editor-card">
            <h3 className="editor-card-title">Related Documents</h3>
            <p className="form-hint">Spec sheets, manuals, certificates — downloadable by customers.</p>
            {documents.length > 0 && (
              <div className="documents-list">
                {documents.map((doc) => (
                  <div key={doc.id} className="document-row">
                    <FileText size={18} className="document-row-icon" />
                    <a
                      href={doc.media_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="document-row-name"
                    >
                      {doc.file_name || 'Untitled document'}
                    </a>
                    <button
                      className="btn btn-ghost btn-icon-sm"
                      onClick={() => handleRemoveDocument(doc.id)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!isNew ? (
              <label className="media-upload-btn">
                <Upload size={16} />
                <span>Upload Documents</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  onChange={handleDocumentUpload}
                  style={{ display: 'none' }}
                />
              </label>
            ) : (
              <p className="form-hint">Save the product first, then you can upload documents.</p>
            )}
          </div>
          </div>

          {/* Options & Variants */}
          <div className="editor-card">
            <h3 className="editor-card-title">Options & Variants</h3>
            <p className="form-hint">
              Add options like Size or Colour. Variant combinations will be generated automatically.
            </p>

            {/* Existing option groups */}
            {optionGroups.map((group, gi) => (
              <OptionGroupEditor
                key={gi}
                group={group}
                onAddValue={(val) => addOptionValue(gi, val)}
                onRemoveValue={(vi) => removeOptionValue(gi, vi)}
                onRemoveGroup={() => removeOptionGroup(gi)}
              />
            ))}

            {/* Add new option group */}
            <div className="option-add-row">
              <input
                type="text"
                className="form-input"
                placeholder="Option name (e.g. Size, Colour)"
                value={newOptionName}
                onChange={(e) => setNewOptionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addOptionGroup();
                }}
              />
              <button
                className="btn btn-secondary"
                onClick={addOptionGroup}
                disabled={!newOptionName.trim()}
              >
                <Plus size={14} /> Add Option
              </button>
            </div>

            {/* Variant table */}
            {variants.length > 0 && (
              <div className="variants-section">
                <div className="variants-header-row">
                  <h4>Variants ({variants.length})</h4>
                  {variants.some(v => v.barcode?.trim()) && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrintAllLabels}>
                      <Printer size={14} /> Print All Labels
                    </button>
                  )}
                </div>

                {/* Multi-select action bar */}
                {selectedVariants.size > 0 && (
                  <div className="variant-action-bar">
                    <span className="variant-action-bar-label">
                      {selectedVariants.size} selected
                    </span>
                    <div className="variant-action-bar-fields">
                      <label>Price £</label>
                      <input
                        type="number"
                        className="form-input form-input-sm"
                        value={bulkPrice}
                        onChange={(e) => setBulkPrice(e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                      <label>Compare at £</label>
                      <input
                        type="number"
                        className="form-input form-input-sm"
                        value={bulkCompareAt}
                        onChange={(e) => setBulkCompareAt(e.target.value)}
                        placeholder="—"
                        step="0.01"
                        min="0"
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={applyBulkPricing}
                        disabled={bulkPrice === '' && bulkCompareAt === ''}
                      >
                        <Check size={12} /> Apply
                      </button>
                    </div>
                  </div>
                )}

                <div className="products-table-wrap">
                  <table className="products-table variants-table">
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            className="variant-checkbox"
                            checked={selectedVariants.size === variants.length && variants.length > 0}
                            onChange={toggleSelectAll}
                          />
                        </th>
                        <th>Combination</th>
                        <th>Price (£)</th>
                        <th>Compare at (£)</th>
                        <th>SKU</th>
                        <th>Barcode</th>
                        <th>Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((v, vi) => (
                        <tr key={vi} className="variants-table-row" style={selectedVariants.has(vi) ? { background: 'var(--color-primary-subtle)' } : undefined}>
                          <td data-label="Select">
                            <input
                              type="checkbox"
                              className="variant-checkbox"
                              checked={selectedVariants.has(vi)}
                              onChange={() => toggleVariantSelected(vi)}
                            />
                          </td>
                          <td data-label="Combination">
                            <span className="variant-combo-cell">
                              <GripVertical size={14} className="grip-icon" />
                              {v.option_values.map((ov) => ov.value).join(' / ')}
                            </span>
                          </td>
                          <td data-label="Price (£)">
                            <input
                              type="number"
                              className="form-input form-input-sm"
                              style={{ width: '80px' }}
                              value={v.price_override}
                              onChange={(e) => updateVariant(vi, 'price_override', e.target.value)}
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                            />
                          </td>
                          <td data-label="Compare at (£)">
                            <input
                              type="number"
                              className="form-input form-input-sm"
                              style={{ width: '80px' }}
                              value={v.compare_at_price}
                              onChange={(e) => updateVariant(vi, 'compare_at_price', e.target.value)}
                              placeholder="—"
                              step="0.01"
                              min="0"
                            />
                          </td>
                          <td data-label="SKU">
                            <input
                              type="text"
                              className="form-input form-input-sm"
                              style={{ width: '90px' }}
                              value={v.sku}
                              onChange={(e) => updateVariant(vi, 'sku', e.target.value)}
                              placeholder="SKU"
                            />
                          </td>
                          <td data-label="Barcode">
                            {!v.barcode ? (
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <input
                                  type="text"
                                  className="form-input form-input-sm"
                                  style={{ width: '100px' }}
                                  value={v.barcode}
                                  onChange={(e) => updateVariant(vi, 'barcode', e.target.value)}
                                  placeholder="Barcode"
                                />
                                <button type="button" className="btn btn-secondary btn-icon-sm" onClick={() => updateVariant(vi, 'barcode', 'ISO-' + Math.random().toString(36).substr(2, 8).toUpperCase())} title="Generate Barcode">
                                  ✨
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: '0.25rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.375rem', width: '100%' }}>
                                <div 
                                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 0, cursor: 'zoom-in', padding: '4px 0' }}
                                  onClick={() => setPreviewBarcode(v.barcode)}
                                >
                                  <img 
                                    src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(v.barcode)}&scale=2&height=8`} 
                                    alt="Preview" 
                                    style={{ height: 28, mixBlendMode: 'multiply' }} 
                                  />
                                  <div style={{ marginTop: '4px', fontFamily: 'monospace', fontSize: '10px', letterSpacing: '1px', fontWeight: 500, color: '#000' }}>
                                    {v.barcode}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px', borderLeft: '1px solid #e2e8f0', paddingLeft: '8px', flexShrink: 0 }}>
                                  <button type="button" className="btn btn-ghost btn-icon-sm" style={{ padding: '2px', color: 'var(--color-danger)' }} onClick={() => updateVariant(vi, 'barcode', '')} title="Clear barcode">
                                    <Trash2 size={15} />
                                  </button>
                                  <button type="button" className="btn btn-ghost btn-icon-sm" style={{ padding: '2px' }} onClick={() => openLabelPrinter('single', { barcode: v.barcode, productName: name, variantLabel: v.option_values.map(o => o.value).join(' / ') })} title="Print Label">
                                    <Printer size={15} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                          <td data-label="Stock">
                            <input
                              type="number"
                              className="form-input form-input-sm"
                              style={{ width: '70px' }}
                              value={v.stock_quantity}
                              onChange={(e) => updateVariant(vi, 'stock_quantity', e.target.value)}
                              min="0"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Customer Reviews Admin */}
          {!isNew && (
            <div className="editor-card">
              <h3 className="editor-card-title">Customer Reviews</h3>
              <p className="form-hint">Manage reviews left by customers on the storefront.</p>
              {reviews.length === 0 ? (
                <p className="form-hint" style={{ marginTop: '1rem' }}>No reviews yet.</p>
              ) : (
                <div className="products-table-wrap" style={{ marginTop: '1rem' }}>
                  <table className="products-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Author</th>
                        <th>Rating</th>
                        <th>Status</th>
                        <th>Review</th>
                        <th style={{ width: '120px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviews.map((r) => (
                        <tr key={r.id}>
                          <td>{new Date(r.created_at).toLocaleDateString()}</td>
                          <td>{r.author_name}</td>
                          <td>
                            <div style={{ display: 'flex', color: '#fbbf24' }}>
                              {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                            </div>
                          </td>
                          <td>
                            <SearchableSelect
                              className="form-input form-input-sm"
                              value={r.status}
                              onChange={(val) => handleUpdateReviewStatus(r.id, val as any)}
                              searchable={false}
                              sort={false}
                              style={{ 
                                borderColor: r.status === 'approved' ? '#86efac' : r.status === 'rejected' ? '#fca5a5' : '#fcd34d',
                                backgroundColor: r.status === 'approved' ? '#f0fdf4' : r.status === 'rejected' ? '#fef2f2' : '#fffbeb'
                              }}
                              options={[
                                { label: 'Pending', value: 'pending' },
                                { label: 'Approved', value: 'approved' },
                                { label: 'Rejected', value: 'rejected' },
                              ]}
                            />
                          </td>
                          <td style={{ maxWidth: '300px', whiteSpace: 'normal', fontSize: '0.875rem', lineHeight: 1.4, color: 'var(--color-text-secondary)' }}>
                            {r.content}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn-ghost btn-icon-sm danger" onClick={() => handleDeleteReview(r.id)} title="Delete Review">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column — sidebar */}
        <div className="product-editor-sidebar">
          {/* Visibility */}
          <div className="editor-card">
            <h3 className="editor-card-title">Visibility</h3>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={isVisible}
                onChange={(e) => setIsVisible(e.target.checked)}
              />
              <span>Show on store</span>
            </label>
            <label className="toggle-row" style={{ marginTop: 8 }}>
              <input
                type="checkbox"
                checked={continueSelling}
                onChange={(e) => setContinueSelling(e.target.checked)}
              />
              <span>Continue selling when out of stock</span>
            </label>
          </div>

          {/* Inventory */}
          <div className="editor-card">
            <h3 className="editor-card-title">Inventory</h3>
            <div className="form-group">
              <label className="form-label">SKU</label>
              <input
                type="text"
                className="form-input"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Stock keeping unit"
              />
            </div>
            {variants.length === 0 && (
              <>
                <div className="form-group">
                  <label className="form-label">Barcode</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        placeholder="Barcode"
                        style={{ flex: 1 }}
                      />
                      <button type="button" className="btn btn-secondary" onClick={() => setBarcode('ISO-' + Math.random().toString(36).substr(2, 8).toUpperCase())}>
                        ✨ Generate
                      </button>
                    </div>
                    {barcode && (
                      <div style={{ 
                        padding: '1rem', 
                        background: '#fff', 
                        borderRadius: '0.5rem', 
                        border: '1px solid #e2e8f0', 
                        display: 'flex', 
                        flexDirection: 'column',
                        justifyContent: 'center', 
                        alignItems: 'center',
                        gap: '0.75rem',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}>
                        <div 
                          style={{ cursor: 'zoom-in', textAlign: 'center' }} 
                          onClick={() => setPreviewBarcode(barcode)}
                        >
                          <img 
                            src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(barcode)}&scale=2&height=12`} 
                            alt="Preview" 
                            style={{ height: 48, mixBlendMode: 'multiply' }} 
                          />
                          <div style={{ marginTop: '8px', fontFamily: 'monospace', fontSize: '14px', letterSpacing: '2px', fontWeight: 500, color: '#000' }}>
                            {barcode}
                          </div>
                        </div>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openLabelPrinter('single', { barcode, productName: name })}>
                          <Printer size={14} /> Print Label
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Stock Quantity</label>
                  <input
                    type="number"
                    className="form-input"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    min="0"
                  />
                </div>
              </>
            )}
            <div className="form-group">
              <label className="form-label">Min. Stock Alert Threshold</label>
              <input
                type="number"
                className="form-input"
                value={minStockThreshold}
                onChange={(e) => setMinStockThreshold(e.target.value)}
                min="0"
              />
              <span className="form-hint">You'll be alerted when stock falls below this.</span>
            </div>
            <div className="form-group">
              <label className="form-label">Selling Quantity</label>
              <div className="radio-group">
                <label className={`radio-option ${packQuantity === '1' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="packType"
                    value="single"
                    checked={packQuantity === '1'}
                    onChange={() => setPackQuantity('1')}
                  />
                  <span>Single</span>
                </label>
                <label className={`radio-option ${packQuantity !== '1' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="packType"
                    value="multi"
                    checked={packQuantity !== '1'}
                    onChange={() => setPackQuantity('2')}
                  />
                  <span>Multi-pack</span>
                </label>
              </div>
              {packQuantity !== '1' && (
                <div style={{ marginTop: 12 }}>
                  <label className="form-label">Items Per Pack</label>
                  <input
                    type="number"
                    className="form-input"
                    value={packQuantity}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPackQuantity(String(val < 2 ? 2 : val));
                    }}
                    min="2"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Labels */}
          <div className="editor-card">
            <h3 className="editor-card-title">Labels</h3>
            {state.productLabels.length === 0 ? (
              <p className="form-hint">No labels yet. Add them in Settings.</p>
            ) : (
              <div className="checkbox-list">
                {state.productLabels.map((label) => (
                  <label key={label.id} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={selectedLabelIds.includes(label.id)}
                      onChange={() => {
                        setSelectedLabelIds((prev) =>
                          prev.includes(label.id)
                            ? prev.filter((id) => id !== label.id)
                            : [...prev, label.id]
                        );
                      }}
                    />
                    <span
                      className="label-color-dot"
                      style={{ backgroundColor: label.color || '#6b7280' }}
                    />
                    <span>{label.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Collections */}
          <div className="editor-card">
            <h3 className="editor-card-title">Collections</h3>
            {allCollections.length === 0 ? (
              <p className="form-hint">No collections yet. Create them in the Collections tab.</p>
            ) : (
              <div className="checkbox-list">
                {allCollections.map((col) => (
                  <label key={col.id} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={selectedCollectionIds.includes(col.id)}
                      onChange={() => {
                        setSelectedCollectionIds((prev) =>
                          prev.includes(col.id)
                            ? prev.filter((id) => id !== col.id)
                            : [...prev, col.id]
                        );
                      }}
                    />
                    <span>{col.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Compatible With */}
          <div className="editor-card">
            <h3 className="editor-card-title">Compatible With</h3>
            {state.compatibilityTypes.length === 0 ? (
              <p className="form-hint">No compatibility types yet. Add them in Settings.</p>
            ) : (
              <div className="checkbox-list">
                {state.compatibilityTypes.map((ct) => (
                  <label key={ct.id} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={selectedCompatibilityIds.includes(ct.id)}
                      onChange={() => {
                        setSelectedCompatibilityIds((prev) =>
                          prev.includes(ct.id)
                            ? prev.filter((id) => id !== ct.id)
                            : [...prev, ct.id]
                        );
                      }}
                    />
                    <span>{ct.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {previewBarcode && (
          <div 
            style={{ 
              position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
              animation: 'fadeIn 0.2s ease'
            }}
            onClick={() => setPreviewBarcode(null)}
          >
            <div 
              style={{ background: '#fff', padding: '2.5rem', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 1.5rem', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Barcode Preview</h3>
              <img 
                src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(previewBarcode)}&scale=4&height=16`} 
                alt="Barcode" 
                style={{ height: 100, mixBlendMode: 'multiply' }} 
              />
              <div style={{ marginTop: '1.25rem', fontFamily: 'monospace', fontSize: '24px', letterSpacing: '4px', fontWeight: 500, color: '#000' }}>
                {previewBarcode}
              </div>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ marginTop: '2rem', width: '100%' }}
                onClick={() => setPreviewBarcode(null)}
              >
                Close Preview
              </button>
            </div>
          </div>
        )}

        {/* Label Printer Modal */}
        <BarcodeLabelPrinter
          open={labelPrinterOpen}
          onClose={() => setLabelPrinterOpen(false)}
          mode={labelPrinterMode}
          singleLabel={labelPrinterData.single}
          bulkLabels={labelPrinterData.bulk}
        />
      </div>
    </PageShell>
  );
}

// ─── Sub-component: Option Group Editor ─────────────────────

function OptionGroupEditor({
  group,
  onAddValue,
  onRemoveValue,
  onRemoveGroup,
}: {
  group: OptionGroupDraft;
  onAddValue: (value: string) => void;
  onRemoveValue: (index: number) => void;
  onRemoveGroup: () => void;
}) {
  const [newValue, setNewValue] = useState('');

  return (
    <div className="option-group">
      <div className="option-group-header">
        <h4>{group.name}</h4>
        <button className="row-action-btn danger" onClick={onRemoveGroup} title="Remove option">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="option-values">
        {group.values.map((val, vi) => (
          <span key={vi} className="option-value-tag">
            {val}
            <button onClick={() => onRemoveValue(vi)}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="option-add-value">
        <input
          type="text"
          className="form-input form-input-sm"
          placeholder={`Add ${group.name} value...`}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newValue.trim()) {
              onAddValue(newValue);
              setNewValue('');
            }
          }}
        />
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (newValue.trim()) {
              onAddValue(newValue);
              setNewValue('');
            }
          }}
          disabled={!newValue.trim()}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

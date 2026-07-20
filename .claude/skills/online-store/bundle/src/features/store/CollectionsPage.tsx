import { useState, useEffect } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { StoreTabBar } from './StoreTabBar';
import { useAlert } from '@/components/ui/AlertDialog';
import * as api from '@/lib/api';
import type { Collection } from '@/types/database';
import { Plus, Pencil, Trash2, X, Check, FolderOpen, Package, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import './StorePage.css';

export function CollectionsPage() {
  const { showAlert, showConfirm } = useAlert();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newImage, setNewImage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editImage, setEditImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `collection_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('store-assets').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('store-assets').getPublicUrl(fileName);
      
      if (isEdit) {
        setEditImage(publicUrl);
      } else {
        setNewImage(publicUrl);
      }
    } catch (err) {
      console.error('Image upload failed:', err);
      showAlert({ title: 'Error', message: 'Failed to upload image.', variant: 'danger' });
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    setLoading(true);
    try {
      const data = await api.fetchCollections();
      setCollections(data);
    } catch (err) {
      console.error('Failed to load collections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      const item = await api.createCollection({
        name: newName.trim(),
        description: newDesc.trim() || null,
        cover_image_url: newImage,
        sort_order: collections.length,
        slug: null,
      });
      setCollections((prev) => [...prev, item]);
      setNewName('');
      setNewDesc('');
      setNewImage(null);
      setShowAdd(false);
    } catch (err) {
      showAlert({
        title: 'Error',
        message: 'Failed to create collection.',
        variant: 'danger',
      });
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editName.trim() || saving) return;
    setSaving(true);
    try {
      const updated = await api.updateCollection(id, {
        name: editName.trim(),
        description: editDesc.trim() || null,
        cover_image_url: editImage,
      });
      setCollections((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updated } : c))
      );
      setEditingId(null);
    } catch (err) {
      console.error('Failed to update collection:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await showConfirm({
      title: 'Delete Collection',
      message: 'Delete this collection? Products in this collection will not be deleted.',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await api.deleteCollection(id);
      setCollections((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error('Failed to delete collection:', err);
    }
  };

  const startEdit = (c: Collection) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditDesc(c.description || '');
    setEditImage(c.cover_image_url);
  };

  return (
    <PageShell
      title="Online Store"
      subtitle="Manage your ecommerce products, categories, and storefront."
    >
      <StoreTabBar />

      <div className="store-toolbar">
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
          <Plus size={16} />
          Add Collection
        </button>
      </div>

      {showAdd && (
        <div className="collection-add-form">
          <input
            type="text"
            className="form-input"
            placeholder="Collection name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') setShowAdd(false);
            }}
            autoFocus
          />
          <input
            type="text"
            className="form-input"
            placeholder="Description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') setShowAdd(false);
            }}
          />
          <div className="collection-image-upload" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {newImage && <img src={newImage} alt="Preview" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: '4px' }} />}
            <label className="btn btn-secondary btn-sm" style={{ cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
              <Upload size={14} style={{ marginRight: 6 }} />
              {uploading ? 'Uploading...' : (newImage ? 'Change Image' : 'Upload Cover Image')}
              <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, false)} style={{ display: 'none' }} disabled={uploading} />
            </label>
            {newImage && (
              <button className="btn btn-ghost btn-icon-sm danger" onClick={() => setNewImage(null)} title="Remove image">
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div className="collection-add-actions">
            <button className="btn btn-primary" onClick={handleAdd} disabled={!newName.trim() || saving}>
              <Check size={14} /> Save
            </button>
            <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="store-loading">Loading collections...</div>
      ) : collections.length === 0 ? (
        <div className="store-empty">
          <FolderOpen size={48} />
          <h3>No collections yet</h3>
          <p>Collections let you group products together (e.g. "Laser Machines", "Accessories", "Sale Items").</p>
        </div>
      ) : (
        <div className="collections-grid">
          {collections.map((c) => (
            <div key={c.id} className="collection-card">
              {editingId === c.id ? (
                <div className="collection-edit-form">
                  <input
                    type="text"
                    className="form-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleEdit(c.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Description"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleEdit(c.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <div className="collection-image-upload" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {editImage && <img src={editImage} alt="Preview" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: '4px' }} />}
                    <label className="btn btn-secondary btn-sm" style={{ cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
                      <Upload size={14} style={{ marginRight: 6 }} />
                      {uploading ? 'Uploading...' : (editImage ? 'Change Image' : 'Upload Cover Image')}
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, true)} style={{ display: 'none' }} disabled={uploading} />
                    </label>
                    {editImage && (
                      <button className="btn btn-ghost btn-icon-sm danger" onClick={() => setEditImage(null)} title="Remove image">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="collection-add-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => handleEdit(c.id)}>
                      <Check size={14} />
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="collection-card-icon" style={{ padding: 0, overflow: 'hidden', backgroundColor: 'var(--surface-50)' }}>
                    {c.cover_image_url ? (
                      <img src={c.cover_image_url} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <FolderOpen size={24} />
                    )}
                  </div>
                  <div className="collection-card-info">
                    <h4>{c.name}</h4>
                    {c.description && <p>{c.description}</p>}
                    <span className="collection-product-count">
                      <Package size={12} />
                      {c.product_count ?? 0} product{(c.product_count ?? 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="collection-card-actions">
                    <button
                      className="row-action-btn"
                      title="Edit"
                      onClick={() => startEdit(c)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="row-action-btn danger"
                      title="Delete"
                      onClick={() => handleDelete(c.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}

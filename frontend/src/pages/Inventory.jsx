import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { Package, X } from 'lucide-react';
import TableScroll from '../components/TableScroll';
import { SUPPORT_CATEGORIES, supportCategoryLabel } from '../supportCategories';

const emptyEditForm = {
  name: '',
  price: '',
  cout_unitaire: '',
  unit: '',
  tva_rate: '',
  is_government_supported: false,
  support_category: '',
};

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const { isAdmin } = useAuth();

  const loadProducts = async () => {
    const response = await api.get('/products');
    setProducts(response.data);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const openEditModal = (product) => {
    setError('');
    setEditError('');
    setEditingProduct(product);
    setEditForm({
      name: product.name ?? '',
      price: product.price ?? '',
      cout_unitaire: product.cout_unitaire ?? '',
      unit: product.unit ?? '',
      tva_rate: product.tva_rate ?? '',
      is_government_supported: Boolean(product.is_government_supported),
      support_category: product.support_category ?? '',
    });
  };

  const closeEditModal = () => {
    setEditingProduct(null);
    setEditForm(emptyEditForm);
    setEditError('');
    setSavingEdit(false);
  };

  const handleEditChange = (event) => {
    const { checked, name, type, value } = event.target;
    setEditForm((current) => {
      if (name === 'is_government_supported' && !checked) {
        return { ...current, is_government_supported: false, support_category: '' };
      }
      return { ...current, [name]: type === 'checkbox' ? checked : value };
    });
  };

  const nullableNumber = (value) => (value === '' ? null : Number(value));

  const handleSaveEdit = async (event) => {
    event.preventDefault();
    if (!editingProduct) return;

    try {
      setSavingEdit(true);
      setEditError('');
      await api.put(`/products/${editingProduct.id}`, {
        name: editForm.name.trim(),
        price: Number(editForm.price),
        cout_unitaire: nullableNumber(editForm.cout_unitaire),
        unit: editForm.unit.trim() || 'unité',
        tva_rate: nullableNumber(editForm.tva_rate) ?? 0,
        is_government_supported: editForm.is_government_supported,
        support_category: editForm.is_government_supported ? editForm.support_category : null,
      });
      await loadProducts();
      closeEditModal();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Échec de la modification');
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Package size={26} />
        Inventaire
      </h1>

      <h3>Produits actuels</h3>
      {error && <p className="badge badge-danger">{error}</p>}
      <input
        className="form-input"
        placeholder="Rechercher un produit..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: '1rem', padding: '0.4rem', width: '250px' }}
      />

      <TableScroll>
      <table className="data-table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Prix (TTC)</th>
            <th>Coût unitaire</th>
            <th>Stock</th>
            <th>Unité</th>
            <th>TVA (%)</th>
            <th>Contrôle</th>
            {isAdmin && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {filteredProducts.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.price} DT</td>
              <td>{p.cout_unitaire !== null && p.cout_unitaire !== undefined ? `${p.cout_unitaire} DT` : '-'}</td>
              <td>{p.stock_quantity}</td>
              <td>{p.unit}</td>
              <td>{p.tva_rate}%</td>
              <td>
                {p.is_government_supported ? (
                  <span className="badge badge-warning">{supportCategoryLabel(p.support_category)}</span>
                ) : (
                  <span className="badge badge-neutral">Normal</span>
                )}
              </td>
              {isAdmin && (
                <td>
                  <button className="btn btn-secondary" onClick={() => openEditModal(p)}>
                    Modifier
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </TableScroll>

      {editingProduct && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-title-row" style={{ marginBottom: '1rem' }}>
              <h3>Modifier le produit</h3>
              <button className="icon-button" type="button" onClick={closeEditModal} aria-label="Fermer">
                <X size={18} />
              </button>
            </div>

            <form className="responsive-form" onSubmit={handleSaveEdit}>
              <label>
                Nom
                <input
                  className="form-input"
                  name="name"
                  value={editForm.name}
                  onChange={handleEditChange}
                  required
                />
              </label>

              <label>
                Prix (TTC)
                <input
                  className="form-input"
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.price}
                  onChange={handleEditChange}
                  required
                />
              </label>

              <label>
                Coût unitaire
                <input
                  className="form-input"
                  name="cout_unitaire"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.cout_unitaire}
                  onChange={handleEditChange}
                />
              </label>

              <label>
                Stock
                <span className="form-input" style={{ display: 'block', background: '#FAFAFB' }}>
                  {editingProduct.stock_quantity}
                </span>
                <span style={{ display: 'block', marginTop: '0.3rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  Use Stock Correction to adjust quantity.
                </span>
              </label>

              <label>
                Unité
                <input
                  className="form-input"
                  name="unit"
                  value={editForm.unit}
                  onChange={handleEditChange}
                />
              </label>

              <label>
                TVA (%)
                <input
                  className="form-input"
                  name="tva_rate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.tva_rate}
                  onChange={handleEditChange}
                />
              </label>

              <label className="checkbox-row">
                <input
                  name="is_government_supported"
                  type="checkbox"
                  checked={editForm.is_government_supported}
                  onChange={handleEditChange}
                />
                Produit contrôlé/subventionné
              </label>

              {editForm.is_government_supported && (
                <label>
                  Catégorie contrôlée
                  <select
                    className="form-input"
                    name="support_category"
                    value={editForm.support_category}
                    onChange={handleEditChange}
                    required
                  >
                    <option value="">-- Choisir une catégorie --</option>
                    {SUPPORT_CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {editError && <p className="badge badge-danger">{editError}</p>}

              <div className="modal-actions" style={{ marginTop: '0.5rem' }}>
                <button className="btn btn-primary" type="submit" disabled={savingEdit}>
                  {savingEdit ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button className="btn btn-secondary" type="button" onClick={closeEditModal}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

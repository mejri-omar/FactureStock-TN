import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { Truck } from 'lucide-react';
import TableScroll from '../components/TableScroll';
import { SUPPORT_CATEGORIES } from '../supportCategories';

export default function Deliveries() {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [upcomingCheques, setUpcomingCheques] = useState([]);


  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [deliveryCart, setDeliveryCart] = useState([]);
  const [productEntryMode, setProductEntryMode] = useState('existing');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductTvaRate, setNewProductTvaRate] = useState('');
  const [newProductUnit, setNewProductUnit] = useState('unité');
  const [newProductSupported, setNewProductSupported] = useState(false);
  const [newProductSupportCategory, setNewProductSupportCategory] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState('');

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const { isAdmin } = useAuth();

  const loadData = useCallback(async () => {
    try {
      const requests = [
        api.get('/suppliers'),
        api.get('/products'),
        api.get('/purchase-orders'),
      ];

      if (isAdmin) {
        requests.push(api.get('/purchase-orders/upcoming-cheques'));
      }

      const results = await Promise.all(requests);
      setSuppliers(results[0].data);
      setProducts(results[1].data);
      setPurchaseOrders(results[2].data);

      if (isAdmin && results[3]) {
        setUpcomingCheques(results[3].data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Échec de chargement des données');
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);


  const handleAddItemToDelivery = async () => {
    if (quantity <= 0 || unitCost === '') return;

    let product;

    if (productEntryMode === 'new') {
      if (!newProductName.trim() || newProductPrice === '') return;

      setError('');
      try {
        const response = await api.post('/products', {
          name: newProductName.trim(),
          price: parseFloat(newProductPrice),
          stock_quantity: 0,
          unit: newProductUnit,
          tva_rate: newProductTvaRate === '' ? 0 : parseFloat(newProductTvaRate),
          is_government_supported: newProductSupported,
          support_category: newProductSupported ? newProductSupportCategory : null,
        });

        product = response.data;
        setProducts((currentProducts) => [...currentProducts, product]);
        setNewProductName('');
        setNewProductPrice('');
        setNewProductTvaRate('');
        setNewProductUnit('unité');
        setNewProductSupported(false);
        setNewProductSupportCategory('');
        setProductEntryMode('existing');
      } catch (err) {
        setError(err.response?.data?.error || "Échec de l'ajout du produit");
        return;
      }
    } else {
      if (!selectedProductId) return;
      product = products.find((p) => p.id === parseInt(selectedProductId));
    }

    if (!product) return;

    setDeliveryCart((currentCart) => [
      ...currentCart,
      {
        product_id: product.id,
        name: product.name,
        quantity: parseInt(quantity),
        unit_cost: parseFloat(unitCost),
      },
    ]);
    setSelectedProductId('');
    setQuantity(1);
    setUnitCost('');
  };

  const handleRemoveItem = (productId) => {
    setDeliveryCart(deliveryCart.filter((item) => item.product_id !== productId));
  };

  const handleSubmitDelivery = async () => {
    setError('');
    setSuccessMessage('');

    if (!selectedSupplierId) {
      setError('Veuillez sélectionner un fournisseur');
      return;
    }
    if (deliveryCart.length === 0) {
      setError('Ajoutez au moins un produit à la livraison');
      return;
    }

    try {
      await api.post('/purchase-orders', {
        supplier_id: parseInt(selectedSupplierId),
        items: deliveryCart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
        })),
      });
      setSuccessMessage('Livraison enregistrée, stock mis à jour');
      setDeliveryCart([]);
      setSelectedSupplierId('');
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || "Échec de l'enregistrement de la livraison");
    }
  };

  const handleRecordPayment = async (purchaseOrder) => {
    if (!isAdmin) return;
    setError('');

    const paymentMethod = window.prompt(
      `Méthode de paiement pour la commande #${purchaseOrder.id} ('espèces' ou 'chèque') :`,
      purchaseOrder.payment_method || 'espèces'
    );

    if (paymentMethod === null) return;

    const normalizedMethod = paymentMethod.trim().toLowerCase();
    if (!['espèces', 'chèque'].includes(normalizedMethod)) {
      setError("Méthode invalide. Utilisez 'espèces' ou 'chèque'");
      return;
    }

    let chequeNumber = null;
    let chequeDueDate = null;

    if (normalizedMethod === 'chèque') {
      chequeNumber = window.prompt('Numéro du chèque :');
      if (chequeNumber === null || !chequeNumber.trim()) {
        setError('Numéro de chèque requis');
        return;
      }

      chequeDueDate = window.prompt('Date d’échéance du chèque (YYYY-MM-DD) :');
      if (chequeDueDate === null || !chequeDueDate.trim()) {
        setError('Date d’échéance requise');
        return;
      }
    }

    try {
      await api.put(`/purchase-orders/${purchaseOrder.id}/payment`, {
        payment_method: normalizedMethod,
        cheque_number: chequeNumber,
        cheque_due_date: chequeDueDate,
      });
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Échec d’enregistrement du paiement');
    }
  };

  const handleChequeStatusUpdate = async (purchaseOrder, chequeStatus) => {
    if (!isAdmin) return;
    setError('');

    try {
      await api.put(`/purchase-orders/${purchaseOrder.id}/cheque-status`, { cheque_status: chequeStatus });
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Échec de la mise à jour du chèque');
    }
  };

  return (
    <div>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Truck size={26} />
        Livraisons
      </h1>


      <hr style={{ margin: '2rem 0' }} />

      <div className="card">
      <h3>Enregistrer une livraison</h3>
      <div className="control-row" style={{ marginBottom: '1rem' }}>
        <label>Fournisseur : </label>
        <select className="form-input" value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}>
          <option value="">-- Choisir un fournisseur --</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="delivery-controls" style={{ marginBottom: '1rem' }}>
        <label>
          <input
            type="radio"
            name="product-entry-mode"
            value="existing"
            checked={productEntryMode === 'existing'}
            onChange={() => setProductEntryMode('existing')}
          />{' '}
          Produit existant
        </label>{' '}
        <label>
          <input
            type="radio"
            name="product-entry-mode"
            value="new"
            checked={productEntryMode === 'new'}
            onChange={() => setProductEntryMode('new')}
          />{' '}
          Nouveau produit
        </label>{' '}
        {productEntryMode === 'existing' ? (
          <>
            <label>Produit : </label>
            <select className="form-input" value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
              <option value="">-- Choisir un produit --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>{' '}
          </>
        ) : (
          <>
            <input
              className="form-input"
              placeholder="Nom du produit"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
            />{' '}
            <input
              className="form-input"
              placeholder="Prix de vente (TTC)"
              type="number"
              step="0.01"
              value={newProductPrice}
              onChange={(e) => setNewProductPrice(e.target.value)}
            />{' '}
            <input
              className="form-input"
              placeholder="Taux TVA (%)"
              type="number"
              step="0.01"
              value={newProductTvaRate}
              onChange={(e) => setNewProductTvaRate(e.target.value)}
            />{' '}
            <select className="form-input" value={newProductUnit} onChange={(e) => setNewProductUnit(e.target.value)}>
              <option value="unité">Unité</option>
              <option value="carton">Carton</option>
              <option value="pièce">Pièce</option>
              <option value="kg">Kg</option>
              <option value="litre">Litre</option>
            </select>{' '}
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={newProductSupported}
                onChange={(e) => {
                  setNewProductSupported(e.target.checked);
                  if (!e.target.checked) setNewProductSupportCategory('');
                }}
              />
              Produit contrôlé/subventionné
            </label>{' '}
            {newProductSupported && (
              <select
                className="form-input"
                value={newProductSupportCategory}
                onChange={(e) => setNewProductSupportCategory(e.target.value)}
                required
              >
                <option value="">-- Catégorie --</option>
                {SUPPORT_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </select>
            )}{' '}
          </>
        )}
        <input
          className="form-input"
          type="number"
          min="1"
          placeholder="Quantité"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          style={{ width: '90px' }}
        />{' '}
        <input
          className="form-input"
          type="number"
          step="0.01"
          placeholder="Coût unitaire"
          value={unitCost}
          onChange={(e) => setUnitCost(e.target.value)}
          style={{ width: '110px' }}
        />{' '}
        <button className="btn btn-primary" onClick={handleAddItemToDelivery}>
          Ajouter à la livraison
        </button>
      </div>

      <TableScroll>
      <table className="data-table">
        <thead>
          <tr>
            <th>Produit</th>
            <th>Quantité</th>
            <th>Coût unitaire</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {deliveryCart.map((item) => (
            <tr key={item.product_id}>
              <td>{item.name}</td>
              <td>{item.quantity}</td>
              <td>{item.unit_cost} DT</td>
              <td>
                <button className="btn btn-danger" onClick={() => handleRemoveItem(item.product_id)}>
                  Retirer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </TableScroll>

      {error && <p className="badge badge-danger">{error}</p>}
      {successMessage && <p className="badge badge-success">{successMessage}</p>}

      <button className="btn btn-primary" onClick={handleSubmitDelivery}>
        Confirmer la livraison
      </button>
      </div>

      {isAdmin && upcomingCheques.length > 0 && (
        <>
          <hr style={{ margin: '2rem 0' }} />
          <h3>Chèques à échéance</h3>
          <ul>
            {upcomingCheques.map((po) => (
              <li key={po.id}>
                #{po.id} - {po.supplier_name} - {po.cheque_number} - échéance :{' '}
                {new Date(po.cheque_due_date).toLocaleDateString('fr-FR')} - total {po.total} DT
              </li>
            ))}
          </ul>
        </>
      )}

      <hr style={{ margin: '2rem 0' }} />

      <h3>Historique des livraisons</h3>
      <TableScroll>
      <table className="data-table">
        <thead>
          <tr>
            <th>N°</th>
            <th>Date</th>
            <th>Fournisseur</th>
            <th>Total</th>
            <th>Paiement</th>
            <th>Chèque</th>
            {isAdmin && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {purchaseOrders.map((po) => (
            <tr key={po.id}>
              <td>{po.id}</td>
              <td>{new Date(po.date).toLocaleString('fr-FR')}</td>
              <td>{po.supplier_name}</td>
              <td>{po.total} DT</td>
              <td>{po.payment_method ? (po.payment_method === 'chèque' ? 'Chèque' : 'Espèces') : '—'}</td>
              <td>
                {po.payment_method === 'chèque'
                  ? (
                    <>
                      {po.cheque_number || '—'} /{' '}
                      {po.cheque_due_date ? new Date(po.cheque_due_date).toLocaleDateString('fr-FR') : '—'} /{' '}
                      <span className={`badge ${
                        po.cheque_status === 'en_attente'
                          ? 'badge-warning'
                          : po.cheque_status === 'rejeté'
                            ? 'badge-danger'
                            : 'badge-success'
                      }`}>
                        {po.cheque_status || '—'}
                      </span>
                    </>
                  )
                  : '—'}
              </td>
              {isAdmin && (
                <td>
                  {!po.payment_method && (
                    <button className="btn btn-secondary" onClick={() => handleRecordPayment(po)}>
                      Enregistrer paiement
                    </button>
                  )}
                  {po.payment_method === 'chèque' && po.cheque_status === 'en_attente' && (
                    <>
                      {' '}
                      <button className="btn btn-secondary" onClick={() => handleChequeStatusUpdate(po, 'encaissé')}>
                        Encaisser
                      </button>{' '}
                      <button className="btn btn-danger" onClick={() => handleChequeStatusUpdate(po, 'rejeté')}>
                        Rejeter
                      </button>
                    </>
                  )}
                  {po.payment_method && po.payment_method !== 'chèque' && (
                    <span className="badge badge-success">Payé</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </TableScroll>
    </div>
  );
}

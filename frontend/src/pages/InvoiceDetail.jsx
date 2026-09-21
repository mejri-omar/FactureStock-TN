import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import TableScroll from '../components/TableScroll';
import { supportCategoryLabel } from '../supportCategories';

const moneyFormatter = new Intl.NumberFormat('fr-TN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function money(value) {
  return `${moneyFormatter.format(Number(value) || 0)} DT`;
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setError('');
      try {
        const res = await api.get(`/invoices/${id}`);
        setInvoice(res.data.invoice);
        setItems(res.data.items || []);
      } catch (err) {
        console.error('Failed to load invoice', err);
        setError(err.response?.data?.error || 'Impossible de charger la facture');
      }
    };
    load();
  }, [id]);

  if (error) return <p className="badge badge-danger">{error}</p>;
  if (!invoice) return <div>Chargement...</div>;

  const supportedItems = items.filter((item) => item.is_government_supported);
  const regularItems = items.filter((item) => !item.is_government_supported);
  const supportedTotal = supportedItems.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
  const regularTotal = regularItems.reduce((sum, item) => sum + Number(item.line_total || 0), 0);

  const renderItemsTable = (rows) => (
    <TableScroll>
      <table className="data-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Quantité</th>
            <th>Unité</th>
            <th>Prix unitaire</th>
            <th>TVA %</th>
            <th>Total HT</th>
            <th>Catégorie</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((it) => (
            <tr key={it.id}>
              <td>{it.description}</td>
              <td>{it.quantity}</td>
              <td>{it.unit || 'unité'}</td>
              <td>{money(it.unit_price)}</td>
              <td>{Number(it.tva_rate || 0).toFixed(2)}%</td>
              <td>{money(it.line_total)}</td>
              <td>
                {it.is_government_supported ? (
                  <span className="badge badge-warning">{supportCategoryLabel(it.support_category)}</span>
                ) : (
                  <span className="badge badge-neutral">Normal</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );

  return (
    <div className="invoice-page">
      <div className="invoice-actions no-print">
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/invoices')}>
          Retour
        </button>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          Imprimer
        </button>
      </div>

      <section className="invoice-document">
      <h1>Facture {invoice.invoice_number}</h1>
      <div className="invoice-summary">
        <div>
          <div><strong>Date :</strong> {new Date(invoice.issued_at).toLocaleString('fr-FR')}</div>
          <div><strong>Client :</strong> {invoice.customer_name || '—'}</div>
          <div><strong>Émise par :</strong> {invoice.issued_by_username || '—'}</div>
          <div><strong>Statut :</strong> {invoice.status === 'issued' ? 'Émise' : invoice.status}</div>
        </div>
        <div className="invoice-totals">
          <div><strong>Sous-total HT :</strong> {money(invoice.subtotal)}</div>
          <div><strong>TVA :</strong> {money(invoice.tax_total)}</div>
          <div className="invoice-grand-total"><strong>Total TTC :</strong> {money(invoice.total)}</div>
        </div>
      </div>

      {supportedItems.length > 0 && (
        <div className="invoice-section">
          <h3>Produits contrôlés/subventionnés</h3>
          <p className="badge badge-warning">
            {supportedItems.length} ligne(s) - {money(supportedTotal)} HT
          </p>
          {renderItemsTable(supportedItems)}
        </div>
      )}

      {regularItems.length > 0 && (
        <div className="invoice-section">
          <h3>Autres produits</h3>
          <p className="badge badge-neutral">
            {regularItems.length} ligne(s) - {money(regularTotal)} HT
          </p>
          {renderItemsTable(regularItems)}
        </div>
      )}
      </section>
    </div>
  );
}

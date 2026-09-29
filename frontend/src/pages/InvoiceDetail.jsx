import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Printer, Trash2 } from 'lucide-react';
import api from '../api';
import TableScroll from '../components/TableScroll';
import { supportCategoryLabel } from '../supportCategories';
import { useAuth } from '../context/AuthContext';
import {
  BUSINESS_NAME,
  BUSINESS_ADDRESS,
  BUSINESS_PHONE,
  BUSINESS_TAX_ID,
} from '../businessInfo';

const moneyFormatter = new Intl.NumberFormat('fr-TN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function money(value) {
  return `${moneyFormatter.format(Number(value) || 0)} DT`;
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const autoPrint = searchParams.get('print') === '1';

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

  useEffect(() => {
    if (!autoPrint || !invoice) return;
    const timer = setTimeout(() => {
      window.print();
      // Clear the flag so a reload or back-navigation does not reprint
      searchParams.delete('print');
      setSearchParams(searchParams, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint, invoice]);

  const handlePrint = () => {
    window.print();
  };

  const handleDelete = async () => {
    if (!invoice) return;
    const confirmed = window.confirm(
      `Supprimer définitivement la facture ${invoice.invoice_number} ?`
    );
    if (!confirmed) return;

    setDeleting(true);
    setError('');
    try {
      await api.delete(`/invoices/${invoice.id}`);
      navigate('/invoices');
    } catch (err) {
      setError(err.response?.data?.error || 'Échec de la suppression');
      setDeleting(false);
    }
  };

  if (error && !invoice) return <p className="badge badge-danger">{error}</p>;
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
        <button type="button" className="btn btn-primary" onClick={handlePrint}>
          <Printer size={16} aria-hidden="true" /> Imprimer la facture
        </button>
        {isAdmin && (
          <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
            <Trash2 size={16} aria-hidden="true" /> {deleting ? 'Suppression…' : 'Supprimer'}
          </button>
        )}
      </div>

      {error && <p className="badge badge-danger">{error}</p>}

      <section className="invoice-document">
      <header className="invoice-header">
        <div className="invoice-header-business">
          <h1>{BUSINESS_NAME}</h1>
          <p>{BUSINESS_ADDRESS}</p>
          <p>{BUSINESS_PHONE}</p>
          <p>{BUSINESS_TAX_ID}</p>
        </div>
        <div className="invoice-header-meta">
          <h2>Facture N° {invoice.invoice_number}</h2>
          <p>Date : {new Date(invoice.issued_at).toLocaleString('fr-FR')}</p>
          <p>Statut : {invoice.status === 'issued' ? 'Émise' : invoice.status}</p>
        </div>
      </header>
      <div className="invoice-summary">
        <div className="invoice-parties">
          <div>
            <div><strong>Client :</strong> {invoice.customer_name || '—'}</div>
            <div><strong>Matricule fiscal :</strong> {invoice.customer_matricule_fiscal || '—'}</div>
            {invoice.customer_address && <div><strong>Adresse :</strong> {invoice.customer_address}</div>}
          </div>
          <div>
            <div><strong>Émise par :</strong> {invoice.issued_by_username || '—'}</div>
          </div>
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

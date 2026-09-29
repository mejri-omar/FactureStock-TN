import { useState, useEffect, useCallback } from 'react';
import { Printer, Trash2 } from 'lucide-react';
import api from '../api';
import TableScroll from '../components/TableScroll';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function InvoicesList() {
  const [invoices, setInvoices] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const load = useCallback(async (p) => {
    setLoading(true);
    setError('');
    try {
      const targetPage = p || 1;
      const res = await api.get(`/invoices?page=${targetPage}&per_page=${perPage}`);
      setInvoices(res.data.invoices || []);
      setTotal(res.data.total || 0);
      setPage(res.data.page || targetPage);
    } catch (err) {
      console.error('Failed to load invoices', err);
      setError(err.response?.data?.error || 'Impossible de charger les factures');
    } finally {
      setLoading(false);
    }
  }, [perPage]);

  useEffect(() => { load(1); }, [load]);

  const handlePrint = (invoice) => {
    navigate(`/invoices/${invoice.id}?print=1`);
  };

  const handleDelete = async (invoice) => {
    const confirmed = window.confirm(
      `Supprimer définitivement la facture ${invoice.invoice_number} ?`
    );
    if (!confirmed) return;

    setDeletingId(invoice.id);
    setError('');
    try {
      await api.delete(`/invoices/${invoice.id}`);
      await load(page);
    } catch (err) {
      console.error('Failed to delete invoice', err);
      setError(err.response?.data?.error || 'Échec de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <h1>Factures</h1>
      {error && <p className="badge badge-danger">{error}</p>}
      {loading && <p className="badge badge-neutral">Chargement…</p>}
      <TableScroll>
        <table className="data-table">
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Date</th>
              <th>Client</th>
              <th>Total</th>
              <th>Statut</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr
                key={inv.id}
                className="clickable-row"
                style={inv.status === 'voided' ? { opacity: 0.5 } : {}}
                onClick={() => navigate(`/invoices/${inv.id}`)}
              >
                <td>{inv.invoice_number}</td>
                <td>{new Date(inv.issued_at).toLocaleString('fr-FR')}</td>
                <td>{inv.customer_name || '—'}</td>
                <td>{inv.total} DT</td>
                <td><span className={inv.status === 'issued' ? 'badge badge-success' : 'badge badge-danger'}>{inv.status}</span></td>
                <td className="row-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={(e) => { e.stopPropagation(); handlePrint(inv); }}
                  >
                    <Printer size={16} aria-hidden="true" /> Imprimer
                  </button>{' '}
                  {isAdmin && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={(e) => { e.stopPropagation(); handleDelete(inv); }}
                      disabled={deletingId === inv.id}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      {deletingId === inv.id ? 'Suppression…' : 'Supprimer'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && invoices.length === 0 && (
              <tr>
                <td colSpan="6">Aucune facture trouvée.</td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroll>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem' }}>
        <div>
          Page {page} — {total} total
        </div>
        <div>
          <button className="btn btn-secondary" onClick={() => { if (page>1) { load(page-1); } }} disabled={page===1 || loading}>Préc</button>{' '}
          <button className="btn btn-primary" onClick={() => { if ((page*perPage) < total) { load(page+1); } }} disabled={(page*perPage) >= total || loading}>Suiv</button>
        </div>
      </div>
    </div>
  );
}

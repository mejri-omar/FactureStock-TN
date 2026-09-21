import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import TableScroll from '../components/TableScroll';
import { useNavigate } from 'react-router-dom';

export default function InvoicesList() {
  const [invoices, setInvoices] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

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
              </tr>
            ))}
            {!loading && invoices.length === 0 && (
              <tr>
                <td colSpan="5">Aucune facture trouvée.</td>
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

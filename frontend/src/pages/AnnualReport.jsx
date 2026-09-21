import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import TableScroll from '../components/TableScroll';
import { supportCategoryLabel } from '../supportCategories';

const currentYear = new Date().getFullYear();
const currencyFormatter = new Intl.NumberFormat('fr-TN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const quantityFormatter = new Intl.NumberFormat('fr-TN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

function formatCurrency(value) {
  return `${currencyFormatter.format(Number(value) || 0)} DT`;
}

function formatQuantity(value, unit) {
  return `${quantityFormatter.format(Number(value) || 0)} ${unit || ''}`.trim();
}

function paymentLabel(method) {
  if (method === 'cash') return 'Espèces';
  if (method === 'card') return 'Carte';
  if (method === 'credit') return 'Crédit';
  return 'Non lié à une vente';
}

export default function AnnualReport() {
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const yearOptions = useMemo(() => {
    return [currentYear - 4, currentYear - 3, currentYear - 2, currentYear - 1, currentYear];
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/invoices/report/annual?year=${year}`);
        setData(res.data);
      } catch (err) {
        console.error('Failed to load annual report', err);
        setError(err.response?.data?.error || 'Impossible de charger le rapport annuel');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [year]);

  if (!data && loading) {
    return <div>Chargement du rapport…</div>;
  }

  return (
    <div>
      <h1>Rapport annuel</h1>

      <div className="control-row annual-report-toolbar">
        <label htmlFor="yearSelect" style={{ fontWeight: 600 }}>Année :</label>
        <select id="yearSelect" className="form-input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {loading && <span className="badge badge-neutral">Chargement…</span>}
      </div>

      {error && <p className="badge badge-danger">{error}</p>}
      {!data && !error && <p>Aucune donnée disponible.</p>}

      {data && (
        <>
      <div className="stats-grid">
        <div className="card stat-card green">
          <div className="stat-card-label">Chiffre d’affaires TTC</div>
          <div className="stat-card-value">{formatCurrency(data.total_ttc)}</div>
        </div>
        <div className="card stat-card blue">
          <div className="stat-card-label">Chiffre d’affaires HT</div>
          <div className="stat-card-value">{formatCurrency(data.subtotal)}</div>
        </div>
        <div className="card stat-card purple">
          <div className="stat-card-label">TVA collectée</div>
          <div className="stat-card-value">{formatCurrency(data.tax_total)}</div>
        </div>
        <div className="card stat-card orange">
          <div className="stat-card-label">Nombre de factures</div>
          <div className="stat-card-value">{data.invoice_count}</div>
        </div>
      </div>

      <div className="card">
        <h3>Résumé mensuel</h3>
        <TableScroll>
          <table className="data-table">
            <thead>
              <tr>
                <th>Mois</th>
                <th>Factures</th>
                <th>HT</th>
                <th>TVA</th>
                <th>TTC</th>
              </tr>
            </thead>
            <tbody>
              {(data.revenue_by_month || []).map((row) => (
                <tr key={row.month}>
                  <td>{new Date(2000, row.month - 1, 1).toLocaleString('fr-FR', { month: 'long' })}</td>
                  <td>{row.invoice_count}</td>
                  <td>{formatCurrency(row.subtotal)}</td>
                  <td>{formatCurrency(row.tax_total)}</td>
                  <td>{formatCurrency(row.total_ttc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </div>

      <div className="card">
        <h3>Produits contrôlés/subventionnés</h3>
        <div className="stats-grid">
          <div className="stat-card orange">
            <div className="stat-card-label">TTC contrôlé</div>
            <div className="stat-card-value">{formatCurrency(data.supported_totals?.revenue_ttc)}</div>
          </div>
          <div className="stat-card blue">
            <div className="stat-card-label">HT contrôlé</div>
            <div className="stat-card-value">{formatCurrency(data.supported_totals?.revenue_ht)}</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-card-label">Factures concernées</div>
            <div className="stat-card-value">{data.supported_totals?.invoice_count || 0}</div>
          </div>
        </div>
        <TableScroll>
          <table className="data-table">
            <thead>
              <tr>
                <th>Catégorie</th>
                <th>Factures</th>
                <th>Produits</th>
                <th>Quantité</th>
                <th>HT</th>
                <th>TVA</th>
                <th>TTC</th>
              </tr>
            </thead>
            <tbody>
              {(data.supported_by_category || []).map((row) => (
                <tr key={row.support_category}>
                  <td>{supportCategoryLabel(row.support_category)}</td>
                  <td>{row.invoice_count}</td>
                  <td>{row.product_count}</td>
                  <td>{formatQuantity(row.total_quantity)}</td>
                  <td>{formatCurrency(row.revenue_ht)}</td>
                  <td>{formatCurrency(row.tax_total)}</td>
                  <td>{formatCurrency(row.revenue_ttc)}</td>
                </tr>
              ))}
              {(data.supported_by_category || []).length === 0 && (
                <tr>
                  <td colSpan="7">Aucun produit contrôlé/subventionné facturé sur cette année.</td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </div>

      <div className="card">
        <h3>Articles vendus</h3>
        <TableScroll>
          <table className="data-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Contrôle</th>
                <th>Quantité</th>
                <th>HT</th>
                <th>TVA</th>
                <th>TTC</th>
                <th>Marge brute</th>
              </tr>
            </thead>
            <tbody>
              {(data.revenue_by_item || []).map((row) => (
                <tr key={`${row.description}-${row.unit}`}>
                  <td>{row.description}</td>
                  <td>
                    {row.is_government_supported ? (
                      <span className="badge badge-warning">{supportCategoryLabel(row.support_category)}</span>
                    ) : (
                      <span className="badge badge-neutral">Normal</span>
                    )}
                  </td>
                  <td>{formatQuantity(row.total_quantity, row.unit)}</td>
                  <td>{formatCurrency(row.revenue_ht)}</td>
                  <td>{formatCurrency(row.tax_total)}</td>
                  <td>{formatCurrency(row.revenue_ttc)}</td>
                  <td>{formatCurrency(row.gross_margin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </div>

      <div className="report-grid">
        <div className="card">
          <h3>TVA par taux</h3>
          <TableScroll>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Taux</th>
                  <th>Base HT</th>
                  <th>TVA</th>
                </tr>
              </thead>
              <tbody>
                {(data.tax_by_rate || []).map((row) => (
                  <tr key={row.tva_rate}>
                    <td>{Number(row.tva_rate).toFixed(2)}%</td>
                    <td>{formatCurrency(row.taxable_amount)}</td>
                    <td>{formatCurrency(row.tax_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </div>

        <div className="card">
          <h3>Paiements</h3>
          <TableScroll>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Méthode</th>
                  <th>Factures</th>
                  <th>TTC</th>
                </tr>
              </thead>
              <tbody>
                {(data.payment_methods || []).map((row) => (
                  <tr key={row.payment_method}>
                    <td>{paymentLabel(row.payment_method)}</td>
                    <td>{row.invoice_count}</td>
                    <td>{formatCurrency(row.total_ttc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </div>
      </div>

      <div className="card">
        <h3>Clients</h3>
        <TableScroll>
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Matricule fiscal</th>
                <th>Factures</th>
                <th>HT</th>
                <th>TVA</th>
                <th>TTC</th>
              </tr>
            </thead>
            <tbody>
              {(data.revenue_by_customer || []).map((row) => (
                <tr key={row.id || row.name}>
                  <td>{row.name || 'Client supprimé'}</td>
                  <td>{row.matricule_fiscal || '—'}</td>
                  <td>{row.invoice_count}</td>
                  <td>{formatCurrency(row.subtotal)}</td>
                  <td>{formatCurrency(row.tax_total)}</td>
                  <td>{formatCurrency(row.total_ttc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </div>
        </>
      )}
    </div>
  );
}

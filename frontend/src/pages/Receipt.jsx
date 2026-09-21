import { useAuth } from '../context/AuthContext';

// Business info - easy to edit later
const BUSINESS_NAME = 'STE FIRAS FERJANI';
const BUSINESS_ADDRESS = 'Alimentation Générale en Gros — Rue Bani Tamim, B05, Raccada, Kairouan';
const BUSINESS_PHONE = 'Tél : 93 461 611 / 96 746 624';
const BUSINESS_TAX_ID = 'Matricule Fiscal : 1811540V/P/M/000';

export default function Receipt({ sale, cashier }) {
  const { user } = useAuth();
  const cashierName = cashier || (user?.username ?? 'Caissier');

  // Helper to format currency with 3 decimal places for HT/TVA, 2 for TTC
  const formatCurrency = (value, decimals = 2) => {
    return parseFloat(value).toFixed(decimals);
  };

  // Compute line totals (price is TTC)
  const lineItems = sale.items.map(item => {
    const lineTTC = item.price * item.quantity;
    const lineHT = lineTTC / (1 + item.tva_rate / 100);
    const lineTVA = lineTTC - lineHT;
    return {
      ...item,
      lineTTC,
      lineHT,
      lineTVA
    };
  });

  // Totals from sale.breakdown (ht, tva, ttc) or recompute
  const ht = sale.breakdown?.ht ?? lineItems.reduce((sum, i) => sum + i.lineHT, 0);
  const tva = sale.breakdown?.tva ?? lineItems.reduce((sum, i) => sum + i.lineTVA, 0);
  const ttc = sale.breakdown?.ttc ?? lineItems.reduce((sum, i) => sum + i.lineTTC, 0);

  return (
    <div className="print-receipt">
      <div style={{ textAlign: 'center', marginBottom: '0.5rem', borderBottom: '2px solid #000', paddingBottom: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{BUSINESS_NAME}</h2>
        <p style={{ margin: '0.1rem 0', fontSize: '0.8rem' }}>{BUSINESS_ADDRESS}</p>
        <p style={{ margin: '0.1rem 0', fontSize: '0.8rem' }}>{BUSINESS_PHONE}</p>
        <p style={{ margin: '0.1rem 0', fontSize: '0.8rem' }}>{BUSINESS_TAX_ID}</p>
      </div>

      <p style={{ margin: '0.2rem 0', fontSize: '0.9rem' }}>N° {sale.id}</p>
      <p style={{ margin: '0.2rem 0', fontSize: '0.9rem' }}>Date : {new Date(sale.date).toLocaleString('fr-FR')}</p>
      <p style={{ margin: '0.2rem 0', fontSize: '0.9rem' }}>Caissier : {cashierName}</p>

      <hr style={{ margin: '0.5rem 0', border: '1px solid #000' }} />

      <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '0.2rem' }}>Produit</th>
            <th style={{ textAlign: 'center', padding: '0.2rem' }}>Qté</th>
            <th style={{ textAlign: 'right', padding: '0.2rem' }}>Prix unitaire</th>
            <th style={{ textAlign: 'right', padding: '0.2rem' }}>TVA</th>
            <th style={{ textAlign: 'right', padding: '0.2rem' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map(item => (
            <tr key={item.product_id} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ textAlign: 'left', padding: '0.2rem' }}>{item.name}</td>
              <td style={{ textAlign: 'center', padding: '0.2rem' }}>{item.quantity} {item.unit}</td>
              <td style={{ textAlign: 'right', padding: '0.2rem' }}>{formatCurrency(item.price, 2)} DT</td>
              <td style={{ textAlign: 'right', padding: '0.2rem' }}>{item.tva_rate}%</td>
              <td style={{ textAlign: 'right', padding: '0.2rem' }}>{formatCurrency(item.lineTTC, 2)} DT</td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr style={{ margin: '0.5rem 0', border: '1px solid #000' }} />

      <p style={{ margin: '0.2rem 0', fontSize: '0.9rem' }}>Total HT : {formatCurrency(ht, 3)} DT</p>
      <p style={{ margin: '0.2rem 0', fontSize: '0.9rem' }}>Total TVA : {formatCurrency(tva, 3)} DT</p>
      <p style={{ margin: '0.2rem 0', fontSize: '0.9rem', fontWeight: 'bold' }}>Total TTC : {formatCurrency(ttc, 2)} DT</p>

      <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>Paiement : {sale.paymentMethod === 'cash' ? 'Espèces' : sale.paymentMethod === 'card' ? 'Carte' : 'Crédit'}</p>

      <hr style={{ margin: '0.5rem 0', border: '1px solid #ddd' }} />

      <p style={{ margin: '0.3rem 0', fontSize: '0.8rem', textAlign: 'center' }}>Merci de votre visite !</p>
      <p style={{ margin: '0.3rem 0', fontSize: '0.8rem', textAlign: 'center' }}>À bientôt !</p>
    </div>
  );
}

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './context/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Checkout from './pages/Checkout';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import SalesHistory from './pages/SalesHistory';
import Deliveries from './pages/Deliveries';
import Users from './pages/Users';
import Suppliers from './pages/Suppliers';
import InvoicesList from './pages/InvoicesList';
import InvoiceDetail from './pages/InvoiceDetail';
import AnnualReport from './pages/AnnualReport';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Checkout />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/deliveries" element={<Deliveries />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/sales-history" element={<SalesHistory />} />
            <Route path="/invoices" element={<InvoicesList />} />
            <Route path="/invoices/report" element={<AnnualReport />} />
            <Route path="/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route
              path="/users"
              element={
                <ProtectedRoute adminOnly={true}>
                  <Users />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

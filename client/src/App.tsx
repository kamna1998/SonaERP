import { Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UserList from './pages/users/UserList';
import ProjectList from './pages/projects/ProjectList';
import ProjectForm from './pages/projects/ProjectForm';
import ProjectDetail from './pages/projects/ProjectDetail';
import DtaoList from './pages/dtao/DtaoList';
import DtaoDetail from './pages/dtao/DtaoDetail';
import SupplierList from './pages/suppliers/SupplierList';
import BidList from './pages/bids/BidList';
import BidReceptionForm from './pages/bids/BidReceptionForm';
import BidDetail from './pages/bids/BidDetail';
import ContractList from './pages/contracts/ContractList';
import ContractForm from './pages/contracts/ContractForm';
import ContractDetail from './pages/contracts/ContractDetail';
import AvenantBuilder from './pages/contracts/AvenantBuilder';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="users" element={<UserList />} />
        {/* Phase 2: Projects / Plan de Passation */}
        <Route path="projects" element={<ProjectList />} />
        <Route path="projects/new" element={<ProjectForm />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        {/* Phase 3: DTAO / Tender Dossiers */}
        <Route path="dtao" element={<DtaoList />} />
        <Route path="dtao/:id" element={<DtaoDetail />} />
        {/* Phase 4: Suppliers & Bid Reception */}
        <Route path="suppliers" element={<SupplierList />} />
        <Route path="bids" element={<BidList />} />
        <Route path="bids/new" element={<BidReceptionForm />} />
        <Route path="bids/:id" element={<BidDetail />} />
        {/* Phase 6: Contract Management & Smart Avenants */}
        <Route path="contracts" element={<ContractList />} />
        <Route path="contracts/new" element={<ContractForm />} />
        <Route path="contracts/:id" element={<ContractDetail />} />
        <Route path="contracts/:id/avenants/new" element={<AvenantBuilder />} />
        {/* Future phase routes - placeholders */}
        <Route path="ccc" element={<PlaceholderPage title="CCC" />} />
        <Route path="avenants" element={<PlaceholderPage title="Avenants" />} />
        <Route path="roles" element={<PlaceholderPage title="Roles & Permissions" />} />
        <Route path="audit" element={<PlaceholderPage title="Audit Trail" />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="card">
      <h1 className="text-2xl font-bold text-sonatrach-navy mb-2">{title}</h1>
      <p className="text-gray-500">This module will be implemented in a future phase.</p>
    </div>
  );
}

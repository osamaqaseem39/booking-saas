import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './context/SessionContext';
import ConsoleLayout from './layout/ConsoleLayout';
import RequireRoles from './layout/RequireRoles';
import ArenaHubPage from './pages/ArenaHubPage';
import BillingPage from './pages/BillingPage';
import BookingsPage from './pages/BookingsPage';
import BusinessesPage from './pages/BusinessesPage';
import EndUsersPage from './pages/EndUsersPage';
import LocationFacilitiesPage from './pages/LocationFacilitiesPage';
import LocationFacilitySetupPage from './pages/LocationFacilitySetupPage';
import LocationsPage from './pages/LocationsPage';
import HealthPage from './pages/HealthPage';
import LoginPage from './pages/LoginPage';
import OnboardPage from './pages/OnboardPage';
import OverviewPage from './pages/OverviewPage';
import UsersPage from './pages/UsersPage';

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/app" element={<ConsoleLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="businesses" element={<BusinessesPage />} />
            <Route path="locations" element={<LocationsPage />} />
            <Route
              path="locations/:locationId/facilities"
              element={<LocationFacilitiesPage />}
            />
            <Route
              path="locations/:locationId/facilities/setup/:facilityCode"
              element={<LocationFacilitySetupPage />}
            />
            <Route
              path="end-users"
              element={
                <RequireRoles anyOf={['platform-owner']}>
                  <EndUsersPage />
                </RequireRoles>
              }
            />
            <Route
              path="onboard"
              element={
                <RequireRoles anyOf={['platform-owner']}>
                  <OnboardPage />
                </RequireRoles>
              }
            />
            <Route path="users" element={<UsersPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="arena" element={<ArenaHubPage />} />
            <Route path="health" element={<HealthPage />} />
          </Route>
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}

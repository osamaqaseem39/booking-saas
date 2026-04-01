import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './context/SessionContext';
import ConsoleLayout from './layout/ConsoleLayout';
import RequireRoles from './layout/RequireRoles';
import BillingPage from './pages/BillingPage';
import BusinessCreatePage from './pages/BusinessCreatePage';
import BusinessEditPage from './pages/BusinessEditPage';
import BusinessTenantStatsPage from './pages/BusinessTenantStatsPage';
import BookingsPage from './pages/BookingsPage';
import BusinessesPage from './pages/BusinessesPage';
import EndUsersPage from './pages/EndUsersPage';
import AddFacilityPage from './pages/AddFacilityPage';
import LocationFacilitySetupPage from './pages/LocationFacilitySetupPage';
import LocationCreatePage from './pages/LocationCreatePage';
import LocationDetailPage from './pages/LocationDetailPage';
import LocationEditPage from './pages/LocationEditPage';
import LocationsPage from './pages/LocationsPage';
import HealthPage from './pages/HealthPage';
import LoginPage from './pages/LoginPage';
import OnboardPage from './pages/OnboardPage';
import OwnerSignupPage from './pages/OwnerSignupPage';
import BusinessOwnerLiveViewPage from './pages/BusinessOwnerLiveViewPage';
import FacilitiesLiveViewPage from './pages/FacilitiesLiveViewPage';
import OverviewPage from './pages/OverviewPage';
import UserCreatePage from './pages/UserCreatePage';
import UserDetailPage from './pages/UserDetailPage';
import UserEditPage from './pages/UserEditPage';
import UsersPage from './pages/UsersPage';

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/owner-signup" element={<OwnerSignupPage />} />
          <Route path="/app" element={<ConsoleLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="businesses" element={<BusinessesPage />} />
            <Route
              path="businesses/new"
              element={
                <RequireRoles anyOf={['platform-owner']}>
                  <BusinessCreatePage />
                </RequireRoles>
              }
            />
            <Route path="businesses/:businessId" element={<BusinessTenantStatsPage />} />
            <Route path="businesses/:businessId/edit" element={<BusinessEditPage />} />
            <Route path="locations" element={<LocationsPage />} />
            <Route path="Facilites" element={<AddFacilityPage />} />
            <Route path="add-court" element={<Navigate to="/app/Facilites" replace />} />
            <Route path="locations/new" element={<LocationCreatePage />} />
            <Route path="locations/:locationId" element={<LocationDetailPage />} />
            <Route path="locations/:locationId/edit" element={<LocationEditPage />} />
            <Route
              path="locations/:locationId/facilities"
              element={<Navigate to="/app/Facilites" replace />}
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
            <Route path="users/new" element={<UserCreatePage />} />
            <Route path="users/:userId" element={<UserDetailPage />} />
            <Route path="users/:userId/edit" element={<UserEditPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route
              path="owner-live"
              element={
                <RequireRoles anyOf={['platform-owner', 'business-admin']}>
                  <BusinessOwnerLiveViewPage />
                </RequireRoles>
              }
            />
            <Route
              path="facilities-live"
              element={
                <RequireRoles anyOf={['platform-owner', 'business-admin']}>
                  <FacilitiesLiveViewPage />
                </RequireRoles>
              }
            />
            <Route path="billing" element={<BillingPage />} />
            <Route path="arena" element={<Navigate to="/app/Facilites" replace />} />
            <Route path="health" element={<HealthPage />} />
          </Route>
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}

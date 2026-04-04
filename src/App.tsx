import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './context/SessionContext';
import ConsoleLayout from './layout/ConsoleLayout';
import RequireRoles from './layout/RequireRoles';
import RequireSelfOrRoles from './layout/RequireSelfOrRoles';
import BillingPage from './pages/BillingPage';
import BusinessCreatePage from './pages/BusinessCreatePage';
import BusinessEditPage from './pages/BusinessEditPage';
import BusinessTenantStatsPage from './pages/BusinessTenantStatsPage';
import BookingsPage from './pages/BookingsPage';
import BookingCreatePage from './pages/BookingCreatePage';
import BookingEditPage from './pages/BookingEditPage';
import ManageTimeSlotsPage from './pages/ManageTimeSlotsPage';
import BusinessesPage from './pages/BusinessesPage';
import EndUsersPage from './pages/EndUsersPage';
import AddFacilityPage from './pages/AddFacilityPage';
import FacilityEditPage from './pages/FacilityEditPage';
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
            <Route
              path="businesses"
              element={
                <RequireRoles anyOf={['platform-owner']}>
                  <BusinessesPage />
                </RequireRoles>
              }
            />
            <Route
              path="businesses/new"
              element={
                <RequireRoles anyOf={['platform-owner']}>
                  <BusinessCreatePage />
                </RequireRoles>
              }
            />
            <Route
              path="businesses/:businessId"
              element={
                <RequireRoles anyOf={['platform-owner']}>
                  <BusinessTenantStatsPage />
                </RequireRoles>
              }
            />
            <Route
              path="businesses/:businessId/edit"
              element={
                <RequireRoles anyOf={['platform-owner']}>
                  <BusinessEditPage />
                </RequireRoles>
              }
            />
            <Route
              path="locations"
              element={
                <RequireRoles anyOf={['platform-owner', 'business-admin', 'customer-end-user']}>
                  <LocationsPage />
                </RequireRoles>
              }
            />
            <Route
              path="Facilites"
              element={
                <RequireRoles anyOf={['platform-owner', 'business-admin']}>
                  <AddFacilityPage />
                </RequireRoles>
              }
            />
            <Route path="add-court" element={<Navigate to="/app/Facilites" replace />} />
            <Route
              path="locations/new"
              element={
                <RequireRoles anyOf={['platform-owner', 'business-admin']}>
                  <LocationCreatePage />
                </RequireRoles>
              }
            />
            <Route path="locations/:locationId" element={<LocationDetailPage />} />
            <Route
              path="locations/:locationId/edit"
              element={
                <RequireRoles anyOf={['platform-owner', 'business-admin']}>
                  <LocationEditPage />
                </RequireRoles>
              }
            />
            <Route
              path="locations/:locationId/facilities"
              element={<Navigate to="/app/Facilites" replace />}
            />
            <Route
              path="locations/:locationId/facilities/setup/:facilityCode"
              element={
                <RequireRoles anyOf={['platform-owner', 'business-admin']}>
                  <LocationFacilitySetupPage />
                </RequireRoles>
              }
            />
            <Route
              path="locations/:locationId/facilities/edit/:facilityCode/:courtId"
              element={
                <RequireRoles anyOf={['platform-owner', 'business-admin']}>
                  <FacilityEditPage />
                </RequireRoles>
              }
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
            <Route
              path="users"
              element={
                <RequireRoles anyOf={['platform-owner', 'business-admin']}>
                  <UsersPage />
                </RequireRoles>
              }
            />
            <Route
              path="users/new"
              element={
                <RequireRoles anyOf={['platform-owner', 'business-admin']}>
                  <UserCreatePage />
                </RequireRoles>
              }
            />
            <Route
              path="users/:userId"
              element={
                <RequireSelfOrRoles
                  anyOf={['platform-owner', 'business-admin']}
                  selfRole="customer-end-user"
                  paramName="userId"
                >
                  <UserDetailPage />
                </RequireSelfOrRoles>
              }
            />
            <Route
              path="users/:userId/edit"
              element={
                <RequireRoles anyOf={['platform-owner', 'business-admin']}>
                  <UserEditPage />
                </RequireRoles>
              }
            />
            <Route
              path="bookings"
              element={
                <RequireRoles
                  anyOf={[
                    'platform-owner',
                    'business-admin',
                    'business-staff',
                    'customer-end-user',
                  ]}
                >
                  <BookingsPage />
                </RequireRoles>
              }
            />
            <Route
              path="bookings/new"
              element={
                <RequireRoles
                  anyOf={[
                    'platform-owner',
                    'business-admin',
                    'business-staff',
                    'customer-end-user',
                  ]}
                >
                  <BookingCreatePage />
                </RequireRoles>
              }
            />
            <Route
              path="bookings/:bookingId/edit"
              element={
                <RequireRoles
                  anyOf={[
                    'platform-owner',
                    'business-admin',
                    'business-staff',
                    'customer-end-user',
                  ]}
                >
                  <BookingEditPage />
                </RequireRoles>
              }
            />
            <Route
              path="time-slots"
              element={
                <RequireRoles anyOf={['platform-owner', 'business-admin', 'business-staff']}>
                  <ManageTimeSlotsPage />
                </RequireRoles>
              }
            />
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
            <Route
              path="billing"
              element={
                <RequireRoles anyOf={['platform-owner', 'business-admin', 'business-staff']}>
                  <BillingPage />
                </RequireRoles>
              }
            />
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

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SessionProvider, useSession } from './context/SessionContext';
import ConsoleLayout from './layout/ConsoleLayout';
import RequireRoles from './layout/RequireRoles';
import RequireSelfOrRoles from './layout/RequireSelfOrRoles';
import LoginPage from './pages/authentication/LoginPage';
import OwnerSignupPage from './pages/authentication/OwnerSignupPage';
import OverviewPage from './pages/dashboard/OverviewPage';
import BusinessOwnerLiveViewPage from './pages/dashboard/BusinessOwnerLiveViewPage';
import FacilitiesLiveViewPage from './pages/dashboard/FacilitiesLiveViewPage';
import BusinessesPage from './pages/business/BusinessesPage';
import BusinessCreatePage from './pages/business/BusinessCreatePage';
import BusinessEditPage from './pages/business/BusinessEditPage';
import BusinessTenantStatsPage from './pages/business/BusinessTenantStatsPage';
import OnboardPage from './pages/business/OnboardPage';
import LocationsPage from './pages/locations/LocationsPage';
import LocationCreatePage from './pages/locations/LocationCreatePage';
import LocationDetailPage from './pages/locations/LocationDetailPage';
import LocationEditPage from './pages/locations/LocationEditPage';
import AddFacilityPage from './pages/facilities/AddFacilityPage';
import FacilityEditPage from './pages/facilities/FacilityEditPage';
import LocationFacilitySetupPage from './pages/facilities/LocationFacilitySetupPage';
import LocationFacilitiesPage from './pages/facilities/LocationFacilitiesPage';
import BookingsPage from './pages/bookings/BookingsPage';
import BookingCreatePage from './pages/bookings/BookingCreatePage';
import BookingEditPage from './pages/bookings/BookingEditPage';
import AddTimeSlotTemplatePage from './pages/bookings/AddTimeSlotTemplatePage';
import ManageTimeSlotsPage from './pages/bookings/ManageTimeSlotsPage';
import UsersPage from './pages/users/UsersPage';
import UserCreatePage from './pages/users/UserCreatePage';
import UserDetailPage from './pages/users/UserDetailPage';
import UserEditPage from './pages/users/UserEditPage';
import BillingPage from './pages/billing/BillingPage';
import HealthPage from './pages/system/HealthPage';

function HealthAccess() {
  const { session } = useSession();
  const roles = session?.roles ?? [];
  if (roles.includes('platform-owner')) {
    return <HealthPage />;
  }
  return <Navigate to="/app" replace />;
}

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
                <RequireRoles anyOf={['platform-owner', 'business-admin', 'location-admin', 'customer-end-user']}>
                  <LocationsPage />
                </RequireRoles>
              }
            />
            <Route
              path="Facilites"
              element={
                <RequireRoles anyOf={['platform-owner', 'business-admin', 'location-admin']}>
                  <AddFacilityPage />
                </RequireRoles>
              }
            />
            <Route path="add-court" element={<Navigate to="/app/Facilites" replace />} />
            <Route
              path="locations/new"
              element={
                <RequireRoles anyOf={['platform-owner']}>
                  <LocationCreatePage />
                </RequireRoles>
              }
            />
            <Route path="locations/:locationId" element={<LocationDetailPage />} />
            <Route
              path="locations/:locationId/edit"
              element={
                <RequireRoles anyOf={['platform-owner', 'business-admin', 'location-admin']}>
                  <LocationEditPage />
                </RequireRoles>
              }
            />
            <Route
              path="locations/:locationId/facilities"
              element={
                <RequireRoles anyOf={['platform-owner', 'business-admin', 'location-admin']}>
                  <LocationFacilitiesPage />
                </RequireRoles>
              }
            />
            <Route
              path="locations/:locationId/facilities/setup/:facilityCode"
              element={
                <RequireRoles anyOf={['platform-owner', 'business-admin', 'location-admin']}>
                  <LocationFacilitySetupPage />
                </RequireRoles>
              }
            />
            <Route
              path="locations/:locationId/facilities/edit/:facilityCode/:courtId"
              element={
                <RequireRoles anyOf={['platform-owner', 'business-admin', 'location-admin']}>
                  <FacilityEditPage />
                </RequireRoles>
              }
            />
            <Route path="end-users" element={<Navigate to="/app/users?kind=customers" replace />} />
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
                <RequireRoles anyOf={['platform-owner', 'business-admin', 'location-admin']}>
                  <UsersPage />
                </RequireRoles>
              }
            />
            <Route
              path="users/new"
              element={
                <RequireRoles anyOf={['platform-owner', 'business-admin', 'location-admin']}>
                  <UserCreatePage />
                </RequireRoles>
              }
            />
            <Route
              path="users/:userId"
              element={
                <RequireSelfOrRoles
                  anyOf={['platform-owner', 'business-admin', 'location-admin']}
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
                <RequireRoles anyOf={['platform-owner', 'business-admin', 'location-admin']}>
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
                    'location-admin',
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
                    'location-admin',
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
                    'location-admin',
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
                <RequireRoles anyOf={['platform-owner', 'business-admin', 'location-admin', 'business-staff']}>
                  <ManageTimeSlotsPage />
                </RequireRoles>
              }
            />
            <Route
              path="time-slots/new"
              element={
                <RequireRoles anyOf={['platform-owner', 'business-admin', 'location-admin', 'business-staff']}>
                  <AddTimeSlotTemplatePage />
                </RequireRoles>
              }
            />
            <Route
              path="time-slots/:templateId/edit"
              element={
                <RequireRoles anyOf={['platform-owner', 'business-admin', 'location-admin', 'business-staff']}>
                  <AddTimeSlotTemplatePage />
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
                <RequireRoles anyOf={['platform-owner', 'business-admin', 'location-admin']}>
                  <FacilitiesLiveViewPage />
                </RequireRoles>
              }
            />
            <Route
              path="billing"
              element={
                <RequireRoles anyOf={['platform-owner', 'business-admin', 'location-admin', 'business-staff']}>
                  <BillingPage />
                </RequireRoles>
              }
            />
            <Route path="arena" element={<Navigate to="/app/Facilites" replace />} />
            <Route path="health" element={<HealthAccess />} />
          </Route>
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}

import { Navigate } from 'react-router-dom';

/** Owner live dashboard is shown on Overview; keep route for bookmarks. */
export default function BusinessOwnerLiveViewPage() {
  return <Navigate to="/app#owner-live-dashboard" replace />;
}

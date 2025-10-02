import { Navigate } from 'react-router-dom'

export default function Dashboard() {
  // Redirect to profile page which now serves as the main dashboard
  return <Navigate to="/profile" replace />
}
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute requiredRole="ADMIN">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="ml-64 flex-1">
          <Header />
          {children}
        </div>
      </div>
    </ProtectedRoute>
  );
}

import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import AuthGuard from '@/components/AuthGuard';
import { AdminSidebarProvider } from '@/context/AdminSidebarContext';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard allowedRoles={['admin']}>
      <AdminSidebarProvider>
        <div className="flex w-full min-h-screen bg-surface font-sans relative overflow-x-hidden">
          <AdminSidebar />
          <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out">
            <AdminHeader />
            <main className="flex-1 min-w-0">
              {children}
            </main>
          </div>
        </div>
      </AdminSidebarProvider>
    </AuthGuard>
  );
}

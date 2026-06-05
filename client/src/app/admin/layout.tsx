import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import AuthGuard from '@/components/AuthGuard';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard allowedRoles={['admin']}>
      <div className="flex w-full bg-surface font-sans">
        <AdminSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <AdminHeader />
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}

import ModeratorSidebar from '@/components/moderator/ModeratorSidebar';
import AuthGuard from '@/components/AuthGuard';

export default function ModeratorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard allowedRoles={['grocery_moderator']}>
      <div className="flex w-full min-h-screen bg-slate-50 font-sans">
        <ModeratorSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}

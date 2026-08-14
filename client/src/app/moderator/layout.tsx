import ModeratorSidebar from '@/components/moderator/ModeratorSidebar';
import AuthGuard from '@/components/AuthGuard';
import { ModeratorSidebarProvider } from '@/context/ModeratorSidebarContext';

export default function ModeratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard allowedRoles={['grocery_moderator']}>
      <ModeratorSidebarProvider>
        <div className="flex w-full min-h-screen bg-slate-50 font-sans relative overflow-x-hidden">
          <ModeratorSidebar />
          <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out">
            {children}
          </div>
        </div>
      </ModeratorSidebarProvider>
    </AuthGuard>
  );
}

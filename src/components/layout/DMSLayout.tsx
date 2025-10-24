import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileText, FolderKanban, TrendingUp, CheckSquare, LogOut, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import mmfsLogo from '@/assets/mmfs-logo.jpg';

interface DMSLayoutProps {
  children: React.ReactNode;
}

const DMSLayout: React.FC<DMSLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const menuItems = [
    { icon: FolderKanban, label: 'Projects', path: '/dms/projects' },
    { icon: TrendingUp, label: 'Progress Tracker', path: '/dms/progress' },
    { icon: FileText, label: 'Documents', path: '/dms/documents' },
    { icon: CheckSquare, label: 'Tasks', path: '/dms/tasks' },
  ];

  const handleLogout = () => {
    navigate('/dms/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <img src={mmfsLogo} alt="MMFS" className="h-10 w-auto rounded" />
            <div>
              <h1 className="text-lg font-bold text-primary">Document Management System</h1>
              <p className="text-xs text-muted-foreground">Project & Document Control</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed md:sticky md:translate-x-0 top-[57px] left-0 h-[calc(100vh-57px)] w-64 bg-white border-r border-border transition-transform duration-300 z-40`}
        >
          <nav className="p-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-secondary text-white shadow-md'
                      : 'text-muted-foreground hover:bg-secondary/10 hover:text-secondary'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 md:ml-0">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DMSLayout;

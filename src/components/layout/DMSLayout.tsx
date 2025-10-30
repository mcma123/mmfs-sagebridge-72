import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileText, FolderKanban, TrendingUp, CheckSquare, LogOut, Menu, X, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';

interface DMSLayoutProps {
  children: React.ReactNode;
}

const DMSLayout: React.FC<DMSLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { theme, setTheme } = useTheme();

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
      <header className="bg-card text-card-foreground border-b border-border sticky top-0 z-50 shadow-sm">
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
            <img src="/banner.png" alt="MMFS Banner" className="h-10 w-auto rounded" />
            <div>
              <h1 className="text-lg font-bold text-primary">Document Management System</h1>
              <p className="text-xs text-muted-foreground">Project & Document Control</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Hamburger to toggle full-screen by hiding the sidebar */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle sidebar"
              title={sidebarOpen ? 'Hide sidebar (Full Screen)' : 'Show sidebar'}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              title="Toggle theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {/* Show icon based on current visual mode */}
              <Sun className="h-5 w-5 hidden dark:inline" />
              <Moon className="h-5 w-5 inline dark:hidden" />
            </Button>
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
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${sidebarOpen ? 'translate-x-0 md:translate-x-0 md:w-64 w-64' : '-translate-x-full md:-translate-x-full md:w-0 w-0'} bg-card text-card-foreground border-r border-border min-h-screen transition-all duration-200`}
        >
          <div className="p-4 hidden md:block">
            <div className="flex items-center gap-3">
              <img src="/banner.png" alt="MMFS Banner" className="h-8 w-auto rounded" />
              <div>
                <p className="text-sm font-semibold text-primary">DMS</p>
                <p className="text-xs text-muted-foreground">Project Control</p>
              </div>
            </div>
          </div>

          <nav className="space-y-1 px-2">
            {menuItems.map((item) => (
              <Button
                key={item.label}
                variant={location.pathname === item.path ? 'secondary' : 'ghost'}
                className={`w-full justify-start gap-2 ${location.pathname === item.path ? 'font-semibold' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DMSLayout;


import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, 
  FileText, 
  ShoppingCart, 
  Package, 
  PieChart, 
  BarChart, 
  Settings, 
  Users, 
  CreditCard,
  HelpCircle,
  LogOut,
  Truck,
  Shield,
  BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  collapsed: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    // TODO: Add logout logic here (clear session, tokens, etc.)
    navigate('/login');
  };
  
  // Route Dashboard to the active module when inside Accounting
  const dashboardPath = location.pathname.startsWith('/accounting') ? '/accounting' : '/dashboard';
  // Remove global Documents link from main sidebar; DMS has its own layout
  
  const navigationItems = [
    { name: 'Dashboard', icon: Home, path: dashboardPath },
    { name: 'Entities', icon: Users, path: '/entities' },
    { name: 'Debit/Credit Notes', icon: FileText, path: '/debit-credit-notes' },
    { name: 'Payment Reconciliation', icon: CreditCard, path: '/payment-reconciliation' },
    { name: 'Banking', icon: CreditCard, path: '/banking' },
    // Documents link removed globally from main app sidebar
    { name: 'Accounting', icon: BookOpen, path: '/accounting' },
    { name: 'Reports', icon: PieChart, path: '/reports' },
    { name: 'Administration', icon: Shield, path: '/administration' },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ] as const;

  // Sidebar animation variants
  const sidebarVariants = {
    expanded: { width: '240px', transition: { duration: 0.3, ease: [0.61, 1, 0.88, 1] } },
    collapsed: { width: '72px', transition: { duration: 0.3, ease: [0.61, 1, 0.88, 1] } }
  };

  return (
    <motion.aside
      className="bg-[hsl(var(--sidebar-background))] h-screen z-20 border-r border-[hsl(var(--sidebar-border))] shadow-nav relative"
      variants={sidebarVariants}
      initial={collapsed ? 'collapsed' : 'expanded'}
      animate={collapsed ? 'collapsed' : 'expanded'}
    >
      <div className="h-16 flex items-center px-4 border-b border-[hsl(var(--sidebar-border))]/20">
        {!collapsed ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded-md bg-card text-card-foreground flex items-center justify-center border border-border">
              <span className="text-[hsl(var(--sidebar-background))] font-bold text-xl">M</span>
            </div>
            <span className="font-semibold text-[hsl(var(--sidebar-foreground))] text-lg">MMFS</span>
          </motion.div>
        ) : (
          <div className="w-8 h-8 rounded-md bg-card text-card-foreground mx-auto flex items-center justify-center border border-border">
            <span className="text-[hsl(var(--sidebar-background))] font-bold text-xl">M</span>
          </div>
        )}
      </div>
      
      {null}
      
      <nav className="mt-4 px-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 16rem)' }}>
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            
            return (
              <li key={item.name}>
                <Link 
                  to={item.path}
                  className={cn(
                    "flex items-center h-10 px-3 rounded-md transition-all duration-300 group",
                    isActive 
                      ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))]" 
                      : "text-[hsl(var(--sidebar-foreground))]/80 hover:bg-[hsl(var(--sidebar-accent))]/50 hover:text-[hsl(var(--sidebar-foreground))]"
                  )}
                >
                  <item.icon 
                    className={cn(
                      "h-5 w-5",
                      collapsed ? "mx-auto" : "mr-3"
                    )} 
                  />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        className="whitespace-nowrap"
                      >
                        {item.name}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      {/* Bottom actions fixed to bottom with proper spacing */}
      <div className="absolute bottom-0 left-0 w-full px-2 py-4 border-t border-[hsl(var(--sidebar-border))]/20 bg-[hsl(var(--sidebar-background))]">
        <div className={cn(
          "space-y-1",
          collapsed ? "px-2" : "px-3"
        )}>
          <a
            href="https://wa.me/27697906374"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center h-10 rounded-md transition-all duration-200",
              "text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))]/50 hover:text-[hsl(var(--sidebar-foreground))]",
              collapsed ? "justify-center px-0" : "px-3"
            )}
          >
            <HelpCircle className={cn("h-5 w-5", collapsed ? "" : "mr-3")} />
            {!collapsed && <span>Help & Support</span>}
          </a>
          
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center h-10 rounded-md transition-all duration-200 w-full",
              "text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))]/50 hover:text-[hsl(var(--sidebar-foreground))]",
              collapsed ? "justify-center px-0" : "px-3"
            )}
          >
            <LogOut className={cn("h-5 w-5", collapsed ? "" : "mr-3")} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </div>
    </motion.aside>
  );
};

export default Sidebar;


import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  Bell, 
  Mail, 
  Menu, 
  X, 
  ChevronDown, 
  User,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  toggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar, sidebarCollapsed }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  
  return (
    <header className="h-16 border-b border-border/60 bg-background/95 backdrop-blur-sm px-4 flex items-center justify-between z-10 shadow-nav">
      <div className="flex items-center">
        <button 
          onClick={toggleSidebar}
          className="w-8 h-8 rounded-md flex items-center justify-center text-primary-500 hover:bg-sage-lightGray transition-colors mr-3"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Menu size={20} />
        </button>
        
        <div className={cn(
          "relative transition-all duration-300 ease-in-out",
          searchFocused ? "w-96" : "w-64"
        )}>
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search size={16} className="text-muted-foreground" />
          </div>
          <input
            type="search"
            className="w-full py-2 pl-10 pr-4 text-sm text-foreground bg-sage-lightGray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-all"
            placeholder="Search transactions, customers..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-sage-lightGray transition-colors relative"
          >
            <Bell size={18} className="text-sage-darkGray" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary-500 rounded-full"></span>
          </button>
          
          {showNotifications && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 mt-2 w-80 bg-card text-card-foreground rounded-lg shadow-lg py-2 z-50 border border-border"
            >
              <div className="px-4 py-2 border-b border-border">
                <h4 className="font-medium">Notifications</h4>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <div className="px-4 py-3 hover:bg-sage-lightGray border-l-2 border-primary-500">
                  <p className="text-sm font-medium">New invoice paid</p>
                  <p className="text-xs text-muted-foreground">Client XYZ paid invoice #1234</p>
                  <p className="text-xs text-muted-foreground mt-1">10 minutes ago</p>
                </div>
                <div className="px-4 py-3 hover:bg-sage-lightGray">
                  <p className="text-sm font-medium">Expense approval</p>
                  <p className="text-xs text-muted-foreground">New expense needs your approval</p>
                  <p className="text-xs text-muted-foreground mt-1">1 hour ago</p>
                </div>
                <div className="px-4 py-3 hover:bg-sage-lightGray">
                  <p className="text-sm font-medium">System update</p>
                  <p className="text-xs text-muted-foreground">System will be updated tonight</p>
                  <p className="text-xs text-muted-foreground mt-1">5 hours ago</p>
                </div>
              </div>
              <div className="px-4 py-2 border-t border-border">
                <button className="text-xs text-primary-500 hover:text-primary-600 font-medium">
                  See all notifications
                </button>
              </div>
            </motion.div>
          )}
        </div>
        
        {/* Messages */}
        <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-sage-lightGray transition-colors relative">
          <Mail size={18} className="text-sage-darkGray" />
        </button>
        
        {/* Help */}
        <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-sage-lightGray transition-colors">
          <HelpCircle size={18} className="text-sage-darkGray" />
        </button>
        
        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 hover:bg-sage-lightGray rounded-full transition-colors pl-1 pr-2 py-1"
          >
            <div className="w-8 h-8 bg-sage-blue rounded-full flex items-center justify-center text-primary-foreground">
              <User size={16} />
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium leading-none">John Doe</p>
              <p className="text-xs text-muted-foreground leading-none mt-1">Admin</p>
            </div>
            <ChevronDown size={14} className="text-muted-foreground hidden md:block" />
          </button>
          
          {showProfile && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 mt-2 w-48 bg-card text-card-foreground rounded-lg shadow-lg py-2 z-50 border border-border"
            >
              <div className="px-4 py-2 border-b border-border">
                <p className="font-medium text-sm">John Doe</p>
                <p className="text-xs text-muted-foreground">john.doe@example.com</p>
              </div>
              <div className="pt-1">
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-sage-lightGray transition-colors">
                  Profile Settings
                </button>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-sage-lightGray transition-colors">
                  Company Settings
                </button>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-sage-lightGray transition-colors">
                  Preferences
                </button>
                <div className="border-t border-border mt-1 pt-1">
                  <button className="w-full text-left px-4 py-2 text-sm hover:bg-sage-lightGray transition-colors text-red-600">
                    Logout
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;

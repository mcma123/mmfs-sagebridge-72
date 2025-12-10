
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { motion } from 'framer-motion';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Animation variants for page transitions
  const pageVariants = {
    initial: { opacity: 0, y: 10 },
    enter: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.61, 1, 0.88, 1] } },
    exit: { opacity: 0, y: 10, transition: { duration: 0.2, ease: [0.61, 1, 0.88, 1] } }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden print:h-auto print:overflow-visible print:block">
      <div className="print:hidden h-full">
        <Sidebar collapsed={sidebarCollapsed} />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden print:h-auto print:overflow-visible print:block">
        <div className="print:hidden">
          <Header toggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
        </div>

        <motion.main
          className="flex-1 overflow-y-auto px-6 py-6 print:overflow-visible print:h-auto print:px-0 print:py-0"
          initial="initial"
          animate="enter"
          exit="exit"
          variants={pageVariants}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
};

export default MainLayout;

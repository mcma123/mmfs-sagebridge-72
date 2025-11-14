import React from 'react';

type Props = {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

export default function WizardLayout({ sidebar, children, actions }: Props) {
  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {sidebar}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
        {actions && (
          <div className="border-t p-4 bg-background flex justify-between">
            {actions}
          </div>
        )}
      </main>
    </div>
  );
}

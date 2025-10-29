import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription,
} from "@/components/ui/sheet";

type SlideOutPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  side?: "right" | "left" | "top" | "bottom";
  children: React.ReactNode;
  footer?: React.ReactNode;
};

const SlideOutPanel: React.FC<SlideOutPanelProps> = ({
  open,
  onOpenChange,
  title,
  description,
  side = "right",
  children,
  footer,
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className="sm:max-w-md p-0">
        <div className="flex h-full flex-col">
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
            <SheetHeader>
              <SheetTitle>{title}</SheetTitle>
              {description ? <SheetDescription>{description}</SheetDescription> : null}
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 max-h-[100dvh]">
            {children}
          </div>
          {footer ? (
            <div className="sticky bottom-0 z-10 bg-background border-t px-6 py-4">
              <SheetFooter>{footer}</SheetFooter>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SlideOutPanel;
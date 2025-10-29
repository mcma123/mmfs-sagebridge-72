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
      <SheetContent side={side} className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {children}
        </div>
        {footer ? <SheetFooter className="mt-6">{footer}</SheetFooter> : null}
      </SheetContent>
    </Sheet>
  );
};

export default SlideOutPanel;
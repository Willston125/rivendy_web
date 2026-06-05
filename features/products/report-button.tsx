"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ReportModal } from "./report-modal";
import { cn } from "@/lib/utils/cn";

interface ReportButtonProps {
  targetId: string;
  type?: "product" | "seller";
  className?: string;
}

export function ReportButton({ targetId, type = "product", className }: ReportButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className={cn("pt-2 text-center", className)}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {type === "seller" ? "Signaler cette boutique" : "Signaler cette annonce"}
        </button>
      </div>

      <ReportModal targetId={targetId} type={type} isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

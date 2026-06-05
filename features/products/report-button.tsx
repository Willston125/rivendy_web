"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ReportModal } from "./report-modal";

interface ReportButtonProps {
  productId: string;
}

export function ReportButton({ productId }: ReportButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Signaler cette annonce
        </button>
      </div>

      <ReportModal productId={productId} isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

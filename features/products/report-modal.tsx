"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, X, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/utils/cn";

const REPORT_REASONS = [
  { key: "pornography", label: "Contenu pornographique / sexuel", emoji: "🔞" },
  { key: "violence", label: "Violence / contenu choquant", emoji: "⚠️" },
  { key: "illegal", label: "Produit illégal", emoji: "🚫" },
  { key: "fake", label: "Fausse annonce / arnaque", emoji: "🎭" },
  { key: "inappropriate", label: "Contenu inapproprié", emoji: "🤐" },
  { key: "spam", label: "Spam / publicité abusive", emoji: "📢" },
  { key: "other", label: "Autre raison", emoji: "❓" },
] as const;

interface ReportModalProps {
  targetId: string;
  type: "product" | "seller";
  isOpen: boolean;
  onClose: () => void;
}

export function ReportModal({ targetId, type, isOpen, onClose }: ReportModalProps) {
  const { user } = useAuth();
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [alreadyReported, setAlreadyReported] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const checkReportStatus = useCallback(async () => {
    if (!user || !isOpen) return;
    setChecking(true);
    try {
      const table = type === "seller" ? "seller_reports" : "product_reports";
      const targetColumn = type === "seller" ? "seller_id" : "product_id";

      const { data } = await supabase
        .from(table)
        .select("id")
        .eq(targetColumn, targetId)
        .eq("reported_by", user.id)
        .limit(1);

      setAlreadyReported((data ?? []).length > 0);
    } catch (_) {}
    setChecking(false);
  }, [user, targetId, type, isOpen]);

  useEffect(() => {
    checkReportStatus();
  }, [checkReportStatus]);

  // Réinitialiser les états
  useEffect(() => {
    if (!isOpen) {
      setSelectedReason("");
      setDetails("");
      setSuccess(false);
      setErrorMsg(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMsg("Veuillez vous connecter pour signaler ce produit.");
      return;
    }
    if (!selectedReason) {
      setErrorMsg("Veuillez sélectionner une raison.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      let error: { message: string } | null = null;
      if (type === "seller") {
        ({ error } = await supabase.from("seller_reports").insert({
          seller_id: targetId,
          reported_by: user.id,
          reason: selectedReason,
          details: details.trim(),
          status: "pending",
        }));
      } else {
        ({ error } = await supabase.from("product_reports").insert({
          product_id: targetId,
          reported_by: user.id,
          reason: selectedReason,
          details: details.trim(),
          status: "pending",
        }));
      }

      if (error) throw error;

      setSuccess(true);
      setAlreadyReported(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setErrorMsg("Erreur lors de l'envoi du signalement. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay de fond */}
      <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={onClose} />

      {/* Contenu modale */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl transition-all">
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2 text-red-500">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="text-base font-black text-slate-900">Signaler un article</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="px-6 py-5">
          {checking ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-[#009688]" />
              <p className="mt-2 text-xs font-semibold text-slate-500">Vérification de l&apos;état...</p>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-500">
                <CheckCircle className="h-8 w-8" />
              </span>
              <p className="text-sm font-black text-slate-900">Signalement envoyé</p>
              <p className="text-sm font-semibold text-slate-500">
                Merci pour votre signalement. Notre équipe examinera cette {type === "seller" ? "boutique" : "annonce"} dans les plus brefs délais.
              </p>
            </div>
          ) : alreadyReported ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500">
                <AlertTriangle className="h-6 w-6" />
              </span>
              <p className="text-sm font-black text-slate-900">Déjà signalé</p>
              <p className="text-sm font-semibold text-slate-500">
                Vous avez déjà signalé {type === "seller" ? "cette boutique" : "ce produit"}. Notre équipe traite votre demande.
              </p>
              <button
                onClick={onClose}
                className="mt-4 inline-flex h-9 items-center justify-center rounded-full bg-slate-100 px-6 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
              >
                Fermer
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-slate-500 leading-normal">
                Pourquoi souhaitez-vous signaler ce produit ? Votre signalement est anonyme pour le vendeur.
              </p>

              {/* Raisons */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {REPORT_REASONS.map((reason) => {
                  const selected = selectedReason === reason.key;
                  return (
                    <button
                      key={reason.key}
                      type="button"
                      onClick={() => setSelectedReason(reason.key)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl border px-4 py-2.5 text-left text-xs font-bold transition",
                        selected
                          ? "border-red-500 bg-red-50/30 text-red-700"
                          : "border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <span className="text-base">{reason.emoji}</span>
                      <span className="flex-1">{reason.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Détails complémentaires */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Détails complémentaires (facultatif)
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Décrivez précisément le problème pour aider l'équipe de modération..."
                  maxLength={300}
                  className="min-h-[70px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#009688] focus:bg-white resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div className="flex-1">
                  {errorMsg && (
                    <p className="flex items-center gap-1 text-[10px] font-bold text-amber-600">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {errorMsg}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-xs font-black text-slate-600 transition hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !selectedReason}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-red-500 px-6 text-xs font-black text-white shadow-sm shadow-red-500/20 transition hover:bg-red-600 disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Envoyer le signalement"
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

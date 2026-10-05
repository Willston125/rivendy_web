"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_STRENGTH_LABEL,
  passwordCriteria,
  passwordStrength,
  validatePassword,
} from "@/lib/utils/password-policy";
import { phoneHint, validatePhone } from "@/lib/utils/phone-validator";
import { cn } from "@/lib/utils/cn";

const STRENGTH_STYLE: Record<string, { width: string; color: string }> = {
  vide: { width: "0%", color: "bg-slate-200" },
  faible: { width: "25%", color: "bg-red-500" },
  moyen: { width: "50%", color: "bg-amber-500" },
  bon: { width: "75%", color: "bg-[#009688]" },
  excellent: { width: "100%", color: "bg-[#007168]" },
};

export function SignupForm() {
  const router = useRouter();
  const { signUpWithPhone } = useAuth();
  const { countries, country } = useCountry();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [realEmail, setRealEmail] = useState("");
  const [countryId, setCountryId] = useState(country?.id ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const selectedCountryId = countryId || country?.id || "";
  const selectedCountry = countries.find((item) => item.id === selectedCountryId);

  // Même politique que l'app et que le serveur (8 caractères, ni le numéro
  // ni le nom, pas de mot de passe courant) — avant le 2026-10-04 le site en
  // acceptait 6, sans confirmation.
  const identity = { phone, fullName };
  const strength = passwordStrength(password, identity);
  const criteria = passwordCriteria(password);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    if (!selectedCountryId || !selectedCountry) {
      setError("Choisissez un pays disponible.");
      return;
    }
    const phoneError = validatePhone(phone, selectedCountryId);
    if (phoneError) {
      setError(phoneError);
      return;
    }
    const passwordError = validatePassword(password, identity);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      await signUpWithPhone({ fullName: fullName.trim(), phone, password, realEmail: realEmail.trim(), countryId: selectedCountryId });
      router.push("/profile");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inscription impossible. Vérifiez vos informations.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Nom complet</Label>
        <Input id="fullName" name="name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="country">Pays</Label>
          <Select id="country" name="country" autoComplete="country" value={selectedCountryId} onChange={(event) => setCountryId(event.target.value)} required>
            {!selectedCountryId && <option value="">Choisissez un pays</option>}
            {countries.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Numéro WhatsApp</Label>
          <Input
            id="phone"
            name="tel"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={phoneHint(selectedCountryId)}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email (facultatif — pour récupérer votre mot de passe)</Label>
        <Input id="email" name="email" type="email" autoComplete="email" value={realEmail} onChange={(event) => setRealEmail(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          name="new-password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {password && (
          <div className="space-y-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn("h-full rounded-full transition-all", STRENGTH_STYLE[strength].color)}
                style={{ width: STRENGTH_STYLE[strength].width }}
              />
            </div>
            <p className="text-xs font-semibold text-slate-500">
              Robustesse : {PASSWORD_STRENGTH_LABEL[strength]}
            </p>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
              {criteria.map((c) => (
                <li key={c.label} className={c.met ? "text-[#007168]" : "text-slate-400"}>
                  {c.met ? "✓" : "○"} {c.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirmer le mot de passe</Label>
        <Input
          id="confirm"
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          required
        />
      </div>
      {error && <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Création…" : "Créer mon compte"}
      </Button>
      <p className="text-center text-sm text-slate-500">
        Déjà inscrit ?{" "}
        <Link href="/auth/login" className="font-bold text-[#009688]">
          Connexion
        </Link>
      </p>
    </form>
  );
}

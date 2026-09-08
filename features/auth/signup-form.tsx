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

export function SignupForm() {
  const router = useRouter();
  const { signUpWithPhone } = useAuth();
  const { countries, country } = useCountry();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [realEmail, setRealEmail] = useState("");
  const [countryId, setCountryId] = useState(country?.id ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const selectedCountryId = countryId || country?.id || "";
  const selectedCountry = countries.find((item) => item.id === selectedCountryId);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (!selectedCountryId || !selectedCountry) {
        throw new Error("Choisissez un pays disponible.");
      }
      await signUpWithPhone({ fullName, phone, password, realEmail, countryId: selectedCountryId });
      router.push("/profile");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inscription impossible");
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
      <div className="space-y-2">
        <Label htmlFor="phone">Numero WhatsApp</Label>
        <Input id="phone" name="tel" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Indicatif + numéro" required />
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
          <Label htmlFor="email">Email optionnel</Label>
          <Input id="email" name="email" type="email" autoComplete="email" value={realEmail} onChange={(event) => setRealEmail(event.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input id="password" name="new-password" type="password" autoComplete="new-password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required />
      </div>
      {error && <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creation..." : "Creer mon compte"}
      </Button>
      <p className="text-center text-sm text-slate-500">
        Deja inscrit ?{" "}
        <Link href="/auth/login" className="font-bold text-[#009688]">
          Connexion
        </Link>
      </p>
    </form>
  );
}

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
  const [countryId, setCountryId] = useState(country.id);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signUpWithPhone({ fullName, phone, password, realEmail, countryId });
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
        <Input id="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Numero WhatsApp</Label>
        <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+253 77..." required />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="country">Pays</Label>
          <Select id="country" value={countryId} onChange={(event) => setCountryId(event.target.value)}>
            {countries.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email optionnel</Label>
          <Input id="email" type="email" value={realEmail} onChange={(event) => setRealEmail(event.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input id="password" type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required />
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

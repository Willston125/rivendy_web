"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/auth-provider";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/profile";
  const { signInWithPhone } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithPhone(phone, password);
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="phone">Numero WhatsApp</Label>
        <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+253 77 14 53 06" required />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Mot de passe</Label>
          <Link href="/auth/forgot-password" className="text-xs font-bold text-[#009688] hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>
        <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      </div>
      {error && <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Connexion..." : "Se connecter"}
      </Button>
      <p className="text-center text-sm text-slate-500">
        Nouveau sur Rivendy ?{" "}
        <Link href="/auth/signup" className="font-bold text-[#009688]">
          Creer un compte
        </Link>
      </p>
    </form>
  );
}

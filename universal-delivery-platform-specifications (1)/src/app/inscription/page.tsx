"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, toast } from "@/lib/client";
import { Field, Spinner } from "@/components/ui";

export default function InscriptionPage() {
  const router = useRouter();
  const [pseudo, setPseudo] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [check, setCheck] = useState<{ valid: boolean; available: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pseudo.trim().length < 3) {
      setCheck(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/state?scope=checkPseudo&pseudo=${encodeURIComponent(pseudo.trim())}`);
        setCheck(await res.json());
      } catch {
        setCheck(null);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [pseudo]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast("Les mots de passe ne correspondent pas.", "err");
      return;
    }
    setBusy(true);
    try {
      await api("register", { pseudo, password });
      toast(`Bienvenue ${pseudo} ! Votre compte est prêt 🎉`);
      router.push("/");
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="card p-8">
        <p className="kicker">Espace client</p>
        <h1 className="mt-1 font-display text-3xl font-black">Créer mon compte</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Un pseudonyme, un mot de passe — rien d'autre. Vos coordonnées de livraison ne seront demandées qu'au moment de commander.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Pseudonyme" hint="3 à 20 caractères : lettres, chiffres, . _ -">
            <div className="relative">
              <input className="input pr-24" value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="ex. camille_du_donjon" autoComplete="username" />
              {pseudo.trim().length >= 3 && (
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-extrabold ${check?.available ? "text-leaf" : check ? "text-danger" : "text-ink-soft"}`}>
                  {check ? (check.available ? "✓ Disponible" : check.valid ? "✗ Déjà pris" : "✗ Invalide") : "…"}
                </span>
              )}
            </div>
          </Field>
          <Field label="Mot de passe" hint="6 caractères minimum — stocké haché (scrypt), jamais en clair.">
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
          </Field>
          <Field label="Confirmer le mot de passe">
            <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
          </Field>
          <button className="btn-primary w-full !py-3.5" disabled={busy || !check?.available || password.length < 6 || password !== confirm}>
            {busy ? <Spinner /> : "Créer mon compte →"}
          </button>
          <p className="text-center text-[11px] text-ink-soft">
            En créant un compte, vous acceptez les <Link href="/legal#cgv" className="underline">CGU</Link> et la{" "}
            <Link href="/legal#confidentialite" className="underline">politique de confidentialité</Link>.
          </p>
        </form>
        <div className="mt-6 border-t border-dashed border-line pt-4 text-center text-sm font-bold">
          Déjà membre ? <Link href="/connexion" className="text-vermillon-deep underline">Se connecter</Link>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link href="/livreur?apply=1" className="card p-4 text-sm font-extrabold transition hover:border-river/60">🛵 Candidater comme livreur →</Link>
        <Link href="/commercant?apply=1" className="card p-4 text-sm font-extrabold transition hover:border-leaf/60">🏪 Inscrire mon commerce →</Link>
      </div>
    </div>
  );
}

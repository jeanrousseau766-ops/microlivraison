"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, toast } from "@/lib/client";
import { Field, Spinner } from "@/components/ui";
import { BrandMark } from "@/components/Shell";

const DEMOS = [
  { pseudo: "camille", pw: "demo1234", label: "Camille", role: "Cliente", emoji: "🛍️", tone: "bg-vermillon" },
  { pseudo: "yanis", pw: "demo1234", label: "Yanis", role: "Livreur validé", emoji: "🛵", tone: "bg-river" },
  { pseudo: "marcel", pw: "demo1234", label: "Marcel", role: "Commerçant", emoji: "🍲", tone: "bg-leaf" },
  { pseudo: "admin", pw: "loches37", label: "Admin", role: "Administration", emoji: "🛡️", tone: "bg-grape" },
];

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pseudo, setPseudo] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const doLogin = async (p: string, pw: string) => {
    setBusy(true);
    setErr("");
    try {
      const res = await api<{ role: string }>("login", { pseudo: p, password: pw });
      toast(`Bienvenue, ${p} !`);
      const ret = sp.get("return");
      router.push(ret || (res.role === "livreur" ? "/livreur" : res.role === "commercant" ? "/commercant" : res.role === "admin" ? "/admin" : "/"));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="card grid overflow-hidden lg:grid-cols-[1fr_1.1fr]">
        <div className="relative bg-night p-8 text-cream grain">
          <div className="relative">
            <BrandMark size={42} />
            <h1 className="mt-5 font-display text-3xl font-black leading-tight">Heureux de vous revoir dans la Cité.</h1>
            <p className="mt-3 text-sm leading-relaxed text-cream/70">
              Un seul compte pour suivre vos commandes, vos missions ou votre boutique. Connexion protégée : mots de passe
              hachés, limitation des tentatives abusives.
            </p>
            <div className="mt-8">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-ambre">Comptes de démonstration</p>
              <div className="mt-3 space-y-2">
                {DEMOS.map((d) => (
                  <button
                    key={d.pseudo}
                    onClick={() => doLogin(d.pseudo, d.pw)}
                    disabled={busy}
                    className="flex w-full items-center gap-3 rounded-xl border border-cream/15 bg-cream/5 px-4 py-3 text-left transition hover:border-ambre/50 hover:bg-cream/10 cursor-pointer"
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${d.tone} text-lg`}>{d.emoji}</span>
                    <span className="flex-1">
                      <span className="block text-sm font-extrabold">{d.label} · {d.role}</span>
                      <span className="block text-[11px] font-bold text-cream/50">{d.pseudo} / {d.pw}</span>
                    </span>
                    <span className="text-ambre">→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="p-8">
          <h2 className="font-display text-2xl font-black">Connexion</h2>
          <p className="mt-1 text-sm text-ink-soft">Pas encore de compte ? <Link href="/inscription" className="font-extrabold text-vermillon-deep underline">Créez-le en 10 secondes</Link> — pseudonyme + mot de passe, c'est tout.</p>
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              doLogin(pseudo, password);
            }}
          >
            <Field label="Pseudonyme">
              <input className="input" value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="votre pseudo" autoComplete="username" />
            </Field>
            <Field label="Mot de passe">
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </Field>
            {err && <p className="rounded-xl bg-danger/8 px-4 py-2.5 text-sm font-bold text-danger">{err}</p>}
            <button className="btn-primary w-full !py-3.5" disabled={busy || !pseudo || !password}>
              {busy ? <Spinner /> : "Se connecter →"}
            </button>
          </form>
          <div className="mt-8 grid gap-2 sm:grid-cols-2">
            <Link href="/livreur?apply=1" className="card p-4 transition hover:border-river/50">
              <p className="text-sm font-extrabold">🛵 Devenir livreur</p>
              <p className="mt-1 text-xs text-ink-soft">Dossier + validation administrative</p>
            </Link>
            <Link href="/commercant?apply=1" className="card p-4 transition hover:border-leaf/50">
              <p className="text-sm font-extrabold">🏪 Inscrire mon commerce</p>
              <p className="mt-1 text-xs text-ink-soft">0 % de commission sur vos produits</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConnexionPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-12"><div className="skeleton h-96" /></div>}>
      <LoginForm />
    </Suspense>
  );
}

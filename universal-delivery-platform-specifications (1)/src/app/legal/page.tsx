"use client";

import { PageHead, Badge } from "@/components/ui";

const SECTIONS = [
  { id: "mentions", label: "Mentions légales" },
  { id: "cgv", label: "CGU / CGV" },
  { id: "confidentialite", label: "Confidentialité & RGPD" },
  { id: "cookies", label: "Cookies" },
  { id: "produits", label: "Produits réglementés" },
  { id: "reclamation", label: "Réclamations" },
  { id: "transport", label: "Cadre transport & social" },
];

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageHead kicker="Informations légales" title="Un cadre clair, avant l'ouverture commerciale" sub="Version 1.0 — Projet Loches. Ces documents résument les obligations vérifiées avant le lancement ; la version contractuelle complète est fournie à l'ouverture." />
      <div className="mb-8 flex flex-wrap gap-1.5">
        {SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`} className="chip">{s.label}</a>)}
      </div>

      <div className="space-y-6">
        <section id="mentions" className="card scroll-mt-24 p-6">
          <h2 className="font-display text-2xl font-black">Mentions légales</h2>
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
            <p><strong className="text-ink">Éditeur :</strong> Locho SAS (structure en cours d'immatriculation — SIREN attribué avant ouverture), siège social à Loches (37600), Indre-et-Loire. Directeur de la publication : le président de Locho SAS.</p>
            <p><strong className="text-ink">Activité :</strong> plateforme numérique de mise en relation entre clients, commerçants locaux et livreurs indépendants, et prestation d'organisation de livraison. La plateforme n'est pas vendeuse des produits : le contrat de vente est conclu entre le client et le commerçant.</p>
            <p><strong className="text-ink">Hébergement :</strong> infrastructure cloud européenne. Contact : contact@locho.fr — Données personnelles : privacy@locho.fr.</p>
            <p><strong className="text-ink">Avant lancement :</strong> immatriculation définitive, mentions complètes (capital, RCS Tours, TVA), assurances RC professionnelle et marchandises confiées, qualification transport confirmée auprès de la DREAL Centre-Val de Loire.</p>
          </div>
        </section>

        <section id="cgv" className="card scroll-mt-24 p-6">
          <h2 className="font-display text-2xl font-black">Conditions générales (CGU / CGV)</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft">
            <p><strong className="text-ink">Rôles :</strong> le commerçant est seul vendeur, responsable de la conformité, de la qualité et de la légalité de ses produits, et fixe librement ses prix. Locho est prestataire de livraison : ses revenus proviennent exclusivement des frais de livraison, sans aucune marge sur les produits.</p>
            <p><strong className="text-ink">Avant paiement, le client connaît :</strong> l'identité du vendeur, le prix des produits, le détail des frais de livraison (minimum, distance, suppléments urgence / horaires / catégorie, promotions), le total TTC, le délai annoncé, les modalités de paiement, d'annulation, de réclamation et de remboursement.</p>
            <p><strong className="text-ink">Horaires :</strong> livraisons tous les jours de 04h00 à 23h00. Aucune commande ne peut être créée en dehors de cette plage. L'ouverture du service ne garantit pas la présence d'un livreur à chaque instant ; chaque commerce n'est commandable que pendant ses propres horaires.</p>
            <p><strong className="text-ink">Annulation :</strong> gratuite tant que la préparation n'est pas avancée (avant remise au livreur), avec remboursement intégral. Au-delà, une réclamation est examinée par l'administration.</p>
            <p><strong className="text-ink">Rétractation :</strong> 14 jours pour les biens éligibles, à l'exclusion des denrées périssables, des produits confectionnés sur mesure et des contenus descellés ne pouvant être renvoyés pour raison d'hygiène (art. L221-28 du Code de la consommation).</p>
            <p><strong className="text-ink">Paiements :</strong> confiés à un prestataire de paiement agréé adapté aux plateformes multi-vendeurs. Les fonds ne transitent jamais de manière informelle par la plateforme. Remboursements sous 2 à 5 jours ouvrés. <Badge tone="ambre">Mode démonstration : aucun débit réel</Badge></p>
          </div>
        </section>

        <section id="confidentialite" className="card scroll-mt-24 p-6">
          <h2 className="font-display text-2xl font-black">Confidentialité & RGPD</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft">
            <p><strong className="text-ink">Minimisation :</strong> le compte client ne requiert qu'un pseudonyme et un mot de passe (haché avec scrypt, jamais stocké en clair). Les coordonnées de livraison ne sont demandées qu'à la commande et limitées à ce qui est nécessaire.</p>
            <p><strong className="text-ink">Géolocalisation :</strong> la position du livreur n'est partagée qu'avec le client de la commande concernée, de l'attribution à la livraison. Elle n'est jamais publique. Le suivi s'arrête dès la fin de la mission ; la déconnexion du livreur coupe sa disponibilité et sa géolocalisation.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-xs">
                <thead><tr className="bg-paper"><th className="th">Catégorie</th><th className="th">Durée de conservation</th></tr></thead>
                <tbody>
                  <tr className="border-t border-line/60"><td className="td">Compte & pseudonyme</td><td className="td">jusqu'à suppression, puis anonymisation immédiate</td></tr>
                  <tr className="border-t border-line/60"><td className="td">Données de commande (adresse, téléphone)</td><td className="td">3 ans après la dernière activité</td></tr>
                  <tr className="border-t border-line/60"><td className="td">Positions GPS de livraison</td><td className="td">durée de la mission uniquement</td></tr>
                  <tr className="border-t border-line/60"><td className="td">Pièces d'identité & justificatifs livreurs</td><td className="td">durée de la relation + 5 ans (obligations légales), accès restreint et journalisé</td></tr>
                  <tr className="border-t border-line/60"><td className="td">Écritures financières</td><td className="td">10 ans (obligation comptable), sous forme anonymisée si compte supprimé</td></tr>
                </tbody>
              </table>
            </div>
            <p><strong className="text-ink">Vos droits :</strong> accès, rectification, effacement, limitation, portabilité — depuis « Mon compte » ou via privacy@locho.fr. Réponse sous 30 jours ; réclamation possible auprès de la CNIL.</p>
            <p><strong className="text-ink">Sécurité :</strong> HTTPS, hachage des mots de passe, limitation des tentatives de connexion, permissions par rôle, sauvegardes régulières, journalisation des opérations administratives, protection renforcée des documents d'identité.</p>
          </div>
        </section>

        <section id="cookies" className="card scroll-mt-24 p-6">
          <h2 className="font-display text-2xl font-black">Cookies & traceurs</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Seuls des cookies strictement nécessaires sont utilisés : session de connexion (httpOnly) et panier local. Aucun traceur
            publicitaire, aucune revente de données. Les tuiles cartographiques sont fournies par OpenStreetMap ; aucune donnée de
            commande ne lui est transmise.
          </p>
        </section>

        <section id="produits" className="card scroll-mt-24 p-6">
          <h2 className="font-display text-2xl font-black">Produits interdits ou réglementés</h2>
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
            <p>Sont exclus du catalogue ordinaire :</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Médicaments sur ordonnance et produits de santé soumis à des règles spécifiques de vente et de livraison ;</li>
              <li>Alcool sans cadre légal vérifié et contrôle de majorité ;</li>
              <li>Tabac et produits assimilés ;</li>
              <li>Produits dangereux, armes et objets réglementés ;</li>
              <li>Tout produit dont le transport ou la distribution est interdit.</li>
            </ul>
            <p>Toute livraison de médicaments devra respecter le rôle du pharmacien, les conditions de transport, les règles de conservation et les modalités de remise prévues par le Code de la santé publique.</p>
          </div>
        </section>

        <section id="reclamation" className="card scroll-mt-24 p-6">
          <h2 className="font-display text-2xl font-black">Procédure de réclamation</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Depuis le suivi de commande : « Signaler un problème » (commande non reçue, produit endommagé ou manquant, retard
            important, commerçant ou livreur indisponible, mauvaise adresse, problème de paiement). Chaque réclamation est transmise à
            l'administration, qui consulte les informations utiles, peut demander des justificatifs, enregistre sa décision et déclenche
            le remboursement éventuel. Réponse visée sous 48 h ouvrées ; médiation de la consommation disponible avant toute action contentieuse.
          </p>
        </section>

        <section id="transport" className="card scroll-mt-24 p-6">
          <h2 className="font-display text-2xl font-black">Cadre transport, social & assurances</h2>
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
            <p><strong className="text-ink">Transport :</strong> le transport rémunéré de marchandises pour autrui peut relever du registre des transporteurs. Avant lancement, la qualification exacte (rôle de l'entreprise, statut des livreurs, véhicules dont motorisés légers, usage du vélo) est confirmée auprès de la <strong className="text-ink">DREAL Centre-Val de Loire</strong> : inscription éventuelle au registre, gestionnaire de transport titulaire de la capacité professionnelle, capacité financière.</p>
            <p><strong className="text-ink">Livreurs indépendants :</strong> vérification de l'identité, de l'existence légale (SIREN/SIRET), des autorisations, du permis lorsque nécessaire, de l'assurance couvrant l'usage professionnel et des justificatifs du véhicule. Le livreur conserve une réelle autonomie : heures, capacité et zone librement choisies, sans lien de subordination artificiel.</p>
            <p><strong className="text-ink">Obligations de plateforme :</strong> information fiscale et sociale des revenus des utilisateurs, déclarations applicables, et anticipation des obligations 2027 de prélèvement à la source de certaines cotisations des micro-entrepreneurs de plateformes. Transparence des relations commerciales.</p>
            <p><strong className="text-ink">Assurances :</strong> RC professionnelle, RC liée au transport selon qualification, véhicules exploités, marchandises confiées, dommages aux tiers. Chaque livreur fournit les justificatifs correspondant à son activité réelle.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

# Sasha Connect — comment fonctionnent les affiliations

Trois acteurs : **l'administrateur** (la clinique), les **partenaires** (salons, boutiques… qui recommandent la clinique) et les **clients** qu'ils amènent.
Chaque partenaire a son propre tableau de bord et ne voit **que ses données** (c'est appliqué côté serveur, pas seulement à l'écran). L'administrateur voit tout.

## Le circuit, étape par étape

1. **Création du partenaire** (Admin → Partners → New Partner)
   On renseigne le nom du commerce, le type, le contact, l'email du partenaire, le **pourcentage de commission** et sa **base de calcul** (montant brut ou bénéfice). Un **code** et un **lien** sont générés : `https://VOTRE-SITE/r/CODE`.
   Le partenaire est créé en statut *Pending* : il faut le passer en **Active** (liste des partenaires → menu du statut → *Activate*). Tant qu'il n'est pas actif, son lien ne fonctionne pas.

2. **Accès du partenaire à son espace**
   Le partenaire reçoit une invitation par email (nécessite Resend), choisit son mot de passe, se connecte, puis remplit une **demande d'accès**. L'administrateur l'approuve dans **Admin → Users → Approve as Partner**. Le partenaire arrive alors sur son portail.

3. **Le partenaire partage son lien** (Portail → Referral Link)
   Sur ses réseaux, par WhatsApp, en boutique… Chaque clic est enregistré avec sa source (Instagram, WhatsApp, direct…).

4. **Un visiteur ouvre le lien et laisse ses coordonnées**
   Un **parrainage** (*referral*) est créé au statut *lead_created* et attribué au partenaire (fenêtre d'attribution : 30 jours par défaut). Un contrôle anti-fraude signale les doublons ou comportements suspects.

5. **La clinique traite le client** (Admin → Referrals → fiche du parrainage)
   Contacté → rendez-vous pris → rendez-vous réalisé → soin terminé. L'administrateur fait avancer le statut.

6. **Calcul de la commission**
   Quand le soin est terminé, l'administrateur saisit le **montant payé** (et le montant éligible) puis lance **Process commission**. La commission = pourcentage du partenaire × base (brut ou bénéfice). Elle est créée au statut *pending* ; on ne peut pas en créer une seconde pour le même parrainage.

7. **Validation** (Admin → Commissions)
   *Approve* → la commission devient **payable**. Autres choix : mettre en attente, ouvrir un litige, rejeter. Une commission déjà payée ne peut plus être ré-approuvée ; un remboursement client passe par le flux de remboursement.

8. **Paiement** (Admin → Payouts)
   L'administrateur regroupe les commissions payables d'un partenaire dans un **paiement** ; les commissions passent à *paid*. Après le virement, il marque le paiement comme effectué en indiquant la référence.

## Des liens d'affiliation professionnels

- **Lien court et lisible** : `https://VOTRE-SITE/r/GLOWSALON`. Le code est généré automatiquement à partir du nom du commerce, il est **unique** (jamais deux partenaires avec le même lien) et fonctionne en majuscules comme en minuscules. Vous pouvez aussi choisir le code à la création (« Link code »).
- **Belle prévisualisation** quand le lien est collé dans WhatsApp, Instagram, Facebook ou iMessage : titre, texte « recommandé par <partenaire> » et image. Les pages de parrainage ne sont pas indexées par Google.
- **Page client soignée** : formulaire simple, numéro de téléphone vérifié, message clair en cas d'erreur, protection contre les robots et contre le double envoi (un client ne crée jamais deux parrainages).
- **Espace partenaire → Referral Link** : copier le lien, partager sur WhatsApp ou par email en un clic, **QR code** téléchargeable (PNG ou SVG) pour comptoir, flyers et cartes de visite, et **un lien suivi par canal** (Instagram, WhatsApp, Facebook, email, QR) pour savoir d'où viennent les clients.
- **Votre propre domaine** : pour un lien du type `join.sashaaesthetics.com/r/GLOWSALON`, ajoutez un domaine personnalisé au projet Cloudflare Pages (Custom domains). Les liens se mettent à jour tout seuls.

## Sécurité des tableaux de bord

- Chaque partenaire ne voit **que ses propres** parrainages, commissions et paiements : c'est contrôlé par le serveur, pas seulement caché à l'écran.
- Les informations internes de la clinique ne sont **jamais envoyées** aux partenaires : score anti-fraude, adresse IP des clients, notes internes, nom de l'approbateur.
- Un partenaire ne peut rien créer, modifier ni supprimer en dehors de son profil (téléphone, adresse, contact).
- Chaque utilisateur peut **changer son mot de passe** (Profil pour les partenaires, Settings pour l'administrateur) ; les autres appareils sont alors déconnectés.
- Connexion protégée (blocage après trop d'essais), sessions sécurisées, codes à usage unique, en-têtes de sécurité (HTTPS forcé, anti-clickjacking).

## Ce que voit chaque partenaire (Portail)

| Page | Contenu |
|---|---|
| Dashboard | parrainages, gains **en attente / payables / payés**, commission de chaque parrainage |
| My Referrals | ses parrainages et leur avancement |
| Commissions | chaque commission, son montant et son statut |
| Payouts | ses paiements reçus et leur référence |
| Referral Link | son lien, QR code, liens suivis par canal, partage WhatsApp / email |
| Profile | ses coordonnées et son mot de passe |

Il ne voit jamais les autres partenaires ni les données internes de la clinique.

## Comptes de démonstration

- **Administrateur** : `webdxb1@gmail.com` (accès complet).
- **Partenaire de test** : `demo@sashaconnect.test` — partenaire « Demo Beauty Lounge », code `DEMOLOUNGE`, avec 3 parrainages d'exemple (un payé 150, un payable 80, un nouveau lead).
  Les données de démonstration portent le nom « DEMO » ; elles sont supprimables à tout moment (demander la suppression des données démo).

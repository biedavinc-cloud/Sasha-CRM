# Mise en production — Sasha Connect

## 1. Checklist de lancement (à faire une fois)

| # | Action | Où | Vérifier |
|---|---|---|---|
| 1 | Base D1 `sasha-crm` créée, tables + index présents | Cloudflare → D1 | `/api/health` → `"migrated":true,"indexes":true` |
| 2 | `AUTH_SECRET` (32+ caractères aléatoires) | Pages → Settings → Variables and Secrets (Secret) | `"authSecret":true` |
| 3 | `ADMIN_EMAILS` = vos adresses administrateur | idem | `"adminEmails":true` |
| 4 | `RESEND_API_KEY` + `EMAIL_FROM` (domaine d'envoi vérifié chez Resend) | idem + resend.com | `"email":true` ; inscription et « mot de passe oublié » fonctionnent |
| 5 | Logo : déposer `public/logo.png` (carré, ≥ 256 px) dans le dépôt | GitHub → `public/` | le logo s'affiche (sinon repli automatique) |
| 6 | (Optionnel) domaine personnalisé | Pages → Custom domains, puis Settings de l'app → *Custom link domain* | liens et QR sur votre domaine |
| 7 | Changer les mots de passe provisoires (Profil → Change password) | l'app | — |
| 8 | Supprimer les données et comptes de démonstration (voir §4) | base D1 | listes vides |

Quand `/api/health` affiche `"ok":true`, la plateforme est complète.

**Plan Cloudflare gratuit** : le hachage des mots de passe peut dépasser la limite de calcul (erreur 1102 à la connexion). Choisir le plan Workers payant (recommandé en production) ou définir `PBKDF2_ITERATIONS=20000`.

## 2. Mise en route sans email

Tant que Resend n'est pas configuré, tout reste utilisable :
- **Créer un partenaire** (Partners → New Partner, avec son email) : un compte est créé et un **mot de passe provisoire** s'affiche une seule fois (bouton *Copy details*). Le partenaire accède directement à son portail, sans demande d'accès.
- **Inviter du personnel** (Users → Invite) : même principe ; le personnel doit ensuite faire une demande d'accès, que vous approuvez.
- **Mot de passe oublié** : Users → *Reset password* (mot de passe provisoire).
- L'inscription libre (« Create account ») répond clairement que l'email n'est pas disponible.

## 3. Exploitation

- **Santé** : `https://VOTRE-SITE/api/health` (booleans uniquement, aucun secret). Brancher un moniteur d'uptime gratuit (UptimeRobot, Better Stack…) sur cette adresse.
- **Sauvegardes** : D1 conserve automatiquement l'historique (Time Travel : 7 jours en plan gratuit, 30 jours en plan payant).
  - Restaurer à un instant donné : `npx wrangler d1 time-travel restore sasha-crm --timestamp=2026-10-20T08:00:00Z`
  - Export complet (fichier SQL, contient des données personnelles — à ranger en lieu sûr) : `npm run backup` → `backups/`.
- **Déploiement** : chaque commit sur `main` redéploie. En cas de problème : Cloudflare → Deployments → déploiement précédent → *Rollback*.
- **Journaux** : Cloudflare → projet Pages → Functions → *Real-time logs*.
- **Tests avant une mise à jour** : voir `README.md` (`npm run test:api`, `npm run test:ui`, `npm run test:no-email`).

## 3 bis. Sécurité en place

- Données partenaires isolées côté serveur ; champs internes (anti-fraude, IP, notes) jamais envoyés aux partenaires.
- Mots de passe hachés (PBKDF2, sel unique), sessions HttpOnly/SameSite, codes à usage unique, limitation des tentatives, déconnexion des autres appareils au changement de mot de passe.
- Politique de sécurité du navigateur (CSP) appliquée, HTTPS forcé (HSTS), anti-clickjacking, pages non indexées (robots + `noindex`).
- Aucun secret dans le dépôt. Les secrets se gèrent uniquement dans Cloudflare.

## 4. Supprimer les données de démonstration

À faire seulement quand tout ce qui est en base est de la démonstration. Console D1 :

```sql
DELETE FROM entities WHERE entity IN ('Referral','ReferralClick','Commission','Payout','AuditLog');
DELETE FROM entities WHERE entity = 'Partner' AND json_extract(data,'$.referral_code') = 'DEMOLOUNGE';
DELETE FROM entities WHERE entity = 'AccessRequest' AND json_extract(data,'$.user_email') = 'demo@sashaconnect.test';
DELETE FROM users WHERE email IN ('demo@sashaconnect.test','manager@sashaconnect.test');
```

## 5. À valider par vous (je ne peux pas le faire à votre place)

- **Textes légaux** : mention de confidentialité et conditions du programme partenaire (données personnelles collectées sur la page de parrainage). À faire relire par un juriste ; le formulaire contient déjà une phrase de consentement.
- **Domaine d'envoi des emails** (Resend) : enregistrements DNS à ajouter chez votre fournisseur de domaine.

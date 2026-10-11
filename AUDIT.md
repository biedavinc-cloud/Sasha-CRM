# Audit — Sasha CRM (migration Cloudflare), 10 oct. 2026

Périmètre : auth, API entités + RLS, fonctions métier, frontend, dépendances, déploiement.
Méthode : lecture du code, `npm audit`, 77 tests de bout en bout sur Pages + D1 en local (`scripts/smoke-test.mjs`), tests d'attaque ciblés.
Limites : pas de test dans un vrai navigateur, ni Google OAuth, ni envoi d'emails réels (Resend).

## Bloquant
| # | Constat | Statut |
|---|---|---|
| 1 | Déploiement KO : `database_id` de `wrangler.toml` = `0000…` (Error 8000022). | À faire par le propriétaire du compte Cloudflare : créer la base D1 et coller son ID. |
| 2 | Régression de ma migration (déjà sur `main`) : mon remplacement automatique `base44.` → `api.` a transformé `media.base44.com` en `media.api.com` (logos auth + landing, mapping d'images). | Corrigé (`audit-fixes`). |

## Sécurité
| # | Gravité | Constat | Statut |
|---|---|---|---|
| 3 | Haute | Pré-détournement via Google : quelqu'un s'inscrit avec l'email d'une victime (compte non vérifié, mot de passe de l'attaquant) ; quand la victime se connecte via Google le compte est marqué vérifié et le mot de passe de l'attaquant reste valable. | Corrigé : le mot de passe d'un compte non vérifié est supprimé à la liaison Google. |
| 4 | Haute | Injection d'opérateurs sur `trackClick` / `captureReferral` (publics) : `{"referralCode":{"$gt":""}}` renvoyait un partenaire sans connaître le code → énumération des codes et noms, faux clics/parrainages attribués à n'importe quel partenaire. Reproduit. | Corrigé : corps plats uniquement sur les fonctions publiques. |
| 5 | Haute (si activé) | `pushToGitHub` : owner/repo/branch pris dans le corps et injectés dans des URL portant `GITHUB_TOKEN` ; permet d'écrire sur `main`, donc de déployer du code en prod depuis une session admin. | Paramètres validés. Recommandation : supprimer la fonction (héritage Base44) et ne pas définir `GITHUB_TOKEN`. |
| 6 | Moyenne | Le score de fraude était renvoyé à l'appelant anonyme (aide à contourner la détection). | Corrigé. |
| 7 | Moyenne | Corps non bornés sur les endpoints publics (1,5 Mo accepté). | Corrigé : 16 Ko max, 500 car. par champ. |
| 8 | Moyenne | Erreurs 500 renvoyaient le texte interne (`error.message`). | Corrigé : message générique, détail dans les logs. |
| 9 | Moyenne | Aucun en-tête de sécurité. | Ajoutés (`public/_headers`). La CSP complète est en *Report-Only* : à passer en enforcé après test navigateur. |
| 10 | Moyenne | Dépendances : 14 vulnérabilités (6 hautes). 134 paquets inutilisés retirés (jspdf/dompurify, stripe, three…) → 10 restantes. Reste : outils de build Tailwind (braces, micromatch… non livrés aux utilisateurs) et `react-router` 6.30.6 (open redirect via backslash ; mitigé par `safeReturnTo`, correctif = passage en v7, non fait). | Partiel |

## Logique métier (argent) — reproduit avant correctif
| # | Constat | Statut |
|---|---|---|
| 11 | Plusieurs commissions pour un même parrainage. | Corrigé (409). |
| 12 | `eligibleAmount` négatif → commission négative (−500 constaté). | Corrigé (400). |
| 13 | Une commission **payée** pouvait être ré-approuvée → à nouveau payable → double paiement. | Corrigé (409). |
| 14 | Paiement d'une commission d'un autre partenaire accepté. IDs en double. | Corrigé. |
| 15 | `createPayout` n'est pas transactionnel : deux appels simultanés pourraient payer deux fois. Non reproduit en local (1 succès sur 3) mais le risque théorique demeure en production. | Corrigé (round 2) : réservation atomique des commissions en une seule instruction SQL (5 paiements simultanés → 1 seul réussit, test automatisé). |

## Vérifié OK
Aucun secret dans le dépôt ni l'historique · cookies HttpOnly/SameSite · mots de passe PBKDF2 salés · OTP à usage unique, 5 essais · pas d'énumération de comptes · reset = déconnexion de tous les appareils · RLS testé (partenaire = ses données) · approbation appliquée côté serveur · CSRF (origine + JSON) · limites de tentatives · IP réelle via `cf-connecting-ip`.

## Résiduel / à surveiller
- PBKDF2 limité à 100 000 itérations (plafond Workers), sous la recommandation OWASP ; compensé par les limites de tentatives.
- Limiteur de débit D1 non atomique (marge de quelques requêtes).
- Sessions fixes de 30 jours, pas de liste d'appareils.
- Requêtes JSON sans index : à surveiller au-delà de quelques dizaines de milliers de lignes.
- Bundle JS de 890 Ko non découpé.
- Logo toujours hébergé chez Base44 (à copier dans `public/`).
- Identifiants `R-<timestamp>` / `C-<timestamp>` : collision possible dans la même milliseconde.
- Token GitHub collé en clair dans une conversation : à révoquer.

## Mise à jour — 2ᵉ série de correctifs
- Paiements : réservation atomique `payable → paid` avant création du paiement, annulation automatique si le paiement échoue.
- Limiteur de débit : une seule instruction atomique (plus de fenêtre de course).
- Identifiants `R-` / `C-` / `P-` / `CLK-` : suffixe aléatoire, plus de collision dans la même milliseconde.
- `pushToGitHub` : désactivée par défaut (active seulement avec `ENABLE_GITHUB_PUSH=1`).
- Performance : chemins JSON littéraux + index (`migrations/0002_indexes.sql`) ; plans de requête vérifiés (recherche par index).
- Tests : 81 vérifications automatiques.

Reste ouvert (volontairement, avec la raison) :
- Liaison D1 `DB` + secrets : à créer dans le dashboard Cloudflare (le dépôt ne dépend plus d'un `database_id` : `wrangler.toml` n'est plus lu par Pages).
- `react-router` v7 et Tailwind v4 : montées de version majeures, impossibles à valider sans test navigateur ; risque actuel mitigé / limité au build.
- Logo hébergé chez Base44 : à copier dans `public/` (le sandbox n'a pas accès à ce domaine).
- PBKDF2 100 000 itérations (plafond Workers), sessions fixes 30 jours.

## Mise à jour — 3ᵉ série (audit approfondi, tests d'interface)
Nouveau : l'application réelle est maintenant rendue dans un navigateur simulé (jsdom) contre le serveur local — 36 tests d'interface + 87 tests API. Toutes les pages admin, partenaire et publique s'affichent sans erreur console ni appel API en échec ; parcours testés : inscription + code, connexion, mot de passe oublié/réinitialisation, demande d'accès + approbation, invitation, création de partenaire.

| # | Constat | Statut |
|---|---|---|
| 16 | Limite D1 de 100 paramètres liés par requête (invisible en local) : une liste `$in` de plus de ~95 éléments ou un paiement de ~100 commissions aurait échoué en production. | Corrigé : listes longues insérées comme littéraux correctement échappés (testé avec 300 valeurs et une apostrophe / injection SQL). |
| 17 | Si l'envoi d'email échouait (clé Resend absente, domaine non vérifié), l'API répondait « OK » et l'utilisateur attendait un code qui n'arrivait jamais. | Corrigé : erreur explicite (503/502) pour les codes et invitations ; la réinitialisation reste uniforme. |
| 18 | Hachage PBKDF2 à 100 000 itérations : peut dépasser la limite CPU du plan Workers gratuit (Error 1102). | Coût configurable (`PBKDF2_ITERATIONS`) ou plan payant ; les anciens hachages restent valides (testé). |
| 19 | Ma série précédente forçait `requested_role` à « user » : la demande « je suis du personnel » était perdue. | Corrigé (c'est seulement une demande ; l'admin attribue le rôle réel). |
| 20 | Ma série précédente pré-approuvait les comptes invités, contrairement au texte de l'écran Users. | Corrigé : l'invitation ne contourne plus l'approbation. |
| 21 | Page blanche sans explication si le bundle ne démarre pas (ex. mauvais dossier de sortie). | Ajouté : message explicite après 6 s, `ErrorBoundary` React, endpoint de diagnostic `/api/health`. |
| 22 | `getGitHubIssues` sans jeton renvoyait une erreur 500. | Corrigé : 503 « GitHub non configuré ». |
| 23 | Bug d'origine (confirmé par test) : la page de réinitialisation plantait (icône `Lock` manquante). | Corrigé en 1ʳᵉ série, désormais couvert par un test d'interface. |

Limites inchangées : pas de test dans un vrai navigateur (jsdom ≠ Chrome), ni Google OAuth, ni envoi réel d'emails.

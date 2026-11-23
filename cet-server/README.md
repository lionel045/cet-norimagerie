# Formulaire CET Norimagerie — demandes, suivi Direction, notifications

## Ce que fait l'appli

| Qui | Quoi |
|---|---|
| **Salarié** | Remplit le formulaire (`/`) → clique « Générer le document » → reçoit un n° (`CET-2026-0001`) |
| **Direction** | Reçoit un mail (aperçu + PDF + bouton « Traiter la demande ») → tableau de bord → Accepter / Refuser |
| **Salarié** | Reçoit la décision par mail (avec le motif) |

- **Tableau de bord** (`/tableau-de-bord`) : compteurs de l'année, liste de toutes les demandes, filtres
  (salarié, statut, type, site), badge NOUVEAU, export Excel (CSV), actualisation auto.
- **Fiche demande** : horodatage, infos, PDF intégré, décision, **historique complet** (création, consultations,
  décision, notifications).
- **Salariés** (`/salaries`) : registre de tous les salariés ayant fait une demande (créé à la 1re demande).
  Pour chacun : nombre de demandes, acceptées / refusées / en attente, jours versés et utilisés (acceptés),
  et l'historique complet de ses demandes avec le rang (1re, 2e, 3e…), la décision, qui l'a prise et quand.
- **Journal d'activité** (`/journal`) : toutes les actions (connexions, échecs, consultations, décisions,
  exports, mails) avec date/heure et auteur.
- **Accès** : réservé aux comptes Direction. Mots de passe hachés (jamais stockés en clair), changement obligatoire
  à la 1re connexion, blocage 10 min après 5 échecs, session de 8 h.

## Tester en 1 clic

1. Installer Node.js LTS (https://nodejs.org).
2. Double-cliquer sur **Lancer le test.bat** (Windows) ou **Lancer le test (Mac).command**.
3. Trois onglets s'ouvrent : formulaire, boîte mail de test, tableau de bord.
   Les **mots de passe temporaires** des comptes Direction s'affichent dans la fenêtre noire.

Sans fichier `.env` → **mode test** : aucun mail réel n'est envoyé, tout arrive dans la boîte de test.

## Mise en production

1. Installer sur un **poste/serveur Norimagerie toujours allumé** (`npm install`, puis `npm start` ou pm2).
2. Créer `.env` à partir de `.env.example` :
   - `PUBLIC_URL=http://<nom-ou-IP-du-serveur>:3000` (adresse des liens dans les mails)
   - le mode d'envoi des mails (voir ci-dessous)
3. Au 1er démarrage, les comptes Direction sont créés et leurs mots de passe temporaires sont écrits dans
   `data/MOTS-DE-PASSE-INITIAUX.txt` → les transmettre **en main propre**. Le fichier se supprime tout seul
   quand toutes les personnes ont choisi leur mot de passe.
4. Donner aux salariés le lien `http://<serveur>:3000`.

### Envoi des emails

Mêmes principes que RappelBiopsie : Microsoft Graph en OAuth *client credentials* (app Entra ID), depuis une boîte
noreply dédiée. Le secret reste dans le `.env` du serveur, jamais dans le navigateur.

**Mails envoyés**

| Quand | À qui | Contenu |
|---|---|---|
| Nouvelle demande | `MAIL_TO` (Direction) | Aperçu (n°, salarié, poste, site, type, jours, motif, horodatage) + lien « Traiter la demande » + PDF joint |
| Nouvelle demande | Salarié | Accusé de réception avec le n° et le récapitulatif (désactivable : `MAIL_CONFIRMATION_SALARIE=false`) |
| Décision prise | Salarié | Acceptée / refusée, par qui, quand, commentaire |

Toutes les valeurs saisies sont échappées dans les mails. Aucun montant n'est envoyé. Pied de mail :
« Message automatique, merci de ne pas y répondre. » Si un mail échoue, la demande reste enregistrée
(visible dans le tableau de bord) et l'erreur est notée dans l'historique et le journal.

**Configuration M365 à demander à l'admin**

1. Boîte partagée `demande-cet-noreply@norimagerie.fr`, sans licence, nom affiché « Demandes CET Norimagerie ».
2. App Entra ID « DemandeCET » avec un secret client (**noter la date d'expiration**).
   **Sans** permission `Mail.Send` dans Entra : le droit d'envoi est donné côté Exchange, limité à la boîte noreply
   (RBAC for Applications) :
   ```powershell
   Connect-ExchangeOnline
   New-ServicePrincipal -AppId <client-id> -ObjectId <object-id-entreprise> -DisplayName "DemandeCET"
   New-ManagementScope -Name "DemandeCET - noreply" -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'demande-cet-noreply@norimagerie.fr'"
   New-ManagementRoleAssignment -App <client-id> -Role "Application Mail.Send" -CustomResourceScope "DemandeCET - noreply"
   Test-ServicePrincipalAuthorization -Identity <client-id> -Resource demande-cet-noreply@norimagerie.fr
   ```
   `<object-id-entreprise>` = l'Object ID de l'**application d'entreprise** (Enterprise applications), pas celui de l'inscription.
3. Facultatif : règle de transport qui rejette les mails envoyés **à** la boîte noreply (réponses des salariés).

**Variables d'environnement (`.env`, serveur uniquement)**

| Variable | Exemple | Rôle |
|---|---|---|
| `AZURE_TENANT_ID` | `xxxxxxxx-…` | ID de l'annuaire (locataire) |
| `AZURE_CLIENT_ID` | `xxxxxxxx-…` | ID d'application de « DemandeCET » |
| `AZURE_CLIENT_SECRET` | `…` | Secret client (à renouveler avant expiration) |
| `MAIL_SENDER` | `demande-cet-noreply@norimagerie.fr` | Boîte d'envoi |
| `MAIL_SENDER_NAME` | `Demandes CET Norimagerie` | Nom affiché (facultatif) |
| `MAIL_TO` | `vfdeux@norimagerie.com,mpchenal@norimagerie.com` | Destinataires des nouvelles demandes |
| `MAIL_CONFIRMATION_SALARIE` | `true` | Accusé de réception au salarié (`false` pour désactiver) |
| `PUBLIC_URL` | `http://SRV-CET:3000` | Adresse du lien dans les mails |

Sans aucune variable `AZURE_*` → mode test (boîte de test sur `/boite-test`). Au démarrage, la fenêtre affiche
`Envoi des mails : GRAPH depuis demande-cet-noreply@…`, ou la liste des variables manquantes.

**Test rapide avec curl** (vérifie le token puis l'envoi, hors appli) :
```bash
TOKEN=$(curl -s -X POST "https://login.microsoftonline.com/$AZURE_TENANT_ID/oauth2/v2.0/token" \
  -d "client_id=$AZURE_CLIENT_ID" -d "client_secret=$AZURE_CLIENT_SECRET" \
  -d "scope=https://graph.microsoft.com/.default" -d "grant_type=client_credentials" | sed 's/.*"access_token":"\([^"]*\)".*/\1/')
curl -i -X POST "https://graph.microsoft.com/v1.0/users/demande-cet-noreply@norimagerie.fr/sendMail" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"message":{"subject":"Test CET","body":{"contentType":"Text","content":"Test"},"toRecipients":[{"emailAddress":{"address":"vous@norimagerie.com"}}]},"saveToSentItems":false}'
```
Réponse attendue : `HTTP/1.1 202 Accepted`.

**Erreurs fréquentes** (affichées dans la fenêtre du serveur et le journal d'activité)

| Code | Cause | Que faire |
|---|---|---|
| 401 | Token refusé : tenant, client ID ou secret faux, ou secret expiré | Vérifier les 3 valeurs, régénérer le secret si expiré |
| 403 | Droit Exchange absent ou pas encore propagé | Attendre jusqu'à 1 h, sinon relancer `Test-ServicePrincipalAuthorization` |
| 404 | `MAIL_SENDER` n'existe pas | Vérifier l'adresse de la boîte partagée |
| 503 | Configuration incomplète | Compléter les variables listées au démarrage |

**Autres modes possibles** (sans app Entra) : Direct Send (`SMTP_HOST=<MX>.mail.protection.outlook.com`,
`SMTP_PORT=25`, uniquement vers des adresses internes) ou SMTP authentifié.

### Règles appliquées par le serveur

- Adresse du salarié obligatoire, en `@norimagerie.com` ou `@norimagerie.fr`.
- Plafonds annuels par salarié (demandes en attente + acceptées de l'année) : 10 jours de versement,
  5 jours d'utilisation, sauf « Solde de tout compte ».
- Anti-abus : 5 demandes maximum par poste toutes les 10 minutes, champ piège invisible pour les robots.
- Double envoi bloqué côté formulaire (même demande renvoyée = ignorée).

## Ajouter un compte au tableau de bord

Double-cliquer sur **Ajouter un compte.bat** (mail, nom, fonction), ou en ligne de commande :
```
node ajouter-compte.js lekoue@norimagerie.com "Lionel EKOUE" "Technicien informatique"
```
Un mot de passe provisoire s'affiche : le transmettre en main propre, la personne choisit le sien à la
première connexion. Tous les comptes ont les mêmes droits (consulter, décider, exporter). La création est
tracée dans le journal d'activité.

## Mise en ligne sur Vercel (recommandé : aucune machine à faire tourner)

L'appli tourne chez Vercel, accessible en HTTPS depuis n'importe où (`https://<projet>.vercel.app`).
Les données restent dans Supabase, les mails partent par Microsoft Graph.

```
Salariés / Direction ──► Vercel (l'appli, région Dublin) ──► Supabase (Irlande)
                                               └──► Microsoft Graph (mails)
```

### 1. Mettre le code sur GitHub (dépôt **privé**)
Dans le dossier `cet-server` :
```
git init
git add .
git commit -m "Outil CET Norimagerie"
git branch -M main
git remote add origin https://github.com/<ton-compte>/cet-norimagerie.git
git push -u origin main
```
Le `.env` n'est **pas** envoyé (exclu par `.gitignore`) : les secrets se saisissent dans Vercel.

### 2. Créer le projet sur Vercel
vercel.com → **Add New → Project** → importer le dépôt `cet-norimagerie`. Vercel détecte Express tout seul
(rien à changer dans Build & Output). Avant de cliquer sur **Deploy**, ouvrir **Environment Variables** :

| Variable | Valeur |
|---|---|
| `SUPABASE_URL` | `https://nzdgdbbynhxvzbnrtnmg.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | la clé `sb_secret_…` |
| `SESSION_SECRET` | une longue valeur aléatoire (voir ci-dessous) |
| `CRON_SECRET` | une autre valeur aléatoire |
| `MAIL_TO` | `vfdeux@norimagerie.com,mpchenal@norimagerie.com` |
| `PUBLIC_URL` | l'adresse Vercel du projet (à compléter après le 1er déploiement) |
| `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `MAIL_SENDER` | quand l'admin les a fournis |

Générer une valeur aléatoire :
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Après le premier déploiement
1. Copier l'adresse du projet (ex. `https://cet-norimagerie.vercel.app`) dans `PUBLIC_URL`
   (Settings → Environment Variables), puis **Deployments → ⋯ → Redeploy**.
2. Tester : formulaire sur `/`, tableau de bord sur `/tableau-de-bord`.
3. Settings → Cron Jobs : la tâche `/api/cron/ping` (tous les jours à 5 h UTC) garde Supabase éveillé.

Ensuite, chaque `git push` sur `main` met le site à jour automatiquement.

### Bon à savoir
- **Comptes** : ceux déjà créés dans Supabase fonctionnent tels quels. Pour en ajouter, lancer
  `Ajouter un compte.bat` sur ton PC (il écrit directement dans Supabase grâce au `.env` local).
- **Sessions** : cookie signé avec `SESSION_SECRET` (8 h). Changer cette valeur déconnecte tout le monde.
  Changer son mot de passe déconnecte ses autres sessions.
- **Sans `AZURE_*`**, les mails ne partent pas (mode test) : à configurer avant de donner le lien aux salariés.
- **Erreurs** : Vercel → projet → **Logs**.
- **Plan** : le plan Hobby (gratuit) de Vercel est réservé à l'usage personnel non commercial ;
  un usage pour l'entreprise relève du plan Pro.

## Installation sur un poste Windows (alternative à Vercel)

1. Copier le dossier `cet-server` sur la machine, de préférence dans `C:\CET\cet-server`, avec le `.env`.
2. Installer Node.js LTS (pour tous les utilisateurs).
3. Clic droit sur **Installer en service.bat** → **Exécuter en tant qu'administrateur**.

Le script installe les dépendances, crée la tâche planifiée « CET Norimagerie » (démarrage avec Windows,
même sans session ouverte, redémarrage automatique en cas d'arrêt), ouvre le port 3000 dans le pare-feu
(réseaux domaine et privé) et ajoute `PUBLIC_URL=http://<nom-du-PC>:3000` au `.env` s'il manque.

- Journal du serveur : `logs\cet.log`
- Après une mise à jour des fichiers ou du `.env` : relancer **Installer en service.bat**.
- Pour tout arrêter : **Desinstaller le service.bat** (en administrateur). Les données Supabase ne sont pas touchées.
- Ne pas lancer `Lancer le test.bat` sur cette machine en même temps (même port).

## Stockage des demandes : Supabase

Sans configuration, les demandes sont enregistrées en fichiers dans `data/`. Avec Supabase, tout est en base
Postgres (demandes, historique, journal, comptes) et les PDF dans un stockage privé : le serveur ne garde plus
aucune donnée, il peut être réinstallé ou déplacé sans rien perdre.

### Mise en place (10 min)
1. Créer un projet sur supabase.com, **région Europe** (Paris `eu-west-3` ou Francfort `eu-central-1`).
2. **SQL Editor** → New query → coller tout `supabase/schema.sql` → **Run**.
3. **Project Settings → API** : copier *Project URL* et la clé **service_role** dans `.env` :
   ```
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```
4. Relancer : la fenêtre doit afficher `Stockage des demandes : Supabase (...)`.

### Mise à jour d'une base existante
Si `schema.sql` a été lancé avant le 18/11/2026 : exécuter **une fois** `supabase/migration-002-salaries.sql`
dans le SQL Editor. Il crée le registre des salariés et y rattache les demandes déjà enregistrées.

### Déjà 2 projets sur le plan gratuit ?
Utiliser un projet existant, avec un schéma séparé `cet` (aucun impact sur les tables du projet) :
1. SQL Editor → coller `supabase/schema-projet-existant.sql` → Run.
2. Project Settings → **Data API** → *Exposed schemas* : ajouter `cet` → Save.
3. Dans `.env`, ajouter `SUPABASE_SCHEMA=cet`.

### Sécurité
- La clé **service_role** reste sur le serveur (fichier `.env`), jamais dans le formulaire ni le navigateur.
- RLS activé sans politique : la clé publique (anon) ne peut **rien** lire ni écrire.
- Le journal `audit` est verrouillé par un trigger : impossible de modifier ou supprimer une ligne.
- Deux décisions simultanées sur la même demande : une seule est enregistrée.
- PDF dans le bucket privé `demandes-pdf`, rangés par année (`2026/CET-2026-0001.pdf`).

### À savoir
- **Plan gratuit suffisant.** Il met normalement en pause un projet inactif 7 jours, mais le serveur fait une
  petite requête à Supabase chaque jour (ligne `Supabase : OK` dans la fenêtre) : tant qu'il tourne, pas de pause.
- Ce sont des données RH : faire valider l'hébergement chez Supabase par la Direction / le DPO.

## Données & sauvegarde (mode fichiers)

Sans Supabase, tout est dans `data/` → **c'est ce dossier qu'il faut sauvegarder**.

- `demandes/<id>.json` + `.pdf` : chaque demande, son statut et son historique
- `audit.log` : journal d'activité
- `utilisateurs.json` : comptes Direction (mots de passe hachés)
- `compteur.json` : numérotation annuelle

## Structure

```
server.js        routes
lib/store/       stockage : supabase.js (Postgres + Storage) ou fichiers.js (local)
supabase/        schema.sql à exécuter dans Supabase
lib/auth.js      comptes, sessions, mots de passe
lib/mail.js      envoi (Graph / SMTP / test)
lib/views.js     pages et mails HTML
public/          formulaire salarié
```

Pour la v2 (Next.js + Prisma), la base Supabase est déjà un Postgres standard : Prisma peut s'y connecter directement.

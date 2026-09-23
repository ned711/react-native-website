# Configurer Supabase

Statut actuel : **NON CONFIGURÉ**. Migrations : 9 fichiers. Aucun projet Supabase n'est relié à ce dépôt.
Le SQL est testé sur PostgreSQL 16 local (`npm run test:db`), l'Edge Function est
vérifiée par `deno check`. Rien n'a encore été exécuté contre un projet Supabase réel.

## 1. Créer le projet et appliquer les migrations

```bash
npm i -g supabase            # ou: npx supabase
supabase login
supabase init                # crée supabase/config.toml (ne remplace pas les migrations)
supabase link --project-ref <REF_DU_PROJET>
supabase db push             # applique supabase/migrations/*.sql dans l'ordre
```

Les migrations supposent ce que Supabase fournit : le schéma `auth` (`auth.users`,
`auth.uid()`) et les rôles `anon`, `authenticated`, `service_role`. Elles créent un
schéma `private` (non exposé par l'API) pour les fonctions internes.

## 2. Déployer le serveur autoritaire

```bash
supabase functions deploy match-action
```

L'Edge Function lit automatiquement `SUPABASE_URL`, `SUPABASE_ANON_KEY` et
`SUPABASE_SERVICE_ROLE_KEY` (fournis par Supabase). Elle importe le moteur partagé
depuis `../../../src`. Si l'outil de déploiement refuse les imports hors de
`supabase/functions`, copier `src/game`, `src/multiplayer`, `src/progression`,
`src/economy`, `src/utils` dans `supabase/functions/_shared/` (point à valider au
premier déploiement).

## 3. Planifier les balayages serveur

Appeler `POST /functions/v1/match-action` avec l'en-tête
`Authorization: Bearer <SERVICE_ROLE_KEY>` (pg_cron + pg_net, ou un scheduler
externe ; ne jamais exposer cette clé au client) :

- `{"type":"TIMEOUT_SWEEP"}` toutes les 10 à 15 s (tours expirés, anti-abandon) ;
- `{"type":"MATCHMAKING_SWEEP"}` toutes les 3 à 5 s (forme les parties à partir
  de `matchmaking_tickets`, complète par des IA après 30 s d'attente).

## 4. Activer Realtime

La dernière migration ajoute `matches`, `game_events`, `chat_messages`,
`gift_events`, `room_players`, `invitations`, `notifications` à la publication
`supabase_realtime` si elle existe. Les RLS s'appliquent aux abonnements.

## 5. Configurer l'application

```bash
cp .env.example .env.local
# renseigner EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY
```

## Restant à faire côté serveur

- Écran de compte (Supabase Auth) : **PRÉPARÉ**, à valider contre le projet.
- Client temps réel de partie en ligne dans l'app : **À FAIRE**.
- Notifications push (fournisseur non choisi) : **NON CONFIGURÉ**.

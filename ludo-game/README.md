# Ludo Royale (Expo / React Native)

Jeu de Ludo mobile : moteur TypeScript pur et vérifié, IA algorithmique, parties
locales jouables, et backend Supabase server-authoritative (SQL testé, non déployé).
Aucune IA externe (LLM, API d'IA, ML) n'est utilisée nulle part.

> Ce dossier est un projet npm autonome placé dans le dépôt du site React Native.
> Il n'est pas dans les workspaces Yarn du site et n'affecte ni son lint ni son build.

## Démarrer

```bash
cd ludo-game
npm install
npm start              # Expo (Expo Go / émulateur / navigateur avec « w »)
npm run typecheck      # tsc --noEmit (0 erreur attendue)
npm test               # Vitest ; les tests base de données sont ignorés sans BD
```

Tests SQL contre un PostgreSQL local (15+ ; testé avec 16) :

```bash
# rôle superutilisateur requis : le harnais crée une base jetable par fichier
LUDO_TEST_DATABASE_URL=postgres://user:pass@localhost:5432/postgres npm run test:db
npm run check:server   # deno check de l'Edge Function (télécharge Deno via npx)
npm run export:android # bundle Metro/Hermes de vérification
```

Le jeu hors ligne ne nécessite aucune configuration. Pour le multijoueur, voir
[docs/SUPABASE.md](docs/SUPABASE.md). Architecture : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Stack

Expo SDK 57, React Native 0.86, React 19.2, TypeScript 6 (strict,
`noUncheckedIndexedAccess`), Expo Router 57, expo-haptics, expo-crypto,
AsyncStorage, supabase-js 2 · Vitest 5, pg (tests SQL), Deno (Edge Function).
Animations : API `Animated` de React Native (pilote natif) ; Reanimated n'est pas
utilisé pour limiter les dépendances natives.

## Arborescence

```
src/
  app/            routes Expo Router : (tabs) Accueil, Jouer, Collection, Amis, Profil ;
                  game, shop, chest, missions, rankings, settings
  game/           moteur pur : board (géométrie + validation), rules, movement, capture,
                  turns, victory, events, engine, dice, replay, spectator, ai, adventure,
                  session (orchestration hors ligne)
  multiplayer/    authority (serveur autoritaire, intents, store CAS, résultats),
                  matchmaking, reconnection (abandon, reconnexion, synchro)
  social/         tags joueur, limitation de débit, chat, cadeaux, invitations, classements
  progression/    niveaux, XP, insignes, fragments, coffres, missions, succès, saisons, stats
  inventory/      catalogue, inventaire, équipement, collection
  content/        personnages, dés, cadeaux, références d'assets (placeholders)
  themes/ environment/ audio/ animations/   présentation data-driven
  economy/        configuration économique (valeurs par défaut à calibrer)
  components/ hooks/ state/ services/ config/ utils/
supabase/
  migrations/     6 migrations SQL (schéma, RLS, RPC, catalogue généré)
  functions/      match-action (Edge Function Deno) + adaptateur Supabase
tests/            Vitest : moteur, IA, multijoueur, social, progression, présentation, SQL
scripts/          génération du SQL du catalogue depuis TypeScript
```

## État réel des fonctionnalités

| Fonctionnalité | Statut | Détail |
|---|---|---|
| Moteur Ludo pur (mouvement, capture, tours, 3 six, fins de partie) | IMPLEMENTÉ | testé |
| Validation mathématique du plateau | IMPLEMENTÉ | 52 cases, boucle, trajets égaux |
| IA facile / normale / difficile | IMPLEMENTÉ | MoveIntent uniquement ; difficile bat facile 189/200 |
| Parties contre l'ordinateur, locales, mixtes ; 2, 3, 4 joueurs, 2v2 | IMPLEMENTÉ | vérifié au navigateur |
| Tous terminent / Top 2 / Top 2 + Duel final | IMPLEMENTÉ | duel vérifié au navigateur |
| Spectateur (« Rester pour regarder ») | IMPLEMENTÉ | hors ligne ; en ligne via RLS |
| Mode Adventure seedé et équitable | IMPLEMENTÉ | 8 types d'événements ; `combat` À FAIRE |
| Replay depuis le journal d'actions | IMPLEMENTÉ | pas d'écran de replay (À FAIRE) |
| Événements typés + bus | IMPLEMENTÉ | |
| Rendu du plateau, pions animés, dé animé | IMPLEMENTÉ | 2D |
| Thèmes (9 palettes), environnements à particules | IMPLEMENTÉ | décors / textures : PLACEHOLDER |
| Personnages 3D, cinématiques de capture, cadeaux 3D | PLACEHOLDER | aucun modèle ; symboles 2D |
| Audio (musiques, effets) | PLACEHOLDER | moteur prêt, aucun fichier licencié |
| Vibrations | IMPLEMENTÉ | désactivable |
| Accessibilité (texte agrandi, réduire animations, rôles/labels) | IMPLEMENTÉ | |
| Backend SQL : profils, amis, blocage, invitations, chat, cadeaux, rooms, matchs, coffres, fragments, équipement, classements, file de matchmaking | PRÉPARÉ | testé sur PostgreSQL 16, pas sur Supabase |
| Serveur autoritaire (Edge Function) | PRÉPARÉ | logique testée, `deno check` OK, non déployé |
| Multijoueur en ligne dans l'app, amis, chat, cadeaux, coffre, classements | NON CONFIGURÉ | nécessite Supabase + écran de connexion (À FAIRE) |
| XP / niveaux / insignes | NON CONFIGURÉ | calcul testé, attribution serveur uniquement |
| Worker de matchmaking | À FAIRE | algorithme testé |
| Missions / succès côté serveur | À FAIRE | logique testée |
| Boutique / paiements | NON CONFIGURÉ | aucun prix défini, aucun fournisseur |
| Notifications push | NON CONFIGURÉ | notifications en base uniquement |
| Saisons / événements | PRÉPARÉ | aucune saison programmée |
| Tournois, clans | À FAIRE | |

L'écran Paramètres > « État du projet » affiche le même tableau dans l'application.

## Sécurité

- Le client n'envoie que des intentions (`ROLL_DICE`, `MOVE_PAWN`, `LEAVE_MATCH`) ;
  le serveur tire les dés et valide tout avec le même moteur.
- XP, monnaies, fragments, coffres, classements : uniquement côté serveur.
- RLS sur toutes les tables ; aucune écriture directe par les clients ;
  fonctions sensibles réservées à `service_role` ; `search_path` vide.
- Seules l'URL et la clé anon de Supabase sont lues par l'app. La clé
  service role ne doit jamais être embarquée.
- Pays : choix explicite du joueur (`set_country`), jamais la géolocalisation.
- Cosmétiques et rareté : aucun effet sur les règles ni sur le dé.

## Tests

- 122 tests unitaires (plateau, mouvements, captures, tours, victoire/duel/2v2,
  Adventure, IA sur 90 parties complètes à états gelés, replay, dé χ², autorité
  serveur, matchmaking, reconnexion, social, progression, contenu, présentation,
  session locale, absence de dérive du SQL généré).
- 26 tests SQL sur PostgreSQL réel (RLS, droits, amis, blocage, invitations
  expirées, chat, limites de débit, coffres concurrents, fragments 6/6,
  équipement, rooms, CAS des actions, spectateurs, résultats idempotents,
  classements, file de matchmaking) ; ignorés (et signalés comme tels) sans BD.
- 1 test statistique de force de l'IA.

## Pour une version publiable

1. Créer le projet Supabase, `db push`, déployer `match-action`, planifier
   `TIMEOUT_SWEEP` ; tester de bout en bout contre ce projet.
2. Écran de connexion Supabase Auth et client temps réel dans l'app (rooms,
   salle d'attente, partie en ligne, reconnexion branchée sur `planSync`).
3. Worker de matchmaking ; suivi serveur des missions et succès.
4. Assets licenciés : modèles 3D, animations, textures, musiques, effets ;
   remplacer les `PLACEHOLDER_ASSET` (aucun changement de logique requis).
5. Prix, fournisseur de paiement et validation serveur des achats.
6. Notifications push (fournisseur à choisir).
7. Tests sur appareils Android moyens / modestes, profilage, builds EAS
   (`eas build`), icônes et écran de démarrage définitifs, politique de
   confidentialité, modération du chat.

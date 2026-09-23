# Architecture

## Principe

```
                 GAME ENGINE (src/game, TypeScript pur, sans I/O)
                       |
           +-----------+-----------+
           |                       |
       GAME STATE              GAME EVENTS (union typée, seq ordonné)
           |                       |
           |        +-------+------+------+-----------+
           |        |       |             |           |
           |       UI    AUDIO        ANIMATION   STATISTIQUES / REPLAY
           |                              |
           |                         ENVIRONNEMENT (visuel seulement)
           |
      MULTIJOUEUR : MatchAuthority (serveur) -> PostgreSQL (CAS)
```

- Le moteur ne lit ni horloge, ni hasard, ni réseau : tout est injecté
  (`EngineContext.now`, valeur du dé dans l'action `ROLL_DICE`).
- La même fonction `applyAction` sert au jeu local, à l'IA, au serveur, au replay.
- L'IA produit un `MoveIntent` choisi parmi `legalMoves` ; l'état qu'elle reçoit
  est en lecture seule (vérifié avec des états gelés dans les tests).

## Convention de position (vérifiée par tests)

| Valeur  | Signification                                  |
|---------|-----------------------------------------------|
| -1      | base                                           |
| 0..51   | circuit commun, relatif à la case de départ    |
| 52..56  | ligne finale du joueur                         |
| 57      | arrivée (centre)                               |

`START_INDEX = {green: 0, yellow: 13, blue: 26, red: 39}` est **dérivé** de l'ordre
des sièges (`index * 13`). Global = `(START_INDEX + relatif) % 52`.

Choix vérifié : la position relative 51 est la case juste avant le départ du joueur
(extrémité de la colonne centrale de son bras). Chaque pion parcourt donc
**exactement un tour complet (52 cases)** puis entre orthogonalement dans sa ligne
finale. La géométrie 15×15 n'écrit à la main que le quart vert ; les trois autres
quarts sont obtenus par rotation, puis `validateBoard` prouve : 52 cases uniques,
boucle fermée (51→0), 48 pas orthogonaux + 4 pas diagonaux uniquement aux coins
intérieurs, départs espacés de 13 et adjacents à leur base, lignes finales reliées
à la case 51, trajets identiques (57 cases) pour les 4 couleurs.

Cases sûres par défaut : départs + étoiles `[0, 9, 13, 22, 26, 35, 39, 48]`
(configurable dans `RuleConfig.safeTrackPositions`).

## Règles (configurables : `RuleConfig`)

- sortie de base uniquement avec 6 ; pas de dépassement du centre (lancer exact) ;
- 6, capture et arrivée d'un pion donnent un lancer supplémentaire ;
- trois 6 consécutifs : tour perdu (désactivable) ;
- capture de tous les pions adverses sur une case non sûre du circuit commun ;
  jamais dans la base, la ligne finale ou sur une case sûre ; pas entre coéquipiers ;
- fin de partie : `all_players`, `top_two`, `top_two_final_duel` ; 2v2 : première
  équipe dont les deux joueurs ont terminé ;
- un joueur qui a terminé ou quitté devient spectateur (aucune action de jeu).

Variante non implémentée (À FAIRE si souhaitée) : blocages de deux pions.

## Adventure

`generateAdventureBoard(seed)` (seed `LUDO-XXXXXX`) tire un motif d'événements
pour UN quart puis le copie sur les quatre : chaque joueur rencontre les mêmes
événements aux mêmes distances de son départ. Contraintes : jamais sur une case
sûre, ni sur un départ ou les 2 cases qui le suivent, ni sur la case d'entrée de
ligne finale ; autant d'événements positifs que négatifs. Les effets ne
s'enchaînent pas. `combat` n'est pas implémenté (À FAIRE).

## Multijoueur (serveur autoritaire)

`MatchAuthority.handleIntent` applique, dans l'ordre : authentification, intent
valide (validation runtime), match existant, joueur assis, rôle (pas spectateur),
siège non repris par l'IA, bon tour, version attendue (anti double action), dé
disponible, puis le moteur (légalité, capture, progression, fin). Le dé est tiré
côté serveur (CSPRNG). Chaque action est enregistrée par `commit_match_action`
(compare-and-swap sur `matches.version` + journal `game_events`).
Les sièges IA et les tours expirés sont joués par le serveur (`advanceAiSeats`,
`handleTurnTimeout`) ; après plusieurs tours manqués le siège est confié à l'IA
ou retiré selon `AbandonPolicy`.

## Modèle de données (PostgreSQL / Supabase)

```
auth.users 1─1 profiles 1─1 wallets
                profiles 1─1 player_stats
                profiles 1─n inventory n─1 items
                profiles 1─1 chest_state, 1─n chest_claims
profiles n─n profiles : friend_requests, friendships (user_a < user_b), blocks
rooms 1─n room_players n─1 profiles ; rooms 0..1─1 matches (match courant)
matches 1─n match_players (siège IA : user_id NULL)
matches 1─n game_events (seq = version) ; matches 1─n game_results (par joueur)
matches 1─n chat_messages / gift_events ; rooms 1─n chat_messages / invitations
profiles 1─n notifications, mission_progress, user_achievements
matchmaking_tickets (member_ids uuid[]) ; seasons ; live_events ; economy_config
countries (ISO, continent) ← profiles.country_code (choix explicite)
```

Sécurité : RLS sur toutes les tables ; aucune politique d'écriture pour les clients ;
écritures via fonctions `SECURITY DEFINER` à `search_path` vide ; `EXECUTE`
révoqué par défaut puis accordé explicitement ; `create_match`,
`commit_match_action`, `apply_match_result` réservées à `service_role` ;
limitation de débit côté serveur (`private.action_log`).

## Présentation

- Rendu du plateau calculé depuis la géométrie logique (`game/board/layout.ts`).
- Animations : dé (séquence pure qui finit toujours sur la vraie valeur), pions
  pas à pas le long de `path`, retour à la base ; `Animated` (pilote natif).
- Environnements : particules procédurales, budgets LOW/NORMAL/HIGH, désactivées
  par « Réduire les animations ».
- Audio : `AudioEngine` écoute les événements ; aucun fichier son présent, le
  backend `noAudioOutputBackend` ne prétend rien jouer ; vibrations via expo-haptics.
- Assets 3D / textures / sons : `AssetRef` de statut `PLACEHOLDER_ASSET`.

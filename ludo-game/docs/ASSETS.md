# Assets à commander

Statut : **aucun de ces fichiers n'existe encore**. Le jeu utilise en attendant des
décors dessinés en code (dégradés, silhouettes, particules), identifiés comme
`PLACEHOLDER_ASSET` dans `src/content/assets.ts`. Chaque fichier livré se branche
en changeant une seule référence d'asset : aucune règle ni logique n'est modifiée.

Les illustrations doivent être **originales ou sous licence commerciale**
(cession de droits écrite pour un jeu mobile monétisé). Ne pas reprendre
d'éléments d'un jeu existant.

## Règles communes

| Élément | Format | Taille | Remarques |
|---|---|---|---|
| Fond lointain `bg_far` | WebP (qualité 85) ou PNG | 1440 × 3120 px, portrait | Ciel, montagnes lointaines. Opaque. |
| Fond intermédiaire `bg_mid` | PNG transparent | 1440 × 3120 px | Monument principal. Transparent ailleurs. |
| Premier plan `bg_near` | PNG transparent | 1440 × 3120 px | Arbres, lanternes, bords d'écran. Transparent au centre. |
| Texture de quadrant ×4 | WebP/PNG | 1024 × 1024 px | Une par couleur : `quad_green`, `quad_yellow`, `quad_red`, `quad_blue`. Motif discret sur la couleur de base, sans texte. |
| Cadre du plateau | PNG transparent | 1024 × 1024 px, 9-slice (bord 96 px) | Bois, pierre, or… selon le pays. |
| Case de piste | PNG | 256 × 256 px, raccordable | Pierre / marbre / papier. Clair, peu contrasté (les pions doivent rester lisibles). |
| Particules ×3 | PNG transparent | 64 × 64 px | Variantes de la particule du pays (ex. 3 pétales différents). |
| Vignette de thème | PNG | 512 × 512 px | Pour la boutique et la collection. |

**Zones de sécurité** (fond 1440 × 3120) :
- 0 à 700 px en haut : zone la plus visible, y placer le monument ;
- 700 à 2300 px : couverte par le plateau (carré de 1400 px centré), ne rien y mettre d'important ;
- 2300 à 3120 px : couverte en partie par le dé et les cartes joueurs.

**Calques séparés obligatoires** : l'interface (pièces, avatars, boutons, textes)
ne doit JAMAIS être incrustée dans les illustrations. Livrer aussi les fichiers
sources (PSD / Procreate / Krita) avec calques.

**Emplacement dans le projet** : `assets/themes/<themeId>/<nom>.webp|png`.

## Par pays

| Thème (`themeId`) | Monument / décor `bg_mid` | Fond `bg_far` | Premier plan `bg_near` | Textures des quadrants | Particules animées | Case / cadre |
|---|---|---|---|---|---|---|
| Japon (`japan`) | Mont Fuji, torii rouge, pagode | Coucher de soleil violet-orangé, lac | Branches de cerisier en fleurs, lanternes en papier, bannière | bambou (vert), grues (jaune), temple / torii (rouge), vagues (bleu) | pétales de sakura, lucioles | pierre claire / bois laqué |
| Égypte (`egypt`) | Pyramides de Gizeh, sphinx | Ciel doré, désert | Palmiers, colonnes, torches | papyrus, scarabée, hiéroglyphes, Nil | sable, braises | grès / or |
| Grèce antique (`greece`) | Parthénon sur l'Acropole | Mer Égée, ciel clair | Oliviers, colonnes doriques | frises grecques, laurier, amphores, vagues | feuilles d'olivier, écume | marbre blanc / marbre veiné |
| Rome antique (`rome`) | Colisée, arcs | Ciel de fin d'après-midi | Pins parasols, colonnes, étendards | mosaïques, aigle, lauriers, fresques | pétales, poussière dorée | travertin / bronze |
| Chine (`china`) | Grande Muraille sur les crêtes | Montagnes dans la brume | Lanternes rouges, pins, dragon | jade, dragon, pivoines, vagues | pétales, lanternes qui s'élèvent | pierre / laque rouge et or |
| France (`france`) | Tour Eiffel, toits de Paris (ou château) | Ciel de soirée | Réverbères, feuillages | fleur de lys, jardins, vitraux, Seine | feuilles d'automne | pierre calcaire / fer forgé |
| Algérie (`algeria`) | Massif du Hoggar (Assekrem), dunes | Ciel du désert, coucher de soleil | Palmiers, motifs berbères | motifs amazighs, tapis, zellige, oasis | sable soufflé par le vent | grès rouge / cuivre |
| Angleterre (`england`) | Big Ben, Tower Bridge | Ciel gris-bleu, Tamise | Réverbères, brouillard | tartan, rose Tudor, briques, Tamise | pluie fine, brouillard | pierre de Portland / bois sombre |
| Russie (`russia`) | Cathédrale Saint-Basile | Ciel d'hiver | Sapins enneigés | motifs khokhloma, gjel, bouleaux, glace | neige | glace / bois peint |
| Inde (`india`) | Taj Mahal et bassin | Ciel à l'aube | Arches mogholes, pétales de souci | mandala, paon, jali, lotus | pétales de souci, fumée d'encens | marbre blanc / grès rose |
| Italie (`italy`, existant) | À préciser (Venise ?) | | | | | |
| Classique (`classic`) | Aucun (fond uni) | Dégradé | — | — | — | pierre claire |

## Autres éléments communs (une seule fois)

| Élément | Format | Taille |
|---|---|---|
| Icônes monnaies (pièce, gemme) | PNG transparent | 128 × 128 px |
| Cadres d'avatar (par rareté : commun, rare, épique, légendaire) | PNG transparent | 256 × 256 px |
| Drapeaux (si non utilisés en emoji) | PNG / SVG | 96 × 64 px |
| Icônes : menu, réglages, chat, emoji, cadeau, aide | SVG ou PNG | 96 × 96 px |
| Faces du dé classique (option, sinon dessinées en code) | PNG | 256 × 256 px ×6 |

## Déjà dessiné en code (aucune commande nécessaire)

- Plateau jouable complet (cases, lignes finales, étoiles, flèches, centre), pions en relief,
  dé et animations : ils suivent la géométrie vérifiée du moteur et restent en code.
- Particules animées (pétales, sable, neige…) : dessinées en code, les PNG de particules
  ci-dessus ne font qu'améliorer leur rendu.

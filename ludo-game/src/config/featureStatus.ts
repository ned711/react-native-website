/**
 * Honest status of every major feature, shown in the app (Settings > État du
 * projet) and in the README. Never mark something IMPLEMENTÉ unless it is.
 */
export type FeatureStatus =
  'IMPLEMENTÉ' | 'PRÉPARÉ' | 'PLACEHOLDER' | 'NON CONFIGURÉ' | 'À FAIRE';

export interface FeatureEntry {
  readonly id: string;
  readonly label: string;
  readonly status: FeatureStatus;
  readonly note: string;
}

export const FEATURES: readonly FeatureEntry[] = [
  {
    id: 'engine',
    label: 'Moteur Ludo pur',
    status: 'IMPLEMENTÉ',
    note: 'Testé (plateau, mouvements, captures, tours, fins de partie).',
  },
  {
    id: 'board',
    label: 'Validation mathématique du plateau',
    status: 'IMPLEMENTÉ',
    note: '52 cases, boucle fermée, trajets égaux.',
  },
  {
    id: 'ai',
    label: 'IA algorithmique (facile / normal / difficile)',
    status: 'IMPLEMENTÉ',
    note: 'Uniquement via MoveIntent.',
  },
  {
    id: 'local',
    label: 'Parties locales et contre ordinateur',
    status: 'IMPLEMENTÉ',
    note: '2, 3, 4 joueurs et 2v2.',
  },
  {
    id: 'adventure',
    label: 'Mode Adventure (seed)',
    status: 'IMPLEMENTÉ',
    note: 'Génération équitable par seed.',
  },
  {
    id: 'duel',
    label: 'Fins de partie (tous / top 2 / duel final)',
    status: 'IMPLEMENTÉ',
    note: '',
  },
  {
    id: 'spectator',
    label: 'Spectateur après victoire',
    status: 'IMPLEMENTÉ',
    note: 'Local ; en ligne via RLS.',
  },
  {
    id: 'dice_anim',
    label: 'Animation du dé',
    status: 'IMPLEMENTÉ',
    note: '2D ; modèles 3D absents.',
  },
  {
    id: 'themes',
    label: 'Thèmes (palettes)',
    status: 'IMPLEMENTÉ',
    note: 'Couleurs réelles ; décors, textures : placeholders.',
  },
  {
    id: 'env',
    label: 'Environnements animés',
    status: 'IMPLEMENTÉ',
    note: 'Particules procédurales ; arrière-plans : placeholders.',
  },
  {
    id: 'characters3d',
    label: 'Personnages 3D et cinématiques',
    status: 'PLACEHOLDER',
    note: 'Aucun modèle 3D ni animation dans le projet.',
  },
  {
    id: 'gifts3d',
    label: 'Cadeaux 3D animés',
    status: 'PLACEHOLDER',
    note: 'Symbole 2D en attendant les modèles.',
  },
  {
    id: 'audio',
    label: 'Audio (musiques, effets)',
    status: 'PLACEHOLDER',
    note: 'Moteur audio prêt, aucun fichier son licencié présent.',
  },
  {
    id: 'haptics',
    label: 'Vibrations',
    status: 'IMPLEMENTÉ',
    note: 'expo-haptics, désactivable.',
  },
  {
    id: 'backend',
    label: 'Backend Supabase (SQL, RLS, RPC)',
    status: 'PRÉPARÉ',
    note: 'Testé sur PostgreSQL local ; aucun projet Supabase connecté.',
  },
  {
    id: 'online',
    label: 'Multijoueur en ligne',
    status: 'NON CONFIGURÉ',
    note: 'Serveur autoritaire écrit et testé ; nécessite un projet Supabase.',
  },
  {
    id: 'friends',
    label: 'Amis, invitations, chat, cadeaux',
    status: 'NON CONFIGURÉ',
    note: 'SQL testé ; nécessite Supabase.',
  },
  {
    id: 'progression',
    label: 'XP, niveaux, insignes, coffres, fragments',
    status: 'NON CONFIGURÉ',
    note: 'Autorité serveur (SQL testé) ; nécessite Supabase.',
  },
  {
    id: 'rankings',
    label: 'Classements pays / continent / monde',
    status: 'NON CONFIGURÉ',
    note: 'SQL testé ; nécessite Supabase.',
  },
  {
    id: 'matchmaking',
    label: 'Matchmaking',
    status: 'PRÉPARÉ',
    note: 'Algorithme et file SQL testés ; worker planifié à faire.',
  },
  {
    id: 'missions',
    label: 'Missions et succès',
    status: 'PRÉPARÉ',
    note: 'Logique testée ; suivi serveur à faire.',
  },
  {
    id: 'shop',
    label: 'Boutique et paiements',
    status: 'NON CONFIGURÉ',
    note: 'Catalogue prêt ; aucun prix ni fournisseur de paiement.',
  },
  {
    id: 'push',
    label: 'Notifications push',
    status: 'NON CONFIGURÉ',
    note: 'Notifications en base ; aucun fournisseur push.',
  },
  {
    id: 'seasons',
    label: 'Saisons et événements',
    status: 'PRÉPARÉ',
    note: 'Structures prêtes ; aucune saison programmée.',
  },
  {id: 'tournaments', label: 'Tournois, clans', status: 'À FAIRE', note: ''},
];

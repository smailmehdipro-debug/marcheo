-- Marchéo · base D1 du serveur hébergé. Toutes les fiches sont rattachées à un compte (compte_id).
CREATE TABLE IF NOT EXISTS comptes (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, sel TEXT NOT NULL, empreinte TEXT NOT NULL, iterations INTEGER NOT NULL,
  adresse_transfert TEXT UNIQUE NOT NULL, offre TEXT NOT NULL DEFAULT 'essai', essai_fin TEXT, stripe_client TEXT, cree_le TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jetons (empreinte TEXT PRIMARY KEY, compte_id TEXT NOT NULL, expire INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS jetons_compte ON jetons (compte_id);
CREATE TABLE IF NOT EXISTS reinitialisations (empreinte TEXT PRIMARY KEY, compte_id TEXT NOT NULL, expire INTEGER NOT NULL);
-- Une ligne par fiche et par compte ; masque = annonce reçue au-delà du quota de l'offre gratuite
CREATE TABLE IF NOT EXISTS fiches (
  compte_id TEXT NOT NULL, coll TEXT NOT NULL, id TEXT NOT NULL, maj_le TEXT NOT NULL, supprime INTEGER NOT NULL DEFAULT 0,
  recu_le TEXT NOT NULL, masque INTEGER NOT NULL DEFAULT 0, json TEXT NOT NULL,
  PRIMARY KEY (compte_id, coll, id)
);
CREATE INDEX IF NOT EXISTS fiches_recu ON fiches (compte_id, recu_le);
-- Confirmations de transfert Gmail reçues (code et lien affichés dans l'application)
CREATE TABLE IF NOT EXISTS transferts (compte_id TEXT NOT NULL, recu_le TEXT NOT NULL, code TEXT, lien TEXT);
CREATE INDEX IF NOT EXISTS transferts_compte ON transferts (compte_id, recu_le);
-- Compteurs d'usage : mois au format AAAA-MM, ou 'total'
CREATE TABLE IF NOT EXISTS usage (compte_id TEXT NOT NULL, mois TEXT NOT NULL, type TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (compte_id, mois, type));
-- Freinage des essais de connexion (par adresse IP et par compte)
CREATE TABLE IF NOT EXISTS essais (cle TEXT PRIMARY KEY, n INTEGER NOT NULL, debut INTEGER NOT NULL);

// Choix du stockage : Supabase si configuré dans .env, sinon fichiers locaux (data/).
const avecSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!avecSupabase && process.env.VERCEL) {
  throw new Error('Sur Vercel, SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont obligatoires (variables du projet)');
}
const backend = avecSupabase ? require('./supabase') : require('./fichiers');

const STATUTS = { attente: 'En attente', acceptee: 'Acceptée', refusee: 'Refusée' };

module.exports = { ...backend, STATUTS, backend };

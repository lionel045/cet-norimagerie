// Ajoute un compte au tableau de bord.
// Usage : node ajouter-compte.js adresse@norimagerie.com "Prénom NOM" "Fonction"
require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });
const auth = require('./lib/auth');
const store = require('./lib/store');

const [email, nom, fonction] = process.argv.slice(2);
if (!email || !nom) {
  console.log('Usage : node ajouter-compte.js adresse@norimagerie.com "Prénom NOM" "Fonction"');
  process.exit(1);
}
(async () => {
  const mdp = await auth.creerCompte(email, nom, fonction);
  await store.audit({ type: 'creation_compte', par: 'administrateur', detail: `Compte créé : ${email}` });
  console.log(`\nCompte créé (${store.backend.nom})`);
  console.log(`  Identifiant           : ${email.toLowerCase()}`);
  console.log(`  Mot de passe provisoire : ${mdp}`);
  console.log('  Un nouveau mot de passe sera demandé à la première connexion.\n');
})().catch(err => { console.error('Impossible de créer le compte : ' + err.message); process.exit(1); });

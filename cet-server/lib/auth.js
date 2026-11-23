// Gestion d'accès au tableau de bord.
// Comptes stockés dans Supabase (ou data/ en local) avec mots de passe hachés (scrypt + sel).
// Session = cookie signé (HMAC) : fonctionne sur Vercel, où plusieurs instances tournent en parallèle.
// Changer de mot de passe invalide les sessions ouvertes ailleurs.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const store = require('./store');
const INIT_FILE = path.join(__dirname, '..', 'data', 'MOTS-DE-PASSE-INITIAUX.txt');
const SESSION_MS = 8 * 3600 * 1000; // 8 h
const SUR_VERCEL = !!process.env.VERCEL;
const echecs = new Map();           // email -> { n, jusqua } (anti brute-force, par instance)

// Clé de signature des sessions : obligatoire sur Vercel, aléatoire en local
const SECRET = process.env.SESSION_SECRET || (SUR_VERCEL ? null : crypto.randomBytes(32).toString('hex'));
if (!SECRET) throw new Error('SESSION_SECRET manquant dans les variables d\'environnement Vercel');

const empreinteMdp = h => crypto.createHash('sha256').update(String(h)).digest('base64url').slice(0, 12);
const signer = data => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
function creerJeton(u) {
  const data = Buffer.from(JSON.stringify({ e: u.email, x: Date.now() + SESSION_MS, v: empreinteMdp(u.motDePasse) })).toString('base64url');
  return data + '.' + signer(data);
}
function lireJeton(jeton) {
  const [data, sig] = String(jeton || '').split('.');
  if (!data || !sig) return null;
  const attendu = Buffer.from(signer(data)), recu = Buffer.from(sig);
  if (attendu.length !== recu.length || !crypto.timingSafeEqual(attendu, recu)) return null;
  try {
    const p = JSON.parse(Buffer.from(data, 'base64url').toString());
    return p.x > Date.now() ? p : null;
  } catch { return null; }
}
// Cookie de session (Secure en HTTPS, comme sur Vercel)
function cookieSession(req, jeton) {
  const https = req.secure || req.headers['x-forwarded-proto'] === 'https';
  return `cet_session=${jeton}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${jeton ? SESSION_MS / 1000 : 0}${https ? '; Secure' : ''}`;
}

const COMPTES_PAR_DEFAUT = [
  { email: 'vfdeux@norimagerie.com', nom: 'Valérie France Deux', fonction: 'Directrice' },
  { email: 'mpchenal@norimagerie.com', nom: 'Marie Pierre Chenal', fonction: 'Resp. administrative et financière' },
];

const hash = (pwd, salt = crypto.randomBytes(16).toString('hex')) =>
  salt + ':' + crypto.scryptSync(pwd, salt, 64).toString('hex');
function verifier(pwd, stored) {
  const [salt, h] = stored.split(':');
  const test = crypto.scryptSync(pwd, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(h, 'hex'));
}

// 1er démarrage : création des comptes avec mot de passe temporaire
async function initialiser() {
  if ((await store.utilisateurs()).length) return;
  const lignes = ['Mots de passe temporaires — à transmettre en main propre puis SUPPRIMER ce fichier.', ''];
  const users = COMPTES_PAR_DEFAUT.map(u => {
    const tmp = crypto.randomBytes(6).toString('base64url');
    lignes.push(`${u.nom} (${u.email}) : ${tmp}`);
    return { ...u, motDePasse: hash(tmp), doitChanger: true, creeLe: new Date().toISOString() };
  });
  await store.creerUtilisateurs(users);
  if (SUR_VERCEL) { console.log(lignes.join('\n')); return; } // disque en lecture seule : visible dans les logs Vercel
  fs.mkdirSync(path.dirname(INIT_FILE), { recursive: true });
  fs.writeFileSync(INIT_FILE, lignes.join('\n') + '\n');
  console.log('Comptes du tableau de bord créés → mots de passe temporaires dans data/MOTS-DE-PASSE-INITIAUX.txt');
}

// Création d'un compte Direction : renvoie le mot de passe provisoire (à changer à la 1re connexion)
async function creerCompte(email, nom, fonction) {
  email = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) throw new Error('Adresse mail invalide : ' + email);
  if (!String(nom || '').trim()) throw new Error('Le nom est obligatoire');
  const provisoire = crypto.randomBytes(6).toString('base64url');
  await store.ajouterUtilisateur({ email, nom: nom.trim(), fonction: (fonction || '').trim(), motDePasse: hash(provisoire), doitChanger: true, creeLe: new Date().toISOString() });
  return provisoire;
}

async function connecter(email, pwd) {
  email = String(email || '').trim().toLowerCase();
  const e = echecs.get(email);
  if (e && e.jusqua > Date.now()) return { erreur: 'Trop de tentatives. Réessayez dans quelques minutes.' };
  const u = (await store.utilisateurs()).find(x => x.email === email);
  if (!u || !verifier(String(pwd || ''), u.motDePasse)) {
    const n = (e?.n || 0) + 1;
    echecs.set(email, { n, jusqua: n >= 5 ? Date.now() + 10 * 60_000 : 0 });
    return { erreur: 'Identifiant ou mot de passe incorrect.' };
  }
  echecs.delete(email);
  return { token: creerJeton(u), user: u };
}

async function changerMotDePasse(email, nouveau) {
  if (String(nouveau).length < 10) return 'Le mot de passe doit faire au moins 10 caractères.';
  await store.majUtilisateur(email, { motDePasse: hash(nouveau), doitChanger: false });
  const users = await store.utilisateurs();
  try { if (!users.some(x => x.doitChanger) && fs.existsSync(INIT_FILE)) fs.unlinkSync(INIT_FILE); } catch { /* lecture seule */ }
  return null;
}

// Nouveau jeton après un changement de mot de passe (l'ancien devient invalide)
async function nouveauJeton(email) {
  const u = (await store.utilisateurs()).find(x => x.email === email);
  return u ? creerJeton(u) : '';
}

const lireCookie = (req, name) =>
  (req.headers.cookie || '').split(';').map(c => c.trim().split('=')).find(([k]) => k === name)?.[1];

async function utilisateurCourant(req) {
  const p = lireJeton(lireCookie(req, 'cet_session'));
  if (!p) return null;
  const u = (await store.utilisateurs()).find(x => x.email === p.e);
  if (!u || empreinteMdp(u.motDePasse) !== p.v) return null; // compte supprimé ou mot de passe changé
  return { email: u.email, nom: u.nom, fonction: u.fonction, doitChanger: u.doitChanger, _jeton: creerJeton(u) };
}

// Middleware : protège une route ; redirige vers /connexion en gardant la page demandée
async function exigerConnexion(req, res, next) {
  let u;
  try { u = await utilisateurCourant(req); } catch (e) { return next(e); }
  if (!u) return res.redirect('/connexion?suite=' + encodeURIComponent(req.originalUrl));
  if (u.doitChanger && req.path !== '/mot-de-passe') return res.redirect('/mot-de-passe?suite=' + encodeURIComponent(req.originalUrl));
  res.append('Set-Cookie', cookieSession(req, u._jeton)); // session glissante
  req.user = u;
  next();
}

function deconnecter(req, res) {
  res.setHeader('Set-Cookie', cookieSession(req, ''));
}

module.exports = { creerCompte, initialiser, connecter, changerMotDePasse, utilisateurCourant, exigerConnexion, deconnecter, cookieSession, nouveauJeton, SESSION_MS };

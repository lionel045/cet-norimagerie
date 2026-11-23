// Stockage local en fichiers (mode test / sans Supabase).
// Même interface async que lib/store/supabase.js.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA = path.join(__dirname, '..', '..', 'data');
const DIR = path.join(DATA, 'demandes');
const AUDIT = path.join(DATA, 'audit.log');
const COUNTER = path.join(DATA, 'compteur.json');
const USERS = path.join(DATA, 'utilisateurs.json');
fs.mkdirSync(DIR, { recursive: true });

function writeJson(file, obj) { // écriture atomique
  fs.writeFileSync(file + '.tmp', JSON.stringify(obj, null, 2));
  fs.renameSync(file + '.tmp', file);
}
const isId = id => /^[0-9a-f-]{36}$/.test(id);
const file = id => path.join(DIR, id + '.json');
const pdf = id => path.join(DIR, id + '.pdf');
const lireSync = id => (isId(id) && fs.existsSync(file(id)) ? JSON.parse(fs.readFileSync(file(id), 'utf8')) : null);

function prochainNumero() {
  const an = new Date().getFullYear();
  const c = fs.existsSync(COUNTER) ? JSON.parse(fs.readFileSync(COUNTER, 'utf8')) : {};
  c[an] = (c[an] || 0) + 1;
  writeJson(COUNTER, c);
  return `CET-${an}-${String(c[an]).padStart(4, '0')}`;
}

module.exports = {
  nom: 'fichiers locaux (data/)',

  async audit(evt) {
    fs.appendFileSync(AUDIT, JSON.stringify({ at: new Date().toISOString(), ...evt }) + '\n');
  },
  async journal(limite = 500) {
    if (!fs.existsSync(AUDIT)) return [];
    return fs.readFileSync(AUDIT, 'utf8').trim().split('\n').filter(Boolean).slice(-limite).reverse().map(l => JSON.parse(l));
  },

  async creer(data, pdfBuffer) {
    const rang = data.email ? (await this.lister()).filter(x => x.email === data.email).length + 1 : null;
    const d = {
      id: crypto.randomUUID(), numero: prochainNumero(), statut: 'attente', creeLe: new Date().toISOString(),
      ...data, rang, decision: null, vuePar: [], historique: [],
    };
    d.historique.push({ at: d.creeLe, type: 'creation', par: d.demandeur, detail: 'Demande soumise via le formulaire' });
    fs.writeFileSync(pdf(d.id), pdfBuffer);
    writeJson(file(d.id), d);
    return d;
  },
  async lire(id) { return lireSync(id); },
  async lister() {
    return fs.readdirSync(DIR).filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')))
      .sort((a, b) => b.creeLe.localeCompare(a.creeLe));
  },
  async lirePdf(id) { return isId(id) && fs.existsSync(pdf(id)) ? fs.readFileSync(pdf(id)) : null; },

  async marquerVue(id, user) {
    const d = lireSync(id);
    if (!d) return null;
    if (!d.vuePar.includes(user.email)) {
      d.vuePar.push(user.email);
      d.historique.push({ at: new Date().toISOString(), type: 'consultation', par: user.nom, detail: 'Première consultation' });
      writeJson(file(id), d);
    }
    return d;
  },
  // Renvoie la demande mise à jour, ou null si une décision existe déjà
  async decider(id, user, statut, motif, detail) {
    const d = lireSync(id);
    if (!d || d.statut !== 'attente') return null;
    const le = new Date().toISOString();
    d.statut = statut;
    d.decision = { statut, motif, par: user.nom, parEmail: user.email, le };
    d.historique.push({ at: le, type: 'decision', par: user.nom, detail });
    writeJson(file(id), d);
    return d;
  },
  async ajouterEvenement(id, evt) {
    const d = lireSync(id);
    if (!d) return;
    d.historique.push({ at: new Date().toISOString(), ...evt });
    writeJson(file(id), d);
  },

  // ── Registre des salariés (calculé à partir des demandes) ──
  async salaries() {
    const parEmail = new Map();
    for (const d of (await this.lister()).filter(x => x.email).reverse()) { // du plus ancien au plus récent
      const s = parEmail.get(d.email) || { email: d.email, premiereDemande: d.creeLe, demandes: [] };
      Object.assign(s, { nom: d.demandeur, poste: d.poste, site: d.site, derniereDemande: d.creeLe });
      s.demandes.unshift(d);
      parEmail.set(d.email, s);
    }
    return [...parEmail.values()].map(s => {
      const n = st => s.demandes.filter(d => d.statut === st).length;
      const j = t => s.demandes.filter(d => d.statut === 'acceptee' && d.type === t).reduce((a, d) => a + (Number(d.jours) || 0), 0);
      return { ...s, nbDemandes: s.demandes.length, nbAttente: n('attente'), nbAcceptees: n('acceptee'), nbRefusees: n('refusee'),
        joursVerses: j('Versement'), joursUtilises: j('Utilisation') };
    }).sort((a, b) => b.derniereDemande.localeCompare(a.derniereDemande));
  },
  async salarie(email) {
    return (await this.salaries()).find(s => s.email === String(email).toLowerCase()) || null;
  },

  async utilisateurs() { return fs.existsSync(USERS) ? JSON.parse(fs.readFileSync(USERS, 'utf8')) : []; },
  async creerUtilisateurs(liste) { writeJson(USERS, liste); },
  async ajouterUtilisateur(u) {
    const users = await this.utilisateurs();
    if (users.some(x => x.email === u.email)) throw new Error('Ce compte existe déjà : ' + u.email);
    users.push(u);
    writeJson(USERS, users);
  },
  async majUtilisateur(email, champs) {
    const users = await this.utilisateurs();
    Object.assign(users.find(u => u.email === email), champs);
    writeJson(USERS, users);
  },
};

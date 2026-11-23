// Serveur CET Norimagerie
//  /                    formulaire salarié (public, réseau interne)
//  /api/demande         réception d'une demande (PDF + données) → enregistrement + mail Direction
//  /tableau-de-bord     suivi des demandes (accès Direction, connexion obligatoire)
//  /demande/:id         fiche + PDF + décision + historique
//  /journal             journal d'activité (traçabilité)
//  /boite-test          boîte mail de test (uniquement sans config mail)
require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

const store = require('./lib/store');
const auth = require('./lib/auth');
const mail = require('./lib/mail');
const V = require('./lib/views');

const PORT = process.env.PORT || 3000;
const TEST = mail.MODE === 'test';
const PUBLIC_URL = (process.env.PUBLIC_URL || (TEST ? `http://localhost:${PORT}` : `http://${os.hostname()}:${PORT}`)).replace(/\/$/, '');
const MAIL_TO = (process.env.MAIL_TO || 'vfdeux@norimagerie.com,mpchenal@norimagerie.com').split(',').map(s => s.trim()).filter(Boolean);
const clip = (s, n) => String(s ?? '').slice(0, n);
const suiteSure = s => (typeof s === 'string' && s.startsWith('/') && !s.startsWith('//') ? s : '/tableau-de-bord');
// Les erreurs des routes async (ex. Supabase injoignable) partent vers le gestionnaire d'erreurs
const a = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // derrière le proxy Vercel : IP réelle et HTTPS détectés
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public'))); // formulaire, logo, librairie PDF (public/vendor)

// ── Réception d'une demande (formulaire salarié) ───────────
const PLAFOND = { Versement: 10, Utilisation: 5 }; // jours ouvrés par an (accord CET)
const CONFIRMATION_SALARIE = process.env.MAIL_CONFIRMATION_SALARIE !== 'false';
const EMAIL_OK = /^[^@\s]+@norimagerie\.(com|fr)$/i;

// Anti-abus (formulaire sans connexion) : 5 demandes max par poste toutes les 10 min + champ piège
const essais = new Map();
function tropDeDemandes(ip) {
  const now = Date.now();
  const l = (essais.get(ip) || []).filter(t => now - t < 10 * 60_000);
  l.push(now);
  essais.set(ip, l);
  return l.length > 5;
}
const refus = (res, code, message) => res.status(code).json({ ok: false, message });

app.post('/api/demande', a(async (req, res) => {
  const b = req.body || {};
  if (b.site_web) return res.json({ ok: true, message: 'Demande enregistrée.' }); // robot : on fait semblant
  if (tropDeDemandes(req.ip)) return refus(res, 429, 'Trop de demandes envoyées depuis ce poste. Réessayez dans quelques minutes.');

  // Validation (reprend les règles du formulaire)
  const type = b.type === 'Utilisation' ? 'Utilisation' : b.type === 'Versement' ? 'Versement' : null;
  const email = clip(b.email, 120).trim().toLowerCase();
  const jours = Number(b.jours);
  const modalite = clip(b.modalite, 120);
  if (!type) return refus(res, 400, 'Type de demande invalide.');
  if (!clip(b.demandeur, 120).trim()) return refus(res, 400, 'Le nom du salarié est obligatoire.');
  if (!EMAIL_OK.test(email)) return refus(res, 400, "L'adresse mail doit être une adresse professionnelle @norimagerie.com ou @norimagerie.fr.");
  if (!Number.isInteger(jours) || jours < 1 || jours > 60) return refus(res, 400, 'Le nombre de jours est invalide.');
  if (typeof b.pdfBase64 !== 'string' || b.pdfBase64.length < 100 || !Array.isArray(b.fields)) return refus(res, 400, 'Document manquant, régénérez la demande.');

  // Plafond annuel : demandes de l'année en attente ou acceptées + celle-ci (sauf solde de tout compte)
  const sansPlafond = type === 'Utilisation' && /^solde de tout compte/i.test(modalite);
  if (!sansPlafond) {
    const an = String(new Date().getFullYear());
    const sal = await store.salarie(email);
    const deja = (sal?.demandes || []).filter(d => d.type === type && d.creeLe.startsWith(an) && d.statut !== 'refusee')
      .reduce((t, d) => t + (Number(d.jours) || 0), 0);
    if (deja + jours > PLAFOND[type]) {
      return refus(res, 422, `Plafond annuel dépassé : ${deja} jour(s) déjà demandé(s) en ${an} pour ce type, ${jours} demandé(s) maintenant, `
        + `maximum ${PLAFOND[type]} jours ouvrés par an.`);
    }
  }

  const pdf = Buffer.from(b.pdfBase64, 'base64');
  const d = await store.creer({
    type,
    demandeur: clip(b.demandeur, 120).trim(),
    email,
    poste: clip(b.poste, 120),
    site: clip(b.site, 80),
    jours,
    motif: clip(b.motif, 300),
    horodatageClient: clip(b.horodatageClient, 40),
    fields: b.fields.slice(0, 20).map(f => ({ label: clip(f.label, 60), value: clip(f.value, 1000) })),
  }, pdf);
  await store.audit({ type: 'creation', id: d.id, numero: d.numero, par: d.demandeur });

  const pdfName = `${d.numero}_${d.demandeur}`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_') + '.pdf';
  const lien = `${PUBLIC_URL}/demande/${d.id}`;

  // 1. Notification Direction (avec PDF)
  try {
    await mail.envoyer({
      to: MAIL_TO,
      subject: `[CET] ${d.numero} – ${d.type} – ${d.demandeur}`,
      text: `Nouvelle demande ${d.numero} (${d.type}) de ${d.demandeur}, reçue le ${V.dt(d.creeLe)}.\nTraiter : ${lien}`,
      html: V.mailNouvelleDemande(d, lien),
      attachments: [{ name: pdfName, content: pdf, url: `/boite-test/pdf/${d.id}` }],
    });
    await store.ajouterEvenement(d.id, { type: 'notification', detail: 'Direction notifiée par mail', par: MAIL_TO.join(', ') });
    await store.audit({ type: 'notification', id: d.id, numero: d.numero, par: 'système', detail: 'Mail Direction' });
  } catch (err) {
    // La demande reste enregistrée et visible dans le tableau de bord
    console.error('Mail Direction KO :', err.message);
    await store.ajouterEvenement(d.id, { type: 'erreur', detail: "Échec de l'envoi du mail à la Direction" });
    await store.audit({ type: 'erreur_mail', id: d.id, numero: d.numero, detail: err.message });
  }

  // 2. Accusé de réception au salarié (un échec ne fait pas échouer la demande)
  if (CONFIRMATION_SALARIE) {
    try {
      await mail.envoyer({
        to: [d.email],
        subject: `[CET] Votre demande ${d.numero} a bien été reçue`,
        text: `Votre demande ${d.numero} (${d.type}, ${d.jours} jour(s)) a bien été reçue le ${V.dt(d.creeLe)}. Vous recevrez la décision de la Direction par mail.`,
        html: V.mailConfirmation(d),
      });
      await store.ajouterEvenement(d.id, { type: 'notification', detail: 'Accusé de réception envoyé au salarié', par: d.email });
    } catch (err) {
      console.error('Mail confirmation salarié KO :', err.message);
      await store.audit({ type: 'erreur_mail', id: d.id, numero: d.numero, detail: 'Confirmation salarié : ' + err.message });
    }
  }

  console.log(`[${V.dt(d.creeLe)}] ${d.numero} – ${d.type} – ${d.demandeur}`);
  res.json({ ok: true, numero: d.numero, message: `Demande n° ${d.numero} enregistrée.` });
}));

// ── Connexion ──────────────────────────────────────────────
app.get('/connexion', (req, res) => res.send(V.connexion(null, req.query.suite)));
app.post('/connexion', a(async (req, res) => {
  const r = await auth.connecter(req.body.email, req.body.mdp);
  if (r.erreur) {
    await store.audit({ type: 'echec_connexion', par: clip(req.body.email, 120), detail: req.ip });
    return res.status(401).send(V.connexion(r.erreur, req.body.suite));
  }
  await store.audit({ type: 'connexion', par: r.user.email, detail: req.ip });
  res.setHeader('Set-Cookie', auth.cookieSession(req, r.token));
  res.redirect(r.user.doitChanger ? '/mot-de-passe?suite=' + encodeURIComponent(suiteSure(req.body.suite)) : suiteSure(req.body.suite));
}));
app.get('/deconnexion', (req, res) => {
  auth.deconnecter(req, res);
  res.redirect('/connexion');
});
app.get('/mot-de-passe', auth.exigerConnexion, (req, res) => res.send(V.motDePasse(req.user, null, req.query.suite)));
app.post('/mot-de-passe', auth.exigerConnexion, a(async (req, res) => {
  if (req.body.mdp !== req.body.mdp2) return res.send(V.motDePasse(req.user, 'Les deux mots de passe ne correspondent pas.', req.body.suite));
  const err = await auth.changerMotDePasse(req.user.email, req.body.mdp);
  if (err) return res.send(V.motDePasse(req.user, err, req.body.suite));
  res.setHeader('Set-Cookie', auth.cookieSession(req, await auth.nouveauJeton(req.user.email)));
  res.redirect(suiteSure(req.body.suite));
}));

// ── Tableau de bord ────────────────────────────────────────
function filtrer(toutes, q) {
  const f = { q: clip(q.q, 80), statut: clip(q.statut, 20), type: clip(q.type, 20), site: clip(q.site, 80) };
  const s = f.q.toLowerCase();
  const liste = toutes.filter(d =>
    (!s || d.demandeur.toLowerCase().includes(s) || d.numero.toLowerCase().includes(s)) &&
    (!f.statut || d.statut === f.statut) && (!f.type || d.type === f.type) && (!f.site || d.site === f.site));
  return { f, liste };
}
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/tableau-de-bord', auth.exigerConnexion, a(async (req, res) => {
  const toutes = await store.lister();
  const { f, liste } = filtrer(toutes, req.query);
  res.send(V.tableauDeBord(req.user, toutes, liste, f));
}));
app.get('/tableau-de-bord/export.csv', auth.exigerConnexion, a(async (req, res) => {
  const { liste } = filtrer(await store.lister(), req.query);
  const c = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lignes = [['N°', 'Reçue le', 'Salarié', 'E-mail', 'Poste', 'Site', 'Type', 'Jours', 'Motif / détail', 'Statut', 'Décidée par', 'Décidée le', 'Commentaire décision']]
    .concat(liste.map(d => [d.numero, V.dt(d.creeLe), d.demandeur, d.email, d.poste, d.site, d.type, d.jours, d.motif,
      store.STATUTS[d.statut], d.decision?.par, d.decision ? V.dt(d.decision.le) : '', d.decision?.motif]));
  await store.audit({ type: 'export', par: req.user.email, detail: `${liste.length} lignes` });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="demandes-cet-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('﻿' + lignes.map(l => l.map(c).join(';')).join('\r\n')); // BOM + ; → s'ouvre direct dans Excel FR
}));

// ── Fiche demande ──────────────────────────────────────────
app.get('/demande/:id', auth.exigerConnexion, a(async (req, res) => {
  const d = await store.marquerVue(req.params.id, req.user);
  if (!d) return res.status(404).send('Demande introuvable');
  await store.audit({ type: 'consultation', id: d.id, numero: d.numero, par: req.user.email });
  const msg = req.query.ok ? { type: 'ok', texte: 'Décision enregistrée.' + (req.query.ok === 'mail' ? ' Le salarié a été prévenu par mail.' : '') }
    : req.query.err ? { type: 'err', texte: req.query.err } : null;
  res.send(V.fiche(req.user, d, msg));
}));
async function envoyerPdf(req, res) {
  const d = await store.lire(req.params.id);
  const pdf = d && await store.lirePdf(d.id);
  if (!pdf) return res.status(404).send('Document introuvable');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="${d.numero}.pdf"`);
  res.send(pdf);
}
app.get('/demande/:id/pdf', auth.exigerConnexion, a(envoyerPdf));

app.post('/demande/:id/decision', auth.exigerConnexion, a(async (req, res) => {
  const id = req.params.id;
  const statut = req.body.statut;
  const motif = clip(req.body.motif, 1000).trim();
  if (!['acceptee', 'refusee'].includes(statut)) return res.redirect(`/demande/${id}?err=` + encodeURIComponent('Décision invalide.'));
  if (statut === 'refusee' && !motif) return res.redirect(`/demande/${id}?err=` + encodeURIComponent('Le motif est obligatoire en cas de refus.'));
  const detail = `Demande ${store.STATUTS[statut].toLowerCase()}` + (motif ? `, commentaire : ${motif}` : '');
  const d = await store.decider(id, req.user, statut, motif, detail);
  if (!d) return res.redirect(`/demande/${id}?err=` + encodeURIComponent('Une décision a déjà été prise sur cette demande.'));
  await store.audit({ type: 'decision', id, numero: d.numero, par: req.user.email, statut, motif });

  let ok = '1';
  if (d.email) {
    try {
      await mail.envoyer({
        to: [d.email],
        subject: `[CET] Votre demande ${d.numero} a été ${statut === 'acceptee' ? 'acceptée' : 'refusée'}`,
        text: `Votre demande ${d.numero} a été ${store.STATUTS[statut].toLowerCase()} par ${d.decision.par}.${motif ? ' Commentaire : ' + motif : ''}`,
        html: V.mailDecision(d),
      });
      await store.ajouterEvenement(id, { type: 'notification', detail: 'Salarié notifié de la décision par mail', par: d.email });
      await store.audit({ type: 'notification', id, numero: d.numero, par: 'système', detail: 'Décision → ' + d.email });
      ok = 'mail';
    } catch (err) {
      console.error('Mail salarié KO :', err.message);
      await store.ajouterEvenement(id, { type: 'erreur', detail: "Échec de l'envoi du mail au salarié" });
      await store.audit({ type: 'erreur_mail', id, numero: d.numero, detail: err.message });
    }
  }
  res.redirect(`/demande/${id}?ok=${ok}`);
}));

// ── Registre des salariés ──────────────────────────────────
app.get('/salaries', auth.exigerConnexion, a(async (req, res) => res.send(V.salaries(req.user, await store.salaries(), clip(req.query.q, 80)))));
app.get('/salaries/:email', auth.exigerConnexion, a(async (req, res) => {
  const x = await store.salarie(req.params.email);
  if (!x) return res.status(404).send('Salarié introuvable');
  res.send(V.salarie(req.user, x));
}));

// ── Journal d'activité ─────────────────────────────────────
app.get('/journal', auth.exigerConnexion, a(async (req, res) => res.send(V.journal(req.user, await store.journal(500)))));

// ── Boîte mail de test ─────────────────────────────────────
if (TEST) {
  app.get('/boite-test', (req, res) => {
    const mails = mail.boiteTest();
    res.send(V.boiteTest(mails, mails.find(m => m.id === req.query.m) || mails[0]));
  });
  app.get('/boite-test/pdf/:id', a((req, res) => { req.query.download = 1; return envoyerPdf(req, res); }));
}

// ── Tâche quotidienne (cron Vercel) : garde le projet Supabase gratuit éveillé ──
app.get('/api/cron/ping', a(async (req, res) => {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ ok: false });
  if (store.ping) await store.ping();
  res.json({ ok: true, at: new Date().toISOString() });
}));

// ── Erreurs ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Erreur :', err.message);
  if (req.path.startsWith('/api/')) return res.status(500).json({ ok: false, message: "Erreur du serveur : la demande n'a pas été enregistrée. Réessayez ou utilisez l'envoi par Outlook." });
  res.status(500).send('Erreur serveur : ' + V.esc(err.message) + '<br><a href="/tableau-de-bord">Retour</a>');
});

// Création des comptes Direction au premier démarrage (si aucun compte n'existe)
const pret = auth.initialiser().catch(err => console.error('Initialisation des comptes impossible :', err.message));

// Sur Vercel : l'app est exportée et Vercel la lance à la demande.
// En local (node server.js, .bat, tâche planifiée) : serveur classique sur le port 3000.
module.exports = app;

if (require.main === module) {
  pret.then(() => app.listen(PORT, () => {
    console.log(`Stockage des demandes : ${store.backend.nom}`);
    console.log(`Envoi des mails       : ${mail.description()}${TEST ? ' (aucun mail réel, boîte de test : http://localhost:' + PORT + '/boite-test)' : ''}`);
    console.log(`Formulaire salarié    : http://localhost:${PORT}`);
    console.log(`Tableau de bord       : http://localhost:${PORT}/tableau-de-bord`);
    console.log(`Liens dans les mails  : ${PUBLIC_URL}`);
    const init = path.join(__dirname, 'data', 'MOTS-DE-PASSE-INITIAUX.txt');
    if (TEST && fs.existsSync(init)) console.log('\n' + fs.readFileSync(init, 'utf8'));
  }));

  // Supabase gratuit : une requête par jour (sur Vercel, c'est le cron qui s'en charge)
  if (store.ping) {
    const garderEveille = () => store.ping()
      .then(() => console.log(`[${V.dt(new Date().toISOString())}] Supabase : OK`))
      .catch(err => console.error('Supabase injoignable :', err.message));
    garderEveille();
    setInterval(garderEveille, 24 * 3600 * 1000);
  }
}

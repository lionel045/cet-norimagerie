// Envoi des mails — 3 modes :
//  graph : Microsoft Graph, OAuth client credentials (app Entra ID), depuis une boîte noreply dédiée
//  smtp  : SMTP (Office 365 ou Direct Send sur le MX, port 25, sans auth)
//  test  : rien n'est envoyé, les mails sont visibles sur /boite-test
// Le secret Entra ID reste côté serveur (.env), jamais dans le navigateur.
const fs = require('fs');
const os = require('os');
const path = require('path');
const nodemailer = require('nodemailer');

const env = (...noms) => noms.map(n => process.env[n]).find(Boolean) || '';
// Noms alignés sur RappelBiopsie (AZURE_*, MAIL_SENDER) ; anciens noms GRAPH_* acceptés
const GRAPH = {
  tenant: env('AZURE_TENANT_ID', 'GRAPH_TENANT_ID'),
  client: env('AZURE_CLIENT_ID', 'GRAPH_CLIENT_ID'),
  secret: env('AZURE_CLIENT_SECRET', 'GRAPH_CLIENT_SECRET'),
  sender: env('MAIL_SENDER', 'GRAPH_SENDER'),
  nom: process.env.MAIL_SENDER_NAME || 'Demandes CET Norimagerie',
};
const GRAPH_VARS = { AZURE_TENANT_ID: GRAPH.tenant, AZURE_CLIENT_ID: GRAPH.client, AZURE_CLIENT_SECRET: GRAPH.secret, MAIL_SENDER: GRAPH.sender };
const grapheDemande = Object.values(GRAPH_VARS).some(Boolean);
const grapheManquant = Object.entries(GRAPH_VARS).filter(([, v]) => !v).map(([k]) => k);

const MODE = grapheDemande ? 'graph' : process.env.SMTP_HOST ? 'smtp' : 'test';
const FROM = process.env.MAIL_FROM || (GRAPH.sender ? `${GRAPH.nom} <${GRAPH.sender}>` : process.env.SMTP_USER) || `${GRAPH.nom} <noreply@norimagerie.com>`;
// Boîte de test : dossier data/ en local, dossier temporaire sur Vercel (disque en lecture seule)
const TEST_DIR = process.env.VERCEL ? path.join(os.tmpdir(), 'boite-test') : path.join(__dirname, '..', 'data', 'boite-test');
if (MODE === 'test') { try { fs.mkdirSync(TEST_DIR, { recursive: true }); } catch { /* ignoré */ } }

const smtp = MODE === 'smtp' ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
}) : null;

// ── Microsoft Graph ─────────────────────────────────────────
const GRAPH_LOGIN = process.env.GRAPH_LOGIN_URL || 'https://login.microsoftonline.com';
const GRAPH_API = process.env.GRAPH_API_URL || 'https://graph.microsoft.com';
const AIDE = {
  401: 'token refusé : tenant, client ID ou secret faux, ou secret expiré',
  403: "droit Exchange absent ou pas encore propagé (jusqu'à 1 h après la création)",
  404: "MAIL_SENDER n'existe pas dans le tenant",
  503: 'configuration Graph incomplète',
};
function erreurGraph(status, corps) {
  const e = new Error(`Graph ${status} (${AIDE[status] || 'erreur inattendue'}) : ${String(corps).slice(0, 500)}`);
  e.status = status;
  return e;
}

let token = null;
async function graphToken() {
  if (token && token.exp > Date.now() + 60_000) return token.value; // cache jusqu'à 60 s avant expiration
  const r = await fetch(`${GRAPH_LOGIN}/${GRAPH.tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GRAPH.client,
      client_secret: GRAPH.secret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });
  const corps = await r.text();
  if (!r.ok) throw erreurGraph(401, corps);
  const j = JSON.parse(corps);
  token = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return token.value;
}

const destinataires = l => (l || []).filter(Boolean).map(a => ({ emailAddress: { address: a } }));

async function envoyerEmailGraph({ to, cc, bcc, subject, html, attachments }) {
  if (grapheManquant.length) throw erreurGraph(503, 'variables manquantes : ' + grapheManquant.join(', '));
  const r = await fetch(`${GRAPH_API}/v1.0/users/${encodeURIComponent(GRAPH.sender)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await graphToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: html },
        from: { emailAddress: { address: GRAPH.sender, name: GRAPH.nom } },
        toRecipients: destinataires(to),
        ccRecipients: destinataires(cc),
        bccRecipients: destinataires(bcc),
        attachments: (attachments || []).map(a => ({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: a.name, contentType: 'application/pdf',
          contentBytes: a.content.toString('base64'),
        })),
      },
      saveToSentItems: false,
    }),
  });
  if (r.status !== 202) {
    if (r.status === 401) token = null; // token invalide : on en redemandera un
    throw erreurGraph(r.status, await r.text());
  }
}

/**
 * @param {{to:string[], cc?:string[], bcc?:string[], subject:string, text:string, html:string, attachments?:{name:string,content:Buffer,url?:string}[]}} m
 */
async function envoyer(m) {
  if (MODE === 'graph') return envoyerEmailGraph(m);
  if (MODE === 'smtp') return smtp.sendMail({
    from: FROM, to: m.to.join(','), cc: (m.cc || []).join(','), bcc: (m.bcc || []).join(','),
    subject: m.subject, text: m.text, html: m.html,
    attachments: (m.attachments || []).map(a => ({ filename: a.name, content: a.content, contentType: 'application/pdf' })),
  });
  // mode test
  fs.writeFileSync(path.join(TEST_DIR, Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '.json'), JSON.stringify({
    from: FROM, to: m.to.join(', '), subject: m.subject, html: m.html,
    date: new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
    attachments: (m.attachments || []).map(a => ({ name: a.name, url: a.url })),
  }));
}

function boiteTest() {
  if (!fs.existsSync(TEST_DIR)) return [];
  return fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.json')).sort().reverse()
    .map(f => ({ id: f.replace('.json', ''), ...JSON.parse(fs.readFileSync(path.join(TEST_DIR, f), 'utf8')) }));
}

const description = () => MODE === 'graph'
  ? `GRAPH depuis ${GRAPH.sender || '?'}${grapheManquant.length ? ' — CONFIG INCOMPLÈTE, manque : ' + grapheManquant.join(', ') : ''}`
  : MODE.toUpperCase();

module.exports = { MODE, envoyer, envoyerEmailGraph, boiteTest, description };

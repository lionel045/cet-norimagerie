// Gabarits HTML (pages du tableau de bord + mails)
const { STATUTS } = require('./store');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dt = iso => iso ? new Date(iso).toLocaleString('fr-FR', {
  timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
}).replace(' ', ' à ') : '—';
const lienSalarie = (email, texte) => email ? `<a href="/salaries/${encodeURIComponent(email)}" onclick="event.stopPropagation()">${esc(texte)}</a>` : esc(texte);
const statut = s => `<span class="st ${s}">${esc(STATUTS[s] || s)}</span>`;
const depuis = iso => {
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return `il y a ${j} jour${j > 1 ? 's' : ''}`;
};

// Icônes (traits, 24×24)
const ico = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  demandes: ico('<path d="M4 4h16v16H4z"/><path d="M4 9h16M9 4v16"/>'),
  salaries: ico('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.5c2.4.2 4 1.8 4.5 4.5"/>'),
  journal: ico('<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>'),
  formulaire: ico('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>'),
  sortie: ico('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>'),
  attente: ico('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  total: ico('<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 12l9 4 9-4M3 17l9 4 9-4"/>'),
  jours: ico('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  recherche: ico('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  export: ico('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  lieu: ico('<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
  verser: ico('<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>'),
  utiliser: ico('<path d="M12 20V8M7 13l5-5 5 5M5 4h14"/>'),
  ouvrir: ico('<path d="M9 6l6 6-6 6"/>'),
};
const initiales = nom => String(nom || '?').trim().split(/\s+/).map(m => m[0]).slice(0, 2).join('').toUpperCase();
const TEINTES = ['#E8EEFC:#22357A', '#E3F4EC:#1D6B3F', '#FDF0E1:#9A5B00', '#F1E8FB:#5B2A8C', '#E4F3F7:#0E6377', '#FBE9EE:#9B2349'];
const avatar = (nom, email, taille = 32) => {
  const [bg, fg] = TEINTES[[...String(email || nom)].reduce((h, c) => h + c.charCodeAt(0), 0) % TEINTES.length].split(':');
  const dim = taille === 32 ? '' : `;width:${taille}px;height:${taille}px;font-size:${Math.round(taille / 3)}px`;
  return `<span class="av" style="background:${bg};color:${fg}${dim}">${esc(initiales(nom))}</span>`;
};
const typeChip = t => `<span class="chip">${t === 'Utilisation' ? I.utiliser : I.verser}${esc(t)}</span>`;

const CSS = `
*{box-sizing:border-box}
html{font-size:14px}
body{margin:0;font-family:"Segoe UI",system-ui,-apple-system,sans-serif;background:#F6F7F9;color:#1A2133;line-height:1.45;font-variant-numeric:tabular-nums}
a{color:#22357A}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid #22357A;outline-offset:2px}
svg{width:18px;height:18px;flex:none}
/* Structure : menu latéral + contenu */
.app{display:flex;min-height:100vh}
.side{width:232px;flex:none;background:#fff;border-right:1px solid #ECEEF2;display:flex;flex-direction:column;position:sticky;top:0;height:100vh}
.side .logo{padding:18px 20px 14px;border-bottom:1px solid #F0F2F5}
.side .logo img{height:34px;display:block}
.side .rubrique{padding:18px 20px 6px;font-size:12px;color:#8A93A6}
.side nav{display:flex;flex-direction:column;gap:2px;padding:0 10px}
.side nav a{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;color:#4A5468;text-decoration:none;font-weight:500}
.side nav a:hover{background:#F4F6FA;color:#1A2133}
.side nav a.on{background:#EEF2FB;color:#22357A;font-weight:600}
.side nav a .nb{margin-left:auto;background:#22357A;color:#fff;font-size:11px;font-weight:700;border-radius:10px;padding:1px 7px}
.side .bas{margin-top:auto;padding:10px;border-top:1px solid #F0F2F5}
.contenu{flex:1;min-width:0;display:flex;flex-direction:column}
.barre{height:64px;background:#fff;border-bottom:1px solid #ECEEF2;display:flex;align-items:center;gap:16px;padding:0 28px;position:sticky;top:0;z-index:5}
.barre .page{display:flex;align-items:center;gap:10px;font-size:17px;font-weight:600}
.barre .page svg{width:20px;height:20px;color:#5B6478}
.barre form.cherche{margin-left:auto;position:relative}
.barre form.cherche svg{position:absolute;left:10px;top:9px;width:16px;height:16px;color:#8A93A6}
.barre form.cherche input{width:260px;height:34px;padding:0 12px 0 32px;border:1px solid #E2E5EB;border-radius:8px;font:inherit;background:#F9FAFB}
.moi{display:flex;align-items:center;gap:10px;padding-left:16px;border-left:1px solid #ECEEF2}
.moi>div>b{display:block;font-size:13px}.moi>div>span{display:block;font-size:12px;color:#8A93A6}
main{padding:24px 28px 60px;max-width:1320px;width:100%}
h1{font-size:22px;font-weight:600;margin:0 0 4px}
h2{font-size:16px;font-weight:600;margin:0}
.sous{color:#6B7489;margin:2px 0 0}
/* Cartes d'indicateurs */
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px}
.kpi{background:#fff;border:1px solid #ECEEF2;border-radius:12px;padding:16px 18px;text-decoration:none;color:inherit;display:block}
a.kpi:hover{border-color:#C9D3EC}
.kpi .ic{width:36px;height:36px;border-radius:9px;background:#22357A;color:#fff;display:grid;place-items:center;margin-bottom:12px}
.kpi .ic.orange{background:#E58A1F}.kpi .ic.vert{background:#2E8A57}.kpi .ic.bleu{background:#2B7A9B}
.kpi .t{font-weight:600}
.kpi .d{color:#8A93A6;font-size:12.5px;margin-top:2px}
.kpi .v{display:flex;align-items:baseline;gap:8px;margin-top:14px}
.kpi .v b{font-size:24px;font-weight:600}
.kpi .v span{font-size:12.5px;color:#6B7489}
/* Panneau + tableau */
.pane{background:#fff;border:1px solid #ECEEF2;border-radius:12px}
.pane-tete{display:flex;align-items:center;gap:12px;padding:18px 20px 4px;flex-wrap:wrap}
.pane-tete .sous{font-size:13px}
.outils{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:14px 20px}
.onglets{display:inline-flex;background:#F2F4F7;border-radius:9px;padding:3px}
.onglets a{padding:6px 12px;border-radius:7px;color:#5B6478;text-decoration:none;font-weight:500;font-size:13px;white-space:nowrap}
.onglets a.on{background:#fff;color:#1A2133;box-shadow:0 1px 2px rgba(16,24,40,.08)}
.onglets a .c{color:#8A93A6;margin-left:4px}
.outils .droite{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}
.outils input,.outils select{height:34px;padding:0 10px;border:1px solid #E2E5EB;border-radius:8px;font:inherit;background:#fff;color:inherit}
.champ-cherche{position:relative}.champ-cherche svg{position:absolute;left:10px;top:9px;width:16px;height:16px;color:#8A93A6}
.champ-cherche input{padding-left:32px;width:220px}
.btn{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 14px;border-radius:8px;border:1px solid #22357A;background:#22357A;color:#fff;font:inherit;font-weight:600;cursor:pointer;text-decoration:none;white-space:nowrap}
.btn svg{width:16px;height:16px}
.btn.sec{background:#fff;color:#1A2133;border-color:#E2E5EB}.btn.sec:hover{background:#F7F8FA}
.btn.vert{background:#1D6B3F;border-color:#1D6B3F}.btn.rouge{background:#fff;color:#A12A22;border-color:#E9C3BF}
.btn.rouge:hover{background:#FBEFEE}
table.reg{width:100%;border-collapse:collapse}
table.reg th{text-align:left;font-weight:600;color:#6B7489;font-size:12.5px;padding:10px 14px;background:#FAFBFC;border-top:1px solid #ECEEF2;border-bottom:1px solid #ECEEF2;white-space:nowrap}
table.reg td{padding:12px 14px;border-bottom:1px solid #F0F2F5;vertical-align:middle}
table.reg tbody tr:last-child td{border-bottom:0}
table.reg tbody tr{cursor:pointer}table.reg tbody tr:hover{background:#F8FAFD}
table.reg td.n,table.reg th.n{text-align:right}
.qui{display:flex;align-items:center;gap:10px}
.qui>div>b{display:block;font-weight:600}.qui>div>span{display:block;font-size:12.5px;color:#8A93A6}
.qui a{color:inherit;text-decoration:none}.qui a:hover{text-decoration:underline}
.av{width:32px;height:32px;border-radius:50%;display:inline-grid;place-items:center;font-size:12px;font-weight:700;flex:none;line-height:1}
.num{font-weight:600;white-space:nowrap;color:#22357A;text-decoration:none}
.lieu{display:inline-flex;align-items:center;gap:5px;color:#4A5468}.lieu svg{width:15px;height:15px;color:#8A93A6}
.chip{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border:1px solid #E2E5EB;border-radius:20px;font-size:12.5px;color:#4A5468;white-space:nowrap}
.chip svg{width:14px;height:14px}
.st{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:20px;font-size:12.5px;font-weight:600;white-space:nowrap}
.st:before{content:"";width:6px;height:6px;border-radius:50%}
.st.attente{background:#FDF1E2;color:#9A5B00}.st.attente:before{background:#E58A1F}
.st.acceptee{background:#E6F4EC;color:#1D6B3F}.st.acceptee:before{background:#2E8A57}
.st.refusee{background:#FBEAE8;color:#A12A22}.st.refusee:before{background:#D2463B}
.pastille{display:inline-block;width:7px;height:7px;border-radius:50%;background:#2B7A9B;margin-left:6px;vertical-align:middle}
.fleche{color:#B4BBC9}.fleche svg{width:16px;height:16px}
.gris{color:#6B7489}.petit{font-size:12.5px}
.pied{padding:12px 20px;color:#8A93A6;font-size:12.5px;border-top:1px solid #F0F2F5}
.aucune{padding:48px 16px;color:#8A93A6;text-align:center}
.resume{color:#3A4357;margin:0 0 20px;font-size:15px}.resume b{color:#1A2133}
/* Fiche */
.retour{display:inline-flex;align-items:center;gap:4px;margin-bottom:14px;color:#6B7489;text-decoration:none}
.retour:hover{color:#1A2133}
.fiche{display:grid;grid-template-columns:400px 1fr;gap:20px;align-items:start}
.bloc{padding:18px 20px;border-bottom:1px solid #F0F2F5}.bloc:last-child{border-bottom:0}
.bloc h2{margin-bottom:12px}
dl{display:grid;grid-template-columns:140px 1fr;gap:8px 12px;margin:0}
dt{color:#6B7489}dd{margin:0;font-weight:600}
.decision textarea{width:100%;min-height:72px;padding:8px 10px;border:1px solid #E2E5EB;border-radius:8px;font:inherit;resize:vertical}
.decision .actions{display:flex;gap:8px;margin-top:10px}
.decision p{margin:8px 0 0;color:#6B7489;font-size:13px}
ol.hist{list-style:none;margin:0;padding:0}
ol.hist li{display:grid;grid-template-columns:118px 1fr;gap:12px;padding:8px 0;border-top:1px solid #F0F2F5}
ol.hist li:first-child{border-top:0}
ol.hist time{color:#8A93A6;font-size:12.5px}
ol.hist .par{display:block;color:#8A93A6;font-size:12.5px}
ol.hist li.erreur{color:#A12A22}
iframe.pdf{width:100%;height:calc(100vh - 160px);min-height:620px;border:1px solid #ECEEF2;border-radius:12px;background:#fff}
.msg{padding:10px 14px;border-radius:8px;margin-bottom:16px;border:1px solid}
.msg.ok{background:#EEF7F1;border-color:#BFDDC9;color:#1D6B3F}.msg.err{background:#FBEFEE;border-color:#E9C3BF;color:#A12A22}
.entete{display:flex;align-items:flex-end;gap:16px;margin-bottom:20px}
/* Connexion */
.auth{max-width:380px;margin:72px auto;padding:0 20px}
.auth img{height:56px;display:block;margin:0 auto 28px}
.auth .pane{padding:28px}
.auth h1{margin-bottom:4px}.auth .sous{margin-bottom:20px}
.auth label{display:block;font-weight:600;margin-bottom:14px}
.auth input{display:block;width:100%;height:40px;margin-top:6px;padding:0 12px;border:1px solid #E2E5EB;border-radius:8px;font:inherit;font-weight:400}
.auth .btn{width:100%;justify-content:center;height:40px;margin-top:4px}
@media(max-width:1100px){.kpis{grid-template-columns:repeat(2,1fr)}.fiche{grid-template-columns:1fr}}
.mnav{display:none}
@media(max-width:800px){.side{display:none}.barre form.cherche{display:none}.kpis{grid-template-columns:1fr}.barre{padding:0 16px}main{padding:16px}
.mnav{display:flex;gap:4px;padding:8px 12px;background:#fff;border-bottom:1px solid #ECEEF2;overflow-x:auto}.mnav a{padding:7px 12px;border-radius:8px;color:#4A5468;text-decoration:none;font-weight:500;white-space:nowrap}.mnav a.on{background:#EEF2FB;color:#22357A}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`;

const PAGES = {
  '/tableau-de-bord': ['Demandes', I.demandes],
  '/salaries': ['Salariés', I.salaries],
  '/journal': ["Journal d'activité", I.journal],
};
function layout(titre, user, body, opts = {}) {
  const head = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titre)} – Demandes CET</title>${opts.refresh ? `<meta http-equiv="refresh" content="${opts.refresh}">` : ''}<style>${CSS}</style></head><body>`;
  if (!user) return head + body + '</body></html>';
  const nav = (href) => `<a href="${href}" class="${opts.nav === href ? 'on' : ''}">${PAGES[href][1]}${PAGES[href][0]}${href === '/tableau-de-bord' && opts.enAttente ? `<span class="nb">${opts.enAttente}</span>` : ''}</a>`;
  const [pageNom, pageIco] = PAGES[opts.nav] || [titre, I.demandes];
  return head + `<div class="app">
<aside class="side"><div class="logo"><a href="/tableau-de-bord"><img src="/logo.png" alt="Norimagerie"></a></div>
<div class="rubrique">Demandes CET</div>
<nav>${nav('/tableau-de-bord')}${nav('/salaries')}${nav('/journal')}</nav>
<div class="rubrique">Raccourcis</div>
<nav><a href="/" target="_blank">${I.formulaire}Formulaire salarié</a></nav>
<div class="bas"><nav><a href="/deconnexion">${I.sortie}Se déconnecter</a></nav></div></aside>
<div class="contenu">
<header class="barre"><div class="page">${pageIco}${esc(pageNom)}</div>
<form class="cherche" method="get" action="/tableau-de-bord" role="search">${I.recherche}<input type="search" name="q" placeholder="Rechercher un salarié ou un n°" aria-label="Rechercher une demande"></form>
<div class="moi">${avatar(user.nom, user.email)}<div><b>${esc(user.nom)}</b><span>${esc(user.fonction || '')}</span></div></div></header>
<nav class="mnav">${Object.keys(PAGES).map(h => `<a href="${h}" class="${opts.nav === h ? 'on' : ''}">${PAGES[h][0]}</a>`).join('')}<a href="/deconnexion">Se déconnecter</a></nav>
${body}</div></div></body></html>`;
}

// ── Connexion / mot de passe ───────────────────────────────
const connexion = (erreur, suite) => layout('Connexion', null, `<div class="auth"><img src="/logo.png" alt="Norimagerie">
<div class="pane"><h1>Demandes CET</h1><p class="sous">Connectez-vous pour consulter et traiter les demandes.</p>
${erreur ? `<div class="msg err">${esc(erreur)}</div>` : ''}
<form method="post" action="/connexion"><input type="hidden" name="suite" value="${esc(suite || '')}">
<label>Adresse e-mail<input type="email" name="email" required autofocus autocomplete="username"></label>
<label>Mot de passe<input type="password" name="mdp" required autocomplete="current-password"></label>
<button class="btn">Se connecter</button></form></div></div>`);

const motDePasse = (user, erreur, suite) => layout('Mot de passe', null, `<div class="auth"><img src="/logo.png" alt="Norimagerie">
<div class="pane"><h1>Nouveau mot de passe</h1>
<p class="sous">${user.doitChanger ? 'Remplacez le mot de passe provisoire qui vous a été remis. ' : ''}10 caractères minimum.</p>
${erreur ? `<div class="msg err">${esc(erreur)}</div>` : ''}
<form method="post" action="/mot-de-passe"><input type="hidden" name="suite" value="${esc(suite || '')}">
<label>Nouveau mot de passe<input type="password" name="mdp" required minlength="10" autocomplete="new-password"></label>
<label>Confirmation<input type="password" name="mdp2" required minlength="10" autocomplete="new-password"></label>
<button class="btn">Enregistrer le mot de passe</button></form></div></div>`);

// ── Tableau de bord ────────────────────────────────────────
function tableauDeBord(user, toutes, filtrees, f) {
  const an = String(new Date().getFullYear());
  const annee = toutes.filter(d => d.creeLe.startsWith(an));
  const jours = type => annee.filter(d => d.statut === 'acceptee' && d.type === type).reduce((s, d) => s + (Number(d.jours) || 0), 0);
  const nb = s => annee.filter(d => d.statut === s).length;
  const enAttente = toutes.filter(d => d.statut === 'attente');
  const nonOuvertes = enAttente.filter(d => !d.vuePar.includes(user.email)).length;
  const nbSalaries = new Set(toutes.map(d => d.email).filter(Boolean)).size;
  const sites = [...new Set(toutes.map(d => d.site).filter(Boolean))].sort();
  const opt = (v, cur, label) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label || v)}</option>`;
  const qs = new URLSearchParams(f).toString();
  const lienAvec = (k, v) => '/tableau-de-bord?' + new URLSearchParams({ ...f, [k]: v }).toString();
  const filtre = Object.values(f).some(Boolean);
  const pl = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
  const compte = s => toutes.filter(d => !s || d.statut === s).length;
  const onglet = (val, label) => `<a href="${lienAvec('statut', val)}" class="${f.statut === val ? 'on' : ''}">${label}<span class="c">${compte(val)}</span></a>`;

  const rows = filtrees.map(d => `<tr onclick="location='/demande/${d.id}'">
    <td><div class="qui">${avatar(d.demandeur, d.email)}<div><b>${lienSalarie(d.email, d.demandeur)}</b><span>${esc(d.email || d.poste || '')}</span></div></div></td>
    <td><a class="num" href="/demande/${d.id}">${esc(d.numero)}</a>${!d.vuePar.includes(user.email) ? '<span class="pastille" title="Pas encore ouverte"></span>' : ''}</td>
    <td>${esc(dt(d.creeLe).split(' à ')[0])}<div class="gris petit">${esc(dt(d.creeLe).split(' à ')[1] || '')}</div></td>
    <td>${d.site ? `<span class="lieu">${I.lieu}${esc(d.site)}</span>` : '—'}</td>
    <td>${typeChip(d.type)}</td>
    <td class="n"><b>${esc(d.jours ?? '—')}</b> j</td>
    <td>${statut(d.statut)}${d.decision ? `<div class="gris petit" style="margin-top:3px">${esc(d.decision.par)}</div>` : ''}</td>
    <td class="fleche">${I.ouvrir}</td></tr>`).join('');

  return layout('Demandes', user, `<main>
<div class="kpis">
  <a class="kpi" href="/tableau-de-bord?statut=attente"><div class="ic orange">${I.attente}</div><div class="t">À traiter</div><div class="d">Demandes en attente de décision</div>
    <div class="v"><b>${enAttente.length}</b><span>${nonOuvertes ? pl(nonOuvertes, 'nouvelle') : 'toutes consultées'}</span></div></a>
  <div class="kpi"><div class="ic">${I.total}</div><div class="t">Demandes ${an}</div><div class="d">Reçues depuis le 1er janvier</div>
    <div class="v"><b>${annee.length}</b><span>${nb('acceptee')} acceptée${nb('acceptee') > 1 ? 's' : ''}, ${nb('refusee')} refusée${nb('refusee') > 1 ? 's' : ''}</span></div></div>
  <div class="kpi"><div class="ic vert">${I.jours}</div><div class="t">Jours accordés</div><div class="d">Demandes acceptées en ${an}</div>
    <div class="v"><b>${jours('Versement')}</b><span>versés, ${jours('Utilisation')} utilisés</span></div></div>
  <a class="kpi" href="/salaries"><div class="ic bleu">${I.salaries}</div><div class="t">Salariés</div><div class="d">Ayant fait au moins une demande</div>
    <div class="v"><b>${nbSalaries}</b><span>voir le registre</span></div></a>
</div>
<section class="pane">
<div class="pane-tete"><div><h2>Demandes</h2><p class="sous">Toutes les demandes CET, de la plus récente à la plus ancienne.</p></div></div>
<form class="outils" method="get">
  <div class="onglets">${onglet('', 'Toutes')}${onglet('attente', 'À traiter')}${onglet('acceptee', 'Acceptées')}${onglet('refusee', 'Refusées')}</div>
  <input type="hidden" name="statut" value="${esc(f.statut)}">
  <div class="droite">
    <div class="champ-cherche">${I.recherche}<input type="search" name="q" value="${esc(f.q)}" placeholder="Nom ou n° de demande" aria-label="Rechercher"></div>
    <select name="type" aria-label="Type" onchange="this.form.submit()"><option value="">Tous les types</option>${opt('Versement', f.type)}${opt('Utilisation', f.type)}</select>
    <select name="site" aria-label="Site" onchange="this.form.submit()"><option value="">Tous les sites</option>${sites.map(s => opt(s, f.site)).join('')}</select>
    <a class="btn sec" href="/tableau-de-bord/export.csv?${qs}">${I.export}Exporter</a>
  </div>
</form>
<table class="reg"><thead><tr><th>Salarié</th><th>N°</th><th>Reçue le</th><th>Site</th><th>Type</th><th class="n">Jours</th><th>Statut</th><th></th></tr></thead>
<tbody>${rows || `<tr><td colspan="8" class="aucune">${filtre ? 'Aucune demande ne correspond à ces filtres. <a href="/tableau-de-bord">Tout afficher</a>' : 'Les demandes envoyées depuis le formulaire apparaîtront ici.'}</td></tr>`}</tbody></table>
<div class="pied">${pl(filtrees.length, 'demande')}${filtre ? ' (filtrées)' : ''}. Mise à jour automatique chaque minute.</div>
</section></main>`, { refresh: 60, nav: '/tableau-de-bord', enAttente: enAttente.length });
}

// ── Fiche demande ──────────────────────────────────────────
function fiche(user, d, msg) {
  const hist = [...d.historique].reverse().map(h => {
    const [jour, heure] = dt(h.at).split(' à ');
    return `<li class="${esc(h.type)}"><time>${esc(jour)}<br>${esc(heure)}</time><span>${esc(h.detail)}${h.par ? `<span class="par">${esc(h.par)}</span>` : ''}</span></li>`;
  }).join('');
  const decision = d.statut === 'attente' ? `
  <form class="decision" method="post" action="/demande/${d.id}/decision" onsubmit="return verifier(event)">
    <label for="motif" class="gris petit">Commentaire (obligatoire pour un refus)</label>
    <textarea id="motif" name="motif"></textarea>
    <div class="actions">
      <button class="btn vert" name="statut" value="acceptee">Accepter</button>
      <button class="btn rouge" name="statut" value="refusee">Refuser</button>
    </div>
    <p>${d.email ? `${esc(d.demandeur)} recevra la décision par mail (${esc(d.email)}).` : 'Aucune adresse mail : le salarié ne sera pas prévenu automatiquement.'}</p>
  </form>
  <script>function verifier(e){var f=e.target,v=e.submitter&&e.submitter.value;
  if(v==='refusee'&&!f.motif.value.trim()){f.motif.focus();f.motif.setCustomValidity('Indiquez le motif du refus.');f.motif.reportValidity();f.motif.setCustomValidity('');return false}
  return confirm((v==='acceptee'?'Accepter':'Refuser')+' la demande ${esc(d.numero)} ? La décision ne pourra plus être modifiée.')}</script>`
    : `<dl><dt>Décision</dt><dd>${statut(d.statut)}</dd><dt>Par</dt><dd>${esc(d.decision.par)}</dd><dt>Le</dt><dd>${esc(dt(d.decision.le))}</dd>
      ${d.decision.motif ? `<dt>Commentaire</dt><dd>${esc(d.decision.motif)}</dd>` : ''}</dl>`;
  return layout(d.numero, user, `<main>
<a class="retour" href="/tableau-de-bord">← Retour aux demandes</a>
${msg ? `<div class="msg ${msg.type}">${esc(msg.texte)}</div>` : ''}
<div class="fiche"><div class="pane">
  <div class="bloc"><h1>${esc(d.numero)}</h1>
    <p class="gris" style="margin:0">${esc(d.type)} de ${esc(d.jours)} jour${d.jours > 1 ? 's' : ''}, demandée par <b style="color:#1B2236">${esc(d.demandeur)}</b><br>
    Reçue le ${esc(dt(d.creeLe))}</p>
    ${d.email ? `<p style="margin:8px 0 0">${d.rang ? (d.rang === 1 ? '1<sup>re</sup> demande' : d.rang + '<sup>e</sup> demande') + ' de ce salarié. ' : ''}<a href="/salaries/${encodeURIComponent(d.email)}">Voir son historique</a></p>` : ''}
    <p style="margin:10px 0 0">${statut(d.statut)}</p></div>
  <div class="bloc"><dl>${d.email ? `<dt>E-mail</dt><dd>${esc(d.email)}</dd>` : ''}${(d.fields || []).filter(x => x.label !== 'Salarié').map(x => `<dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd>`).join('')}</dl>
    <p style="margin:14px 0 0"><a href="/demande/${d.id}/pdf?download=1">Télécharger le PDF</a></p></div>
  <div class="bloc"><h2>Décision</h2>${decision}</div>
  <div class="bloc"><h2>Historique</h2><ol class="hist">${hist}</ol></div>
</div>
<iframe class="pdf" src="/demande/${d.id}/pdf" title="Feuille de demande ${esc(d.numero)}"></iframe></div></main>`, { nav: '/tableau-de-bord' });
}


// ── Registre des salariés ──────────────────────────────────
function salaries(user, liste, q) {
  const s = (q || '').toLowerCase();
  const f = liste.filter(x => !s || x.nom.toLowerCase().includes(s) || x.email.includes(s));
  const rows = f.map(x => `<tr onclick="location='/salaries/${encodeURIComponent(x.email)}'">
    <td><div class="qui">${avatar(x.nom, x.email)}<div><b>${esc(x.nom)}</b><span>${esc(x.email)}</span></div></div></td>
    <td>${esc(x.poste || '—')}<div class="gris petit">${esc(x.site || '')}</div></td>
    <td class="n">${x.nbDemandes}</td>
    <td class="n">${x.nbAttente ? `<span class="st attente">${x.nbAttente}</span>` : '0'}</td>
    <td class="n">${x.nbAcceptees}</td>
    <td class="n">${x.nbRefusees}</td>
    <td class="n">${x.joursVerses}</td>
    <td class="n">${x.joursUtilises}</td>
    <td>${esc(dt(x.derniereDemande).split(' à ')[0])}</td><td class="fleche">${I.ouvrir}</td></tr>`).join('');
  return layout('Salariés', user, `<main>
<section class="pane">
<div class="pane-tete"><div><h2>${liste.length} salarié${liste.length > 1 ? 's' : ''}</h2><p class="sous">Enregistrés à leur première demande. Les jours ne comptent que les demandes acceptées.</p></div></div>
<form class="outils" method="get"><div class="droite">
  <div class="champ-cherche">${I.recherche}<input type="search" name="q" value="${esc(q || '')}" placeholder="Nom ou adresse mail" aria-label="Rechercher"></div>
  <button class="btn sec">Rechercher</button>${q ? '<a href="/salaries" class="btn sec">Effacer</a>' : ''}</div></form>
<table class="reg"><thead><tr><th>Salarié</th><th>Poste et site</th><th class="n">Demandes</th><th class="n">En attente</th><th class="n">Acceptées</th><th class="n">Refusées</th><th class="n">Jours versés</th><th class="n">Jours utilisés</th><th>Dernière demande</th><th></th></tr></thead>
<tbody>${rows || `<tr><td colspan="10" class="aucune">${q ? 'Aucun salarié ne correspond à cette recherche.' : 'Les salariés apparaîtront ici dès leur première demande.'}</td></tr>`}</tbody></table>
</section></main>`, { nav: '/salaries' });
}

function salarie(user, x) {
  const rows = x.demandes.map(d => `<tr onclick="location='/demande/${d.id}'">
    <td class="n">${esc(d.rang || '')}</td>
    <td style="white-space:nowrap"><a class="num" href="/demande/${d.id}">${esc(d.numero)}</a></td>
    <td>${esc(dt(d.creeLe))}</td>
    <td>${typeChip(d.type)}</td>
    <td class="n">${esc(d.jours)}</td>
    <td>${esc(d.motif || '—')}</td>
    <td>${statut(d.statut)}</td>
    <td>${d.decision ? `${esc(d.decision.par)}<div class="gris petit">${esc(dt(d.decision.le))}</div>` : '<span class="gris">—</span>'}</td>
    <td>${esc(d.decision?.motif || '')}</td></tr>`).join('');
  const pl = (n, m) => `${n} ${m}${n > 1 ? 's' : ''}`;
  return layout(x.nom, user, `<main>
<a class="retour" href="/salaries">← Retour aux salariés</a>
<div class="entete"><div class="qui">${avatar(x.nom, x.email, 48)}
<div><h1>${esc(x.nom)}</h1><p class="sous">${esc(x.email)}${x.poste ? ', ' + esc(x.poste) : ''}${x.site ? ', ' + esc(x.site) : ''}. Première demande le ${esc(dt(x.premiereDemande))}</p></div></div></div>
<p class="resume"><b>${pl(x.nbDemandes, 'demande')}</b> : ${x.nbAcceptees} acceptée${x.nbAcceptees > 1 ? 's' : ''}, ${x.nbRefusees} refusée${x.nbRefusees > 1 ? 's' : ''}, ${x.nbAttente} en attente.
Jours accordés : <b>${x.joursVerses} versé${x.joursVerses > 1 ? 's' : ''}</b> sur le CET, <b>${x.joursUtilises} utilisé${x.joursUtilises > 1 ? 's' : ''}</b>.</p>
<section class="pane"><div class="pane-tete" style="padding-bottom:14px"><h2>Historique des demandes et décisions</h2></div>
<table class="reg"><thead><tr><th class="n">Rang</th><th>N°</th><th>Reçue le</th><th>Type</th><th class="n">Jours</th><th>Motif ou détail</th><th>Statut</th><th>Décidée par</th><th>Commentaire</th></tr></thead>
<tbody>${rows}</tbody></table></section></main>`, { nav: '/salaries' });
}

// ── Journal d'activité (audit) ─────────────────────────────
function journal(user, lignes) {
  const L = { creation: 'Nouvelle demande', consultation: 'Consultation', decision: 'Décision', connexion: 'Connexion', echec_connexion: 'Échec de connexion', export: 'Export Excel', notification: 'Mail envoyé', erreur_mail: "Échec d'envoi de mail", creation_compte: 'Création de compte' };
  const rows = lignes.map(l => `<tr style="cursor:default"><td>${esc(dt(l.at))}</td><td>${esc(L[l.type] || l.type)}</td><td>${esc(l.numero || '')}</td><td>${esc(l.par || '')}</td>
    <td>${esc([l.statut && STATUTS[l.statut], l.motif, l.detail].filter(Boolean).join(', '))}</td></tr>`).join('');
  return layout("Journal d'activité", user, `<main>
<section class="pane"><div class="pane-tete" style="padding-bottom:14px"><div><h2>Toutes les actions</h2><p class="sous">Enregistrées sur l'outil, des plus récentes aux plus anciennes (500 dernières). Ce journal ne peut pas être modifié.</p></div></div><table class="reg"><thead><tr><th>Date</th><th>Action</th><th>Demande</th><th>Par</th><th>Détail</th></tr></thead>
<tbody>${rows || '<tr><td colspan="5" class="aucune">Aucune action enregistrée pour le moment.</td></tr>'}</tbody></table></section></main>`, { nav: '/journal' });
}

// ── Mails ──────────────────────────────────────────────────
function mailCadre(titre, contenu) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f5f9;font-family:Segoe UI,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f9;padding:24px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e3e8f0;">
<tr><td style="background:#22357A;padding:16px 24px;color:#ffffff;">
<div style="font-size:13px;color:#A9B6E0;">Norimagerie, demandes CET</div>
<div style="font-size:19px;font-weight:600;margin-top:2px;">${esc(titre)}</div></td></tr>
${contenu}
<tr><td style="background:#f8f9fc;padding:12px 24px;font-size:11px;color:#8a94a8;">Message automatique, merci de ne pas y répondre.</td></tr>
</table></td></tr></table></body></html>`;
}
const mailBouton = (lien, texte) => `<a href="${esc(lien)}" target="_blank" style="display:inline-block;background:#22357A;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:11px 24px;border-radius:4px;">${esc(texte)}</a>`;
const mailLignes = fields => fields.map(f => `<tr><td style="padding:8px 12px;border-bottom:1px solid #eef1f6;color:#6b7a99;font-size:13px;width:38%;">${esc(f.label)}</td>
<td style="padding:8px 12px;border-bottom:1px solid #eef1f6;color:#1a2440;font-size:14px;font-weight:600;">${esc(f.value)}</td></tr>`).join('');

function mailNouvelleDemande(d, lien) {
  return mailCadre(`Nouvelle demande ${d.numero} — ${d.type}`, `
<tr><td style="padding:16px 24px 4px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F8;border-radius:4px;">
<tr><td style="padding:12px 14px;color:#1B2236;font-size:14px;">Reçue le <strong>${esc(dt(d.creeLe))}</strong>, envoyée par <strong>${esc(d.demandeur)}</strong>.</td></tr></table></td></tr>
<tr><td style="padding:12px 24px;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eef1f6;border-radius:8px;">${mailLignes(d.fields)}</table></td></tr>
<tr><td align="center" style="padding:8px 24px 24px;">${mailBouton(lien, 'Traiter la demande')}
<div style="font-size:12px;color:#8a94a8;margin-top:10px;">La feuille de demande est jointe en PDF. Une connexion est demandée pour la traiter.</div></td></tr>`);
}

function mailConfirmation(d) {
  return mailCadre(`Demande ${d.numero} bien reçue`, `
<tr><td style="padding:20px 24px 4px;font-size:14px;color:#1a2440;line-height:1.6;">Bonjour,<br><br>
Votre demande de <strong>${esc(d.type.toLowerCase())}</strong> CET a bien été enregistrée le ${esc(dt(d.creeLe))}
sous le n° <strong>${esc(d.numero)}</strong>. Elle a été transmise à la Direction, qui vous fera connaître sa décision par mail.</td></tr>
<tr><td style="padding:12px 24px 24px;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eef1f6;border-radius:8px;">${mailLignes(d.fields)}</table></td></tr>`);
}

function mailDecision(d) {
  const ok = d.statut === 'acceptee';
  return mailCadre(`Votre demande ${d.numero} a été ${ok ? 'acceptée' : 'refusée'}`, `
<tr><td style="padding:20px 24px 4px;font-size:14px;color:#1a2440;line-height:1.6;">Bonjour,<br><br>
Votre demande de <strong>${esc(d.type.toLowerCase())}</strong> CET n° <strong>${esc(d.numero)}</strong>, envoyée le ${esc(dt(d.creeLe))},
a été <strong style="color:${ok ? '#1e7a46' : '#b3261e'}">${ok ? 'acceptée' : 'refusée'}</strong> par ${esc(d.decision.par)} le ${esc(dt(d.decision.le))}.</td></tr>
${d.decision.motif ? `<tr><td style="padding:8px 24px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:${ok ? '#e3f6ea' : '#fde8e7'};border-radius:8px;">
<tr><td style="padding:12px 14px;font-size:14px;color:#1a2440;"><strong>Commentaire de la Direction :</strong> ${esc(d.decision.motif)}</td></tr></table></td></tr>` : ''}
<tr><td style="padding:12px 24px 24px;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eef1f6;border-radius:8px;">${mailLignes(d.fields)}</table></td></tr>`);
}

// ── Boîte mail de test ─────────────────────────────────────
function boiteTest(mails, sel) {
  const list = mails.map(m => `<a class="item ${m === sel ? 'on' : ''}" href="?m=${m.id}"><b>${esc(m.subject)}</b><span>À : ${esc(m.to)}<br>${esc(m.date)}</span></a>`).join('')
    || '<p class="empty">Aucun mail pour l\'instant.<br>Fais une demande sur le formulaire.</p>';
  const view = sel ? `<div class="head"><div><b>De :</b> ${esc(sel.from)}</div><div><b>À :</b> ${esc(sel.to)}</div><div><b>Objet :</b> ${esc(sel.subject)}</div>
  ${sel.attachments?.length ? `<div><b>Pièce jointe :</b> ${sel.attachments.map(a => `<a href="${esc(a.url)}">${esc(a.name)}</a>`).join(' ')}</div>` : ''}</div>
  <iframe srcdoc="${esc(sel.html)}"></iframe>` : '';
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Boîte mail de test</title><meta http-equiv="refresh" content="${sel ? 30 : 5}">
<style>body{margin:0;font-family:Segoe UI,Arial,sans-serif;display:flex;height:100vh;background:#f3f5f9}
aside{width:340px;background:#fff;border-right:1px solid #e3e8f0;overflow:auto}aside h1{font-size:15px;margin:0;padding:16px;background:#1a1f4e;color:#fff}
aside h1 small{display:block;font-weight:400;color:#1AB8D5;font-size:11px;margin-top:3px}
.item{display:block;padding:12px 16px;border-bottom:1px solid #eef1f6;text-decoration:none;color:#1a2440;font-size:13px}
.item span{display:block;color:#8a94a8;font-size:12px;margin-top:3px}.item.on{background:#eef6fb}.empty{padding:16px;color:#8a94a8;font-size:13px;line-height:1.6}
main{flex:1;display:flex;flex-direction:column}.head{background:#fff;padding:12px 18px;border-bottom:1px solid #e3e8f0;font-size:13px;line-height:1.7}
iframe{flex:1;border:0;background:#f3f5f9}</style></head><body>
<aside><h1>Boîte mail de test<small>Aucun mail n'est réellement envoyé</small></h1>${list}</aside><main>${view}</main></body></html>`;
}

module.exports = { esc, dt, depuis, salaries, salarie, connexion, motDePasse, tableauDeBord, fiche, journal, mailNouvelleDemande, mailConfirmation, mailDecision, boiteTest };

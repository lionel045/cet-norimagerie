// Stockage Supabase : Postgres (tables demandes, evenements, audit, utilisateurs) + Storage (PDF).
// Utilise la clé service_role, côté serveur UNIQUEMENT (jamais dans le navigateur).
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: process.env.SUPABASE_SCHEMA || 'public' },
});
const BUCKET = process.env.SUPABASE_BUCKET || (process.env.SUPABASE_SCHEMA === 'cet' ? 'cet-demandes-pdf' : 'demandes-pdf');
const isId = id => /^[0-9a-f-]{36}$/.test(id);
const ok = ({ data, error }) => { if (error) throw new Error('Supabase : ' + error.message); return data; };

// Ligne SQL → objet utilisé par l'appli
const versApp = (r, evts = []) => r && ({
  id: r.id, numero: r.numero, statut: r.statut, creeLe: r.cree_le,
  type: r.type, demandeur: r.demandeur, email: r.email, poste: r.poste, site: r.site,
  jours: Number(r.jours), motif: r.motif, horodatageClient: r.horodatage_client, fields: r.champs || [],
  vuePar: r.vue_par || [],
  decision: r.decision_le ? { statut: r.statut, motif: r.decision_motif, par: r.decision_par, parEmail: r.decision_par_email, le: r.decision_le } : null,
  historique: evts.map(e => ({ at: e.at, type: e.type, par: e.par, detail: e.detail })),
  salarieId: r.salarie_id, rang: r.rang_salarie,
});
const salarieVersApp = s => s && ({
  email: s.email, nom: s.nom, poste: s.poste, site: s.site,
  premiereDemande: s.premiere_demande, derniereDemande: s.derniere_demande,
  nbDemandes: Number(s.nb_demandes || 0), nbAttente: Number(s.nb_attente || 0),
  nbAcceptees: Number(s.nb_acceptees || 0), nbRefusees: Number(s.nb_refusees || 0),
  joursVerses: Number(s.jours_verses || 0), joursUtilises: Number(s.jours_utilises || 0),
});

const COLONNES_LISTE = 'id,numero,statut,cree_le,type,demandeur,email,poste,site,jours,motif,champs,vue_par,decision_motif,decision_par,decision_par_email,decision_le,salarie_id,rang_salarie';

module.exports = {
  nom: 'Supabase (' + new URL(process.env.SUPABASE_URL).host + (process.env.SUPABASE_SCHEMA ? ', schéma ' + process.env.SUPABASE_SCHEMA : '') + ')',

  // Petite lecture quotidienne : évite la mise en pause du plan gratuit (7 jours sans activité)
  async ping() {
    ok(await sb.from('demandes').select('id').limit(1));
  },

  async audit(evt) {
    ok(await sb.from('audit').insert({
      type: evt.type, demande_id: evt.id || null, numero: evt.numero || null, par: evt.par || null,
      statut: evt.statut || null, motif: evt.motif || null, detail: evt.detail || null,
    }));
  },
  async journal(limite = 500) {
    const rows = ok(await sb.from('audit').select('*').order('at', { ascending: false }).limit(limite));
    return rows.map(r => ({ ...r, id: r.demande_id }));
  },

  async creer(data, pdfBuffer) {
    // Registre des salariés : créé à la 1re demande, mis à jour ensuite (nom, poste, site les plus récents)
    let salarie = null, rang = null;
    if (data.email) {
      salarie = ok(await sb.from('salaries').upsert({
        email: data.email, nom: data.demandeur, poste: data.poste, site: data.site, derniere_demande: new Date().toISOString(),
      }, { onConflict: 'email' }).select().single());
      const { count } = await sb.from('demandes').select('id', { count: 'exact', head: true }).eq('salarie_id', salarie.id);
      rang = (count || 0) + 1;
    }
    const r = ok(await sb.from('demandes').insert({
      type: data.type, demandeur: data.demandeur, email: data.email || null, poste: data.poste, site: data.site,
      jours: data.jours, motif: data.motif, horodatage_client: data.horodatageClient, champs: data.fields,
      salarie_id: salarie?.id || null, rang_salarie: rang,
    }).select().single());
    const chemin = `${r.cree_le.slice(0, 4)}/${r.numero}.pdf`;
    ok(await sb.storage.from(BUCKET).upload(chemin, pdfBuffer, { contentType: 'application/pdf', upsert: true }));
    ok(await sb.from('demandes').update({ pdf_path: chemin }).eq('id', r.id));
    const evt = ok(await sb.from('evenements').insert({
      demande_id: r.id, type: 'creation', par: r.demandeur, detail: 'Demande soumise via le formulaire',
    }).select().single());
    return versApp(r, [evt]);
  },
  async lire(id) {
    if (!isId(id)) return null;
    const r = ok(await sb.from('demandes').select('*').eq('id', id).maybeSingle());
    if (!r) return null;
    const evts = ok(await sb.from('evenements').select('*').eq('demande_id', id).order('at'));
    return versApp(r, evts);
  },
  async lister() {
    const rows = ok(await sb.from('demandes').select(COLONNES_LISTE).order('cree_le', { ascending: false }));
    return rows.map(r => versApp(r));
  },
  async lirePdf(id) {
    if (!isId(id)) return null;
    const r = ok(await sb.from('demandes').select('pdf_path').eq('id', id).maybeSingle());
    if (!r?.pdf_path) return null;
    const blob = ok(await sb.storage.from(BUCKET).download(r.pdf_path));
    return Buffer.from(await blob.arrayBuffer());
  },

  async marquerVue(id, user) {
    if (!isId(id)) return null;
    ok(await sb.rpc('marquer_vue', { p_id: id, p_email: user.email, p_nom: user.nom }));
    return this.lire(id);
  },
  // Mise à jour conditionnelle (statut = attente) : si les deux responsables décident
  // en même temps, une seule décision passe.
  async decider(id, user, statut, motif, detail) {
    if (!isId(id)) return null;
    const r = ok(await sb.from('demandes').update({
      statut, decision_motif: motif || null, decision_par: user.nom, decision_par_email: user.email,
      decision_le: new Date().toISOString(),
    }).eq('id', id).eq('statut', 'attente').select().maybeSingle());
    if (!r) return null;
    ok(await sb.from('evenements').insert({ demande_id: id, type: 'decision', par: user.nom, detail }));
    return this.lire(id);
  },
  async ajouterEvenement(id, evt) {
    ok(await sb.from('evenements').insert({ demande_id: id, type: evt.type, par: evt.par || null, detail: evt.detail }));
  },

  // ── Registre des salariés ──
  async salaries() {
    const rows = ok(await sb.from('salaries_synthese').select('*').order('derniere_demande', { ascending: false }));
    return rows.map(salarieVersApp);
  },
  async salarie(email) {
    const s = ok(await sb.from('salaries_synthese').select('*').eq('email', String(email).toLowerCase()).maybeSingle());
    if (!s) return null;
    const dem = ok(await sb.from('demandes').select(COLONNES_LISTE).eq('salarie_id', s.id).order('cree_le', { ascending: false }));
    return { ...salarieVersApp(s), demandes: dem.map(r => versApp(r)) };
  },

  async utilisateurs() {
    const rows = ok(await sb.from('utilisateurs').select('*'));
    return rows.map(u => ({ email: u.email, nom: u.nom, fonction: u.fonction, motDePasse: u.mot_de_passe, doitChanger: u.doit_changer }));
  },
  async creerUtilisateurs(liste) {
    ok(await sb.from('utilisateurs').upsert(liste.map(u => ({
      email: u.email, nom: u.nom, fonction: u.fonction, mot_de_passe: u.motDePasse, doit_changer: u.doitChanger,
    }))));
  },
  async ajouterUtilisateur(u) {
    const { error } = await sb.from('utilisateurs').insert({
      email: u.email, nom: u.nom, fonction: u.fonction, mot_de_passe: u.motDePasse, doit_changer: u.doitChanger,
    });
    if (error) throw new Error(error.code === '23505' ? 'Ce compte existe déjà : ' + u.email : 'Supabase : ' + error.message);
  },
  async majUtilisateur(email, champs) {
    const m = {};
    if ('motDePasse' in champs) m.mot_de_passe = champs.motDePasse;
    if ('doitChanger' in champs) m.doit_changer = champs.doitChanger;
    ok(await sb.from('utilisateurs').update(m).eq('email', email));
  },
};

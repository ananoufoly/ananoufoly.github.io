/**
 * Apps Script — choix des menus de l'anniversaire de Luka (29 novembre 2026).
 * Reçoit les réponses du formulaire https://ananoufoly.github.io/luka/ et les
 * écrit dans une Google Sheet dédiée. NON lié au tracker ni au planner.
 *
 * DÉPLOIEMENT (à faire une fois côté Google) :
 *   1. script.google.com -> Nouveau projet -> nommer « Anniversaire Luka » ->
 *      coller ce code (remplace tout).
 *   2. Choisir la fonction « setup » dans la barre du haut -> Exécuter.
 *      Google demande d'autoriser les accès : accepter. setup crée la Sheet
 *      « Anniversaire Luka — menus » dans ton Drive (onglets Familles, Plats,
 *      Récap) et affiche son lien dans le journal d'exécution.
 *   3. Déployer -> Nouveau déploiement -> type « Application Web ».
 *        - Exécuter en tant que : Moi
 *        - Qui a accès : Tout le monde   (PAS « Tout utilisateur disposant d'un compte Google »)
 *   4. Copier l'URL qui finit par /exec et la coller dans docs/luka/index.html (API_URL).
 *
 * Après une modification de ce code : Déployer -> Gérer les déploiements ->
 * crayon -> Version : « Nouvelle version » -> Déployer (l'URL /exec reste la même).
 *
 * Aucun secret : le formulaire est public. Le serveur valide tout ce qu'il reçoit.
 *
 * Protocole (POST, Content-Type text/plain, corps JSON) :
 *   { nom, nbAdultes, nbEnfants, adultes: [{ prenom, entree, plat, accompagnement }], remarques }
 *     -> { ok: true, remplace: bool, total, ref }   ref : permet à ce seul envoi de s'annuler
 *   { action: "annuler", nom, ref }                 -> { ok: true }   (supprime cette réponse)
 *   Erreur                                          -> { ok: false, error: "..." }
 * GET ?action=recap -> { ok: true, recap: { libellé: valeur } }  (totaux du Récap, sans aucun nom)
 */

const SHEET_NAME = 'Anniversaire Luka — menus';
const CAPACITE = 32;
const PRIX_ADULTE = 30;
const PRIX_ENFANT = 12;

const MENU = {
  entree: ['Pastels', 'Avocat aux crevettes'],
  plat: ['Pintade', 'Poisson'],
  accompagnement: ['Alloco', 'Attiéké', 'Riz', 'Ablo'],
};

const MAX = { nom: 80, prenom: 40, remarques: 500 };

// ─── Installation ───────────────────────────────────────────────────────────

function setup() {
  const props = PropertiesService.getScriptProperties();
  let ss;
  const id = props.getProperty('SHEET_ID');
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create(SHEET_NAME);
    props.setProperty('SHEET_ID', ss.getId());
  }

  const familles = getOrCreate_(ss, 'Familles');
  familles.getRange(1, 1, 1, 6).setValues([[
    'Date', 'Nom', 'Nb adultes', 'Nb enfants', 'Total estimé (€)', 'Allergies et remarques',
  ]]);
  familles.getRange('A2:A').setNumberFormat('dd/MM/yyyy HH:mm');

  const plats = getOrCreate_(ss, 'Plats');
  plats.getRange(1, 1, 1, 5).setValues([['Nom', 'Prénom', 'Entrée', 'Plat', 'Accompagnement']]);

  const recap = getOrCreate_(ss, 'Récap');
  recap.clear();
  const rows = [
    ['Récap', ''],
    ['Familles', '=COUNTA(Familles!B2:B)'],
    ['Adultes', '=SUM(Familles!C2:C)'],
    ['Enfants', '=SUM(Familles!D2:D)'],
    ['Places utilisées', '=B3+B4'],
    ['Places disponibles', CAPACITE],
    ['Places restantes', '=B6-B5'],
    ['Total estimé (€, hors boissons)', '=SUM(Familles!E2:E)'],
    ['', ''],
    ['Entrées', ''],
  ];
  MENU.entree.forEach(v => rows.push([v, countif_('C', v)]));
  rows.push(['', ''], ['Plats', '']);
  MENU.plat.forEach(v => rows.push([v, countif_('D', v)]));
  rows.push(['', ''], ['Accompagnements', '']);
  MENU.accompagnement.forEach(v => rows.push([v, countif_('E', v)]));
  // setFormula lit toujours la syntaxe anglaise (virgule) ; setValues suivrait la
  // langue de la Sheet, et COUNTIF(…,"…") casserait dans une Sheet en français.
  rows.forEach(([label, value], i) => {
    recap.getRange(i + 1, 1).setValue(label);
    const cell = recap.getRange(i + 1, 2);
    if (typeof value === 'string' && value.charAt(0) === '=') cell.setFormula(value);
    else cell.setValue(value);
  });
  recap.getRange('A1').setFontSize(14);
  ['A1', 'A10', 'A14', 'A18'].forEach(a => recap.getRange(a).setFontWeight('bold'));
  recap.setColumnWidth(1, 240);

  [familles, plats].forEach(sh => {
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#fde2dc');
  });
  recap.getRange('A1:B1').setBackground('#fde2dc');

  const defaut = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
  if (defaut && ss.getSheets().length > 1) ss.deleteSheet(defaut);
  ss.setActiveSheet(recap);
  ss.moveActiveSheet(1);

  Logger.log('Sheet prête : ' + ss.getUrl());
}

function getOrCreate_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function countif_(col, value) {
  return '=COUNTIF(Plats!' + col + '2:' + col + ',"' + value + '")';
}

function sheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('setup non exécuté');
  return SpreadsheetApp.openById(id);
}

// ─── Web app ────────────────────────────────────────────────────────────────

function doGet(e) {
  try {
    if (!e || !e.parameter || e.parameter.action !== 'recap') return json_({ ok: true });
    SpreadsheetApp.flush();
    const values = sheet_().getSheetByName('Récap').getDataRange().getValues();
    const recap = {};
    let section = '';
    values.forEach(([label, value]) => {
      if (!label) return;
      if (value === '') { section = label; return; }
      recap[section && section !== 'Récap' ? section + ' · ' + label : label] = value;
    });
    return json_({ ok: true, recap });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, error: 'Serveur occupé, réessaie dans un instant.' });
  }
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'annuler') return json_(annuler_(body));
    return json_(enregistrer_(body));
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function enregistrer_(body) {
  const nom = text_(body.nom, MAX.nom);
  if (!nom) throw new Error('Le nom est obligatoire.');
  const nbAdultes = int_(body.nbAdultes, 1, 12, 'Nombre d\'adultes');
  const nbEnfants = int_(body.nbEnfants, 0, 12, 'Nombre d\'enfants');
  const adultes = Array.isArray(body.adultes) ? body.adultes : [];
  if (adultes.length !== nbAdultes) throw new Error('Il faut un choix de plats par adulte.');

  const lignesPlats = adultes.map((a, i) => {
    a = a || {};
    const choix = ['entree', 'plat', 'accompagnement'].map(k => {
      if (MENU[k].indexOf(a[k]) === -1) throw new Error('Choix invalide pour l\'adulte ' + (i + 1) + '.');
      return a[k];
    });
    return [safe_(nom), safe_(text_(a.prenom, MAX.prenom))].concat(choix);
  });

  const total = nbAdultes * PRIX_ADULTE + nbEnfants * PRIX_ENFANT;
  const remarques = text_(body.remarques, MAX.remarques);

  const ss = sheet_();
  const cle = key_(nom);
  const remplace = supprimer_(ss, cle);

  ss.getSheetByName('Familles').appendRow([
    new Date(), safe_(nom), nbAdultes, nbEnfants, total, safe_(remarques),
  ]);
  const plats = ss.getSheetByName('Plats');
  plats.getRange(plats.getLastRow() + 1, 1, lignesPlats.length, 5).setValues(lignesPlats);

  const ref = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('ref:' + cle, ref);
  return { ok: true, remplace, total, ref };
}

function annuler_(body) {
  const cle = key_(text_(body.nom, MAX.nom));
  const props = PropertiesService.getScriptProperties();
  const ref = props.getProperty('ref:' + cle);
  if (!cle || !ref || typeof body.ref !== 'string' || body.ref !== ref) {
    throw new Error('Annulation refusée.');
  }
  supprimer_(sheet_(), cle);
  props.deleteProperty('ref:' + cle);
  return { ok: true };
}

/** Supprime les lignes Familles et Plats de ce nom ; renvoie true s'il y en avait. */
function supprimer_(ss, cle) {
  let found = false;
  ['Familles', 'Plats'].forEach(name => {
    const sh = ss.getSheetByName(name);
    const col = name === 'Familles' ? 2 : 1;
    const last = sh.getLastRow();
    if (last < 2) return;
    const noms = sh.getRange(2, col, last - 1, 1).getValues();
    for (let i = noms.length - 1; i >= 0; i--) {
      if (key_(String(noms[i][0])) === cle) {
        sh.deleteRow(i + 2);
        found = true;
      }
    }
  });
  return found;
}

// ─── Validation ─────────────────────────────────────────────────────────────

function text_(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, ' ').replace(/[ \t]+/g, ' ').trim().slice(0, max);
}

function int_(v, min, max, label) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(label + ' invalide.');
  return n;
}

/** Empêche l'interprétation comme formule : un texte qui commence par = + - @ reste du texte. */
function safe_(s) {
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

/** Clé de comparaison des noms : sans accents, casse ni espaces superflus. */
function key_(s) {
  return String(s).replace(/^'/, '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

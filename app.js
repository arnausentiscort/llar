// La Llar: la llista de la compra de l'Arnau i la Núria, els menús i el receptari. JS pla, sense llibreries.
// Cada cosa (un producte, una recepta, un àpat) és una fila xifrada amb el codi de casa (PBKDF2 + AES-GCM): es desa
// primer al mòbil i, si hi ha Supabase (config.js), s'hi puja i se'n baixa el que ha posat l'altre. Sense connexió,
// tot es queda al mòbil i s'envia quan torna.
import {SUPABASE} from './config.js';

const PERSONES = ['Arnau', 'Núria'];
const ITERACIONS = 150000;
const CADA = 12000; // cada quant es mira si l'altre ha canviat res (amb la pantalla oberta)

// --- guardar al mòbil (pot fallar en navegació privada: llavors funciona, però no ho recorda) ---
const guardat = {
	llegir(k, d) {
		try {
			const v = localStorage.getItem(k);
			return v == null ? d : JSON.parse(v);
		} catch {
			return d;
		}
	},
	posar(k, v) {
		try {
			localStorage.setItem(k, JSON.stringify(v));
		} catch {}
	},
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
const nouId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const ara = () => new Date().toISOString();
const normal = (s) =>
	String(s ?? '')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
const majuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// --- icones (Lucide, ISC) ---
const ICONES = {
	casa: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
	llista: '<path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/>',
	menu: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
	recepta: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
	mes: '<path d="M5 12h14"/><path d="M12 5v14"/>',
	fet: '<path d="M20 6 9 17l-5-5"/>',
	tancar: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
	nuvol: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
	sense: '<path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17 11h-1.79A7 7 0 0 0 8.689 5.36"/>',
	mobil: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
	paperera: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
	estrella: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
};
const icona = (nom, mida = 18) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="${mida}" height="${mida}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nom]}</svg>`;

// --- els tipus de producte, en l'ordre d'un súper. Les paraules, en català i en castellà ---
const CATEGORIES = [
	['fruita', 'Fruita i verdura', '🥬', 'fruita, fruta, poma, manzana, pera, platan, platano, banana, taronja, naranja, mandarina, llimona, limon, maduixa, fresa, raim, uva, kiwi, pinya, pina, melo, melon, sindria, sandia, preseg, melocoton, enciam, lechuga, tomaquet, tomate, ceba, cebolla, all, ajo, pastanaga, zanahoria, patata, carbassa, calabaza, carbasso, calabacin, alberginia, berenjena, pebrot, pimiento, cogombre, pepino, espinac, espinaca, broquil, brocoli, coliflor, col, mongeta tendra, judia verde, porro, puerro, bolet, champinon, xampinyo, alvocat, aguacate, api, apio, julivert, perejil, alfabrega, albahaca, rucula, canonges, verdura, amanida, ensalada, gingebre, jengibre'],
	['carn', 'Carn i peix', '🥩', 'carn, carne, pollastre, pollo, pit de pollastre, pechuga, cuixa, muslo, vedella, ternera, porc, cerdo, xai, cordero, conill, conejo, hamburguesa, salsitxa, salchicha, botifarra, butifarra, carn picada, carne picada, llom, lomo, costella, costilla, peix, pescado, salmo, salmon, lluc, merluza, bacalla, bacalao, gamba, gambas, llagosti, langostino, calamar, sepia, musclo, mejillon, rap, rape, dorada, llobarro, lubina'],
	['lactics', 'Làctics i ous', '🥛', 'llet, leche, iogurt, yogur, formatge, queso, formatge ratllat, queso rallado, mantega, mantequilla, nata, ous, huevos, ou, huevo, mato, kefir'],
	['embotit', 'Embotit', '🥓', 'pernil, jamon, fuet, llonganissa, salchichon, xorico, chorizo, gall dindi, pavo, bacon, baco, mortadel·la, mortadela, embotit, embutido'],
	['forn', 'Forn', '🥖', 'pa, pan, barra de pa, baguette, pa de motlle, pan de molde, croissant, brioix, bolleria, magdalena, magdalenes, torrades, tostadas'],
	['rebost', 'Rebost', '🥫', 'arros, arroz, pasta, macarrons, macarrones, espaguetis, fideus, fideos, llenties, lentejas, cigrons, garbanzos, mongetes, alubias, farina, harina, sucre, azucar, sal, oli, aceite, vinagre, tomaquet fregit, tomate frito, tonyina en conserva, tonyina, atun, conserva, cafe, cacau, cola cao, xocolata, chocolate, cereals, cereales, muesli, galeta, galetes, galletas, mel, miel, melmelada, mermelada, especies, especias, pebre, pimienta, pebre vermell, pimenton, brou, caldo, fruits secs, frutos secos, nous, nueces, ametlles, almendras, salsa, ketchup, maionesa, mayonesa, mostassa, mostaza, patates xips, patatas fritas, olives, aceitunas'],
	['begudes', 'Begudes', '🧃', 'aigua, agua, cervesa, cerveza, vi, vino, suc, zumo, refresc, refresco, coca-cola, fanta, aquarius'],
	['congelats', 'Congelats', '🧊', 'congelat, congelados, congelado, gelat, helado, pizza, croquetes, croquetas'],
	['neteja', 'Neteja i casa', '🧽', 'paper de cuina, papel de cocina, paper higienic, papel higienico, detergent, detergente, suavitzant, suavizante, lleixiu, lejia, fregall, estropajo, bosses, bolsas, bosses d escombraries, bolsas de basura, rentaplats, lavavajillas, sabo de plats, tovalloletes, toallitas, paper d alumini, papel de aluminio, paper film, esponja, netejador, limpiador'],
	['higiene', 'Higiene', '🧴', 'xampu, champu, gel de dutxa, gel de ducha, gel, pasta de dents, pasta de dientes, raspall de dents, cepillo, desodorant, desodorante, compreses, compresas, tampons, tampones, crema solar, maquinetes, cuchillas, cotonets, bastoncillos'],
	['altres', 'Altres', '🛒', ''],
];
const PARAULES = CATEGORIES.map(([id, , , p]) => [id, p.split(',').map(normal).filter((x) => x.length > 1)]);
function categoria(nom) {
	const n = ` ${normal(nom).replace(/['’]/g, ' ')} `;
	// guanya la paraula més llarga que hi surti sencera ("tomate frito" és rebost, "tomate" és fruita)
	let millor = ['altres', 0];
	for (const [id, ps] of PARAULES) for (const p of ps) if (p.length > millor[1] && new RegExp(`[ ]${p}(s|es)?[ ]`).test(n)) millor = [id, p.length];
	return millor[0];
}

// un missatge de WhatsApp ("llet, ous i pa") o una llista: una cosa per tros
function trossos(text) {
	return String(text ?? '')
		.split(/\r?\n/)
		.map((l) => l.replace(/^\[[^\]]*\]\s*[^:]{1,30}:\s*/, '').replace(/^\d{1,2}[/:.]\d{1,2}.{0,20}? - [^:]{1,30}:\s*/, ''))
		.join(',')
		.split(/,|;|\s+i\s+|\s+y\s+|\s+\+\s+/)
		.map((t) => t.replace(/^[\s\-*•·]+/, '').replace(/[.\s]+$/, '').trim())
		.filter((t) => t.length > 1)
		.map(majuscula);
}

// --- el xifrat: la clau surt del codi de casa (el mateix als dos mòbils) ---
const b64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b)));
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const normCodi = (c) => String(c ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
async function prepararCasa(codi) {
	const c = normCodi(codi);
	const enc = new TextEncoder();
	const casa = hex(await crypto.subtle.digest('SHA-256', enc.encode(`llar-casa:${c}`))).slice(0, 32);
	const sal = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`llar-sal:${c}`))).slice(0, 16);
	const base = await crypto.subtle.importKey('raw', enc.encode(c), 'PBKDF2', false, ['deriveKey']);
	const clau = await crypto.subtle.deriveKey({name: 'PBKDF2', salt: sal, iterations: ITERACIONS, hash: 'SHA-256'}, base, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
	return {casa, clau};
}
async function xifrar(obj) {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const x = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, estat.clau, new TextEncoder().encode(JSON.stringify(obj)));
	return `${b64(iv)}.${b64(x)}`;
}
async function desxifrar(s) {
	const [iv, x] = s.split('.');
	return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name: 'AES-GCM', iv: deB64(iv)}, estat.clau, deB64(x))));
}

// --- l'estat: les files (id → {o: l'objecte, a: quan es va tocar}), el que falta pujar i qui ets ---
const estat = {
	codi: guardat.llegir('llar-codi', null),
	qui: guardat.llegir('llar-qui', null),
	files: guardat.llegir('llar-files', {}),
	cua: new Set(guardat.llegir('llar-cua', [])),
	vista: 'llista',
	clau: null,
	casa: null,
	xarxa: SUPABASE.url ? 'mirant' : 'local', // mirant · al-dia · sense · local
	error: null,
	obert: null, // el dia del menú on s'està afegint un plat
};
const desar = () => {
	guardat.posar('llar-files', estat.files);
	guardat.posar('llar-cua', [...estat.cua]);
};
const totes = (t) => Object.entries(estat.files).filter(([, f]) => f.o.t === t && !f.o.esborrat).map(([id, f]) => ({id, ...f.o}));
function tocar(id, o) {
	estat.files[id] = {o, a: ara()};
	estat.cua.add(id);
	desar();
	pujarAviat();
}

// --- Supabase: una taula "llar" (id, casa, dades, actualitzat). Es puja el que falta i es baixa tot ---
const capcals = () => ({apikey: SUPABASE.clau, Authorization: `Bearer ${SUPABASE.clau}`, 'Content-Type': 'application/json'});
let temporitzador = null;
const pujarAviat = () => {
	clearTimeout(temporitzador);
	temporitzador = setTimeout(sincronitzar, 400);
};
let sincronitzant = false;
async function sincronitzar() {
	if (!SUPABASE.url || !estat.clau || sincronitzant) return;
	sincronitzant = true;
	try {
		const pujar = [...estat.cua].filter((id) => estat.files[id]);
		if (pujar.length) {
			const files = await Promise.all(pujar.map(async (id) => ({id, casa: estat.casa, dades: await xifrar(estat.files[id].o), actualitzat: estat.files[id].a})));
			const r = await fetch(`${SUPABASE.url}/rest/v1/llar`, {method: 'POST', headers: {...capcals(), Prefer: 'resolution=merge-duplicates,return=minimal'}, body: JSON.stringify(files)});
			if (!r.ok) throw new Error(`Supabase ${r.status}`);
			for (const id of pujar) estat.cua.delete(id);
		}
		const r = await fetch(`${SUPABASE.url}/rest/v1/llar?casa=eq.${estat.casa}&select=id,dades,actualitzat`, {headers: capcals()});
		if (!r.ok) throw new Error(`Supabase ${r.status}`);
		let canvis = false;
		for (const f of await r.json()) {
			const meva = estat.files[f.id];
			if (estat.cua.has(f.id) || (meva && meva.a >= f.actualitzat)) continue;
			try {
				estat.files[f.id] = {o: await desxifrar(f.dades), a: f.actualitzat};
				canvis = true;
			} catch {} // una fila d'un altre codi: no és nostra
		}
		desar();
		const abans = estat.xarxa;
		estat.xarxa = 'al-dia';
		if (canvis || pujar.length || abans !== 'al-dia') pintar(); // el "per enviar" de dalt també canvia
	} catch {
		const abans = estat.xarxa;
		estat.xarxa = 'sense';
		if (abans !== 'sense') pintar();
	} finally {
		sincronitzant = false;
	}
}
setInterval(() => document.visibilityState === 'visible' && sincronitzar(), CADA);
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && sincronitzar());
window.addEventListener('online', sincronitzar);

// --- el receptari per començar (Reshi n'omple uns quants; els ids fixos fan que no es repeteixin) ---
const RECEPTES = [
	['llenties', 'Llenties estofades', 'Llenties, Ceba, Pastanaga, Patata, Xoriço, All, Pebre vermell'],
	['macarrons', 'Macarrons a la bolonyesa', 'Macarrons, Carn picada, Ceba, Tomàquet fregit, Formatge ratllat'],
	['truita', 'Truita de patates', 'Ous, Patates, Ceba, Oli'],
	['pollastre', 'Pollastre al forn amb patates', 'Pollastre, Patates, Ceba, Llimona, All'],
	['amanida', 'Amanida', 'Enciam, Tomàquet, Cogombre, Tonyina en conserva, Olives'],
	['crema', 'Crema de carbassa', 'Carbassa, Ceba, Pastanaga, Patata, Nata'],
	['arros', 'Arròs a la cubana', 'Arròs, Tomàquet fregit, Ous, Plàtan'],
	['salmo', 'Salmó amb verdures', 'Salmó, Carbassó, Pebrot, Ceba'],
];
function sembrarReceptes() {
	if (guardat.llegir('llar-sembrat', false) || totes('recepta').length) return;
	for (const [id, nom, ing] of RECEPTES) if (!estat.files[`r-${id}`]) tocar(`r-${id}`, {t: 'recepta', nom, ingredients: ing.split(', '), qui: 'Reshi'});
	guardat.posar('llar-sembrat', true);
}

// --- la llista ---
const pendents = () => totes('cosa').filter((c) => !c.fet && !c.arxivat);
function afegir(noms, plat) {
	const hiSon = new Set(pendents().map((c) => normal(c.nom)));
	let n = 0;
	for (const nom of noms) {
		if (hiSon.has(normal(nom))) continue;
		hiSon.add(normal(nom));
		tocar(nouId(), {t: 'cosa', nom, cat: categoria(nom), qui: estat.qui, quan: ara(), fet: false, ...(plat && {plat})});
		n++;
	}
	return n;
}
// el que compreu sovint: les coses que han sortit dues vegades o més i ara no són a la llista
function sovint() {
	const compte = {};
	for (const c of totes('cosa')) {
		const k = normal(c.nom);
		compte[k] = {nom: c.nom, n: (compte[k]?.n ?? 0) + 1};
	}
	const hiSon = new Set(pendents().map((c) => normal(c.nom)));
	return Object.entries(compte)
		.filter(([k, x]) => x.n >= 2 && !hiSon.has(k))
		.sort((a, b) => b[1].n - a[1].n)
		.slice(0, 10)
		.map(([, x]) => x.nom);
}
const quiCurt = (q) => (q === estat.qui ? 'tu' : q);
function vistaLlista() {
	const p = pendents();
	const comprades = totes('cosa').filter((c) => c.fet && !c.arxivat);
	const sv = sovint();
	const grups = CATEGORIES.map(([id, nom, emoji]) => ({id, nom, emoji, coses: p.filter((c) => (c.cat ?? 'altres') === id).sort((a, b) => a.nom.localeCompare(b.nom, 'ca'))})).filter((g) => g.coses.length);
	return `
	<form class="afegir" id="form-afegir">
		<textarea name="text" rows="1" placeholder="Què falta? (o enganxa un WhatsApp)" enterkeyhint="done" autocomplete="off"></textarea>
		<button type="submit" aria-label="Afegir">${icona('mes', 22)}</button>
	</form>
	${sv.length ? `<div class="sovint"><h2>${icona('estrella', 13)} Sovint</h2><div>${sv.map((n) => `<button type="button" data-sovint="${esc(n)}">${esc(n)}</button>`).join('')}</div></div>` : ''}
	${
		grups.length
			? grups
					.map(
						(g) => `<section class="grup"><h2><span>${g.emoji}</span>${g.nom}<small>${g.coses.length}</small></h2><ul>${g.coses
							.map(
								(c) => `<li><button type="button" class="cosa" data-fet="${c.id}"><span class="marca"></span><span class="nom">${esc(c.nom)}</span><small>${[c.plat ? `per ${esc(c.plat)}` : '', esc(quiCurt(c.qui))].filter(Boolean).join(' · ')}</small></button></li>`,
							)
							.join('')}</ul></section>`,
					)
					.join('')
			: `<p class="buit">${icona('casa', 28)}<b>No falta res.</b>Escriu a dalt el que s’acabi, o tria plats al Menú.</p>`
	}
	${
		comprades.length
			? `<section class="grup comprat"><h2><span>🛒</span>Al carro<small>${comprades.length}</small><button type="button" class="buidar" data-buidar>Ja ho hem comprat</button></h2><ul>${comprades
					.map((c) => `<li><button type="button" class="cosa fet" data-desfer="${c.id}"><span class="marca">${icona('fet', 14)}</span><span class="nom">${esc(c.nom)}</span></button></li>`)
					.join('')}</ul></section>`
			: ''
	}`;
}

// --- el menú: els propers set dies; cada plat posa els seus ingredients a la llista ---
const NOMS_DIES = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'];
const diaDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function vistaMenu() {
	const receptes = totes('recepta').sort((a, b) => a.nom.localeCompare(b.nom, 'ca'));
	const apats = totes('apat');
	const dies = [...Array(7)].map((_, i) => {
		const d = new Date();
		d.setDate(d.getDate() + i);
		return {dia: diaDe(d), nom: i === 0 ? 'Avui' : i === 1 ? 'Demà' : NOMS_DIES[d.getDay()], data: `${d.getDate()}/${d.getMonth() + 1}`};
	});
	return `<p class="explica">Tria què menjareu i els ingredients van sols a la llista (el que ja hi és no es repeteix).</p>
	${dies
		.map((d) => {
			const seus = apats.filter((a) => a.dia === d.dia);
			return `<section class="dia"><h2>${d.nom}<small>${d.data}</small></h2>
			${seus.map((a) => `<div class="plat"><span>${esc(a.nom)}</span><small>${esc(quiCurt(a.qui))}</small><button type="button" data-treure-apat="${a.id}" aria-label="Treure ${esc(a.nom)}">${icona('tancar', 15)}</button></div>`).join('')}
			${
				estat.obert === d.dia
					? `<div class="triar">${receptes.map((r) => `<button type="button" data-apat="${r.id}" data-dia="${d.dia}">${esc(r.nom)}</button>`).join('')}<button type="button" class="cancel" data-obrir-dia="">Res</button></div>`
					: `<button type="button" class="afegir-plat" data-obrir-dia="${d.dia}">${icona('mes', 15)} Un plat</button>`
			}</section>`;
		})
		.join('')}`;
}

// --- el receptari ---
function vistaReceptes() {
	const receptes = totes('recepta').sort((a, b) => a.nom.localeCompare(b.nom, 'ca'));
	return `<form class="recepta-nova" id="form-recepta">
		<h2>${icona('mes', 15)} Una recepta nova</h2>
		<input name="nom" placeholder="Nom del plat" required autocomplete="off">
		<textarea name="ingredients" rows="3" placeholder="Ingredients, separats per comes o un per línia" required></textarea>
		<button type="submit">Desar la recepta</button>
	</form>
	${receptes
		.map(
			(r) => `<details class="recepta"><summary><b>${esc(r.nom)}</b><small>${r.ingredients.length} ingredients</small></summary>
			<ul>${r.ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
			<div class="recepta-botons"><button type="button" data-a-llista="${r.id}">${icona('llista', 15)} A la llista</button><button type="button" class="perill" data-esborrar-recepta="${r.id}">${icona('paperera', 15)} Esborrar</button></div>
		</details>`,
		)
		.join('')}`;
}

// --- la primera vegada: el codi de casa i qui ets ---
function vistaEntrar() {
	return `<main class="entrar">
		<div class="logo">${icona('casa', 40)}</div>
		<h1>Llar</h1>
		<p>La llista de la compra, els menús i les receptes de casa, per a tots dos.</p>
		<form id="form-entrar">
			<label>El codi de casa<input name="codi" required autocomplete="off" autocapitalize="characters" placeholder="El mateix als dos mòbils" value="${esc(estat.codi ?? '')}"></label>
			<fieldset><legend>Qui ets?</legend>${PERSONES.map((p) => `<label class="persona"><input type="radio" name="qui" value="${p}" required ${estat.qui === p ? 'checked' : ''}><span>${p}</span></label>`).join('')}</fieldset>
			<button type="submit">Entrar</button>
			${estat.error ? `<p class="error">${esc(estat.error)}</p>` : ''}
		</form>
	</main>`;
}

const ESTAT_XARXA = {
	'al-dia': ['nuvol', 'Al dia'],
	mirant: ['nuvol', 'Connectant…'],
	sense: ['sense', 'Sense connexió: es desa al mòbil'],
	local: ['mobil', 'Només en aquest mòbil'],
};
function pintar() {
	const app = document.getElementById('app');
	if (!estat.clau) {
		app.innerHTML = vistaEntrar();
		return;
	}
	const [ic, text] = ESTAT_XARXA[estat.xarxa];
	const n = pendents().length;
	app.innerHTML = `
	<header class="cap">
		<div class="marca">${icona('casa', 20)}<b>Llar</b></div>
		<span class="xarxa ${estat.xarxa}" title="${text}">${icona(ic, 14)}<span>${estat.cua.size && estat.xarxa !== 'local' ? `${estat.cua.size} per enviar` : text}</span></span>
		<button type="button" class="qui" data-sortir title="Canviar de persona">${esc(estat.qui)}</button>
	</header>
	<main class="pantalla">${{llista: vistaLlista, menu: vistaMenu, receptes: vistaReceptes}[estat.vista]()}</main>
	<nav class="pestanyes">
		<button type="button" data-vista="llista" aria-pressed="${estat.vista === 'llista'}">${icona('llista', 20)}<span>Llista</span>${n ? `<i>${n}</i>` : ''}</button>
		<button type="button" data-vista="menu" aria-pressed="${estat.vista === 'menu'}">${icona('menu', 20)}<span>Menú</span></button>
		<button type="button" data-vista="receptes" aria-pressed="${estat.vista === 'receptes'}">${icona('recepta', 20)}<span>Receptes</span></button>
	</nav>`;
}

// --- el que es toca ---
document.addEventListener('click', (ev) => {
	const b = ev.target.closest('button');
	if (!b) return;
	const d = b.dataset;
	const f = (id) => estat.files[id]?.o;
	if (d.vista) {
		estat.vista = d.vista;
		window.scrollTo(0, 0);
	} else if (d.fet) tocar(d.fet, {...f(d.fet), fet: true, fetQuan: ara(), perQui: estat.qui});
	else if (d.desfer) tocar(d.desfer, {...f(d.desfer), fet: false});
	else if (d.buidar !== undefined) {
		for (const c of totes('cosa').filter((c) => c.fet && !c.arxivat)) tocar(c.id, {...f(c.id), arxivat: true});
	} else if (d.sovint) afegir([d.sovint]);
	else if (d.obrirDia !== undefined) estat.obert = d.obrirDia || null;
	else if (d.apat) {
		const r = f(d.apat);
		tocar(nouId(), {t: 'apat', dia: d.dia, recepta: d.apat, nom: r.nom, qui: estat.qui});
		const n = afegir(r.ingredients, r.nom);
		estat.obert = null;
		avisar(n ? `${n} ${n === 1 ? 'ingredient' : 'ingredients'} a la llista` : 'Ja teniu tots els ingredients a la llista');
	} else if (d.treureApat) tocar(d.treureApat, {...f(d.treureApat), esborrat: true});
	else if (d.aLlista) {
		const r = f(d.aLlista);
		const n = afegir(r.ingredients, r.nom);
		avisar(n ? `${n} ${n === 1 ? 'ingredient' : 'ingredients'} a la llista` : 'Ja hi són tots');
	} else if (d.esborrarRecepta) {
		if (!confirm(`Esborrar «${f(d.esborrarRecepta).nom}»?`)) return;
		tocar(d.esborrarRecepta, {...f(d.esborrarRecepta), esborrat: true});
	} else if (d.sortir !== undefined) {
		estat.clau = null;
	} else return;
	pintar();
});

document.addEventListener('submit', async (ev) => {
	ev.preventDefault();
	const dades = new FormData(ev.target);
	if (ev.target.id === 'form-afegir') {
		const n = afegir(trossos(dades.get('text')));
		pintar();
		document.querySelector('#form-afegir textarea')?.focus();
		if (!n) avisar('Ja hi era');
	} else if (ev.target.id === 'form-recepta') {
		const ingredients = trossos(dades.get('ingredients'));
		if (!ingredients.length) return;
		tocar(nouId(), {t: 'recepta', nom: majuscula(String(dades.get('nom')).trim()), ingredients, qui: estat.qui});
		pintar();
		avisar('Recepta desada');
	} else if (ev.target.id === 'form-entrar') {
		await entrar(dades.get('codi'), dades.get('qui'));
	}
});
// a la casella d'afegir, Intro afegeix (Maj+Intro fa una línia nova, per enganxar llistes)
document.addEventListener('keydown', (ev) => {
	if (ev.key === 'Enter' && !ev.shiftKey && ev.target.matches('#form-afegir textarea')) {
		ev.preventDefault();
		ev.target.form.requestSubmit();
	}
});

let avisT = null;
function avisar(text) {
	let a = document.getElementById('avis');
	if (!a) {
		a = document.createElement('p');
		a.id = 'avis';
		a.setAttribute('role', 'status');
		document.body.append(a);
	}
	a.textContent = text;
	a.className = 'veure';
	clearTimeout(avisT);
	avisT = setTimeout(() => (a.className = ''), 2200);
}

async function entrar(codi, qui) {
	if (!normCodi(codi) || !qui) return;
	// un altre codi és una altra casa: el que hi havia al mòbil no hi té res a veure
	if (estat.codi && normCodi(estat.codi) !== normCodi(codi)) {
		estat.files = {};
		estat.cua = new Set();
		guardat.posar('llar-sembrat', false);
		desar();
	}
	const c = await prepararCasa(codi);
	Object.assign(estat, c, {codi: normCodi(codi), qui, error: null});
	guardat.posar('llar-codi', estat.codi);
	guardat.posar('llar-qui', qui);
	pintar();
	await sincronitzar();
	sembrarReceptes();
	pintar();
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
if (estat.codi && estat.qui) entrar(estat.codi, estat.qui);
else pintar();

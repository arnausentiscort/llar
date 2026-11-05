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
	compartir: '<path d="M12 2v13"/><path d="m16 6-4-4-4 4"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>',
	editar: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
	cerca: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
	carro: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
	plat: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 3 2h3Zm0 0v7"/>',
	seguent: '<path d="m9 18 6-6-6-6"/>',
	regal: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
	secret: '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
	enllac: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
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

// --- cada tipus amb el seu color, i els productes de sempre amb la seva icona (per afegir-los d'un toc) ---
const COLOR_CAT = {fruita: '#43a047', carn: '#e0524f', lactics: '#3d8bd9', embotit: '#d9628f', forn: '#d99a2b', rebost: '#a8743f', begudes: '#1fa9b8', congelats: '#5b9fe0', neteja: '#8c68d6', higiene: '#1e9e8f', altres: '#8a8079'};
// [tipus, [nom, icona, altres maneres de dir-ho (castellà, singular...)]]
const PRODUCTES = [
	['fruita', [['Plàtans', '🍌', 'platan, platano, banana'], ['Pomes', '🍎', 'poma, manzana'], ['Taronges', '🍊', 'taronja, naranja'], ['Mandarines', '🍊', 'mandarina'], ['Llimones', '🍋', 'llimona, limon'], ['Maduixes', '🍓', 'maduixa, fresa'], ['Raïm', '🍇', 'uva'], ['Préssecs', '🍑', 'preseg, melocoton'], ['Síndria', '🍉', 'sandia'], ['Meló', '🍈', 'melo, melon'], ['Tomàquets', '🍅', 'tomaquet, tomate'], ['Enciam', '🥬', 'lechuga'], ['Espinacs', '🥬', 'espinac, espinacas'], ['Cebes', '🧅', 'ceba, cebolla'], ['Alls', '🧄', 'all, ajo, gra d all, dent d all'], ['Patates', '🥔', 'patata'], ['Pastanagues', '🥕', 'pastanaga, zanahoria'], ['Pebrots', '🫑', 'pebrot, pimiento, pebrot vermell, pebrot verd'], ['Cogombre', '🥒', 'pepino'], ['Carbassó', '🥒', 'carbasso, calabacin'], ['Carbassa', '🎃', 'calabaza'], ['Porros', '🥬', 'porro, puerro'], ['Bròquil', '🥦', 'brocoli'], ['Coliflor', '🥦', ''], ['Alvocat', '🥑', 'aguacate'], ['Bolets', '🍄', 'bolet, champinon, champinones, xampinyons'], ['Blat de moro', '🌽', 'maiz'], ['Alberginia', '🍆', 'alberginies, berenjena']]],
	['carn', [['Pollastre', '🍗', 'pollo, pit de pollastre, pechuga, cuixes de pollastre'], ['Carn picada', '🥩', 'carne picada'], ['Bistecs', '🥩', 'bistec, filet, filete'], ['Llom', '🥩', 'lomo, llom de porc'], ['Hamburgueses', '🍔', 'hamburguesa'], ['Salsitxes', '🌭', 'salsitxa, salchicha'], ['Botifarra', '🌭', 'botifarres, butifarra'], ['Salmó', '🐟', 'salmon'], ['Lluç', '🐟', 'lluc, merluza'], ['Bacallà', '🐟', 'bacalla, bacalao'], ['Gambes', '🦐', 'gamba, gambas, llagostins'], ['Calamars', '🦑', 'calamar, sepia']]],
	['lactics', [['Llet', '🥛', 'leche'], ['Ous', '🥚', 'ou, huevo, huevos'], ['Iogurts', '🍦', 'iogurt, yogur, yogures'], ['Formatge', '🧀', 'queso'], ['Formatge ratllat', '🧀', 'queso rallado, parmesa, parmesano'], ['Mozzarella', '🧀', 'mozarella'], ['Mantega', '🧈', 'mantequilla'], ['Nata', '🥛', 'nata per cuinar'], ['Beixamel', '🥛', 'bechamel']]],
	['embotit', [['Pernil salat', '🍖', 'pernil, jamon, jamon serrano'], ['Pernil dolç', '🍖', 'jamon york, jamon cocido'], ['Fuet', '🥓', 'llonganissa, salchichon'], ['Xoriço', '🌭', 'xorico, chorizo'], ['Gall dindi', '🦃', 'pavo'], ['Bacon', '🥓', 'baco, beicon']]],
	['forn', [['Pa', '🥖', 'pan, barra de pa'], ['Pa de motlle', '🍞', 'pan de molde'], ['Pa d’hamburguesa', '🍔', 'pa d hamburguesa, pan de hamburguesa'], ['Tortites', '🌮', 'tortites de blat, tortillas de trigo, wraps'], ['Croissants', '🥐', 'croissant'], ['Magdalenes', '🧁', 'magdalena'], ['Torrades', '🍞', 'tostadas']]],
	['rebost', [['Arròs', '🍚', 'arroz'], ['Pasta', '🍝', ''], ['Macarrons', '🍝', 'macarrones'], ['Espaguetis', '🍝', 'spaghetti'], ['Fideus', '🍜', 'fideos'], ['Plaques de lasanya', '🍝', 'lasanya, lasaña'], ['Oli', '🫒', 'aceite, oli d oliva'], ['Tomàquet fregit', '🥫', 'tomate frito'], ['Tomàquet triturat', '🥫', 'tomate triturado'], ['Tonyina', '🐟', 'atun, tonyina en conserva'], ['Llenties', '🫘', 'llentia, lentejas'], ['Cigrons', '🫘', 'garbanzos'], ['Mongetes', '🫘', 'mongeta, alubias, judias, fesols'], ['Brou', '🍲', 'caldo, brou de pollastre'], ['Pesto', '🌿', ''], ['Sal', '🧂', ''], ['Sucre', '🍬', 'azucar'], ['Cafè', '☕', 'cafe'], ['Cereals', '🥣', 'cereales, muesli'], ['Galetes', '🍪', 'galleta, galletas'], ['Xocolata', '🍫', 'chocolate, cacau, cola cao'], ['Mel', '🍯', 'miel'], ['Olives', '🫒', 'aceitunas'], ['Patates xips', '🥔', 'patatas fritas']]],
	['begudes', [['Aigua', '💧', 'agua'], ['Cervesa', '🍺', 'cerveza'], ['Vi', '🍷', 'vino'], ['Suc', '🧃', 'zumo'], ['Refrescos', '🥤', 'refresc, coca-cola, fanta']]],
	['congelats', [['Pizza', '🍕', ''], ['Gelat', '🍨', 'helado'], ['Croquetes', '🧆', 'croquetas'], ['Verdura congelada', '🧊', 'congelats']]],
	['neteja', [['Paper de cuina', '🧻', 'papel de cocina'], ['Paper higiènic', '🧻', 'papel higienico'], ['Detergent', '🫧', 'detergente, suavitzant'], ['Rentaplats', '🍽️', 'lavavajillas, sabo de plats'], ['Bosses d’escombraries', '🗑️', 'bolsas de basura'], ['Esponges', '🧽', 'fregall, estropajo, esponja'], ['Lleixiu', '🧪', 'lejia, netejador']]],
	['higiene', [['Xampú', '🧴', 'champu'], ['Gel de dutxa', '🧼', 'gel de ducha, sabo'], ['Pasta de dents', '🪥', 'pasta de dientes, raspall de dents'], ['Desodorant', '🧴', 'desodorante']]],
];
// cada manera de dir un producte → la seva icona
const ICONA_DE = [];
for (const [, ps] of PRODUCTES)
	for (const [nom, ic, alt] of ps)
		for (const p of [nom, ...alt.split(',')].map((x) => normal(x).replace(/['’]/g, ' ')).filter(Boolean)) ICONA_DE.push([p, ic]);
ICONA_DE.sort((a, b) => b[0].length - a[0].length);
const EMOJI_CAT = Object.fromEntries(CATEGORIES.map(([id, , e]) => [id, e]));
function iconaDe(nom, cat) {
	const n = ` ${normal(nom).replace(/['’]/g, ' ')} `;
	for (const [p, ic] of ICONA_DE) if (new RegExp(`[ ]${p}(s|es)?[ ]`).test(n)) return ic;
	return EMOJI_CAT[cat ?? categoria(nom)] ?? '🛒';
}
const CAT_DE = {};
for (const [cat, ps] of PRODUCTES) for (const [nom, , alt] of ps) for (const p of [nom, ...alt.split(',')].map(normal).filter(Boolean)) CAT_DE[p] = cat;
// el mateix producte dit de maneres diferents ("Ceba" i "Cebes", "leche" i "Llet") compta com un de sol
const NOM_DE = {};
for (const [, ps] of PRODUCTES) for (const [nom, , alt] of ps) for (const p of [nom, ...alt.split(',')].map(normal).filter(Boolean)) NOM_DE[p] ??= normal(nom);
const canon = (nom) => NOM_DE[normal(nom)] ?? normal(nom);
// el nom bonic de cada producte ("ou" → "Ous"); si no és al catàleg, tal com s'ha escrit
const BONIC_DE = {};
for (const [, ps] of PRODUCTES) for (const [nom, , alt] of ps) for (const p of [nom, ...alt.split(',')].map(normal).filter(Boolean)) BONIC_DE[p] ??= nom;
// (també en plural o singular: "carbassons" → "Carbassó", "pebrot" → "Pebrots")
const formesDe = (n) => [n, n.replace(/ons$/, 'o'), n.replace(/es$/, ''), n.replace(/s$/, ''), n.replace(/ns$/, 'n')];
const nomProducte = (t) => formesDe(normal(t)).map((x) => BONIC_DE[x]).find(Boolean) ?? majuscula(String(t).trim());
const catDe = (nom) => CAT_DE[normal(nom)] ?? categoria(nom);
const colorCat = (cat) => COLOR_CAT[cat] ?? COLOR_CAT.altres;

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

// --- els ingredients de les receptes: cada un és un producte amb quantitat i unitat, no un text ---
// Tres menes: el que es gasta sencer (3 ous), el que se'n fa una part però es pot comptar (1 paquet de pasta, 200 g de
// bacon) i el del rebost, que no es compta i no va a la llista (sal, pebre, oli). Les quantitats són per a tots dos.
const UNITATS = {u: ['unitat', 'unitats'], g: ['g', 'g'], ml: ['ml', 'ml'], paquet: ['paquet', 'paquets'], pot: ['pot', 'pots'], llauna: ['llauna', 'llaunes'], bossa: ['bossa', 'bosses']};
const UNITAT_DE = {
	g: ['g', 1], gr: ['g', 1], grs: ['g', 1], gram: ['g', 1], grams: ['g', 1], gramos: ['g', 1], kg: ['g', 1000], quilo: ['g', 1000], quilos: ['g', 1000], kilo: ['g', 1000], kilos: ['g', 1000],
	ml: ['ml', 1], cl: ['ml', 10], l: ['ml', 1000], litre: ['ml', 1000], litres: ['ml', 1000], litro: ['ml', 1000], litros: ['ml', 1000], brik: ['ml', 1000],
	paquet: ['paquet', 1], paquets: ['paquet', 1], paquete: ['paquet', 1], paquetes: ['paquet', 1], pot: ['pot', 1], pots: ['pot', 1], bote: ['pot', 1], botes: ['pot', 1],
	llauna: ['llauna', 1], llaunes: ['llauna', 1], lata: ['llauna', 1], latas: ['llauna', 1], bossa: ['bossa', 1], bosses: ['bossa', 1], bolsa: ['bossa', 1], bolsas: ['bossa', 1],
	u: ['u', 1], unitat: ['u', 1], unitats: ['u', 1], unidad: ['u', 1], unidades: ['u', 1],
};
const NUMERO_DE = {un: 1, una: 1, uno: 1, dos: 2, dues: 2, tres: 3, quatre: 4, cuatro: 4, cinc: 5, cinco: 5, sis: 6, seis: 6, mig: 0.5, mitja: 0.5, mitjà: 0.5, medio: 0.5, media: 0.5, '½': 0.5, '¼': 0.25};
// el que hi ha sempre a casa: no va a la llista sol (si s'acaba, s'apunta a mà)
const DEL_REBOST = new Set(
	'sal, sal grossa, olives, aceitunas, pebre, pebre negre, pebre vermell, pimienta, pimenton, oli, oli d oliva, aceite, vinagre, sucre, azucar, farina, harina, orenga, oregano, comi, comino, curri, curry, canyella, nou moscada, llorer, laurel, julivert, perejil, alfabrega, albahaca, herbes, herbes provençals, especies, espècies per a fajites, all en pols, mostassa, salsa de soja, soja, ketchup, maionesa, mayonesa, llevat, aigua, agua, alls, all, ajo, formatge ratllat, brou en pastilla, pastilla de brou, romani, farigola, tomillo, colorant, safra'
		.split(',')
		.map((x) => normal(x)),
);
const esDelRebost = (nom) => DEL_REBOST.has(normal(nom)) || DEL_REBOST.has(canon(nom));
const numero = (s) => {
	const t = normal(s);
	if (t in NUMERO_DE) return NUMERO_DE[t];
	if (/^\d+\/\d+$/.test(t)) return Number(t.split('/')[0]) / Number(t.split('/')[1]);
	const n = Number(t.replace(',', '.'));
	return Number.isFinite(n) && n > 0 ? n : null;
};
// "3 ous", "200 g de bacon", "1 paquet de pasta", "mitja ceba", "Ous x3", "pebre" → {nom, q, u, rebost}
function llegirIngredient(text) {
	let t = String(text ?? '').replace(/^[\s\-*•·]+/, '').replace(/[.\s]+$/, '').trim();
	let q = null;
	let u = 'u';
	let rebost = /\b(al gust|una mica|un pessic|un raig|del rebost)\b/i.test(t);
	t = t.replace(/\s*\(?\b(al gust|una mica( de| d')?|un pessic( de| d')?|un raig( de| d')?|del rebost)\b\)?\s*/gi, ' ').trim();
	const davant = t.match(/^(\d+(?:[.,]\d+)?|\d+\/\d+|½|¼|un|una|uno|dos|dues|tres|quatre|cuatro|cinc|cinco|sis|seis|mig|mitja|mitjà|medio|media)\s*([a-zà-ü]+)?\.?\s+(?:de\s+|d['’]\s*)?(.+)$/i)
		?? t.match(/^(\d+(?:[.,]\d+)?)\s*([a-z]+)\.?\s*(?:de\s+|d['’]\s*)?(.+)$/i);
	const darrere = t.match(/^(.+?)\s*[x×]?\s*(\d+(?:[.,]\d+)?)\s*([a-z]+)?$/i);
	if (davant && numero(davant[1]) != null) {
		const unitat = davant[2] && UNITAT_DE[normal(davant[2])];
		q = numero(davant[1]);
		if (unitat) [u, q] = [unitat[0], q * unitat[1]];
		t = unitat ? davant[3] : t.replace(/^\S+\s*/, ''); // sense unitat: tot el que va darrere del número
	} else if (darrere && numero(darrere[2]) != null && (!darrere[3] || UNITAT_DE[normal(darrere[3])])) {
		const unitat = darrere[3] && UNITAT_DE[normal(darrere[3])];
		q = numero(darrere[2]);
		if (unitat) [u, q] = [unitat[0], q * unitat[1]];
		t = darrere[1];
	}
	const nom = nomProducte(t.replace(/^(de|d['’])\s*/i, '').trim());
	if (q == null && !rebost) rebost = esDelRebost(nom);
	return {nom, q: q == null ? null : Math.round(q * 100) / 100, u, rebost};
}
// les receptes velles tenien els ingredients en text: es llegeixen igual
const ingredient = (x) => (typeof x === 'string' ? llegirIngredient(x) : {u: 'u', q: null, rebost: false, ...x});
const ingredientsDe = (r) => (r?.ingredients ?? []).map(ingredient).filter((i) => i.nom);
const xifra = (n) => (n === 0.5 ? '½' : n === 0.25 ? '¼' : n.toLocaleString('ca-ES', {maximumFractionDigits: 2}));
// 3 → "×3", 1500 g → "1,5 kg", 2 paquets...
function quantitat(q, u) {
	if (q == null) return '';
	if (u === 'u') return `×${xifra(q)}`;
	if (u === 'g') return q >= 1000 ? `${xifra(q / 1000)} kg` : `${xifra(q)} g`;
	if (u === 'ml') return q >= 1000 ? `${xifra(q / 1000)} l` : `${xifra(q)} ml`;
	return `${xifra(q)} ${UNITATS[u]?.[q > 1 ? 1 : 0] ?? u}`;
}
const quantitats = (quant) => Object.entries(quant ?? {}).filter(([, q]) => q > 0).map(([u, q]) => quantitat(q, u)).join(' + ');
// "Ous ×3", "Bacon 150 g", "Espaguetis 1 paquet"
const textIngredient = (i) => (i.q == null ? i.nom : `${i.nom} ${quantitat(i.q, i.u)}`);

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
async function desxifrar(s, clau = estat.clau) {
	const [iv, x] = s.split('.');
	return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name: 'AES-GCM', iv: deB64(iv)}, clau, deB64(x))));
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
	full: null, // el full de baix obert: {t: 'plat', dia} · {t: 'recepta', id} · {t: 'perfil'}
	editant: false, // la llista en mode de treure coses
	ultim: null, // l'última cosa tatxada (fa l'animació)
	mesCal: 0, // el mes que es mira al calendari (0 = aquest, -1 = l'anterior...)
	cal: guardat.llegir('llar-cal', {}), // els esdeveniments de cada calendari (id → {quan, events, error}), per obrir-la sense xarxa
	perRegals: null, // de qui són els regals que es miren (si no, els teus)
	secreta: true, // les idees per a l'altre, d'entrada, que no les vegi
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
// Les quantitats són per a dos; la pasta, un paquet per àpat (com feu vosaltres). El que és del rebost no va a la llista.
const RECEPTES = [
	['llenties', 'Llenties estofades', '1 pot de llenties, 1 ceba, 2 pastanagues, 1 patata, 100 g de xoriço, all, pebre vermell, oli, sal'],
	['macarrons', 'Macarrons a la bolonyesa', '1 paquet de macarrons, 300 g de carn picada, 1 ceba, 1 pot de tomàquet fregit, formatge ratllat, oli, sal'],
	['truita', 'Truita de patates', '5 ous, 4 patates, 1 ceba, oli, sal'],
	['pollastre', 'Pollastre al forn amb patates', '4 cuixes de pollastre, 4 patates, 1 ceba, 1 llimona, all, herbes, oli, sal'],
	['amanida', 'Amanida completa', '1 enciam, 2 tomàquets, 1 cogombre, 2 llaunes de tonyina, 2 ous, olives, oli, vinagre, sal'],
	['crema', 'Crema de carbassa', '800 g de carbassa, 1 ceba, 1 pastanaga, 1 patata, 200 ml de nata, oli, sal'],
	['arros', 'Arròs a la cubana', '200 g d’arròs, 1 pot de tomàquet fregit, 2 ous, 2 plàtans, oli, sal'],
	['salmo', 'Salmó amb verdures al forn', '2 salmó, 1 carbassó, 1 pebrot, 1 ceba, oli, sal, pebre'],
	['carbonara', 'Espaguetis a la carbonara', '1 paquet d’espaguetis, 3 ous, 150 g de bacon, formatge ratllat, pebre, sal'],
	['tonyina', 'Espaguetis amb tonyina i tomàquet', '1 paquet d’espaguetis, 2 llaunes de tonyina, 1 pot de tomàquet fregit, orenga, sal'],
	['pesto', 'Pasta al pesto', '1 paquet de pasta, 1 pot de pesto, formatge ratllat, sal'],
	['lasanya', 'Lasanya de carn', '1 paquet de plaques de lasanya, 400 g de carn picada, 1 ceba, 1 pot de tomàquet fregit, 500 ml de beixamel, 100 g de formatge ratllat, oli, sal'],
	['fajites', 'Fajites de pollastre', '400 g de pollastre, 1 paquet de tortites, 2 pebrots, 1 ceba, espècies per a fajites, oli'],
	['quesadilles', 'Quesadilles de pernil i formatge', '1 paquet de tortites, 150 g de formatge, 100 g de pernil dolç'],
	['curri', 'Pollastre al curri amb arròs', '400 g de pollastre, 200 ml de nata, 1 ceba, 200 g d’arròs, curri, oli, sal'],
	['arros-pollastre', 'Arròs amb pollastre i verdures', '200 g d’arròs, 300 g de pollastre, 1 pebrot, 1 ceba, 1 tomàquet, 1 l de brou, oli, sal'],
	['hamburgueses', 'Hamburgueses', '2 hamburgueses, 1 paquet de pa d’hamburguesa, 1 tomàquet, 1 enciam, 4 llesques de formatge, ketchup'],
	['bistec', 'Bistec amb amanida', '2 bistecs, 1 enciam, 2 tomàquets, oli, sal'],
	['llom', 'Llom amb patates', '400 g de llom, 3 patates, oli, sal, all'],
	['lluc', 'Lluç al forn amb patates', '2 lluç, 3 patates, 1 ceba, oli, sal, julivert'],
	['ous-estrellats', 'Ous estrellats amb patates i pernil', '4 ous, 4 patates, 100 g de pernil salat, oli, sal'],
	['cigrons', 'Cigrons amb espinacs', '1 pot de cigrons, 1 bossa d’espinacs, all, pebre vermell, comí, oli, sal'],
	['botifarra', 'Botifarra amb mongetes', '2 botifarres, 1 pot de mongetes, all, julivert, oli, sal'],
	['sopa', 'Sopa de fideus', '100 g de fideus, 1 l de brou, sal'],
	['crema-verdures', 'Crema de verdures', '2 carbassons, 1 porro, 1 patata, 1 ceba, oli, sal'],
	['gaspatxo', 'Gaspatxo', '1 kg de tomàquets, 1 cogombre, 1 pebrot, all, oli, vinagre, sal'],
	['pizza', 'Pizza', '1 pizza'],
	['croquetes', 'Croquetes amb amanida', '1 paquet de croquetes, 1 enciam, 2 tomàquets, oli, sal'],
	['salsitxes', 'Salsitxes amb patates', '6 salsitxes, 3 patates, oli, sal'],
	['wok', 'Wok de verdures amb pollastre', '300 g de pollastre, 1 pebrot, 1 carbassó, 1 pastanaga, 1 ceba, 1 paquet de fideus, salsa de soja, oli'],
];
// les receptes de mostra (amb ids fixos: si dos mòbils les posen alhora, són les mateixes). Les que ja hi eren en text
// i ningú ha tocat, es passen a ingredients amb quantitat. Les que s'hagin esborrat no tornen.
function sembrarReceptes() {
	// només amb el que hi ha al núvol a la mà: si no, tornarien les que algú ha esborrat
	if (guardat.llegir('llar-sembrat-2', false) || (SUPABASE.url && estat.xarxa !== 'al-dia')) return;
	for (const [id, nom, ing] of RECEPTES) {
		const ja = estat.files[`r-${id}`]?.o;
		const ingredients = ing.split(', ').map(llegirIngredient);
		if (!ja) tocar(`r-${id}`, {t: 'recepta', nom, ingredients, qui: 'Reshi'});
		else if (!ja.esborrat && ja.qui === 'Reshi' && ja.ingredients?.every((x) => typeof x === 'string')) tocar(`r-${id}`, {...ja, nom, ingredients});
	}
	guardat.posar('llar-sembrat-2', true);
}

// --- el logo: dues "L" (ells dos, i la "Ll" de Llar) sota una teulada, amb el punt de la "l·l" (fer_icona.py) ---
const logo = (mida) =>
	`<svg class="logo-marca" width="${mida}" height="${mida}" viewBox="2.2 2.2 20.4 20.4" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.6 11 12.4 3.6 21.2 11"/><path d="M7.75 11v8.5h3"/><path d="M14.75 11v8.5h3"/><circle cx="11.25" cy="15.6" r="1.25" fill="var(--groc)" stroke="none"/></svg>`;
// cada persona amb la seva rodoneta de color
const av = (q, gran) => `<span class="av av-${normal(q) || 'ningu'}${gran ? ' gran' : ''}" title="${esc(q)}">${esc(String(q ?? '?').charAt(0))}</span>`;

// --- la llista ---
const pendents = () => totes('cosa').filter((c) => !c.fet && !c.arxivat);
const alCarro = () => totes('cosa').filter((c) => c.fet && !c.arxivat);
// posa coses a la llista: [{nom, q, u}]. Si ja hi són, se'n suma la quantitat. `font` és l'àpat del menú que les
// demana (així, si es treu el plat, es resten); sense font, és que s'han apuntat a mà.
function posarALlista(items, font) {
	const nous = [];
	let sumats = 0;
	for (const it of items) {
		const ja = pendents().find((c) => canon(c.nom) === canon(it.nom));
		const posa = it.q != null ? [{u: it.u, q: it.q}] : [];
		if (ja) {
			const o = estat.files[ja.id].o;
			if (!posa.length && !font) continue; // ja hi és i no porta quantitat: res a fer
			const quant = {...(o.quant ?? {})};
			for (const x of posa) quant[x.u] = (quant[x.u] ?? 0) + x.q;
			const fonts = font ? {...(o.fonts ?? {}), [font]: [...(o.fonts?.[font] ?? []), ...posa]} : o.fonts;
			tocar(ja.id, {...o, quant, fonts, manual: o.manual || !font});
			if (posa.length) sumats++;
		} else {
			const id = nouId();
			const nom = nomProducte(it.nom);
			tocar(id, {t: 'cosa', nom, cat: catDe(nom), qui: estat.qui, quan: ara(), fet: false, quant: Object.fromEntries(posa.map((x) => [x.u, x.q])), ...(font ? {fonts: {[font]: posa}} : {manual: true})});
			nous.push(id);
		}
	}
	return {nous, sumats};
}
// a mà ("6 ous", "Llet"): sense rebost, que si s'apunta és que s'ha acabat
const afegir = (noms) => posarALlista(noms.map((n) => ({...llegirIngredient(n), rebost: false}))).nous;
// treure un plat del menú: es resta el que havia posat, i el que només hi era per ell, fora
function treureDeLlista(font) {
	for (const c of pendents()) {
		const o = estat.files[c.id].o;
		const posat = o.fonts?.[font];
		if (!posat) continue;
		const fonts = {...o.fonts};
		delete fonts[font];
		const quant = {...(o.quant ?? {})};
		for (const x of posat) {
			quant[x.u] = Math.round(((quant[x.u] ?? 0) - x.q) * 100) / 100;
			if (quant[x.u] <= 0) delete quant[x.u];
		}
		tocar(c.id, !Object.keys(fonts).length && !o.manual ? {...o, fonts, esborrat: true} : {...o, fonts, quant});
	}
}
// els ingredients d'un plat que van a la llista (els del rebost, no)
const perComprar = (r) => ingredientsDe(r).filter((i) => !i.rebost);
const delRebost = (r) => ingredientsDe(r).filter((i) => i.rebost);
// tot el que heu comprat mai, amb quantes vegades (per a "Sovint" i per suggerir mentre s'escriu)
function historial() {
	const compte = {};
	for (const c of totes('cosa')) {
		const k = normal(c.nom);
		compte[k] = {nom: c.nom, n: (compte[k]?.n ?? 0) + 1};
	}
	const hiSon = new Set(pendents().map((c) => normal(c.nom)));
	return Object.entries(compte)
		.filter(([k]) => !hiSon.has(k))
		.sort((a, b) => b[1].n - a[1].n)
		.map(([k, x]) => ({k, ...x}));
}
const sovint = () => historial().filter((x) => x.n >= 2).slice(0, 10).map((x) => x.nom);
function suggeriments(text) {
	const t = normal(text);
	if (t.length < 2 || /[,\n]/.test(text)) return [];
	return historial()
		.filter((x) => x.k.includes(t) && x.k !== t)
		.sort((a, b) => b.k.startsWith(t) - a.k.startsWith(t))
		.slice(0, 5)
		.map((x) => x.nom);
}
const grupsDe = (coses) =>
	CATEGORIES.map(([id, nom, emoji]) => ({id, nom, emoji, coses: coses.filter((c) => (c.cat ?? 'altres') === id).sort((a, b) => a.nom.localeCompare(b.nom, 'ca'))})).filter((g) => g.coses.length);

// la llista en text, per enviar-la per WhatsApp
function textLlista() {
	return `🛒 Llista de la compra\n${grupsDe(pendents())
		.map((g) => `\n${g.emoji} ${g.nom}\n${g.coses.map((c) => `• ${c.nom}${quantitats(c.quant) ? ` (${quantitats(c.quant)})` : ''}`).join('\n')}`)
		.join('\n')}`;
}
async function compartir() {
	const text = textLlista();
	try {
		if (navigator.share) return await navigator.share({text});
	} catch (e) {
		if (e.name === 'AbortError') return;
	}
	try {
		await navigator.clipboard.writeText(text);
		avisar('Llista copiada: enganxa-la al WhatsApp');
	} catch {
		location.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
	}
}

// a l'iPhone, si s'obre des de Safari: com posar-la a la pantalla d'inici
const esIphone = /iPhone|iPad|iPod/.test(navigator.userAgent);
const instal·lada = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
const avisInstal·lar = () =>
	esIphone && !instal·lada && !guardat.llegir('llar-no-installar', false)
		? `<aside class="installar"><div class="installar-icona">${logo(26)}</div><div><b>Posa-la a la pantalla d’inici</b><p>Toca ${icona('compartir', 14)} a baix i després <b>Afegir a la pantalla d’inici</b> <span>(Añadir a pantalla de inicio)</span>.</p></div><button type="button" data-no-installar aria-label="Tancar">${icona('tancar', 16)}</button></aside>`
		: '';

// "D'un toc": el que compreu sovint i, darrere, els productes de sempre que ara no són a la llista
const DE_SEMPRE = ['Llet', 'Ous', 'Pa', 'Plàtans', 'Tomàquets', 'Pollastre', 'Iogurts', 'Formatge', 'Pomes', 'Patates', 'Cebes', 'Pasta', 'Arròs', 'Aigua', 'Paper higiènic', 'Pernil'];
function rapid() {
	const hiSon = new Set(pendents().map((c) => canon(c.nom)));
	const vist = new Set();
	return [...historial().map((x) => x.nom), ...DE_SEMPRE]
		.filter((n) => {
			const k = canon(n);
			if (hiSon.has(k) || vist.has(k)) return false;
			vist.add(k);
			return true;
		})
		.slice(0, 14);
}
const fitxaRapid = (nom, posat) => {
	const cat = catDe(nom);
	return `<button type="button" class="fitxa${posat ? ' posat' : ''}" ${posat === undefined ? 'data-rapid' : 'data-rapid-full'}="${esc(nom)}" style="--c:${colorCat(cat)}"><span class="fitxa-ic">${iconaDe(nom, cat)}</span><span>${esc(nom)}</span>${posat ? `<i>${icona('fet', 11)}</i>` : ''}</button>`;
};
// el full amb tots els productes, per tipus: tocar-ne un el posa a la llista (o el treu, si ja hi és)
function fullRapid() {
	const hiSon = new Set(pendents().map((c) => canon(c.nom)));
	return `<h2>Què falta?</h2><p class="full-explica">Toca el que s’hagi acabat. Si ja hi és, el treu.</p>
	${PRODUCTES.map(([cat, ps]) => `<section class="rapid-cat" style="--c:${colorCat(cat)}"><h3><span>${EMOJI_CAT[cat]}</span>${CATEGORIES.find((c) => c[0] === cat)[1]}</h3><div class="rapids graella">${ps.map(([nom]) => fitxaRapid(nom, hiSon.has(canon(nom)))).join('')}</div></section>`).join('')}`;
}
// per a quins plats és una cosa (els àpats del menú que l'han posada)
const platsDe = (c) => [...new Set(Object.keys(c.fonts ?? {}).map((id) => estat.files[id]?.o).filter((a) => a && !a.esborrat).map((a) => a.nom))];
function filaCosa(c) {
	const plats = platsDe(c);
	const meta = plats.length ? `<small>${icona('plat', 11)} ${esc(plats.join(', '))}</small>` : c.plat ? `<small>${icona('plat', 11)} ${esc(c.plat)}</small>` : '';
	const q = quantitats(c.quant) ? `<b class="quant">${esc(quantitats(c.quant))}</b>` : '';
	if (estat.editant)
		return `<li><div class="cosa"><span class="ic-cosa">${iconaDe(c.nom, c.cat)}</span><span class="nom">${esc(c.nom)}${meta}</span>${q}<button type="button" class="treure" data-treure="${c.id}" aria-label="Treure ${esc(c.nom)}">${icona('paperera', 17)}</button></div></li>`;
	return `<li><button type="button" class="cosa" data-fet="${c.id}"><span class="check"></span><span class="ic-cosa">${iconaDe(c.nom, c.cat)}</span><span class="nom">${esc(c.nom)}${meta}</span>${q}${av(c.qui)}</button></li>`;
}
// el que els plats d'aquesta setmana fan servir del rebost: per mirar que n'hi hagi (un toc i va a la llista)
function rebostSetmana() {
	const ds = new Set(dies().map((d) => d.dia));
	const hiSon = new Set(pendents().map((c) => canon(c.nom)));
	const noms = new Map();
	for (const a of totes('apat')) {
		if (!ds.has(a.dia) || !a.recepta) continue;
		for (const i of delRebost(estat.files[a.recepta]?.o)) if (!hiSon.has(canon(i.nom))) noms.set(canon(i.nom), i.nom);
	}
	return [...noms.values()];
}
function vistaLlista() {
	const p = pendents();
	const carro = alCarro();
	const rapids = estat.editant ? [] : rapid();
	const grups = grupsDe(p);
	const total = p.length + carro.length;
	return `${avisInstal·lar()}
	<form class="afegir" id="form-afegir">
		<textarea id="text-afegir" name="text" rows="1" placeholder="Què falta?" enterkeyhint="done" autocomplete="off" autocorrect="on"></textarea>
		<button type="submit" aria-label="Afegir">${icona('mes', 22)}</button>
	</form>
	<div class="suggeriments" id="suggeriments" hidden></div>
	${estat.editant ? '' : `<section class="rapid"><h2>${icona('estrella', 13)} D’un toc</h2><div class="rapids">${rapids.map((n) => fitxaRapid(n)).join('')}<button type="button" class="fitxa mes" data-rapid-tot><span class="fitxa-ic">${icona('mes', 22)}</span><span>Tots</span></button></div></section>`}
	${
		total
			? `<div class="barra-llista">
				<div class="progres"><b>${p.length ? `Falten ${p.length}` : 'Ja ho teniu tot'}</b>${carro.length ? `<span>${carro.length} de ${total} al carro</span>` : ''}<i style="--fet:${total ? (carro.length / total) * 100 : 0}%"></i></div>
				${p.length ? `<button type="button" class="boto-suau" data-compartir aria-label="Enviar la llista">${icona('compartir', 17)}</button><button type="button" class="boto-suau${estat.editant ? ' actiu' : ''}" data-editar>${estat.editant ? 'Fet' : icona('editar', 17)}</button>` : ''}
			</div>`
			: ''
	}
	${(() => {
		const r = estat.editant ? [] : rebostSetmana();
		return r.length ? `<section class="rebost-setmana"><h2>🧂 Per als plats de la setmana, mireu que tingueu</h2><div class="xips">${r.map((n) => `<button type="button" data-rapid="${esc(n)}"><span>${iconaDe(n)}</span>${esc(n)}${icona('mes', 13)}</button>`).join('')}</div><small>Si alguna cosa s’ha acabat, toca-la i va a la llista.</small></section>` : '';
	})()}
	${grups.map((g) => `<section class="grup" style="--c:${colorCat(g.id)}"><h2><span class="emoji">${g.emoji}</span>${g.nom}<small>${g.coses.length}</small></h2><ul>${g.coses.map(filaCosa).join('')}</ul></section>`).join('')}
	${!p.length && !carro.length ? `<div class="buit"><div class="buit-dibuix">${icona('carro', 34)}</div><b>No falta res</b><p>Escriu a dalt el que s’acabi, o tria què menjareu al <button type="button" class="enllac" data-vista="menu">Menú</button> i els ingredients vindran sols.</p></div>` : ''}
	${
		carro.length
			? `<section class="grup carro"><h2><span class="emoji">🛒</span>Al carro<small>${carro.length}</small></h2><ul>${carro
					.map((c) => `<li><button type="button" class="cosa fet${c.id === estat.ultim ? ' nou' : ''}" data-desfer="${c.id}"><span class="check">${icona('fet', 14)}</span><span class="ic-cosa">${iconaDe(c.nom, c.cat)}</span><span class="nom">${esc(c.nom)}</span>${quantitats(c.quant) ? `<b class="quant">${esc(quantitats(c.quant))}</b>` : ''}${av(c.perQui ?? c.qui)}</button></li>`)
					.join('')}</ul>
				<button type="button" class="boto-gran" data-buidar>${icona('fet', 18)} Ja ho hem comprat</button></section>`
			: ''
	}`;
}

// --- el menú: els propers set dies; cada plat posa els seus ingredients a la llista ---
const NOMS_DIES = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'];
const MESOS = ['gen', 'febr', 'març', 'abr', 'maig', 'juny', 'jul', 'ag', 'set', 'oct', 'nov', 'des'];
const diaDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function dies() {
	return [...Array(7)].map((_, i) => {
		const d = new Date();
		d.setDate(d.getDate() + i);
		return {dia: diaDe(d), nom: i === 0 ? 'Avui' : i === 1 ? 'Demà' : NOMS_DIES[d.getDay()], num: d.getDate(), mes: MESOS[d.getMonth()], avui: i === 0};
	});
}
const nomDia = (dia) => dies().find((d) => d.dia === dia)?.nom ?? dia;
function vistaMenu() {
	const apats = totes('apat');
	const ds = dies();
	const n = apats.filter((a) => ds.some((d) => d.dia === a.dia)).length;
	const evs = totsEvents();
	return `<header class="titol"><h1>Menú</h1><p>${n ? `${n} ${n === 1 ? 'plat' : 'plats'} aquesta setmana. ` : ''}Tria què menjareu i els ingredients van sols a la llista.</p></header>
	${ds
		.map((d) => {
			const seus = apats.filter((a) => a.dia === d.dia);
			return `<section class="dia${d.avui ? ' avui' : ''}">
				<div class="dia-data"><b>${d.num}</b><span>${d.mes}</span></div>
				<div class="dia-cos"><h2>${d.nom}</h2>
					${(() => {
						const plans = delDia(evs, d.dia).filter((e) => e.tipus !== 'info');
						return plans.length ? `<p class="dia-plans">${plans.slice(0, 3).map((e) => `<span style="--c:${e.color}">${e.totDia ? '' : `${horaDe(e.inici)} `}${esc(e.titol)}</span>`).join('')}</p>` : '';
					})()}
					${notaApats(evs, d.dia)}
					${seus.map((a) => `<div class="plat">${av(a.qui)}<span>${esc(a.nom)}</span><button type="button" data-treure-apat="${a.id}" aria-label="Treure ${esc(a.nom)}">${icona('tancar', 15)}</button></div>`).join('')}
					<button type="button" class="afegir-plat" data-obrir-dia="${d.dia}">${icona('mes', 15)} ${seus.length ? 'Un altre plat' : 'Afegir un plat'}</button>
				</div>
			</section>`;
		})
		.join('')}`;
}

// --- el receptari ---
const receptesOrdenades = () => totes('recepta').sort((a, b) => a.nom.localeCompare(b.nom, 'ca'));
// "3 ous · 1 paquet de pasta · bacon +2"
const resumIngredients = (r) => {
	const i = perComprar(r);
	return i.slice(0, 3).map(textIngredient).join(' · ') + (i.length > 3 ? ` +${i.length - 3}` : '') || 'Tot del rebost';
};
// les icones dels ingredients (els que es compren), com una tira
const iconesRecepta = (r) => perComprar(r).slice(0, 5).map((i) => iconaDe(i.nom)).join('');
function vistaReceptes() {
	const rs = receptesOrdenades();
	return `<header class="titol"><h1>Receptes</h1><p>Els vostres plats amb els seus ingredients. Toca’n un per canviar-lo o posar-lo a la llista.</p></header>
	<div class="eines-receptes">
		<label class="cerca">${icona('cerca', 17)}<input type="search" id="cerca-receptes" placeholder="Cercar" autocomplete="off"></label>
		<button type="button" class="boto-principal" data-recepta="">${icona('mes', 17)} Nova</button>
	</div>
	<ul class="receptes">${rs
		.map(
			(r) =>
				`<li data-nom="${esc(normal(`${r.nom} ${ingredientsDe(r).map((i) => i.nom).join(' ')}`))}"><button type="button" class="recepta" data-recepta="${r.id}"><span class="recepta-icona">${icona('plat', 18)}</span><span class="recepta-text"><b>${esc(r.nom)}</b><small>${esc(resumIngredients(r))}</small><span class="recepta-icones">${iconesRecepta(r)}</span></span>${icona('seguent', 18)}</button></li>`,
		)
		.join('')}</ul>
	<p class="buit-cerca" hidden>Cap recepta amb aquest nom.</p>`;
}

// --- els regals: la llista de cadascú, com la de la compra però del que li faria il·lusió ---
// Cadascú apunta el que vol (ho veuen tots dos) i també pot apuntar idees secretes per a l'altre (només les veu qui les
// apunta). Quan algú diu "el compro jo", l'altre no ho veu a la seva llista: és sorpresa, i així no en compreu dos.
// (Va tot xifrat amb el mateix codi de casa: amagat vol dir que l'app no ho ensenya, no que l'altre no ho pugui desxifrar.)
const perRegals = () => (PERSONES.includes(estat.perRegals) ? estat.perRegals : estat.qui);
const articleDe = (q) => (q === 'Núria' ? 'la ' : /^[AEIOU]/.test(q) ? 'l’' : 'el ');
// una icona per a cada tipus de regal (si no n'hi ha cap, el paquet)
const ICONES_REGAL = [
	['sabates, sabatilles, bambes, zapatillas, zapatos, runners', '👟'], ['pala, padel, raqueta, tennis', '🎾'], ['classes, clases, curs, curso', '🎓'],
	['mobles, muebles, cadira, silla, taula, mesa, sofa, estanteria, lampara, llum', '🛋️'], ['funda, carcassa, tablet, ipad, mobil, movil', '📱'],
	['gorro, gorra, barret, bufanda', '🧢'], ['caixa d eines, caja de herramientas, eines, herramientas', '🧰'], ['echo, alexa, altaveu, altavoz, homepod', '🔊'],
	['nanoleaf, bombeta, bombilla, led', '💡'], ['cascos, auriculars, auriculares, headphones, airpods', '🎧'], ['colonia, perfum, perfume', '🌸'],
	['secador, planxa, plancha, rizador', '💨'], ['ulleres de busseig, ulleres de bucejar, ulleres de buceja, gafas de buceo, aletes, aletas, snorkel, busseig, bucejar, buceo', '🤿'],
	['ulleres de sol, gafas de sol, ulleres, gafas', '🕶️'], ['serum, kerastase, crema, xampu, champu, mascarilla', '🧴'], ['pinta, peine, raspall, cepillo', '🪮'],
	['contorno, contorn, make up, maquillatge, maquillaje, eyeliner, polvos, pols, pintallavis, labial, rimel, bronceadores, matizantes', '💄'],
	['llibre, llibres, libro, libros', '📚'], ['gopro, camera, camara', '📷'], ['dron, drone', '🚁'], ['bolso, bossa, bolsa, motxilla, mochila, gortari', '👜'],
	['joc, juego, cartes, cartas, puzzle', '🃏'], ['gym, gimnas, gimnasio, velcro, turmelleres, tobilleras, peses, pesas', '🏋️'], ['rellotge, reloj, smartwatch', '⌚'],
	['samarreta, camiseta, jersei, jersey, jaqueta, chaqueta, abric, abrigo, pantalons, pantalones, vestit, vestido, roba, ropa', '👕'], ['viatge, viaje, escapada, hotel', '✈️'],
	['sopar, cena, restaurant, restaurante', '🍽️'], ['entrades, entradas, concert, concierto', '🎟️'], ['joia, joya, collaret, collar, arracades, pendientes, anell, anillo, polsera, pulsera', '💍'],
	['planta, flors, flores', '🪴'], ['consola, play, playstation, switch, xbox, videojoc, videojuego', '🎮'],
]
	.flatMap(([ps, ic]) => ps.split(',').map((x) => [normal(x).replace(/['’·]/g, ' '), ic]))
	.sort((a, b) => b[0].length - a[0].length);
function iconaRegal(nom) {
	const n = ` ${normal(nom).replace(/['’·!?.,:()/]/g, ' ')} `;
	for (const [p, ic] of ICONES_REGAL) if (new RegExp(`[ ]${p}(s|es)?[ ]`).test(n)) return ic;
	return '🎁';
}
// el que es veu de cada llista: la teva, sense les idees secretes de l'altre; la de l'altre, amb les teves
const regalsDe = (per) =>
	totes('regal')
		.filter((g) => g.per === per && !g.donat && (!g.secret || g.qui === estat.qui))
		.sort((a, b) => (a.quan ?? '').localeCompare(b.quan ?? ''));
// una línia → {nom, nota}: "Echo Dot: que sigui Matter" i "Caixa d'eines (les eines ja les tinc)" porten nota
function llegirRegal(linia) {
	let l = linia.replace(/^[\s\-*•·]+/, '').trim();
	let nota = '';
	const dosPunts = l.indexOf(':');
	const parentesi = l.indexOf(' (');
	const coma = l.indexOf(', ');
	const barra = l.indexOf('|');
	if (barra > 1) [l, nota] = [l.slice(0, barra), l.slice(barra + 1)];
	else if (dosPunts > 1 && dosPunts < 45) [l, nota] = [l.slice(0, dosPunts), l.slice(dosPunts + 1)];
	else if (parentesi > 1) [l, nota] = [l.slice(0, parentesi), l.slice(parentesi + 2).replace(/\)[\s.]*$/, '')];
	else if (l.length > 45 && coma > 8) [l, nota] = [l.slice(0, coma), l.slice(coma + 2)];
	return {nom: majuscula(l.replace(/!{2,}/g, '!').replace(/[\s.!¡]+$/, '').trim()), nota: nota.replace(/^[\s.]+|[\s.]+$/g, '').trim()};
}
// el que s'escriu o s'enganxa: una cosa per línia. Si hi ha "Arnau:" o "Núria:", el que ve a sota va a la llista de cadascú
function trossosRegals(text, per) {
	const fora = [];
	let qui = per;
	let demanat = false; // sota un "Núria:" és el que ella ha demanat, no una idea secreta
	let buida = true; // si la línia d'abans era buida
	for (const linia of String(text ?? '').split(/\r?\n/)) {
		const l = linia.trim();
		const ambBuida = buida;
		buida = !l;
		if (!l) continue;
		// el capçal de cada llista: "Arnau:", "Núria:" (o mig nom, si s'ha copiat tallat: "au:")
		const capcal = l.match(/^([a-zà-ü]{2,8})\s*:\s*$/i) ?? l.match(/^(arnau|n[uú]ria)\s*$/i);
		const de = capcal && PERSONES.find((p) => normal(p) === normal(capcal[1]) || normal(p).endsWith(normal(capcal[1])) || normal(p).startsWith(normal(capcal[1])));
		if (de) {
			qui = de;
			demanat = true;
			continue;
		}
		// una línia que comença amb parèntesi completa la d'abans ("llibres!" i a sota quins)
		if (/^[(…]/.test(l) && fora.length) {
			const ant = fora[fora.length - 1];
			ant.nota = [ant.nota, l.replace(/^\(/, '').replace(/[)\s.…]+$/, '').trim()].filter(Boolean).join(' · ');
			continue;
		}
		const g = llegirRegal(l);
		// una marca sola en majúscules ("KERASTASE") i just a sota el producte: és un regal sol
		const ant = fora[fora.length - 1];
		if (!ambBuida && ant && !ant.nota && /^[A-ZÀ-Ü0-9'’ -]{3,20}$/.test(ant.cru) && !/^[A-ZÀ-Ü0-9'’ -]+$/.test(g.nom)) {
			ant.nom = `${majuscula(ant.nom.toLowerCase())} ${g.nom}`;
			ant.nota = g.nota;
			ant.cru = l;
			continue;
		}
		if (g.nom.length > 1) fora.push({...g, per: qui, demanat, cru: l});
	}
	return fora;
}
function afegirRegals(llista, secreta) {
	const hiSon = new Set(totes('regal').filter((g) => !g.donat).map((g) => `${g.per}|${normal(g.nom)}`));
	let n = 0;
	for (const g of llista) {
		const k = `${g.per}|${normal(g.nom)}`;
		// "COLONIA!" quan ja hi ha "Colonia buena": és la mateixa (dit amb més ganes)
		if (hiSon.has(k) || [...hiSon].some((x) => x.startsWith(`${k} `))) continue;
		hiSon.add(k);
		// a la llista de l'altre és una idea secreta si el botó ho diu; el que ve d'un "Núria:" enganxat ho ha demanat ella
		const secret = g.per !== estat.qui && secreta && !g.demanat;
		tocar(nouId(), {t: 'regal', per: g.per, nom: g.nom, nota: g.nota, enllac: '', secret, qui: estat.qui, quan: ara(), comprat: null, donat: false});
		n++;
	}
	return n;
}
function filaRegal(g) {
	const meu = g.per === estat.qui;
	const marques = [
		g.nota ? `<small class="nota">${esc(g.nota)}</small>` : '',
		g.secret ? `<small class="secret">${icona('secret', 12)} Idea teva: ${articleDe(g.per)}${esc(g.per)} no la veu</small>` : '',
		!g.secret && g.qui !== g.per && g.qui !== estat.qui ? `<small>L’ha apuntat ${articleDe(g.qui)}${esc(g.qui)}</small>` : '',
	].join('');
	const enllac = g.enllac ? `<a class="regal-enllac" href="${esc(g.enllac)}" target="_blank" rel="noopener" aria-label="Obrir l’enllaç">${icona('enllac', 16)}</a>` : '';
	const compra = meu
		? ''
		: g.comprat
			? g.comprat.qui === estat.qui
				? `<button type="button" class="regal-compro fet" data-no-compro="${g.id}">${icona('fet', 14)} El compres tu</button>`
				: `<span class="regal-compro altre">${av(g.comprat.qui)} El compra ${articleDe(g.comprat.qui)}${esc(g.comprat.qui)}</span>`
			: `<button type="button" class="regal-compro" data-compro="${g.id}">El compro jo</button>`;
	return `<li class="regal${g.comprat && !meu ? ' comprat' : ''}"><button type="button" class="regal-cos" data-regal="${g.id}"><span class="ic-regal">${iconaRegal(g.nom)}</span><span class="regal-text"><b>${esc(g.nom)}</b>${marques}</span></button>${enllac}${compra}</li>`;
}
function vistaRegals() {
	const per = perRegals();
	const meu = per === estat.qui;
	const llista = regalsDe(per);
	const comprats = llista.filter((g) => g.comprat).length;
	const aqui = `${articleDe(per)}${per}`;
	return `<header class="titol"><h1>Regals</h1><p>${meu ? 'El que t’agradaria. Qui te’l compra ho marca i tu no ho veus: així és sorpresa.' : `El que vol ${aqui}, i les teves idees. Marca el que li compres: ${aqui} no ho veurà.`}</p></header>
	<div class="per-qui">${PERSONES.map((p) => `<button type="button" data-per="${p}" aria-pressed="${p === per}">${av(p)}${p === estat.qui ? 'Els meus' : `Per a ${articleDe(p)}${p}`}</button>`).join('')}</div>
	<form class="afegir" id="form-regal">
		<textarea id="text-regal" name="text" rows="1" placeholder="${meu ? 'Què t’agradaria?' : `Una idea per a ${aqui}`}" enterkeyhint="done" autocomplete="off" autocorrect="on"></textarea>
		<button type="submit" aria-label="Afegir">${icona('mes', 22)}</button>
	</form>
	${meu ? '' : `<button type="button" class="secreta${estat.secreta ? ' actiu' : ''}" data-secreta aria-pressed="${estat.secreta}">${icona('secret', 15)} ${estat.secreta ? `Idea secreta: ${aqui} no la veurà` : `Ho ha demanat ${aqui}: ho veurà`}</button>`}
	<p class="pista">Pots enganxar una llista sencera, una cosa per línia. Si hi ha «Arnau:» i «Núria:», cada part va a la llista de cadascú.</p>
	${
		llista.length
			? `${!meu && comprats ? `<p class="regals-compte">${comprats} de ${llista.length} ja tenen qui els compri</p>` : ''}<ul class="regals">${llista.map(filaRegal).join('')}</ul>`
			: `<div class="buit"><div class="buit-dibuix">${icona('regal', 34)}</div><b>${meu ? 'Encara no hi ha res' : `${majuscula(aqui)} encara no hi ha posat res`}</b><p>${meu ? 'Apunta a dalt el que t’agradaria: unes sabates, un llibre, una escapada…' : 'Apunta-hi idees: només les veuràs tu.'}</p><button type="button" class="enllac" data-perfil>Els teniu apuntats amb un altre codi? Porta’ls aquí</button></div>`
	}`;
}
function fullRegal(id) {
	const g = estat.files[id]?.o;
	if (!g) return '<h2>Aquest regal ja no hi és</h2>';
	const meu = g.per === estat.qui;
	return `<h2 class="titol-regal"><span class="ic-regal">${iconaRegal(g.nom)}</span>${meu ? 'El teu regal' : `Per a ${articleDe(g.per)}${esc(g.per)}`}</h2>
	<form id="form-regal-edit" class="form-recepta" data-id="${id}">
		<label>Què<input name="nom" value="${esc(g.nom)}" required autocomplete="off"></label>
		<label>Detalls (talla, color, model…)<textarea name="nota" rows="3" placeholder="Opcional">${esc(g.nota ?? '')}</textarea></label>
		<label>Enllaç<input name="enllac" type="url" inputmode="url" value="${esc(g.enllac ?? '')}" placeholder="https://… (opcional)" autocomplete="off"></label>
		<button type="submit" class="boto-gran">Desar</button>
	</form>
	<div class="full-botons">${
		!meu && g.comprat?.qui === estat.qui ? `<button type="button" class="boto-suau" data-donat="${id}">${icona('regal', 16)} Ja l’hi he donat</button>` : '<span></span>'
	}<button type="button" class="boto-perill" data-esborrar-regal="${id}">${icona('paperera', 16)} Esborrar</button></div>`;
}

// --- el calendari: els Google Calendar de tots dos, llegits amb l'enllaç secret (.ics) ---
// Cada un enganxa el seu enllaç al perfil (es desa xifrat, com tot). Google no deixa que una web el llegeixi directament,
// així que passa per la funció "calendari" del Supabase (supabase-calendari.ts), que el va a buscar i el torna.
// Hi ha dues menes de calendari: els plans de cadascú i els "d'informació" (qui és a Reus), que es veuen com a franges.
// el nom que Supabase va posar a la funció del pont quan es va crear (supabase-calendari.ts)
const FUNCIO_CALENDARI = 'swift-processor';
const calendaris = () => totes('calendari');
const DIES_SETMANA = ['dl', 'dt', 'dc', 'dj', 'dv', 'ds', 'dg'];
const MESOS_LLARGS = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
const deMes = (m) => (/^[aeiou]/.test(MESOS_LLARGS[m]) ? `d’${MESOS_LLARGS[m]}` : `de ${MESOS_LLARGS[m]}`);
const desfer = (s) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
// "20261206" (tot el dia), "20261206T210000Z" (UTC) o amb TZID (hora d'aquí)
function dataIcs(v) {
	const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
	if (!m) return null;
	const [, a, me, d, h = '0', mi = '0', s = '0', z] = m;
	return z ? new Date(Date.UTC(+a, +me - 1, +d, +h, +mi, +s)) : new Date(+a, +me - 1, +d, +h, +mi, +s);
}
function llegirIcs(text) {
	const evs = [];
	let e = null;
	for (const l of text.replace(/\r/g, '').replace(/\n[ \t]/g, '').split('\n')) {
		if (l === 'BEGIN:VEVENT') e = {};
		else if (l === 'END:VEVENT') {
			if (e?.inici && e.estat !== 'CANCELLED') evs.push(e);
			e = null;
		} else if (e) {
			const i = l.indexOf(':');
			if (i < 0) continue;
			const [nom, ...params] = l.slice(0, i).split(';');
			const val = l.slice(i + 1);
			if (nom === 'SUMMARY') e.titol = desfer(val);
			else if (nom === 'LOCATION') e.lloc = desfer(val);
			else if (nom === 'DTSTART') [e.inici, e.totDia] = [dataIcs(val), params.includes('VALUE=DATE') || /^\d{8}$/.test(val)];
			else if (nom === 'DTEND') e.fi = dataIcs(val);
			else if (nom === 'RRULE') e.regla = Object.fromEntries(val.split(';').map((x) => x.split('=')));
			else if (nom === 'EXDATE') (e.excepte ??= []).push(...val.split(',').map((v) => dataIcs(v)?.getTime()));
			else if (nom === 'RECURRENCE-ID') e.recId = dataIcs(val)?.getTime();
			else if (nom === 'UID') e.uid = val;
			else if (nom === 'STATUS') e.estat = val;
		}
	}
	return evs;
}
// els que es repeteixen (cada setmana, cada any...), desplegats entre dues dates
const DIES_ICS = {MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0};
function desplegar(evs, des, fins) {
	const fora = [];
	const canviats = new Set(evs.filter((e) => e.recId).map((e) => `${e.uid}|${e.recId}`));
	for (const e of evs) {
		const dura = (e.fi ?? e.inici).getTime() - e.inici.getTime() || (e.totDia ? 864e5 : 36e5);
		const posa = (ini) => {
			const fi = new Date(ini.getTime() + dura);
			if (fi > des && ini < fins && !e.excepte?.includes(ini.getTime()) && !(e.regla && canviats.has(`${e.uid}|${ini.getTime()}`)))
				fora.push({titol: e.titol ?? '(sense títol)', lloc: e.lloc ?? '', totDia: e.totDia, inici: ini, fi});
		};
		if (!e.regla) {
			posa(e.inici);
			continue;
		}
		const r = e.regla;
		const cada = Number(r.INTERVAL ?? 1);
		const fins2 = r.UNTIL ? dataIcs(r.UNTIL) : fins;
		let n = 0;
		const maxim = Number(r.COUNT ?? 1e9);
		const dies = r.BYDAY ? r.BYDAY.split(',').map((d) => DIES_ICS[d.slice(-2)]) : null;
		for (let k = 0, d = new Date(e.inici); k < 800 && d <= fins2 && d < fins && n < maxim; k++) {
			if (r.FREQ === 'WEEKLY' && dies) {
				// la setmana de d: cada dia que toca
				const dl = new Date(d);
				dl.setDate(d.getDate() - ((d.getDay() + 6) % 7));
				for (const dia of dies) {
					const x = new Date(dl);
					x.setDate(dl.getDate() + ((dia + 6) % 7));
					if (x < e.inici || x > fins2 || n >= maxim) continue;
					n++;
					posa(x);
				}
				d.setDate(d.getDate() + 7 * cada);
				continue;
			}
			n++;
			posa(new Date(d));
			if (r.FREQ === 'DAILY') d.setDate(d.getDate() + cada);
			else if (r.FREQ === 'WEEKLY') d.setDate(d.getDate() + 7 * cada);
			else if (r.FREQ === 'MONTHLY') d.setMonth(d.getMonth() + cada);
			else if (r.FREQ === 'YEARLY') d.setFullYear(d.getFullYear() + cada);
			else break;
		}
	}
	return fora;
}
// va a buscar els calendaris (com a molt cada 10 minuts, si no es força) i ho desa per obrir-la sense xarxa
let carregantCal = false;
async function carregarCalendaris(forca) {
	if (carregantCal || !SUPABASE.url || !estat.clau) return;
	const cals = calendaris().filter((c) => forca || !estat.cal[c.id] || Date.now() - estat.cal[c.id].quan > 10 * 60e3);
	if (!cals.length) return;
	carregantCal = true;
	const des = new Date();
	des.setMonth(des.getMonth() - 2);
	const fins = new Date();
	fins.setMonth(fins.getMonth() + 7);
	await Promise.all(
		cals.map(async (c) => {
			try {
				const r = await fetch(`${SUPABASE.url}/functions/v1/${FUNCIO_CALENDARI}`, {method: 'POST', headers: capcals(), body: JSON.stringify({url: c.url})});
				if (!r.ok) throw new Error(r.status === 404 ? 'Falta el pont al Supabase' : `Google ha dit ${r.status}`);
				const events = desplegar(llegirIcs(await r.text()), des, fins).map((e) => ({...e, inici: e.inici.toISOString(), fi: e.fi.toISOString()}));
				estat.cal[c.id] = {quan: Date.now(), events};
			} catch (e) {
				estat.cal[c.id] = {...(estat.cal[c.id] ?? {events: []}), quan: Date.now(), error: String(e.message ?? e)};
			}
		}),
	);
	guardat.posar('llar-cal', estat.cal);
	carregantCal = false;
	pintar();
	// si mentrestant se n'ha afegit un altre, també
	if (calendaris().some((c) => !estat.cal[c.id])) carregarCalendaris();
}
// tots els esdeveniments, amb de qui són i de quina mena: [{titol, inici: Date, fi: Date, totDia, qui, tipus, color, partit}]
// cada persona d'"A Reus" amb un color diferent de les altres (per ordre alfabètic; la família, sempre en rosa)
const PALETA_INFO = ['#3d8bd9', '#43a047', '#e8833a', '#8c68d6', '#1fa9b8', '#d99a2b', '#7a5c3e', '#5b6abf'];
function totsEvents() {
	const fora = [];
	const noms = [...new Set(calendaris().filter((c) => c.tipus === 'info').flatMap((c) => (estat.cal[c.id]?.events ?? []).map((e) => e.titol.replace(/ a Reus$/i, ''))))]
		.filter((n) => !/🏠/.test(n))
		.sort((a, b) => a.localeCompare(b, 'ca'));
	const colorDeNom = (titol) => (/🏠/.test(titol) ? '#d9628f' : PALETA_INFO[Math.max(0, noms.indexOf(titol.replace(/ a Reus$/i, ''))) % PALETA_INFO.length]);
	for (const c of calendaris()) {
		for (const e of estat.cal[c.id]?.events ?? []) {
			const partit = /⚽|real tiesada/i.test(e.titol);
			const nom = e.titol.replace(/ a Reus$/i, '');
			fora.push({...e, inici: new Date(e.inici), fi: new Date(e.fi), qui: c.qui, tipus: c.tipus, partit, nom,
				color: c.tipus === 'info' ? colorDeNom(e.titol) : partit ? '#e0524f' : c.qui === 'Núria' ? 'var(--nuria)' : 'var(--arnau)'});
		}
	}
	return fora.sort((a, b) => a.inici - b.inici);
}
const iniciDia = (dia) => new Date(`${dia}T00:00:00`);
const fiDia = (dia) => new Date(iniciDia(dia).getTime() + 864e5);
const delDia = (evs, dia) => evs.filter((e) => e.inici < fiDia(dia) && e.fi > iniciDia(dia));
const horaDe = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
// qui no menja a casa: algú amb un pla (amb hora) que agafa l'hora de dinar o de sopar
const APATS = [['dinar', 13.5, 15.5], ['sopar', 20.5, 22.5]];
function foraDeCasa(evs, dia) {
	const fora = [];
	for (const [apat, h0, h1] of APATS) {
		const a = new Date(iniciDia(dia).getTime() + h0 * 36e5);
		const b = new Date(iniciDia(dia).getTime() + h1 * 36e5);
		for (const q of PERSONES) {
			const e = evs.find((x) => x.tipus !== 'info' && !x.totDia && x.qui === q && x.inici < b && x.fi > a);
			if (e) fora.push({apat, qui: q, e});
		}
	}
	return fora;
}
// "🍽 Sopar: l'Arnau no hi és (⚽ 21:10)"
function notaApats(evs, dia) {
	const fora = foraDeCasa(evs, dia);
	return APATS.map(([apat]) => {
		const f = fora.filter((x) => x.apat === apat);
		if (!f.length) return '';
		const qui = f.length === PERSONES.length ? 'no sou cap a casa' : `${articleDe(f[0].qui)}${f[0].qui} no hi és`;
		return `<p class="nota-apat">🍽 <b>${majuscula(apat)}:</b> ${esc(qui)} <small>(${f.map((x) => `${x.e.partit ? '⚽ ' : ''}${horaDe(x.e.inici)}`).join(', ')})</small></p>`;
	}).join('');
}
const filaEvent = (e, dia) => {
	const quan = e.totDia ? 'Tot el dia' : `${horaDe(e.inici)}${e.fi - e.inici > 0 && e.fi.toDateString() === e.inici.toDateString() ? `–${horaDe(e.fi)}` : ''}`;
	const multi = e.totDia && e.fi - e.inici > 864e5 ? ` <small>${dia === diaDe(e.inici) ? 'arriba' : diaDe(new Date(e.fi.getTime() - 864e5)) === dia ? 'marxa' : 'hi és'}</small>` : '';
	return `<li class="event${e.tipus === 'info' ? ' info' : ''}" style="--c:${e.color}"><span class="event-hora">${quan}</span><span class="event-text"><b>${esc(e.titol)}</b>${multi}${e.lloc ? `<small>${esc(e.lloc)}</small>` : ''}</span>${e.tipus === 'info' ? '' : av(e.qui)}</li>`;
};
// el resum d'avui (i de demà, si avui ja s'ha acabat)
function resumAvui(evs) {
	const avui = diaDe(new Date());
	const plans = delDia(evs, avui).filter((e) => e.tipus !== 'info');
	const info = delDia(evs, avui).filter((e) => e.tipus === 'info');
	const plats = totes('apat').filter((a) => a.dia === avui);
	return `<section class="avui-cal">
		<h2>Avui <small>${NOMS_DIES[new Date().getDay()].toLowerCase()} ${new Date().getDate()} ${deMes(new Date().getMonth())}</small></h2>
		${plans.length ? `<ul class="events">${plans.map((e) => filaEvent(e, avui)).join('')}</ul>` : '<p class="buit-petit">Cap pla per avui.</p>'}
		${notaApats(evs, avui)}
		${plats.length ? `<p class="avui-plat">${icona('plat', 14)} ${plats.map((a) => esc(a.nom)).join(' · ')}</p>` : `<button type="button" class="enllac" data-obrir-dia="${avui}">Què menjareu avui?</button>`}
		${info.length ? `<div class="avui-info">${info.map((e) => `<span style="--c:${e.color}">${esc(e.nom)}</span>`).join('')} <small>a Reus</small></div>` : ''}
	</section>`;
}
// una franja de dates curta: "27 → 29 nov", "18 des → 11 gen"
function franja(e) {
	const fi = new Date(e.fi.getTime() - (e.totDia ? 864e5 : 0));
	const a = `${e.inici.getDate()}${e.inici.getMonth() !== fi.getMonth() ? ` ${MESOS[e.inici.getMonth()]}` : ''}`;
	return diaDe(e.inici) === diaDe(fi) ? `${e.inici.getDate()} ${MESOS[e.inici.getMonth()]}` : `${a} → ${fi.getDate()} ${MESOS[fi.getMonth()]}`;
}
function vistaCalendari() {
	const evs = totsEvents();
	const ara = new Date();
	const primer = new Date(ara.getFullYear(), ara.getMonth() + estat.mesCal, 1);
	const seguent = new Date(primer.getFullYear(), primer.getMonth() + 1, 1);
	const nDies = new Date(primer.getFullYear(), primer.getMonth() + 1, 0).getDate();
	const buits = (primer.getDay() + 6) % 7;
	const avui = diaDe(ara);
	const apats = totes('apat');
	const errors = calendaris().filter((c) => estat.cal[c.id]?.error);
	const ocult = (estat.calOcult ??= new Set()); // el que s'ha amagat del mes: 'plans' o 'info'
	const delMes = evs.filter((e) => e.inici < seguent && e.fi > primer);
	const persones = delMes.filter((e) => e.tipus === 'info');
	const plans = delMes.filter((e) => e.tipus !== 'info');
	const cel = (n) => {
		const d = diaDe(new Date(primer.getFullYear(), primer.getMonth(), n));
		const seus = delDia(evs, d);
		const info = ocult.has('info') ? [] : seus.filter((e) => e.tipus === 'info');
		const ps = ocult.has('plans') ? [] : seus.filter((e) => e.tipus !== 'info');
		const finde = [0, 6].includes(new Date(`${d}T12:00`).getDay());
		const plat = apats.some((a) => a.dia === d);
		return `<button type="button" class="cel${finde ? ' finde' : ''}${d === avui ? ' avui' : ''}${d < avui ? ' passat' : ''}" data-dia-cal="${d}">
			<b>${n}${plat ? '<i class="plat" title="Hi ha plat al menú">🍽</i>' : ''}</b>
			<span class="cel-plans">${ps.slice(0, 3).map((e) => (e.partit ? '<i class="partit">⚽</i>' : `<i style="--c:${e.color}"></i>`)).join('')}${ps.length > 3 ? '<em>+</em>' : ''}</span>
			<span class="cel-textos">${ps.slice(0, 2).map((e) => `<span class="cel-ev" style="--c:${e.color}" title="${e.totDia ? '' : `${horaDe(e.inici)} `}${esc(e.titol)}">${e.partit ? `⚽ ${esc(e.titol.replace(/^⚽\s*/, '').replace(/Real Tiesada\s*[–-]\s*|\s*[–-]\s*Real Tiesada/i, ''))}` : esc(e.titol)}</span>`).join('')}${ps.length > 2 ? `<em>+${ps.length - 2}</em>` : ''}</span>
			<span class="cel-info">${info.slice(0, 3).map((e) => `<i style="--c:${e.color}" title="${esc(e.titol)}"><span>${esc(e.nom)}</span></i>`).join('')}</span>
		</button>`;
	};
	// els propers caps de setmana, que és el que més es mira
	const findes = [];
	for (let d = new Date(ara); findes.length < 3; d.setDate(d.getDate() + 1)) {
		if (d.getDay() !== 6) continue;
		const ds = diaDe(d);
		const dg = diaDe(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
		const seus = [...new Map([...delDia(evs, ds), ...delDia(evs, dg)].map((e) => [`${e.titol}|${e.inici}`, e])).values()];
		findes.push({ds, d: new Date(d), seus});
	}
	const nomMes = `${majuscula(MESOS_LLARGS[primer.getMonth()])}${primer.getFullYear() !== ara.getFullYear() ? ` ${primer.getFullYear()}` : ''}`;
	const mostra = (que, text) => `<button type="button" class="mostra${ocult.has(que) ? '' : ' actiu'}" data-cal-mostra="${que}" aria-pressed="${!ocult.has(que)}">${text}</button>`;
	return `<header class="titol titol-amb-boto"><h1>Calendari</h1>${calendaris().length ? `<button type="button" class="boto-suau" data-apunta="">${icona('mes', 16)} Apuntar</button>` : ''}</header>
	<div class="cal-graella">
		<div class="cal-esq">
			${calendaris().length ? resumAvui(evs) : `<div class="connecta-cal"><b>Connecta els vostres calendaris</b><p>Enganxa l’enllaç secret del teu Google Calendar i aquí veureu els plans de tots dos, qui és a Reus i el menú, tot junt.</p><button type="button" class="boto-suau" data-perfil>${icona('menu', 16)} Connectar el meu</button></div>`}
			<section class="mes">
				<div class="mes-cap"><button type="button" class="boto-suau" data-mes-cal="-1" aria-label="Mes anterior">‹</button><b>${nomMes}</b><button type="button" class="boto-suau" data-mes-cal="1" aria-label="Mes següent">›</button></div>
				<div class="llegenda">${mostra('plans', '🗓️ Plans')}${mostra('info', '📍 Qui és a Reus')}<span class="claus"><span><i style="--c:var(--arnau)"></i>Arnau</span><span><i style="--c:var(--nuria)"></i>Núria</span><span>⚽ partit</span><span>🍽 menú</span></span></div>
				<div class="graella-mes">${DIES_SETMANA.map((d, i) => `<small class="${i > 4 ? 'finde' : ''}">${d}</small>`).join('')}${'<span></span>'.repeat(buits)}${[...Array(nDies)].map((_, i) => cel(i + 1)).join('')}</div>
			</section>
			${errors.length ? `<p class="error-cal">${icona('sense', 14)} ${errors.map((c) => `${esc(c.nom)}: ${esc(estat.cal[c.id].error)}`).join(' · ')}</p>` : ''}
		</div>
		<div class="cal-dre">
			<section class="cal-llista">
				<h2>📍 Qui és a Reus <small>${MESOS_LLARGS[primer.getMonth()]}</small></h2>
				${persones.length ? persones.map((e) => `<button type="button" class="persona-fila" style="--c:${e.color}" data-dia-cal="${diaDe(e.inici < primer ? primer : e.inici)}"><i></i><b>${esc(e.nom)}</b><span>${franja(e)}</span></button>`).join('') : '<p class="buit-petit">Ningú aquest mes.</p>'}
			</section>
			<section class="cal-llista">
				<h2>🗓️ Plans <small>${MESOS_LLARGS[primer.getMonth()]}</small></h2>
				${plans.length ? plans.map((e) => `<button type="button" class="pla-fila${diaDe(e.inici) < avui ? ' passat' : ''}" style="--c:${e.color}" data-dia-cal="${diaDe(e.inici)}"><span class="pla-dia"><b>${e.inici.getDate()}</b><small>${DIES_SETMANA[(e.inici.getDay() + 6) % 7]}</small></span><span class="pla-text"><b>${esc(e.titol)}</b><small>${e.totDia ? 'Tot el dia' : horaDe(e.inici)}${e.lloc ? ` · ${esc(e.lloc)}` : ''}</small></span>${av(e.qui)}</button>`).join('') : '<p class="buit-petit">Cap pla aquest mes.</p>'}
			</section>
			<section class="findes"><h2>Els propers caps de setmana</h2>${findes
				.map((f) => `<button type="button" class="finde-fila" data-dia-cal="${f.ds}"><span class="finde-data"><small>ds</small><b>${f.d.getDate()}</b><small>${MESOS[f.d.getMonth()]}</small></span><span class="finde-coses">${f.seus.length ? f.seus.slice(0, 4).map((e) => `<span style="--c:${e.color}">${esc(e.titol)}</span>`).join('') : '<small>Lliure</small>'}</span></button>`)
				.join('')}</section>
		</div>
	</div>`;
}
// el full d'un dia: els plans, qui és a Reus, qui menja a casa i el menú
function fullDia(dia) {
	const evs = totsEvents();
	const seus = delDia(evs, dia);
	const plans = seus.filter((e) => e.tipus !== 'info');
	const info = seus.filter((e) => e.tipus === 'info');
	const d = new Date(`${dia}T12:00`);
	const plats = totes('apat').filter((a) => a.dia === dia);
	return `<h2>${NOMS_DIES[d.getDay()]} ${d.getDate()} ${deMes(d.getMonth())}</h2>
	<div class="dia-bloc"><h3>🗓️ Plans</h3>${plans.length ? `<ul class="events">${plans.map((e) => filaEvent(e, dia)).join('')}</ul>` : '<p class="buit-petit">Cap pla.</p>'}</div>
	${info.length ? `<div class="dia-bloc"><h3>📍 A Reus</h3><ul class="events">${info.map((e) => filaEvent(e, dia)).join('')}</ul></div>` : ''}
	${notaApats(evs, dia)}
	<div class="dia-menu"><h3>${icona('plat', 14)} Menú</h3>
		${plats.map((a) => `<div class="plat">${av(a.qui)}<span>${esc(a.nom)}</span><button type="button" data-treure-apat="${a.id}" aria-label="Treure ${esc(a.nom)}">${icona('tancar', 15)}</button></div>`).join('')}
		<button type="button" class="afegir-plat" data-obrir-dia="${dia}">${icona('mes', 15)} ${plats.length ? 'Un altre plat' : 'Afegir un plat'}</button>
	</div>
	<button type="button" class="boto-suau ample" data-apunta="${dia}">${icona('mes', 16)} Apuntar alguna cosa aquest dia</button>`;
}
// apuntar al Google Calendar: s'escriu com es diria i s'obre Google ja omplert
function fullApunta(dia) {
	const d = dia ? new Date(`${dia}T12:00`) : null;
	return `<h2>Apuntar al calendari</h2>
	<p class="full-explica">${d ? `Per al ${NOMS_DIES[d.getDay()].toLowerCase()} ${d.getDate()} ${deMes(d.getMonth())}. ` : ''}Escriu-ho com ho diries${d ? '' : ' (amb el dia i, si cal, l’hora)'}. S’obrirà el Google Calendar ja omplert: només cal tocar «Desar».</p>
	<form class="apunta" id="form-apunta"${dia ? ` data-dia="${dia}"` : ''}><input name="text" id="text-apunta" placeholder="${d ? 'Sopar a casa la Marina 21h' : 'Sopar amb la Marina dissabte 21h'}" autocomplete="off" enterkeyhint="go"><button type="submit" aria-label="Apuntar">${icona('mes', 20)}</button></form>
	<p class="pista">Exemples: «dentista demà a les 10:30», «cine 12/11 22h», «pàdel dilluns 19h».</p>`;
}
// "sopar amb la Marina dissabte 21h" → {titol, dia, hora}. Entén avui, demà, demà passat, els dies de la setmana i 6/12
function llegirApunt(text, diaFix) {
	let t = ` ${text.trim()} `;
	let dia = diaFix ?? null;
	let hora = null;
	const avui = new Date();
	const treu = (re) => {
		const m = t.match(re);
		if (m) t = t.replace(m[0], ' ');
		return m;
	};
	let m;
	if ((m = treu(/\s(?:a les |a las )?(\d{1,2})(?::|\.|h)(\d{2})?h?\s/i))) hora = `${m[1].padStart(2, '0')}:${m[2] ?? '00'}`;
	if (!dia) {
		if (treu(/\sdem[aà] passat\s|\spasado mañana\s/i)) dia = diaDe(new Date(avui.getFullYear(), avui.getMonth(), avui.getDate() + 2));
		else if (treu(/\sdem[aà]\s|\smañana\s/i)) dia = diaDe(new Date(avui.getFullYear(), avui.getMonth(), avui.getDate() + 1));
		else if (treu(/\savui\s|\shoy\s/i)) dia = diaDe(avui);
		else if ((m = treu(/\s(?:el |dia )?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s/i))) {
			let any = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : avui.getFullYear();
			if (!m[3] && new Date(any, +m[2] - 1, +m[1]) < new Date(avui.getFullYear(), avui.getMonth(), avui.getDate())) any++;
			dia = diaDe(new Date(any, +m[2] - 1, +m[1]));
		} else {
			const noms = [['diumenge', 'domingo'], ['dilluns', 'lunes'], ['dimarts', 'martes'], ['dimecres', 'miércoles', 'miercoles'], ['dijous', 'jueves'], ['divendres', 'viernes'], ['dissabte', 'sábado', 'sabado']];
			for (const [n, ps] of noms.entries()) {
				if (treu(new RegExp(`\\s(?:aquest |este |el )?(?:${ps.join('|')})\\s`, 'i'))) {
					const x = new Date(avui);
					x.setDate(avui.getDate() + ((n - avui.getDay() + 7) % 7 || 7));
					dia = diaDe(x);
					break;
				}
			}
		}
	}
	const titol = majuscula(t.replace(/\s+/g, ' ').trim());
	return {titol, dia: dia ?? diaDe(avui), hora};
}
// l'enllaç de Google per crear l'esdeveniment ja omplert (un toc a "Desar" i ja hi és)
function enllacGoogle({titol, dia, hora}) {
	const d = dia.replace(/-/g, '');
	let dates;
	if (hora) {
		const [h, m] = hora.split(':').map(Number);
		const fi = new Date(`${dia}T${hora}:00`);
		fi.setHours(h + 1, m);
		dates = `${d}T${hora.replace(':', '')}00/${diaDe(fi).replace(/-/g, '')}T${horaDe(fi).replace(':', '')}00`;
	} else dates = `${d}/${diaDe(new Date(new Date(`${dia}T12:00`).getTime() + 864e5)).replace(/-/g, '')}`;
	return `https://calendar.google.com/calendar/render?${new URLSearchParams({action: 'TEMPLATE', text: titol, dates, ctz: 'Europe/Madrid'})}`;
}
// al perfil: els calendaris de cadascú (l'enllaç secret de Google)
function seccioCalendaris() {
	const meus = calendaris().filter((c) => c.qui === estat.qui);
	const altres = calendaris().filter((c) => c.qui !== estat.qui);
	return `<div class="cals">
		<b>Calendaris</b>
		${[...meus, ...altres].map((c) => `<div class="cal-fila"><span class="cal-tipus">${c.tipus === 'info' ? '📍' : '🗓️'}</span><span><b>${esc(c.nom)}</b><small>${c.qui === estat.qui ? 'teu' : `de ${articleDe(c.qui)}${esc(c.qui)}`}${estat.cal[c.id]?.error ? ` · ${esc(estat.cal[c.id].error)}` : estat.cal[c.id] ? ` · ${estat.cal[c.id].events.length} coses` : ''}</small></span>${c.qui === estat.qui ? `<button type="button" class="cal-treure" data-treure-cal="${c.id}" aria-label="Treure ${esc(c.nom)}">${icona('tancar', 15)}</button>` : ''}</div>`).join('')}
		<form id="form-cal" class="form-cal">
			<input name="url" required autocomplete="off" inputmode="url" placeholder="Enllaç secret iCal del teu Google Calendar">
			<div><input name="nom" required autocomplete="off" placeholder="Nom (p. ex. El meu, A Reus)"><select name="tipus"><option value="plans">Plans</option><option value="info">Informació (qui és a Reus…)</option></select></div>
			<button type="submit" class="boto-suau">Afegir el calendari</button>
			<small>A Google Calendar (al web): ⚙️ Configuració → el teu calendari → «Integrar el calendari» → «Adreça secreta en format iCal».</small>
		</form>
	</div>`;
}

// --- els fulls de baix ---
function fullPlat(dia) {
	const rs = receptesOrdenades();
	return `<h2>Què menjareu ${dia === diaDe(new Date()) ? 'avui' : nomDia(dia) === 'Demà' ? 'demà' : `el ${nomDia(dia).toLowerCase()}`}?</h2>
	<label class="cerca">${icona('cerca', 17)}<input type="search" id="cerca-plat" placeholder="Cercar un plat" autocomplete="off"></label>
	<ul class="triar">${rs
		.map(
			(r) =>
				`<li data-nom="${esc(normal(`${r.nom} ${ingredientsDe(r).map((i) => i.nom).join(' ')}`))}"><button type="button" data-apat="${r.id}" data-dia="${dia}"><b>${esc(r.nom)}</b><small>${iconesRecepta(r)} ${esc(resumIngredients(r))}</small></button></li>`,
		)
		.join('')}</ul>
	<form id="form-plat-lliure" class="plat-lliure" data-dia="${dia}">
		<input name="nom" placeholder="Un altre plat (sense recepta)" autocomplete="off" required>
		<button type="submit" aria-label="Afegir">${icona('mes', 18)}</button>
	</form>`;
}
// la recepta oberta s'edita en un esborrany (estat.full.esb), que no es perd si arriba un canvi de l'altre mòbil
const esborranyDe = (id) => {
	const r = id ? estat.files[id]?.o : null;
	return {nom: r?.nom ?? '', ing: ingredientsDe(r)};
};
function filaIngredient(i, n) {
	const unitats = Object.entries(UNITATS)
		.map(([u, [un, molts]]) => `<option value="${u}"${i.u === u ? ' selected' : ''}>${u === 'u' ? 'unitats' : u === 'g' || u === 'ml' ? u : molts}</option>`)
		.join('');
	return `<div class="ing${i.rebost ? ' rebost' : ''}" style="--c:${colorCat(catDe(i.nom))}">
		<span class="ic-cosa">${iconaDe(i.nom)}</span>
		<input class="ing-nom" id="ing-nom-${n}" data-camp="nom" data-i="${n}" value="${esc(i.nom)}" aria-label="Ingredient" autocomplete="off">
		${
			i.rebost
				? `<span class="ing-rebost">del rebost</span>`
				: `<input class="ing-q" id="ing-q-${n}" data-camp="q" data-i="${n}" type="number" inputmode="decimal" step="any" min="0" placeholder="—" value="${i.q ?? ''}" aria-label="Quantitat"><select class="ing-u" id="ing-u-${n}" data-camp="u" data-i="${n}" aria-label="Unitat">${unitats}</select>`
		}
		<button type="button" class="ing-tipus${i.rebost ? ' actiu' : ''}" data-ing-rebost="${n}" title="${i.rebost ? 'És del rebost: no va a la llista' : 'Marcar com a rebost (sal, pebre, oli…)'}" aria-pressed="${i.rebost}"><span>🧂</span>Rebost</button>
		<button type="button" class="ing-treure" data-ing-treure="${n}" aria-label="Treure ${esc(i.nom)}">${icona('tancar', 15)}</button>
	</div>`;
}
function fullRecepta(id) {
	const r = id ? estat.files[id]?.o : null;
	const esb = (estat.full.esb ??= esborranyDe(id));
	return `<h2>${r ? 'La recepta' : 'Una recepta nova'}</h2>
	<form id="form-recepta" class="form-recepta" data-id="${id ?? ''}">
		<label>Nom del plat<input id="rec-nom" name="nom" value="${esc(esb.nom)}" placeholder="Espaguetis a la carbonara" required autocomplete="off"></label>
		<div class="ings">
			<div class="ings-cap"><b>Ingredients</b><small>per a vosaltres dos</small></div>
			${esb.ing.map(filaIngredient).join('')}
			<div class="ing-nou"><input id="ing-nou" placeholder="3 ous, 1 paquet de pasta, pebre…" autocomplete="off" enterkeyhint="enter"><button type="button" data-ing-afegir aria-label="Afegir l’ingredient">${icona('mes', 18)}</button></div>
			<p class="pista">Escriu-los com els diries: «3 ous», «200 g de bacon», «1 paquet de pasta». 🧂 = del rebost (sal, pebre, oli…): el teniu sempre i no va a la llista. Sense quantitat, va a la llista sense número.</p>
		</div>
		<button type="submit" class="boto-gran">${r ? 'Desar els canvis' : 'Desar la recepta'}</button>
	</form>
	${
		r
			? `<div class="full-botons"><button type="button" class="boto-suau" data-a-llista="${id}">${icona('llista', 16)} Ingredients a la llista</button><button type="button" class="boto-perill" data-esborrar-recepta="${id}">${icona('paperera', 16)} Esborrar</button></div>`
			: ''
	}`;
}
const ESTAT_XARXA = {
	'al-dia': 'Tot desat i compartit',
	mirant: 'Connectant…',
	sense: 'Sense connexió: es desa al mòbil i s’enviarà sol',
	local: 'Només en aquest mòbil',
};
function fullPerfil() {
	return `<div class="perfil">${av(estat.qui, true)}<h2>Hola, ${esc(estat.qui)}</h2><p class="xarxa-text ${estat.xarxa}"><i></i>${ESTAT_XARXA[estat.xarxa]}</p></div>
	<div class="codi"><span>El codi de casa</span><b>${esc(estat.codi)}</b><small>És el mateix als dos mòbils. Amb ell es xifra tot: ningú més ho pot llegir.</small></div>
	<form id="form-portar" class="portar">
		<b>Portar coses d’una altra casa</b>
		<small>Si heu apuntat regals o receptes amb un altre codi, escriu-lo aquí i es copiaran a aquesta casa.</small>
		<div><input name="codi" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="L’altre codi"><button type="submit" class="boto-suau">Portar</button></div>
	</form>
	${seccioCalendaris()}
	<button type="button" class="boto-suau ample" data-sortir>Canviar de persona o de codi</button>`;
}
// els regals i les receptes d'una altra casa (un altre codi), copiats a aquesta. No s'hi esborra res.
async function portarDe(codi) {
	if (normCodi(codi) === estat.codi) return 'Aquest ja és el codi d’aquesta casa';
	const altra = await prepararCasa(codi);
	const r = await fetch(`${SUPABASE.url}/rest/v1/llar?casa=eq.${altra.casa}&select=id,dades`, {headers: capcals()});
	if (!r.ok) throw new Error(`Supabase ${r.status}`);
	const files = await r.json();
	const hiSon = new Set(Object.values(estat.files).filter((f) => !f.o.esborrat).map((f) => `${f.o.t}|${f.o.per ?? ''}|${normal(f.o.nom ?? '')}`));
	let regals = 0;
	let receptes = 0;
	for (const f of files) {
		let o;
		try {
			o = await desxifrar(f.dades, altra.clau);
		} catch {
			continue;
		}
		if (o.esborrat || o.donat || !['regal', 'recepta'].includes(o.t)) continue;
		const k = `${o.t}|${o.per ?? ''}|${normal(o.nom ?? '')}`;
		if (hiSon.has(k)) continue;
		hiSon.add(k);
		tocar(nouId(), o);
		if (o.t === 'regal') regals++;
		else receptes++;
	}
	if (!files.length) return 'Amb aquest codi no hi ha res';
	if (!regals && !receptes) return 'Ja ho teníeu tot aquí';
	return [regals && `${regals} ${regals === 1 ? 'regal' : 'regals'}`, receptes && `${receptes} ${receptes === 1 ? 'recepta' : 'receptes'}`].filter(Boolean).join(' i ') + ' portats';
}

// --- la primera vegada: el codi de casa i qui ets ---
function vistaEntrar() {
	return `<main class="entrar">
		<div class="logo-gran">${logo(56)}</div>
		<h1>Llar</h1>
		<p>La llista de la compra, els menús, les receptes i els regals de casa. Per a tots dos.</p>
		<form id="form-entrar">
			<label>El codi de casa<input name="codi" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Per exemple: TORTILLA CONDIS 47" value="${esc(estat.codi ?? '')}"></label>
			<p class="ajuda">Inventeu-lo junts i escriviu el mateix als dos mòbils. Guardeu-lo bé: és la clau de la vostra llista.</p>
			<fieldset><legend>Qui ets?</legend><div class="persones">${PERSONES.map((p) => `<label class="persona"><input type="radio" name="qui" value="${p}" required ${estat.qui === p ? 'checked' : ''}><span>${av(p, true)}${p}</span></label>`).join('')}</div></fieldset>
			<button type="submit" class="boto-gran">Entrar</button>
			${estat.error ? `<p class="error">${esc(estat.error)}</p>` : ''}
		</form>
	</main>`;
}

function pintar() {
	const app = document.getElementById('app');
	if (!estat.clau) {
		app.innerHTML = vistaEntrar();
		return;
	}
	// que el teclat i el que s'estava escrivint no es perdin quan arriba un canvi de l'altre
	const actiu = document.activeElement;
	const escrivint = actiu?.id && actiu.matches('input, textarea') ? {id: actiu.id, valor: actiu.value, nom: actiu.name, form: actiu.form?.id} : null;
	const n = pendents().length;
	const perEnviar = estat.cua.size && estat.xarxa !== 'local' ? estat.cua.size : 0;
	const full = estat.full;
	// si el full ja era obert, que no torni a pujar ni perdi on era
	const abans = document.querySelector('.full');
	const quiet = full && abans?.dataset.t === full.t;
	const scrollFull = abans?.scrollTop ?? 0;
	app.innerHTML = `
	<header class="cap">
		<div class="marca">${logo(24)}<b>Llar</b></div>
		<button type="button" class="estat-xarxa ${estat.xarxa}" data-perfil title="${ESTAT_XARXA[estat.xarxa]}"><i></i>${perEnviar ? `${perEnviar} per enviar` : estat.xarxa === 'sense' ? 'Sense connexió' : ''}</button>
		<button type="button" class="qui" data-perfil aria-label="${esc(estat.qui)}">${av(estat.qui)}</button>
	</header>
	<main class="pantalla">${{llista: vistaLlista, menu: vistaMenu, receptes: vistaReceptes, regals: vistaRegals, calendari: vistaCalendari}[estat.vista]()}</main>
	<nav class="pestanyes">
		<button type="button" data-vista="llista" aria-pressed="${estat.vista === 'llista'}">${icona('llista', 22)}<span>Llista</span>${n ? `<i>${n}</i>` : ''}</button>
		<button type="button" data-vista="menu" aria-pressed="${estat.vista === 'menu'}">${icona('plat', 22)}<span>Menú</span></button>
		<button type="button" data-vista="calendari" aria-pressed="${estat.vista === 'calendari'}">${icona('menu', 22)}<span>Calendari</span></button>
		<button type="button" data-vista="receptes" aria-pressed="${estat.vista === 'receptes'}">${icona('recepta', 22)}<span>Receptes</span></button>
		<button type="button" data-vista="regals" aria-pressed="${estat.vista === 'regals'}">${icona('regal', 22)}<span>Regals</span></button>
	</nav>
	${
		full
			? `<div class="vel${quiet ? ' quiet' : ''}" data-tancar-full></div><section class="full${quiet ? ' quiet' : ''}" data-t="${full.t}" role="dialog" aria-modal="true"><div class="full-nansa"></div><button type="button" class="full-tancar" data-tancar-full aria-label="Tancar">${icona('tancar', 18)}</button>${
					{plat: () => fullPlat(full.dia), recepta: () => fullRecepta(full.id), perfil: fullPerfil, rapid: fullRapid, regal: () => fullRegal(full.id), dia: () => fullDia(full.dia), apunta: () => fullApunta(full.dia)}[full.t]()
				}</section>`
			: ''
	}`;
	document.body.classList.toggle('amb-full', !!full);
	if (quiet) document.querySelector('.full').scrollTop = scrollFull;
	if (escrivint) {
		const el = document.getElementById(escrivint.id) ?? (escrivint.form && document.querySelector(`#${escrivint.form} [name="${escrivint.nom}"]`));
		if (el) {
			el.value = escrivint.valor;
			el.focus();
			filtrar(el);
		}
	}
	estat.ultim = null;
}

// --- el que es toca ---
document.addEventListener('click', (ev) => {
	if (ev.target.closest('.vel')) {
		estat.full = null;
		return pintar();
	}
	const b = ev.target.closest('button');
	if (!b) return;
	const d = b.dataset;
	const f = (id) => estat.files[id]?.o;
	if (d.vista) {
		estat.vista = d.vista;
		estat.editant = false;
		window.scrollTo(0, 0);
		if (['calendari', 'menu'].includes(d.vista)) carregarCalendaris();
	} else if (d.fet) {
		tocar(d.fet, {...f(d.fet), fet: true, fetQuan: ara(), perQui: estat.qui});
		estat.ultim = d.fet;
	} else if (d.desfer) tocar(d.desfer, {...f(d.desfer), fet: false});
	else if (d.buidar !== undefined) {
		const ids = alCarro().map((c) => c.id);
		for (const id of ids) tocar(id, {...f(id), arxivat: true});
		avisar(`${ids.length} ${ids.length === 1 ? 'cosa comprada' : 'coses comprades'}`, () => ids.forEach((id) => tocar(id, {...f(id), arxivat: false})));
	} else if (d.treure) {
		const id = d.treure;
		tocar(id, {...f(id), esborrat: true});
		avisar(`«${f(id).nom}» fora de la llista`, () => tocar(id, {...f(id), esborrat: false}));
		if (!pendents().length) estat.editant = false;
	} else if (d.sovint || d.suggeriment) {
		afegir([d.sovint || d.suggeriment]);
		if (d.suggeriment) {
			const t = document.querySelector('#form-afegir textarea');
			if (t) t.value = '';
		}
	} else if (d.rapid) {
		const [id] = afegir([d.rapid]);
		if (id) avisar(`${iconaDe(d.rapid)} ${d.rapid} a la llista`, () => tocar(id, {...f(id), esborrat: true}));
	} else if (d.rapidFull) {
		const ja = pendents().find((c) => canon(c.nom) === canon(d.rapidFull));
		if (ja) tocar(ja.id, {...f(ja.id), esborrat: true});
		else afegir([d.rapidFull]);
	} else if (d.rapidTot !== undefined) estat.full = {t: 'rapid'};
	else if (d.editar !== undefined) estat.editant = !estat.editant;
	else if (d.compartir !== undefined) return compartir();
	else if (d.noInstallar !== undefined) guardat.posar('llar-no-installar', true);
	else if (d.obrirDia) estat.full = {t: 'plat', dia: d.obrirDia};
	else if (d.apat) {
		// el plat al menú, i el que cal comprar a la llista (sumat al que ja hi havia)
		const r = f(d.apat);
		const apat = nouId();
		tocar(apat, {t: 'apat', dia: d.dia, recepta: d.apat, nom: r.nom, qui: estat.qui});
		const {nous, sumats} = posarALlista(perComprar(r), apat);
		const n = nous.length + sumats;
		const rebost = delRebost(r).map((i) => i.nom.toLowerCase());
		estat.full = null;
		avisar(`${r.nom}: ${n ? `${n} ${n === 1 ? 'cosa' : 'coses'} a la llista` : 'no cal comprar res'}${rebost.length ? ` · mireu que tingueu ${rebost.slice(0, 3).join(', ')}` : ''}`, () => {
			treureDeLlista(apat);
			tocar(apat, {...f(apat), esborrat: true});
		});
	} else if (d.treureApat) {
		// treure el plat del menú també treu de la llista el que havia posat
		const id = d.treureApat;
		tocar(id, {...f(id), esborrat: true});
		treureDeLlista(id);
		avisar(`«${f(id).nom}» fora del menú i de la llista`, () => {
			tocar(id, {...f(id), esborrat: false});
			const r = f(id).recepta && f(f(id).recepta);
			if (r) posarALlista(perComprar(r), id);
		});
	} else if (d.recepta !== undefined) estat.full = {t: 'recepta', id: d.recepta || null};
	else if (d.ingAfegir !== undefined) afegirIngredients();
	else if (d.ingTreure !== undefined) estat.full.esb.ing.splice(Number(d.ingTreure), 1);
	else if (d.ingRebost !== undefined) {
		const i = estat.full.esb.ing[Number(d.ingRebost)];
		i.rebost = !i.rebost;
	} else if (d.aLlista) {
		const r = f(d.aLlista);
		const {nous, sumats} = posarALlista(perComprar(r));
		const n = nous.length + sumats;
		estat.full = null;
		avisar(n ? `${n} ${n === 1 ? 'cosa' : 'coses'} a la llista` : 'Ja hi són tots');
	} else if (d.esborrarRecepta) {
		const id = d.esborrarRecepta;
		tocar(id, {...f(id), esborrat: true});
		estat.full = null;
		avisar(`«${f(id).nom}» esborrada`, () => tocar(id, {...f(id), esborrat: false}));
	} else if (d.diaCal) estat.full = {t: 'dia', dia: d.diaCal};
	else if (d.apunta !== undefined) {
		estat.full = {t: 'apunta', dia: d.apunta || null};
		setTimeout(() => document.getElementById('text-apunta')?.focus(), 250);
	} else if (d.calMostra) {
		const o = (estat.calOcult ??= new Set());
		o.has(d.calMostra) ? o.delete(d.calMostra) : o.add(d.calMostra);
	}
	else if (d.mesCal) estat.mesCal += Number(d.mesCal);
	else if (d.treureCal) {
		const id = d.treureCal;
		tocar(id, {...f(id), esborrat: true});
		delete estat.cal[id];
		avisar(`Calendari «${f(id).nom}» tret`, () => tocar(id, {...f(id), esborrat: false}));
	} else if (d.per) estat.perRegals = d.per;
	else if (d.secreta !== undefined) estat.secreta = !estat.secreta;
	else if (d.compro) {
		const id = d.compro;
		tocar(id, {...f(id), comprat: {qui: estat.qui, quan: ara()}});
		avisar(`${iconaRegal(f(id).nom)} ${f(id).nom}: el compres tu`, () => tocar(id, {...f(id), comprat: null}));
	} else if (d.noCompro) tocar(d.noCompro, {...f(d.noCompro), comprat: null});
	else if (d.regal) estat.full = {t: 'regal', id: d.regal};
	else if (d.donat) {
		const id = d.donat;
		tocar(id, {...f(id), donat: true, donatQuan: ara()});
		estat.full = null;
		avisar(`${iconaRegal(f(id).nom)} Regal fet!`, () => tocar(id, {...f(id), donat: false}));
	} else if (d.esborrarRegal) {
		const id = d.esborrarRegal;
		tocar(id, {...f(id), esborrat: true});
		estat.full = null;
		avisar(`«${f(id).nom}» esborrat`, () => tocar(id, {...f(id), esborrat: false}));
	} else if (d.perfil !== undefined) estat.full = {t: 'perfil'};
	else if (d.tancarFull !== undefined) estat.full = null;
	else if (d.desferAvis !== undefined) {
		desferAvis?.();
		desferAvis = null;
		amagarAvis();
	} else if (d.sortir !== undefined) {
		estat.clau = null;
		estat.full = null;
	} else return;
	pintar();
});

document.addEventListener('submit', async (ev) => {
	ev.preventDefault();
	const form = ev.target;
	const dades = new FormData(form);
	if (form.id === 'form-afegir') {
		const noms = trossos(dades.get('text'));
		if (!noms.length) return;
		const {nous, sumats} = posarALlista(noms.map((n) => ({...llegirIngredient(n), rebost: false})));
		const n = nous.length;
		form.querySelector('textarea').value = '';
		pintar();
		document.querySelector('#form-afegir textarea')?.focus();
		avisar(!n && !sumats ? 'Ja hi era' : !n ? 'Quantitat sumada' : n > 1 ? `${n} coses afegides` : `${estat.files[nous[0]].o.nom} afegit`);
	} else if (form.id === 'form-recepta') {
		afegirIngredients(); // el que hi hagués escrit a la casella de baix, també
		const esb = estat.full.esb;
		const nom = majuscula(String(dades.get('nom') ?? esb.nom).trim());
		const ingredients = esb.ing.filter((i) => i.nom.trim()).map((i) => ({nom: nomProducte(i.nom), q: i.rebost ? null : i.q, u: i.u, rebost: !!i.rebost}));
		if (!nom) return;
		if (!ingredients.length) return avisar('Posa-hi algun ingredient');
		const id = form.dataset.id || nouId();
		tocar(id, {...(estat.files[id]?.o ?? {qui: estat.qui}), t: 'recepta', nom, ingredients});
		estat.full = null;
		pintar();
		avisar(form.dataset.id ? 'Recepta desada' : 'Recepta nova desada');
	} else if (form.id === 'form-plat-lliure') {
		const nom = majuscula(String(dades.get('nom')).trim());
		if (!nom) return;
		tocar(nouId(), {t: 'apat', dia: form.dataset.dia, recepta: null, nom, qui: estat.qui});
		estat.full = null;
		pintar();
		avisar(`${nom} al menú`);
	} else if (form.id === 'form-regal') {
		const llista = trossosRegals(dades.get('text'), perRegals());
		if (!llista.length) return;
		const n = afegirRegals(llista, estat.secreta);
		const quins = [...new Set(llista.map((g) => g.per))];
		if (quins.length === 1) estat.perRegals = quins[0];
		form.querySelector('textarea').value = '';
		pintar();
		avisar(!n ? 'Ja hi era' : n > 1 ? `${n} regals apuntats${quins.length > 1 ? ' a les dues llistes' : ''}` : `${iconaRegal(llista[0].nom)} ${llista[0].nom}: apuntat`);
	} else if (form.id === 'form-regal-edit') {
		const id = form.dataset.id;
		const enllac = String(dades.get('enllac') ?? '').trim();
		tocar(id, {...estat.files[id].o, nom: majuscula(String(dades.get('nom')).trim()), nota: String(dades.get('nota') ?? '').trim(), enllac: /^https?:\/\//.test(enllac) ? enllac : ''});
		estat.full = null;
		pintar();
		avisar('Desat');
	} else if (form.id === 'form-entrar') {
		await entrar(dades.get('codi'), dades.get('qui'));
	} else if (form.id === 'form-cal') {
		// un calendari nou: l'enllaç secret .ics de Google
		const url = String(dades.get('url') ?? '').trim();
		if (!/^https:\/\/calendar\.google\.com\/calendar\/ical\/.+\.ics$/.test(url)) return avisar('Ha de ser l’adreça secreta iCal de Google (acaba en .ics)');
		const id = nouId();
		tocar(id, {t: 'calendari', qui: estat.qui, nom: majuscula(String(dades.get('nom')).trim()), tipus: dades.get('tipus') === 'info' ? 'info' : 'plans', url});
		pintar();
		avisar('Calendari afegit');
		carregarCalendaris(true);
	} else if (form.id === 'form-apunta') {
		// apuntar al Google Calendar: s'obre Google amb tot omplert i només cal tocar "Desar"
		const text = String(dades.get('text') ?? '').trim();
		if (text.length < 2) return;
		const a = llegirApunt(text, form.dataset.dia);
		window.open(enllacGoogle(a), '_blank', 'noopener');
		form.querySelector('input').value = '';
		const d = new Date(`${a.dia}T12:00`);
		estat.full = null;
		pintar();
		avisar(`${a.titol} · ${NOMS_DIES[d.getDay()].toLowerCase()} ${d.getDate()}${a.hora ? ` a les ${a.hora}` : ''}: toca «Desar» a Google`);
		setTimeout(() => carregarCalendaris(true), 60e3); // quan torni, que ja hi surti
	} else if (form.id === 'form-portar') {
		const boto = form.querySelector('button');
		boto.disabled = true;
		boto.textContent = 'Portant…';
		try {
			const text = await portarDe(dades.get('codi'));
			estat.full = null;
			pintar();
			avisar(text);
		} catch {
			boto.disabled = false;
			boto.textContent = 'Portar';
			avisar('Sense connexió: torna-ho a provar');
		}
	}
});
// a la casella d'afegir, Intro afegeix (Maj+Intro fa una línia nova, per enganxar llistes)
document.addEventListener('keydown', (ev) => {
	if (ev.key === 'Enter' && !ev.shiftKey && ev.target.matches('#form-afegir textarea, #form-regal textarea')) {
		ev.preventDefault();
		ev.target.form.requestSubmit();
	}
	// a la recepta, Intro a la casella d'ingredients l'afegeix (i a les altres no envia el formulari)
	if (ev.key === 'Enter' && ev.target.matches('#form-recepta input')) {
		ev.preventDefault();
		if (ev.target.id === 'ing-nou') {
			afegirIngredients();
			pintar();
		}
	}
	if (ev.key === 'Escape' && estat.full) {
		estat.full = null;
		pintar();
	}
});
// el que hi ha escrit a la casella d'ingredients (un o uns quants: "3 ous, 1 paquet de pasta, pebre") → files
function afegirIngredients() {
	const caixa = document.getElementById('ing-nou');
	const text = caixa?.value ?? '';
	if (!estat.full?.esb || !text.trim()) return;
	const nous = text
		.split(/\r?\n|,|;/)
		.map((t) => t.trim())
		.filter((t) => t.length > 1)
		.map(llegirIngredient);
	estat.full.esb.ing.push(...nous);
	caixa.value = '';
}
// mentre s'escriu: suggeriments a la llista, cerques als fulls i l'esborrany de la recepta (sense tornar a pintar tot)
function filtrar(el) {
	if (el.dataset?.camp && estat.full?.esb) {
		const i = estat.full.esb.ing[Number(el.dataset.i)];
		if (!i) return;
		if (el.dataset.camp === 'q') i.q = el.value === '' ? null : Number(el.value);
		else i[el.dataset.camp] = el.value;
	} else if (el.id === 'rec-nom' && estat.full?.esb) estat.full.esb.nom = el.value;
	else if (el.matches('#form-afegir textarea')) {
		const caixa = document.getElementById('suggeriments');
		const s = suggeriments(el.value);
		caixa.hidden = !s.length;
		caixa.innerHTML = s.map((n) => `<button type="button" data-suggeriment="${esc(n)}">${icona('mes', 13)}${esc(n)}</button>`).join('');
	} else if (el.id === 'cerca-plat' || el.id === 'cerca-receptes') {
		const t = normal(el.value);
		let algun = false;
		for (const li of document.querySelectorAll(el.id === 'cerca-plat' ? '.triar li' : '.receptes li')) {
			li.hidden = t && !li.dataset.nom.includes(t);
			algun ||= !li.hidden;
		}
		const buit = document.querySelector('.buit-cerca');
		if (buit) buit.hidden = algun;
	}
}
document.addEventListener('input', (ev) => filtrar(ev.target));
document.addEventListener('change', (ev) => ev.target.matches('select[data-camp]') && filtrar(ev.target));
// si al nom d'un ingredient s'hi escriu la quantitat ("4 ous"), en sortir es posa al seu lloc
document.addEventListener('focusout', (ev) => {
	if (!ev.target.matches?.('.ing-nom') || !estat.full?.esb) return;
	const i = estat.full.esb.ing[Number(ev.target.dataset.i)];
	if (!i || !i.nom.trim()) return;
	// si s'hi ha escrit amb quantitat ("4 ous"), es reparteix
	const llegit = llegirIngredient(i.nom);
	if (llegit.q != null) Object.assign(i, {nom: llegit.nom, q: llegit.q, u: llegit.u});
});

// --- l'avís de baix (amb "Desfer" quan es pot) ---
let avisT = null;
let desferAvis = null;
function amagarAvis() {
	document.getElementById('avis')?.classList.remove('veure');
}
function avisar(text, desfer) {
	let a = document.getElementById('avis');
	if (!a) {
		a = document.createElement('div');
		a.id = 'avis';
		a.setAttribute('role', 'status');
		document.body.append(a);
	}
	desferAvis = desfer ?? null;
	a.innerHTML = `<span>${esc(text)}</span>${desfer ? '<button type="button" data-desfer-avis>Desfer</button>' : ''}`;
	a.classList.add('veure');
	clearTimeout(avisT);
	avisT = setTimeout(() => {
		amagarAvis();
		desferAvis = null;
	}, desfer ? 5000 : 2400);
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
	carregarCalendaris();
	pintar();
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
if (estat.codi && estat.qui) entrar(estat.codi, estat.qui);
else pintar();

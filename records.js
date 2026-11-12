// --- Records: el que heu fet junts (viatges, plans, projectes), amb les fotos. És el que era "Ratis", però dins de la Llar
// perquè la Núria no hagi d'entrar enlloc més. Tres peces: el mur (cadascú penja i l'altre respon), el mapa dels viatges
// i el diari de cada record (les fotos dia per dia, com polaroids).
//
// Les fotos: es redueixen al mòbil (una gran de 1600 px i una petita de 480 px), es xifren amb la clau de casa i es pugen a
// l'espai "llar-fotos" de Supabase (supabase.sql, bloc de Records). Supabase només hi veu soroll. El record (títol, dates,
// lloc, la llista de fotos, reaccions i respostes) és una fila més de la Llar, xifrada com totes.

export function crearRecords(c) {
	const {estat, totes, tocar, nouId, ara, esc, icona, avisar, pintar, av, SUPABASE, capcals, NOMS_DIES, deMes, majuscula} = c;

	const ESPAIS = [
		['viatges', 'Viatges'],
		['plans', 'Plans'],
		['projectes', 'Projectes'],
	];
	const REACCIONS = [
		['encanta', 'Ens va encantar'],
		['repetir', 'Repetir'],
		['riure', 'Quin riure'],
	];
	const MESOS = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
	const espais = () => [...ESPAIS, ...totes('espai').map((e) => [e.id, e.nom])];
	const nomEspai = (id) => espais().find(([k]) => k === id)?.[1] ?? 'Records';
	const records = () => totes('record').sort((a, b) => (b.des ?? '').localeCompare(a.des ?? '') || (b.quan ?? '').localeCompare(a.quan ?? ''));
	const mesAny = (d) => (d ? `${MESOS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : '');
	const dies = (r) => (r.des && r.fins ? Math.round((new Date(`${r.fins}T12:00`) - new Date(`${r.des}T12:00`)) / 864e5) + 1 : 1);

	// ===== les fotos: llegir la data i el lloc (EXIF), reduir, xifrar, pujar, i després baixar i desxifrar =====
	function exif(buf) {
		const v = new DataView(buf);
		if (v.getUint16(0) !== 0xffd8) return {};
		let o = 2;
		while (o < v.byteLength - 4) {
			const marca = v.getUint16(o);
			const mida = v.getUint16(o + 2);
			if (marca === 0xffe1 && v.getUint32(o + 4) === 0x45786966) return llegirTiff(v, o + 10);
			if ((marca & 0xff00) !== 0xff00) break;
			o += 2 + mida;
		}
		return {};
	}
	function llegirTiff(v, t) {
		const le = v.getUint16(t) === 0x4949;
		const u16 = (p) => v.getUint16(p, le);
		const u32 = (p) => v.getUint32(p, le);
		const ifd = (p) => {
			const n = u16(p);
			const tags = {};
			for (let i = 0; i < n; i++) {
				const e = p + 2 + i * 12;
				tags[u16(e)] = {tipus: u16(e + 2), n: u32(e + 4), val: e + 8};
			}
			return tags;
		};
		const text = (tag) => {
			const p = tag.n > 4 ? t + u32(tag.val) : tag.val;
			let s = '';
			for (let i = 0; i < tag.n - 1; i++) s += String.fromCharCode(v.getUint8(p + i));
			return s;
		};
		const racionals = (tag) => {
			const p = t + u32(tag.val);
			return [0, 1, 2].map((i) => u32(p + i * 8) / (u32(p + i * 8 + 4) || 1));
		};
		try {
			const zero = ifd(t + u32(t + 4));
			const r = {};
			const ex = zero[0x8769] && ifd(t + u32(zero[0x8769].val));
			const quan = ex?.[0x9003] ?? zero[0x0132];
			if (quan) r.data = text(quan).slice(0, 10).replace(/:/g, '-');
			const gps = zero[0x8825] && ifd(t + u32(zero[0x8825].val));
			if (gps?.[2] && gps?.[4]) {
				const g = (x) => x[0] + x[1] / 60 + x[2] / 3600;
				r.lat = g(racionals(gps[2])) * (text(gps[1]) === 'S' ? -1 : 1);
				r.lng = g(racionals(gps[4])) * (text(gps[3]) === 'W' ? -1 : 1);
			}
			return r;
		} catch {
			return {};
		}
	}
	async function reduir(fitxer, costat) {
		const img = await createImageBitmap(fitxer, {imageOrientation: 'from-image'});
		const f = Math.min(1, costat / Math.max(img.width, img.height));
		const cv = document.createElement('canvas');
		cv.width = Math.round(img.width * f);
		cv.height = Math.round(img.height * f);
		cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
		const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', costat > 1000 ? 0.82 : 0.75));
		return {blob, w: cv.width, h: cv.height};
	}
	const camiFoto = (id, mida) => `${estat.casa}/${id}-${mida}`;
	async function pujar(id, mida, blob) {
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const xif = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, estat.clau, await blob.arrayBuffer());
		const cos = new Blob([iv, xif]);
		const r = await fetch(`${SUPABASE.url}/storage/v1/object/llar-fotos/${camiFoto(id, mida)}`, {
			method: 'POST',
			headers: {apikey: SUPABASE.clau, Authorization: `Bearer ${SUPABASE.clau}`, 'Content-Type': 'application/octet-stream'},
			body: cos,
		});
		if (!r.ok) throw new Error(r.status === 400 || r.status === 404 ? 'Falta crear l’espai de fotos a Supabase' : `No s’ha pogut pujar (${r.status})`);
	}
	// les fotos ja desxifrades, per no tornar-les a baixar; i les xifrades, a la memòria cau del mòbil (sense xarxa també)
	const vistes = new Map();
	async function urlFoto(id, mida) {
		const k = `${id}-${mida}`;
		if (vistes.has(k)) return vistes.get(k);
		const prom = (async () => {
			const cami = `${SUPABASE.url}/storage/v1/object/authenticated/llar-fotos/${camiFoto(id, mida)}`;
			const cau = await caches.open('llar-fotos-v1').catch(() => null);
			let r = await cau?.match(cami);
			if (!r) {
				r = await fetch(cami, {headers: {apikey: SUPABASE.clau, Authorization: `Bearer ${SUPABASE.clau}`}});
				if (!r.ok) throw new Error('sense foto');
				await cau?.put(cami, r.clone());
			}
			const buf = new Uint8Array(await r.arrayBuffer());
			const clar = await crypto.subtle.decrypt({name: 'AES-GCM', iv: buf.slice(0, 12)}, estat.clau, buf.slice(12));
			return URL.createObjectURL(new Blob([clar], {type: 'image/jpeg'}));
		})();
		vistes.set(k, prom);
		prom.catch(() => vistes.delete(k));
		return prom;
	}
	const foto = (f, mida = 'p', extra = '') => (f ? `<img class="rec-img" data-foto="${f.id}" data-mida="${mida}" alt=""${f.w ? ` width="${f.w}" height="${f.h}"` : ''} ${extra}>` : '<span class="rec-img rec-img-buida"></span>');

	// ===== les vistes =====
	const reaccions = (r) => {
		const meva = r.reaccions?.[estat.qui];
		const totals = Object.values(r.reaccions ?? {});
		return `<div class="rec-reac">${REACCIONS.map(([k, nom]) => {
			const n = totals.filter((x) => x === k).length;
			return `<button type="button" class="${meva === k ? 'actiu' : ''}" data-rec-reac="${r.id}" data-k="${k}">${nom}${n ? ` · ${n}` : ''}</button>`;
		}).join('')}</div>`;
	};
	const persona = (q) => `<span class="rec-qui">${av(q)}<b>${esc(q)}</b></span>`;
	const post = (r) => {
		const fs = r.fotos ?? [];
		const ult = (r.respostes ?? []).at(-1);
		return `<article class="rec-post">
			<div class="rec-post-cap">${persona(r.qui)}<small>${fs.length ? `ha penjat ${fs.length} ${fs.length === 1 ? 'foto' : 'fotos'}` : 'ha apuntat'} · ${esc(nomEspai(r.espai))}</small></div>
			<button type="button" class="rec-coll n${Math.min(fs.length, 3)}" data-rec="${r.id}">${fs.slice(0, 3).map((f, i) => foto(f, i ? 'p' : 'g')).join('')}${fs.length > 3 ? `<em>+${fs.length - 3}</em>` : ''}</button>
			<button type="button" class="rec-post-titol" data-rec="${r.id}"><b>${esc(r.titol)}</b><small>${[r.lloc, mesAny(r.des)].filter(Boolean).map(esc).join(' · ')}</small></button>
			${r.nota ? `<p class="rec-nota-curta">${esc(r.nota)}</p>` : ''}
			${reaccions(r)}
			${ult ? `<button type="button" class="rec-resp-ult" data-rec="${r.id}">${av(ult.qui)}<span><b>${esc(ult.qui)}</b> ${esc(ult.text)}</span>${r.respostes.length > 1 ? `<small>i ${r.respostes.length - 1} més</small>` : ''}</button>` : ''}
		</article>`;
	};
	function faUnAny(rs) {
		const avui = new Date();
		return rs.find((r) => {
			if (!r.des || !r.fotos?.length) return false;
			const d = new Date(`${r.des}T12:00`);
			const anys = avui.getFullYear() - d.getFullYear();
			if (anys < 1) return false;
			const mateix = new Date(avui.getFullYear(), d.getMonth(), d.getDate());
			return Math.abs(mateix - avui) < 7 * 864e5;
		});
	}
	function vista() {
		const espai = estat.recEspai ?? 'tot';
		const rs = records();
		const meus = espai === 'tot' ? rs : rs.filter((r) => r.espai === espai);
		const fa = faUnAny(rs);
		const xips = [['tot', 'Tot'], ...espais()].map(([k, nom]) => `<button type="button" class="s-xip${k === espai ? ' actiu' : ''}" data-rec-espai="${k}">${esc(nom)}</button>`).join('');
		let cos = '';
		if (espai === 'viatges') {
			const llocs = new Set(meus.map((r) => r.lloc).filter(Boolean));
			const fotos = meus.reduce((t, r) => t + (r.fotos?.length ?? 0), 0);
			const fora = meus.reduce((t, r) => t + dies(r), 0);
			cos = `<section class="rec-mon">
				<div id="rec-mapa" class="rec-mapa"></div>
				<div class="rec-xifres"><div><b>${meus.length}</b><span>${meus.length === 1 ? 'viatge' : 'viatges'}</span></div><div><b>${llocs.size}</b><span>llocs</span></div><div><b>${fora}</b><span>dies fora</span></div><div><b>${fotos}</b><span>fotos</span></div></div>
				<div class="rec-viatges">${meus.map((r) => `<button type="button" class="rec-viatge" data-rec="${r.id}">${foto(r.fotos?.[r.portada ?? 0], 'p')}<span><b>${esc(r.titol)}</b><small>${esc(mesAny(r.des))}${dies(r) > 1 ? ` · ${dies(r)} dies` : ''}</small></span></button>`).join('')}</div>
			</section>`;
		}
		const buit = !rs.length
			? `<div class="rec-buit"><b>El vostre racó</b><p>Els viatges, les cites i els projectes, amb les fotos. Toca <b>+</b>, tria fotos del carret i la data i el lloc surten sols.</p><button type="button" class="boto-suau" data-rec-ratis>Portar les fotos de Ratis</button></div>`
			: '';
		return `<header class="rec-cap"><div><small>Arnau i Núria</small><h1>Records</h1></div><button type="button" class="rec-mes" data-rec-nou aria-label="Nou record">${icona('mes', 22)}</button></header>
		<div class="rec-xips">${xips}<button type="button" class="s-xip" data-rec-espai-nou>+ Espai</button></div>
		${fa && espai === 'tot' ? `<button type="button" class="rec-faunany" data-rec="${fa.id}">${foto(fa.fotos[fa.portada ?? 0], 'p')}<span><small>Fa ${new Date().getFullYear() - Number(fa.des.slice(0, 4)) === 1 ? 'un any' : `${new Date().getFullYear() - Number(fa.des.slice(0, 4))} anys`}</small><b>${esc(fa.titol)}</b></span></button>` : ''}
		${cos}${buit}
		<div class="rec-mur">${(espai === 'viatges' ? [] : meus).map(post).join('')}</div>`;
	}

	// el diari d'un record: portada, i les fotos dia per dia com polaroids
	function diari(r) {
		const fs = r.fotos ?? [];
		const perDia = new Map();
		for (const f of fs) {
			const k = f.data ?? r.des ?? '';
			if (!perDia.has(k)) perDia.set(k, []);
			perDia.get(k).push(f);
		}
		const dies = [...perDia.entries()].sort((a, b) => a[0].localeCompare(b[0]));
		const gir = (i) => [-5, 4, -2, 3, -4, 2][i % 6];
		const meu = r.qui === estat.qui;
		return `<div class="rec-diari">
			<div class="rec-hero">${foto(fs[r.portada ?? 0], 'g')}<div><small>${esc(nomEspai(r.espai))} · ${esc(mesAny(r.des))}</small><h2>${esc(r.titol)}</h2><p>${[dies.length > 1 ? `${dies.length} dies` : '', fs.length ? `${fs.length} ${fs.length === 1 ? 'foto' : 'fotos'}` : '', r.lloc].filter(Boolean).map(esc).join(' · ')}</p></div></div>
			${r.nota ? `<p class="rec-nota">${av(r.qui)}<span>${esc(r.nota)}</span></p>` : ''}
			${dies
				.map(([d, llista], n) => {
					const dt = d ? new Date(`${d}T12:00`) : null;
					return `<section class="rec-dia"><h3><b>${dies.length > 1 ? `Dia ${n + 1}` : 'Les fotos'}</b>${dt ? ` ${NOMS_DIES[dt.getDay()].toLowerCase()} ${dt.getDate()} ${deMes(dt.getMonth())}` : ''}</h3>
					<div class="rec-polaroids">${llista.map((f, i) => `<button type="button" class="rec-pol" style="--gir:${gir(i + n)}deg" data-rec-veure="${f.id}">${foto(f, 'p')}</button>`).join('')}</div></section>`;
				})
				.join('')}
			${reaccions(r)}
			<div class="rec-respostes">${(r.respostes ?? []).map((x) => `<div class="rec-resp">${av(x.qui)}<span><b>${esc(x.qui)}</b> ${esc(x.text)}</span></div>`).join('')}</div>
			<form class="apunta" id="form-rec-resp" data-id="${r.id}"><input name="text" placeholder="Digues alguna cosa…" autocomplete="off" enterkeyhint="send"><button type="submit" aria-label="Enviar">${icona('seguent', 20)}</button></form>
			<div class="full-botons"><label class="boto-suau rec-afegir-fotos">${icona('mes', 16)} Més fotos<input type="file" accept="image/*" multiple hidden data-rec-mes-fotos="${r.id}"></label>${meu ? `<button type="button" class="boto-perill" data-rec-esborrar="${r.id}">${icona('paperera', 16)} Esborrar</button>` : ''}</div>
		</div>`;
	}

	// un record nou: les fotos primer (d'elles en surt la data i el lloc), i la resta, si es vol
	function nou(full) {
		const fs = full.fotos ?? [];
		const dates = fs.map((f) => f.data).filter(Boolean).sort();
		const suggerit = full.lloc || '';
		return `<h2>Nou record</h2>
		<label class="rec-tria">${fs.length ? `<span class="rec-tria-fotos">${fs.slice(0, 8).map((f) => `<img src="${f.vista}" alt="">`).join('')}${fs.length > 8 ? `<em>+${fs.length - 8}</em>` : ''}</span>` : `${icona('mes', 26)}<b>Tria les fotos</b><small>Del carret: les que vulguis de cop</small>`}<input type="file" id="rec-fotos" accept="image/*" multiple hidden></label>
		${dates.length ? `<p class="rec-auto">${icona('menu', 14)} ${dates[0] === dates.at(-1) ? `${Number(dates[0].slice(8))} ${deMes(Number(dates[0].slice(5, 7)) - 1)} ${dates[0].slice(0, 4)}` : `del ${Number(dates[0].slice(8))} ${deMes(Number(dates[0].slice(5, 7)) - 1)} al ${Number(dates.at(-1).slice(8))} ${deMes(Number(dates.at(-1).slice(5, 7)) - 1)}`}${fs.some((f) => f.lat) ? ' · amb el lloc de les fotos' : ''}</p>` : ''}
		<form id="form-rec-nou" class="rec-form">
			<div class="segment rec-segment">${espais().map(([k, nom]) => `<button type="button" data-rec-nou-espai="${k}" aria-pressed="${(full.espai ?? 'plans') === k}">${esc(nom)}</button>`).join('')}</div>
			<input name="titol" placeholder="${suggerit ? esc(suggerit) : 'Títol: Còrdova, sopar a la Barceloneta…'}" autocomplete="off" value="${esc(full.titol ?? '')}">
			<input name="lloc" placeholder="On? (per posar-ho al mapa)" autocomplete="off" value="${esc(full.lloc ?? '')}">
			<textarea name="nota" rows="2" placeholder="Una frase, si vols (opcional)">${esc(full.nota ?? '')}</textarea>
			<button type="submit" class="boto-principal" ${fs.length || full.titol ? '' : ''}>${full.pujant ? `Pujant ${full.pujant}…` : 'Desar'}</button>
		</form>`;
	}
	function full(f) {
		if (f.t === 'rec') {
			const r = estat.files[f.id]?.o;
			return r && !r.esborrat ? diari({id: f.id, ...r}) : '<h2>Ja no hi és</h2>';
		}
		if (f.t === 'recnou') return nou(f);
		if (f.t === 'recfoto') return `<div class="rec-gran">${foto({id: f.foto}, 'g')}</div>`;
		return '';
	}

	// ===== després de pintar: les fotos i el mapa =====
	function despres() {
		for (const img of document.querySelectorAll('img[data-foto]:not([src])')) {
			img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
			urlFoto(img.dataset.foto, img.dataset.mida)
				.then((u) => {
					img.src = u;
					img.classList.add('carregada');
				})
				.catch(() => img.classList.add('sense'));
		}
		const m = document.getElementById('rec-mapa');
		if (m && !m.dataset.fet) {
			m.dataset.fet = '1';
			mapa(m);
		}
	}
	let leaflet = null;
	const carregarLeaflet = () =>
		(leaflet ??= new Promise((ok, ko) => {
			const css = document.createElement('link');
			css.rel = 'stylesheet';
			css.href = 'vendor/leaflet.css';
			document.head.append(css);
			const s = document.createElement('script');
			s.src = 'vendor/leaflet.js';
			s.onload = () => ok(window.L);
			s.onerror = ko;
			document.head.append(s);
		}));
	async function mapa(el) {
		const L = await carregarLeaflet().catch(() => null);
		if (!L || !el.isConnected) return;
		const rs = records().filter((r) => r.espai === 'viatges' && r.lat != null).sort((a, b) => (a.des ?? '').localeCompare(b.des ?? ''));
		const m = L.map(el, {zoomControl: false, attributionControl: false}).setView([41.4, 2.1], 4);
		L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 12}).addTo(m);
		if (rs.length > 1) L.polyline(rs.map((r) => [r.lat, r.lng]), {color: '#e0b25a', weight: 2, dashArray: '4 6', opacity: 0.9}).addTo(m);
		for (const r of rs) {
			const f = r.fotos?.[r.portada ?? 0];
			const mk = L.marker([r.lat, r.lng], {icon: L.divIcon({className: '', html: `<button type="button" class="rec-pin" data-rec="${r.id}">${foto(f, 'p')}</button>`, iconSize: [46, 46], iconAnchor: [23, 23]})}).addTo(m);
			mk.on('add', despres);
		}
		if (rs.length) m.fitBounds(rs.map((r) => [r.lat, r.lng]), {padding: [70, 70], maxZoom: 6});
		despres();
	}

	// ===== accions =====
	async function llegirFitxers(fitxers) {
		const out = [];
		for (const f of fitxers) {
			const cap = await f.slice(0, 256 * 1024).arrayBuffer();
			const e = exif(cap);
			out.push({fitxer: f, vista: URL.createObjectURL(f), data: e.data && /^\d{4}-\d\d-\d\d$/.test(e.data) ? e.data : null, lat: e.lat ?? null, lng: e.lng ?? null});
		}
		return out;
	}
	async function pujarFotos(llista, quin) {
		const fotos = [];
		let n = 0;
		for (const f of llista) {
			n++;
			if (quin) quin(`${n}/${llista.length}`);
			const id = nouId();
			const g = await reduir(f.fitxer, 1600);
			const p = await reduir(f.fitxer, 480);
			await pujar(id, 'g', g.blob);
			await pujar(id, 'p', p.blob);
			fotos.push({id, w: g.w, h: g.h, data: f.data, lat: f.lat, lng: f.lng});
		}
		return fotos;
	}
	async function onEs(lloc) {
		// el nom d'un lloc (no les vostres coordenades) → on és al mapa, amb OpenStreetMap
		try {
			const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ca&q=${encodeURIComponent(lloc)}`);
			const [x] = await r.json();
			return x ? {lat: Number(x.lat), lng: Number(x.lon)} : null;
		} catch {
			return null;
		}
	}
	const mitjana = (fs) => {
		const amb = fs.filter((f) => f.lat != null);
		return amb.length ? {lat: amb.reduce((t, f) => t + f.lat, 0) / amb.length, lng: amb.reduce((t, f) => t + f.lng, 0) / amb.length} : null;
	};

	document.addEventListener('change', async (ev) => {
		const el = ev.target;
		if (el.id === 'rec-fotos' && estat.full?.t === 'recnou') {
			const form = document.getElementById('form-rec-nou');
			if (form) for (const k of ['titol', 'lloc', 'nota']) estat.full[k] = form.elements[k].value;
			estat.full.fotos = [...(estat.full.fotos ?? []), ...(await llegirFitxers([...el.files]))];
			pintar();
		} else if (el.dataset.recMesFotos) {
			const id = el.dataset.recMesFotos;
			const llista = await llegirFitxers([...el.files]);
			try {
				avisar(`Pujant ${llista.length} fotos…`);
				const noves = await pujarFotos(llista);
				const r = estat.files[id].o;
				tocar(id, {...r, fotos: [...(r.fotos ?? []), ...noves]});
				pintar();
				avisar(`${noves.length} fotos més`);
			} catch (e) {
				avisar(String(e.message ?? e));
			}
		}
	});

	function clic(d) {
		if (d.recEspai !== undefined) return (estat.recEspai = d.recEspai), true;
		if (d.recNou !== undefined) return (estat.full = {t: 'recnou', espai: estat.recEspai && estat.recEspai !== 'tot' ? estat.recEspai : 'plans'}), true;
		if (d.recNouEspai) {
			const form = document.getElementById('form-rec-nou');
			if (form) for (const k of ['titol', 'lloc', 'nota']) estat.full[k] = form.elements[k].value;
			estat.full.espai = d.recNouEspai;
			return true;
		}
		if (d.rec) return (estat.full = {t: 'rec', id: d.rec}), true;
		if (d.recVeure) return (estat.full = {t: 'recfoto', foto: d.recVeure, torna: estat.full?.id}), true;
		if (d.recReac) {
			const r = estat.files[d.recReac].o;
			const reac = {...(r.reaccions ?? {})};
			if (reac[estat.qui] === d.k) delete reac[estat.qui];
			else reac[estat.qui] = d.k;
			tocar(d.recReac, {...r, reaccions: reac});
			return true;
		}
		if (d.recEsborrar) {
			const id = d.recEsborrar;
			tocar(id, {...estat.files[id].o, esborrat: true});
			estat.full = null;
			avisar(`«${estat.files[id].o.titol}» esborrat`, () => tocar(id, {...estat.files[id].o, esborrat: false}));
			return true;
		}
		if (d.recEspaiNou !== undefined) {
			const nom = prompt('Nom del nou espai (p. ex. Concerts, El pis, Forky)');
			if (nom?.trim()) tocar(nouId(), {t: 'espai', nom: majuscula(nom.trim()), qui: estat.qui, quan: ara()});
			return true;
		}
		if (d.recRatis !== undefined) {
			portarRatis();
			return true;
		}
		return false;
	}

	async function form(f, dades) {
		if (f.id === 'form-rec-resp') {
			const text = String(dades.get('text') ?? '').trim();
			if (!text) return true;
			const r = estat.files[f.dataset.id].o;
			tocar(f.dataset.id, {...r, respostes: [...(r.respostes ?? []), {qui: estat.qui, text, quan: ara()}]});
			pintar();
			return true;
		}
		if (f.id !== 'form-rec-nou') return false;
		const full = estat.full;
		const fs = full.fotos ?? [];
		const lloc = String(dades.get('lloc') ?? '').trim();
		const titol = String(dades.get('titol') ?? '').trim() || lloc || (fs[0]?.data ? `${majuscula(mesAny(fs[0].data))}` : '');
		if (!titol && !fs.length) return avisar('Tria alguna foto o posa-hi un títol'), true;
		if (full.pujant) return true;
		full.titol = titol;
		full.lloc = lloc;
		full.nota = String(dades.get('nota') ?? '').trim();
		try {
			full.pujant = `0/${fs.length}`;
			pintar();
			const fotos = await pujarFotos(fs, (x) => {
				full.pujant = x;
				const b = document.querySelector('#form-rec-nou [type=submit]');
				if (b) b.textContent = `Pujant ${x}…`;
			});
			const dates = fotos.map((x) => x.data).filter(Boolean).sort();
			const on = mitjana(fotos) ?? (lloc ? await onEs(lloc) : null);
			const id = nouId();
			tocar(id, {t: 'record', espai: full.espai ?? 'plans', titol, lloc: lloc || null, nota: full.nota || null, des: dates[0] ?? new Date().toISOString().slice(0, 10), fins: dates.at(-1) ?? null, lat: on?.lat ?? null, lng: on?.lng ?? null, fotos, portada: 0, qui: estat.qui, quan: ara()});
			for (const x of fs) URL.revokeObjectURL(x.vista);
			estat.full = null;
			estat.recEspai = 'tot';
			pintar();
			avisar(`«${titol}» penjat`);
		} catch (e) {
			full.pujant = null;
			pintar();
			avisar(String(e.message ?? e));
		}
		return true;
	}

	// les fotos que ja hi havia a Ratis (la web d'abril), per no començar de zero
	const RATIS = [
		['torre.JPG', 'Torredembarra', 'Torredembarra', 'viatges', 'El port de Torredembarra, la nostra platja.'],
		['cordoba.jpg', 'Còrdova', 'Còrdova', 'viatges', 'Escapada al sud, perduts pels carrers de Còrdova.'],
		['padelsurf.jpg', 'Pàdel surf a Eivissa', 'Eivissa', 'viatges', 'Estiu pur.'],
		['gorrita.jpg', 'Les nostres cares', 'Barcelona', 'plans', 'Molt juntetes.'],
		['forky.jpg', 'Fent el tonto amb el Forky', 'Barcelona', 'plans', 'A l’ascensor.'],
	];
	async function portarRatis() {
		if (estat.portantRatis) return;
		estat.portantRatis = true;
		avisar('Portant les fotos de Ratis…');
		try {
			for (const [fitxer, titol, lloc, espai, nota] of RATIS) {
				const r = await fetch(`https://arnausentiscort.github.io/Ratis/photos/${fitxer}`);
				if (!r.ok) continue;
				const blob = await r.blob();
				const [f] = await llegirFitxers([new File([blob], fitxer, {type: 'image/jpeg'})]);
				const fotos = await pujarFotos([f]);
				const on = mitjana(fotos) ?? (await onEs(lloc));
				tocar(nouId(), {t: 'record', espai, titol, lloc, nota, des: f.data ?? null, fins: null, lat: on?.lat ?? null, lng: on?.lng ?? null, fotos, portada: 0, qui: 'Arnau', quan: ara()});
				pintar();
			}
			avisar('Les fotos de Ratis ja són aquí');
		} catch (e) {
			avisar(String(e.message ?? e));
		}
		estat.portantRatis = false;
	}

	return {vista, full, clic, form, despres, ultim: () => records()[0]};
}

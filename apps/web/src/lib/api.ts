// All requests go through the dev proxy (same-origin) or VITE_API_URL in prod.
export const API_BASE = import.meta.env.VITE_API_URL || "";

async function req(path: string, opts: RequestInit = {}) {
	const res = await fetch(API_BASE + path, {
		credentials: "include",
		headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
		...opts,
	});
	const json = await res.json().catch(() => ({}));
	if (!res.ok)
		throw Object.assign(new Error(json.error || "request_failed"), {
			status: res.status,
			body: json,
		});
	return json;
}

export const api = {
	get: (p: string) => req(p),
	post: (p: string, body?: any) =>
		req(p, { method: "POST", body: JSON.stringify(body || {}) }),
	put: (p: string, body?: any) =>
		req(p, { method: "PUT", body: JSON.stringify(body || {}) }),
};

const ISO: Record<string, string> = {
	Mexico: "mx",
	"South Africa": "za",
	"Korea Republic": "kr",
	Czechia: "cz",
	Switzerland: "ch",
	Canada: "ca",
	"Bosnia & Herz.": "ba",
	Qatar: "qa",
	Brazil: "br",
	Morocco: "ma",
	Scotland: "gb-sct",
	Haiti: "ht",
	USA: "us",
	Australia: "au",
	Paraguay: "py",
	Türkiye: "tr",
	Germany: "de",
	"Ivory Coast": "ci",
	Ecuador: "ec",
	Curaçao: "cw",
	Netherlands: "nl",
	Japan: "jp",
	Sweden: "se",
	Tunisia: "tn",
	Egypt: "eg",
	"IR Iran": "ir",
	Belgium: "be",
	"New Zealand": "nz",
	Spain: "es",
	Uruguay: "uy",
	"Cape Verde": "cv",
	"Saudi Arabia": "sa",
	France: "fr",
	Norway: "no",
	Senegal: "sn",
	Iraq: "iq",
	Argentina: "ar",
	Austria: "at",
	Algeria: "dz",
	Jordan: "jo",
	Colombia: "co",
	Portugal: "pt",
	"Congo DR": "cd",
	Uzbekistan: "uz",
	England: "gb-eng",
	Ghana: "gh",
	Croatia: "hr",
	Panama: "pa",
};
export function flagUrl(name?: string | null) {
	if (!name) return null;
	const code = ISO[name];
	return code ? `https://flagcdn.com/w40/${code}.png` : null;
}

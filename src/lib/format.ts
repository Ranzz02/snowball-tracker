export const formatRub = (n: number) =>
	`${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('en-US')} ₽`;

export const formatSigned = (n: number) =>
	`${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('en-US')} ₽`;

/** Compact form for chips: 250000 -> 250k */
export const formatShort = (n: number) => {
	const a = Math.abs(n);
	const s =
		a >= 1_000_000
			? `${+(a / 1_000_000).toFixed(2)}M`
			: a >= 1000
				? `${+(a / 1000).toFixed(1)}k`
				: `${a}`;
	return `${n < 0 ? '−' : n > 0 ? '+' : ''}${s}`;
};

export const formatDate = (iso: string) =>
	new Date(iso).toLocaleDateString(undefined, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	});

export const formatDateTime = (iso: string) =>
	new Date(iso).toLocaleString(undefined, {
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
	});

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

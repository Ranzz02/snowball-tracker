import { describe, expect, it } from 'vitest';
import { emptyAppData } from '../models';
import { ledgerCsv, paymentsCsv, toCsv } from './csv';

describe('toCsv', () => {
	it('quotes commas, quotes and newlines', () => {
		expect(toCsv([['a,b', 'say "hi"', 'x\ny', 5]])).toBe('"a,b","say ""hi""","x\ny",5\r\n');
	});

	it('neutralises text that looks like a formula but keeps negative numbers', () => {
		expect(toCsv([['=SUM(A1)', '-5', -5]])).toBe("'=SUM(A1),'-5,-5\r\n");
	});
});

describe('exports', () => {
	const data = emptyAppData();
	data.friends = [{ id: 'f1', name: 'Räihä', color: '#fff' }];
	data.payments = [
		{ id: 'p2', friendId: 'f1', amount: 200, timestamp: '2026-02-02', note: 'b' },
		{ id: 'p1', friendId: 'f1', amount: 100, timestamp: '2026-01-01' },
	];

	it('lists payments oldest first', () => {
		expect(paymentsCsv(data)).toBe(
			'Date,Friend,Amount,Note\r\n2026-01-01,Räihä,100,\r\n2026-02-02,Räihä,200,b\r\n',
		);
	});

	it('writes one ledger row per friend with money moving', () => {
		const lines = ledgerCsv(data, []).trim().split('\r\n');
		expect(lines).toHaveLength(2);
		expect(lines[0].startsWith('Friend,Earned,Paid,Owed,')).toBe(true);
		expect(lines[1].startsWith('Räihä,0,300,-300,')).toBe(true);
	});
});

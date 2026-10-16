import test from 'node:test';
import assert from 'node:assert/strict';
import { venueURL, matchPresentation } from '../src/match-card.js';

test('risultato: distingue gara futura, in corso, parziale e terminata senza inventare punteggi', () => {
 assert.equal(matchPresentation({ played: false, 'team1-setwin': 0, 'team2-setwin': 0 }).hasScore, false);
 assert.equal(matchPresentation({ is_live: '1', played: false }).status, 'In corso');
 assert.equal(matchPresentation({ 'team1-setwin': 1, played: false }).status, 'Risultato parziale');
 const final = matchPresentation({ played: true, ris_ufficiale: '1', pt_a: [25, 25, 25], pt_b: [18, 20] });
 assert.equal(final.status, 'Terminata');assert.equal(final.official, 'Risultato ufficiale');
 assert.deepEqual(final.sets, [[25, 18], [25, 20], [25, '–']]);
 assert.equal(matchPresentation({ played: '1', ris_ufficiale: '0' }).official, 'Risultato non ufficiale');
 assert.equal(matchPresentation({ played: true }).official, '');
 assert.equal(matchPresentation({ played: true, is_live: '1', ris_ufficiale: '1' }).official, '');
 assert.deepEqual(matchPresentation({ pt_b: [25], pt_a: null }).sets, [['–', 25]]);
});

test('mappa: usa solo coordinate numeriche valide e non valori mancanti o segnaposto', () => {
 assert.equal(venueURL({ 'lat-stadium': '44.1812394', 'lng-stadium': '9.6227659' }), 'https://www.google.com/maps/search/?api=1&query=44.1812394,9.6227659');
 for(const pair of [[null, 9], ['', 9], [91, 9], [44, 181], ['javascript:alert(1)', 9], [0, 0]]) assert.equal(venueURL({ 'lat-stadium': pair[0], 'lng-stadium': pair[1] }), '');
});

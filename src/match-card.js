import { clubInfo } from './clubs.js';
import { escapeHTML as e } from './data.js';

export function venueURL(match) {
  const raw = [match['lat-stadium'], match['lng-stadium']];
  if (raw.some(value => value === null || value === undefined || String(value).trim() === '')) return '';
  const [lat, lng] = raw.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return '';
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function matchPresentation(match) {
  const live = Number(match.is_live) === 1;
  const played = Number(match.played) === 1;
  const pointsA = Array.isArray(match.pt_a) ? match.pt_a : [];
  const pointsB = Array.isArray(match.pt_b) ? match.pt_b : [];
  const hasScore = played || live || Number(match['team1-setwin']) > 0 || Number(match['team2-setwin']) > 0 || pointsA.length > 0 || pointsB.length > 0;
  const sets = Array.from({ length: Math.max(pointsA.length, pointsB.length) }, (_, i) => [pointsA[i] ?? '–', pointsB[i] ?? '–']);
  return {
    live, hasScore, sets,
    status: live ? 'In corso' : played ? 'Terminata' : hasScore ? 'Risultato parziale' : 'In programma',
    official: played && !live ? (Number(match.ris_ufficiale) === 1 ? 'Risultato ufficiale' : match.ris_ufficiale === undefined || match.ris_ufficiale === null || match.ris_ufficiale === '' ? '' : 'Risultato non ufficiale') : '',
  };
}

export function renderMatchCard(match, { logo, star }) {
  const state = matchPresentation(match);
  const teams = [match.team1, match.team2];
  const time = String(match.time || '').replace(/^(\d{1,2})\.(\d{2})$/, '$1:$2');
  const meta = [match.date || 'Data da definire', time, match.day, match.ng ? `Gara ${match.ng}` : ''].filter(Boolean).join(' · ');
  const map = venueURL(match);
  const referees = [['1referee', '1° arbitro'], ['2referee', '2° arbitro']].filter(([key]) => String(match[key] || '').trim());
  const society = team => {
    const club = clubInfo(team);
    const title = club?.title || String(team?.nome_societa || '').trim();
    return `<div class="match-club">${title ? `<span class="match-club-name" title="${e(title)}${club ? ` · Codice società: ${e(club.id)}` : ''}">${e(title)}</span>${club ? star('club',club.id,club.title,club.logo) : ''}` : ''}</div>`;
  };
  return `<article class="match">
    ${match.groupId ? `<div class="match-competition"><span>${e([match.groupTitle || 'Girone '+match.groupId,match.committeeTitle].filter(Boolean).join(' · '))}</span>${match.committeeId ? `<button type="button" data-match-standings="${e(match.groupId)}" data-committee="${e(match.committeeId)}" aria-label="Classifica: ${e(match.groupTitle || 'Girone '+match.groupId)}">Classifica ↗</button>` : ''}</div>` : ''}
    <div class="match-meta"><span>${e(meta)}</span><span class="badge ${state.live ? 'live' : ''}">${state.live ? '● ' : ''}${e(state.status)}</span></div>
    <div class="match-teams">${teams.map((team, i) => `${i ? '<span class="team-divider" aria-hidden="true">-</span>' : ''}<div class="match-team">${society(team)}${logo(team)}<strong>${e(team?.title || 'Squadra da definire')}</strong>${star('team', team?.id, team?.title)}</div>`).join('')}</div>
    <div class="match-result" aria-label="${state.hasScore ? 'Risultato in set' : 'Risultato non disponibile'}">${state.hasScore ? `<span>${e(match['team1-setwin'] ?? '–')}</span><span class="score-divider">-</span><span>${e(match['team2-setwin'] ?? '–')}</span>` : '<span class="unplayed-score">–</span>'}</div>
    ${state.sets.length ? `<ol class="set-scores" aria-label="Parziali dei set">${state.sets.map(([a, b], i) => `<li aria-label="Set ${i + 1}: ${e(a)} a ${e(b)}"><span class="set-number">${i + 1}°</span><span>${e(a)}-${e(b)}</span></li>`).join('')}</ol>` : ''}
    ${state.official ? `<p class="result-official">${e(state.official)}</p>` : ''}
    <div class="match-details"><div class="match-venue"><span>${e(match.stadium || 'Impianto da definire')}</span>${map ? `<a href="${e(map)}" target="_blank" rel="noopener noreferrer">Mappa ↗</a>` : ''}</div>
    ${referees.length ? `<dl class="match-referees">${referees.map(([key, label]) => `<div><dt>${label}</dt><dd>${e(String(match[key]).trim())}</dd></div>`).join('')}</dl>` : '<p class="referees-missing">Arbitri non indicati</p>'}
    </div>
  </article>`;
}

import { escapeHTML as e, favoriteKey } from './data.js';

// Condiviso dalle schede Società e Preferiti: cambiano solo i dati ricevuti.
export function renderClubCard(club, { open = true, logo, star, teamName, committeeTitle, exportAction = () => '' }) {
  const key = favoriteKey('club', club.id, club.committee);
  const teams = club.teams || [];
  return `<article class="saved saved-club society-card" data-club-id="${e(club.id)}">
    <details class="saved-club-group" data-club-expansion="${e(key)}" ${open ? 'open' : ''}>
      <summary>${logo(club)}<span><small>SOCIETÀ</small><strong>${e(club.title)}</strong><span class="society-card-meta">${e(club.id)} · ${teams.length} ${teams.length === 1 ? 'squadra' : 'squadre'}</span></span><span class="club-caret" aria-hidden="true">⌄</span></summary>
      <div class="saved-club-content">
        <div class="saved-club-actions"><button data-open-club="${e(club.id)}" data-club-title="${e(club.title)}" data-club-logo="${e(club.logo || '')}" data-club-committee="${e(club.committee)}" aria-label="Apri società ${e(club.title)}">Apri società ↗</button>${exportAction('club',club.id,club.title,club.committee)}${star('club', club.id, club.title, club.logo || '', club.committee)}</div>
        <div class="favorite-team-list">${teams.length ? teams.map(team => `<div class="favorite-team-row"><button class="favorite-team-open" data-open-team="${e(team.id)}" data-team-committee="${e(team.committee)}" data-team-title="${e(team.title)}" data-team-logo="${e(team.logo || '')}">${logo(team)}<span><strong>${teamName(team, team.committee)}</strong><small>${e(committeeTitle(team.committee))}</small></span><span aria-hidden="true">↗</span></button>${exportAction('team',String(team.id),team.title,team.committee)}${star('team', String(team.id), team.title, team.logo || '', team.committee)}</div>`).join('') : '<p class="club-teams-missing">Apri la società per caricare le squadre disponibili.</p>'}</div>
      </div>
    </details>
  </article>`;
}

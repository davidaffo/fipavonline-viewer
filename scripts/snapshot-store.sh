#!/usr/bin/env bash
set -euo pipefail

# Eseguito dalla Action; usa un branch di soli dati e non modifica l'indice del codice.
branch=data-snapshots
ref="refs/remotes/origin/$branch"
case "${1:-}" in
  restore)
    remote_ref=$(git ls-remote --heads origin "refs/heads/$branch")
    if [[ -n "$remote_ref" ]]; then
      git fetch --no-tags --depth=1 origin "refs/heads/$branch:$ref"
      git archive "$ref" public/data | tar -x
    fi
    ;;
  save)
    task_tmp=$(mktemp -d)
    trap 'rm -rf "$task_tmp"' EXIT
    export GIT_INDEX_FILE="$task_tmp/index"
    git read-tree --empty
    git add --force -- public/data
    tree=$(git write-tree)
    parents=()
    if git show-ref --verify --quiet "$ref"; then parents=(-p "$(git rev-parse "$ref")"); fi
    commit=$(git -c user.name='github-actions[bot]' -c user.email='41898282+github-actions[bot]@users.noreply.github.com' commit-tree "$tree" "${parents[@]}" -m 'Update FIPAV snapshots')
    git push origin "$commit:refs/heads/$branch"
    ;;
  *) echo 'Uso: snapshot-store.sh restore|save' >&2; exit 1 ;;
esac

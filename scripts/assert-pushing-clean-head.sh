# Refuse a push unless every updated ref is the checked-out HEAD and the
# working tree is clean. That way pnpm verify cannot pass on uncommitted work
# while a broken commit is pushed.
#
# Exit 0: push HEAD with a clean tree; the hook should run pnpm verify.
# Exit 1: refuse the push.
# Exit 2: no commit is being pushed (delete-only or empty); skip verify.
set -e

zero=0000000000000000000000000000000000000000
head_sha=$(git rev-parse HEAD)
saw_update=0

while read local_ref local_sha remote_ref remote_sha || [ -n "$local_sha" ]; do
  if [ -z "$local_sha" ]; then
    continue
  fi
  if [ "$local_sha" = "$zero" ]; then
    local_ref=
    local_sha=
    continue
  fi
  # Peel annotated tags to the commit they point at before comparing with HEAD.
  peeled=$(git rev-parse "${local_sha}^{commit}" 2>/dev/null) || {
    echo "pre-push: refusing to push ${local_ref}."
    echo "pre-push: ${local_sha} does not resolve to a commit."
    echo "pre-push: check out that ref with a clean working tree, then push."
    exit 1
  }
  if [ "$peeled" != "$head_sha" ]; then
    echo "pre-push: refusing to push ${local_ref}."
    echo "pre-push: ${peeled} is not the checked-out HEAD (${head_sha})."
    echo "pre-push: check out that ref with a clean working tree, then push."
    exit 1
  fi
  saw_update=1
  local_ref=
  local_sha=
done

if [ "$saw_update" -eq 0 ]; then
  exit 2
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "pre-push: working tree is not clean."
  echo "pre-push: commit local changes so verify runs against the commits being pushed."
  exit 1
fi

exit 0

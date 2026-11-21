#!/usr/bin/env bash
# Build and (re)start Saksi on the VM as a Docker container, with automatic rollback.
#
#   deploy/deploy.sh [--force] [REF]   deploy REF: branch, tag or commit (default: main)
#   deploy/deploy.sh --rollback        switch back to the previous image and commit
#
# Flow: git fetch + checkout REF in $SAKSI_ROOT -> docker build web/ as saksi-web:<tag> while
# the live container keeps serving -> docker compose up -d (deploy/compose.yaml) with the new
# tag -> poll /api/status with x-demo-token and the container health. A failed build restores
# the previous source and leaves the live container alone; a failed health check starts the
# previous tag again and restores the previous source.
#
# The tag is <commit>-<fingerprint of the NEXT_PUBLIC_* build args>, so an existing image is
# reused and changing a NEXT_PUBLIC_* value in the env file triggers a rebuild. Re-running the
# same REF only ensures the container is up and healthy. --force always builds, under a new tag
# (<tag>-<time>), so the image it replaces stays available for rollback.
#
# Settings (environment variables, all optional):
#   SAKSI_ROOT=$HOME/saksi  SAKSI_REPO_URL=https://github.com/alertxsto/saksi.git
#   SAKSI_ENV_FILE=$SAKSI_ROOT/web/.env.production  SAKSI_PORT=3400
#   SAKSI_HEALTH_URL=http://127.0.0.1:$SAKSI_PORT/api/status  SAKSI_KEEP_IMAGES=3
#   HEALTH_RETRIES=30  HEALTH_DELAY=2  HEALTH_STRICT=0 (1: rpc, db and contracts must pass)
# shellcheck disable=SC2329  # on_exit and its helpers run from the EXIT trap
set -euo pipefail

SAKSI_ROOT=${SAKSI_ROOT:-$HOME/saksi}
SAKSI_REPO_URL=${SAKSI_REPO_URL:-https://github.com/alertxsto/saksi.git}
PORT=${SAKSI_PORT:-3400}
HEALTH_URL=${SAKSI_HEALTH_URL:-http://127.0.0.1:$PORT/api/status}
HEALTH_RETRIES=${HEALTH_RETRIES:-30}
HEALTH_DELAY=${HEALTH_DELAY:-2}
HEALTH_STRICT=${HEALTH_STRICT:-0}
KEEP_IMAGES=${SAKSI_KEEP_IMAGES:-3}
STATE_DIR=${SAKSI_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/saksi-deploy}
APP_DIR=$SAKSI_ROOT/web
COMPOSE_DIR=$SAKSI_ROOT/deploy
ENV_FILE=${SAKSI_ENV_FILE:-$APP_DIR/.env.production}
KIT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
IMAGE=saksi-web

PHASE=init        # init -> checked_out -> switched -> finished; drives the EXIT trap
PREV_SHA=''       # commit checked out before this run (rollback target for the source)
ROLLBACK_TAG=''   # image tag to start again if the new one fails ('' = nothing to go back to)
TMP=''
LOCK_DIR=''
DEMO_TOKEN=''
REPORT_JS=''
FAILED_TAG=''     # tag that was being started when the run failed
BUILD_ARGS=()
PUBLIC_KEY=''

if [[ -t 1 ]]; then GREEN=$'\e[32m'; RED=$'\e[31m'; YELLOW=$'\e[33m'; RESET=$'\e[0m'; else GREEN=''; RED=''; YELLOW=''; RESET=''; fi
log() { printf '[deploy] %s\n' "$*"; }
warn() { printf '[deploy] %sWARN%s %s\n' "$YELLOW" "$RESET" "$*" >&2; }
die() { printf '[deploy] %sERROR%s %s\n' "$RED" "$RESET" "$*" >&2; exit 1; }
usage() { sed -n '2,23p' "$KIT_DIR/deploy.sh" | sed 's/^# \{0,1\}//'; }
git_root() { git -C "$SAKSI_ROOT" "$@"; }
# SAKSI_TAG on the command line wins over deploy/.env.
compose() { SAKSI_TAG=$1 SAKSI_ENV_FILE=$ENV_FILE POSTGRES_PASSWORD=$(env_value POSTGRES_PASSWORD) docker compose --project-directory "$COMPOSE_DIR" -f "$COMPOSE_DIR/compose.yaml" "${@:2}"; }
image_exists() { docker image inspect "$IMAGE:$1" >/dev/null 2>&1; }

history_note() {
  mkdir -p "$STATE_DIR"
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "$STATE_DIR/history"
}

# Last assignment of NAME in the env file, without surrounding quotes or CR.
env_value() {
  local name=$1 line=''
  [[ -r $ENV_FILE ]] || return 0
  line=$(grep -E "^[[:space:]]*(export[[:space:]]+)?${name}=" "$ENV_FILE" | tail -n 1) || true
  line=${line#*=}
  line=${line%$'\r'}
  line=${line#\"}; line=${line%\"}
  line=${line#\'}; line=${line%\'}
  printf '%s' "$line"
}

read_state() { # name -> "tag sha key" or empty
  if [[ -r $STATE_DIR/$1 ]]; then cat "$STATE_DIR/$1"; fi
}
write_state() { # name tag sha key
  printf '%s %s %s\n' "$2" "$3" "$4" > "$STATE_DIR/$1.tmp"
  mv -f "$STATE_DIR/$1.tmp" "$STATE_DIR/$1"
}

acquire_lock() {
  mkdir -p "$STATE_DIR"
  if command -v flock >/dev/null 2>&1; then
    exec 9>"$STATE_DIR/deploy.lock"
    flock -n 9 || die "another deploy is running (lock: $STATE_DIR/deploy.lock)"
  else
    mkdir "$STATE_DIR/deploy.lock.d" 2>/dev/null \
      || die "another deploy is running (delete $STATE_DIR/deploy.lock.d if it is stale)"
    LOCK_DIR=$STATE_DIR/deploy.lock.d
  fi
}

check_env() {
  [[ -f $ENV_FILE ]] || die "missing $ENV_FILE (copy deploy/env.production.example and fill it in)"
  local perms='' name missing=()
  perms=$(stat -c %a "$ENV_FILE" 2>/dev/null) || true
  if [[ -n $perms && ${perms: -2} != 00 ]]; then warn "$ENV_FILE is readable by others (mode $perms); run: chmod 600 $ENV_FILE"; fi
  for name in DATABASE_URL SUBJECT_KEY DATA_KEY SESSION_SECRET DEMO_ADMIN_TOKEN NEXT_PUBLIC_RPC_PRIMARY \
      NEXT_PUBLIC_REGISTRY_ADDRESS NEXT_PUBLIC_JOURNAL_ADDRESS NEXT_PUBLIC_BREACH_ADDRESS NEXT_PUBLIC_DEPLOY_BLOCK; do
    [[ -n $(env_value "$name") ]] || missing+=("$name")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then warn "empty in $ENV_FILE: ${missing[*]}"; fi
  DEMO_TOKEN=${DEMO_ADMIN_TOKEN:-$(env_value DEMO_ADMIN_TOKEN)}
  [[ -n $DEMO_TOKEN ]] || die "DEMO_ADMIN_TOKEN is empty; the /api/status health check needs it"
}

check_tools() {
  local tool
  for tool in git docker curl sha256sum; do
    command -v "$tool" >/dev/null 2>&1 || die "required command not found: $tool"
  done
  docker info >/dev/null 2>&1 || die "cannot reach the Docker daemon (is $(id -un) in the docker group?)"
  docker compose version >/dev/null 2>&1 || die "docker compose v2 plugin not found"
  docker buildx version >/dev/null 2>&1 || die "docker buildx plugin not found (web/Dockerfile needs BuildKit)"
}

ensure_repo() {
  if [[ ! -d $SAKSI_ROOT/.git ]]; then
    # init + fetch instead of clone, so a pre-created web/.env.production does not block it.
    log "initialising $SAKSI_ROOT from $SAKSI_REPO_URL"
    mkdir -p "$SAKSI_ROOT"
    git_root init -q
    git_root remote add origin "$SAKSI_REPO_URL"
  fi
}

resolve_ref() {
  local ref=$1 candidate sha=''
  [[ $ref =~ ^[A-Za-z0-9._/][A-Za-z0-9._/-]*$ ]] || die "invalid ref: $ref"
  for candidate in "refs/remotes/origin/$ref" "refs/tags/$ref" "$ref"; do
    if sha=$(git_root rev-parse --verify --quiet "${candidate}^{commit}"); then
      printf '%s' "$sha"
      return 0
    fi
  done
  die "ref not found after fetch: $ref"
}

# Fills BUILD_ARGS from the env file for every `ARG NEXT_PUBLIC_*` in the checked-out Dockerfile
# and sets PUBLIC_KEY to a fingerprint of those values; they are inlined into the bundle at build.
public_build_args() {
  local name value lines='' sum=''
  BUILD_ARGS=()
  while read -r name; do
    value=$(env_value "$name")
    BUILD_ARGS+=(--build-arg "$name=$value")
    lines+="$name=$value"$'\n'
  done < <(sed -nE 's/^ARG[[:space:]]+(NEXT_PUBLIC_[A-Za-z0-9_]+).*/\1/p' "$APP_DIR/Dockerfile" | LC_ALL=C sort -u)
  sum=$(printf '%s' "$lines" | sha256sum)
  PUBLIC_KEY=${sum:0:8}
}

build_image() {
  local tag=$1 sha=$2 key=$3
  log "building $IMAGE:$tag (the live container keeps serving)"
  docker build "${BUILD_ARGS[@]}" \
    --label saksi.component=web \
    --label "org.opencontainers.image.revision=$sha" \
    --label "saksi.public-env=$key" \
    -t "$IMAGE:$tag" "$APP_DIR" || die "docker build failed (output above)"
}

# Starts TAG and records it in deploy/.env, so manual `docker compose` commands there match.
compose_up() {
  local tag=$1
  compose "$tag" up -d --no-build --remove-orphans web
  printf '# Written by deploy/deploy.sh: the running tag, for plain docker compose commands here.\nSAKSI_TAG=%s\nSAKSI_ENV_FILE=%s\n' \
    "$tag" "$ENV_FILE" > "$COMPOSE_DIR/.env"
}

container_state() {
  local id=''
  id=$(compose "$1" ps -q web 2>/dev/null) || true
  if [[ -z $id ]]; then printf 'missing'; return 0; fi
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || printf 'missing'
}

print_report() {
  local level check detail color
  while IFS=$'\t' read -r level check detail; do
    case $level in PASS) color=$GREEN ;; FAIL) color=$RED ;; *) color=$YELLOW ;; esac
    printf '  %s%-4s%s %-14s %s\n' "$color" "$level" "$RESET" "$check" "$detail"
  done <<< "$1"
}

# Strict mode also requires the chain, the database and the contract addresses.
health_gate() {
  [[ $HEALTH_STRICT == 1 ]] || return 0
  local level check detail
  while IFS=$'\t' read -r level check detail; do
    if [[ $level == FAIL && ( $check == rpc || $check == db || $check == contracts ) ]]; then return 1; fi
  done <<< "$1"
  return 0
}

# status-report.mjs runs inside the image, so the host needs no Node.js.
status_report() { # tag body-file
  docker run --rm -i --pull never --network none --read-only --entrypoint node "$IMAGE:$1" \
    --input-type=module -e "$REPORT_JS" < "$2"
}

health_check() {
  local tag=$1 attempt code='' report='' last='' state=''
  local body=$TMP/status.json headers=$TMP/headers
  ( umask 077; printf 'x-demo-token: %s\n' "$DEMO_TOKEN" > "$headers" )
  for ((attempt = 1; attempt <= HEALTH_RETRIES; attempt++)); do
    rm -f "$body"
    state=$(container_state "$tag")
    code=$(curl -sS -o "$body" -w '%{http_code}' --max-time 15 -H @"$headers" "$HEALTH_URL" 2>/dev/null) || code=000
    if [[ $code == 200 ]] && report=$(status_report "$tag" "$body"); then
      if [[ $state != healthy ]]; then
        log "health attempt $attempt/$HEALTH_RETRIES: HTTP 200, container $state"
      elif health_gate "$report"; then
        log "health check passed (attempt $attempt): $HEALTH_URL, container healthy"
        print_report "$report"
        return 0
      else
        last=$report
        log "health attempt $attempt/$HEALTH_RETRIES: HTTP 200 but strict checks failed"
      fi
    elif [[ $code == 200 ]]; then
      log "health attempt $attempt/$HEALTH_RETRIES: HTTP 200 but the body is not a status report"
    else
      log "health attempt $attempt/$HEALTH_RETRIES: HTTP $code, container $state"
    fi
    sleep "$HEALTH_DELAY"
  done
  if [[ -n $last ]]; then print_report "$last"; fi
  return 1
}

restore_source() {
  if [[ -z $PREV_SHA ]]; then return 0; fi
  log "restoring source to ${PREV_SHA:0:12}"
  git_root checkout --force --detach "$PREV_SHA"
}

rollback_after_failure() {
  log "last log lines of the failed container:"
  compose "$1" logs --no-color --tail 40 web >&2 || true
  restore_source
  if [[ -z $ROLLBACK_TAG ]] || ! image_exists "$ROLLBACK_TAG"; then
    warn "no other image to roll back to; $IMAGE:$1 stays in place (cd $COMPOSE_DIR && docker compose logs web)"
    return 0
  fi
  log "rolling back to $IMAGE:$ROLLBACK_TAG"
  compose_up "$ROLLBACK_TAG"
  if health_check "$ROLLBACK_TAG"; then
    log "rollback healthy; failed image kept as $IMAGE:$1 for inspection"
    history_note "auto-rollback to $ROLLBACK_TAG ok"
  else
    warn "rollback finished but the health check still fails (cd $COMPOSE_DIR && docker compose logs --tail 100 web)"
    history_note "auto-rollback to $ROLLBACK_TAG unhealthy"
  fi
}

on_exit() {
  local rc=$?
  set +e
  if [[ $rc -ne 0 ]]; then
    case $PHASE in
      checked_out) restore_source ;;   # the live container was not touched
      switched) rollback_after_failure "$FAILED_TAG" ;;
    esac
  fi
  if [[ -n $TMP ]]; then rm -rf "$TMP"; fi
  if [[ -n $LOCK_DIR ]]; then rmdir "$LOCK_DIR"; fi
  exit "$rc"
}

# Keeps the KEEP_IMAGES most recently deployed images (by the history file, then by creation)
# plus whatever is current or previous; drops dangling ones. Only tags made by this script count.
prune_images() {
  local keep=$1 n=0 tag current previous pattern='^[0-9a-f]{12}-[0-9a-f]{8}(-[0-9]{14})?$'
  current=$(read_state current); current=${current%% *}
  previous=$(read_state previous); previous=${previous%% *}
  while read -r tag; do
    if [[ ! $tag =~ $pattern ]] || ! image_exists "$tag"; then continue; fi
    n=$((n + 1))
    if (( n <= keep )) || [[ $tag == "$current" || $tag == "$previous" ]]; then continue; fi
    if docker image rm "$IMAGE:$tag" >/dev/null 2>&1; then log "removed old image $IMAGE:$tag"; fi
  done < <({
    if [[ -r $STATE_DIR/history ]]; then tac "$STATE_DIR/history" | grep -owE '[0-9a-f]{12}-[0-9a-f]{8}(-[0-9]{14})?' || true; fi
    docker image ls "$IMAGE" --format '{{.CreatedAt}}'$'\t''{{.Tag}}' | LC_ALL=C sort -r | cut -f 2
  } | awk '!seen[$0]++')
  docker image prune -f --filter label=saksi.component=web >/dev/null 2>&1 || true
}

prepare() {
  check_tools
  check_env
  acquire_lock
  TMP=$(mktemp -d)
  # Read now: the checkout below may replace or remove the kit's own files.
  REPORT_JS=$(cat "$KIT_DIR/status-report.mjs")
  ensure_repo
  log "fetching origin"
  git_root fetch --prune --tags --force origin
}

deploy() {
  local ref=$1 force=$2 target current cur_tag='' cur_sha='' cur_key='' key tag dirty=''
  prepare
  target=$(resolve_ref "$ref")
  PREV_SHA=$(git_root rev-parse --verify --quiet 'HEAD^{commit}') || PREV_SHA=''
  current=$(read_state current)
  if [[ -n $current ]]; then read -r cur_tag cur_sha cur_key <<< "$current"; fi
  log "target $ref = ${target:0:12}; deployed ${cur_tag:-nothing}"

  dirty=$(git_root status --porcelain --untracked-files=no) || true
  if [[ -n $dirty ]]; then warn "discarding local edits to tracked files:"$'\n'"$dirty"; fi
  PHASE=checked_out
  git_root checkout --force --detach "$target"
  [[ -f $APP_DIR/Dockerfile && -f $COMPOSE_DIR/compose.yaml ]] \
    || die "${target:0:12} has no web/Dockerfile or deploy/compose.yaml (it predates the Docker kit)"
  public_build_args
  key=$PUBLIC_KEY

  if [[ $force -eq 0 && $target == "$cur_sha" && $key == "$cur_key" ]] && image_exists "$cur_tag"; then
    tag=$cur_tag
    log "already deployed with the same NEXT_PUBLIC_* values; ensuring $IMAGE:$tag is up"
  else
    tag=${target:0:12}-$key
    if [[ $force -eq 1 ]]; then tag+=-$(date -u +%Y%m%d%H%M%S); fi
    if image_exists "$tag"; then log "reusing existing image $IMAGE:$tag"; else build_image "$tag" "$target" "$key"; fi
  fi
  # Rolling back to the tag that is being (re)started would not change anything.
  if [[ $tag != "$cur_tag" ]]; then ROLLBACK_TAG=$cur_tag; fi

  FAILED_TAG=$tag
  PHASE=switched
  compose_up "$tag"
  health_check "$tag" || die "$IMAGE:$tag failed the health check"
  PHASE=finished

  if [[ $tag != "$cur_tag" ]]; then
    if [[ -n $cur_tag ]]; then write_state previous "$cur_tag" "$cur_sha" "$cur_key"; fi
    write_state current "$tag" "$target" "$key"
  fi
  history_note "deploy $ref $target $tag ok"
  prune_images "$KEEP_IMAGES"
  current=$(read_state previous); current=${current%% *}
  log "${GREEN}deployed $IMAGE:$tag${RESET} ($ref); previous: ${current:-none}"
}

rollback() {
  local previous prev_tag='' prev_sha='' prev_key='' current cur_tag='' cur_sha='' cur_key=''
  prepare
  previous=$(read_state previous)
  [[ -n $previous ]] || die "no previous deployment recorded in $STATE_DIR/previous"
  read -r prev_tag prev_sha prev_key <<< "$previous"
  image_exists "$prev_tag" || die "image $IMAGE:$prev_tag is gone; redeploy the old commit instead: deploy.sh $prev_sha"
  current=$(read_state current)
  if [[ -n $current ]]; then read -r cur_tag cur_sha cur_key <<< "$current"; fi
  PREV_SHA=$(git_root rev-parse --verify --quiet 'HEAD^{commit}') || PREV_SHA=''
  ROLLBACK_TAG=$cur_tag

  log "rolling back to $IMAGE:$prev_tag (${prev_sha:0:12})"
  PHASE=checked_out
  git_root checkout --force --detach "$prev_sha"
  public_build_args
  if [[ $prev_key != "$PUBLIC_KEY" ]]; then
    warn "NEXT_PUBLIC_* values changed since $prev_tag was built; its bundle keeps the old values"
  fi
  FAILED_TAG=$prev_tag
  PHASE=switched
  compose_up "$prev_tag"
  health_check "$prev_tag" || die "$IMAGE:$prev_tag failed the health check"
  PHASE=finished

  write_state current "$prev_tag" "$prev_sha" "$prev_key"
  if [[ -n $cur_tag ]]; then write_state previous "$cur_tag" "$cur_sha" "$cur_key"; fi
  history_note "rollback $prev_tag ok"
  log "${GREEN}rolled back to $IMAGE:$prev_tag${RESET}; run it again to roll forward"
}

main() {
  local mode=deploy force=0 ref=main
  while [[ $# -gt 0 ]]; do
    case $1 in
      --rollback) mode=rollback ;;
      --force) force=1 ;;
      -h|--help) usage; return 0 ;;
      -*) usage >&2; die "unknown option: $1" ;;
      *) ref=$1 ;;
    esac
    shift
  done
  trap on_exit EXIT
  trap 'exit 130' INT TERM
  if [[ $mode == rollback ]]; then rollback; else deploy "$ref" "$force"; fi
}

# Everything above is only definitions; the whole file is parsed before main runs, so a
# checkout that rewrites this script mid-run cannot change what executes.
main "$@"; exit "$?"

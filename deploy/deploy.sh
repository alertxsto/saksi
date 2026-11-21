#!/usr/bin/env bash
# Build and (re)start Saksi on the VM, with automatic rollback.
#
#   deploy/deploy.sh [--force] [REF]   deploy REF: branch, tag or commit (default: main)
#   deploy/deploy.sh --rollback        switch back to the previous build and commit
#
# Flow: git fetch + checkout REF in $SAKSI_ROOT -> pnpm install --frozen-lockfile ->
# build into web/.next-new (nice -n 19, capped heap) while the live server keeps serving
# web/.next -> stop, swap .next -> .next-prev and .next-new -> .next, start -> poll
# /api/status with x-demo-token. A failed build restores the previous source and leaves
# the live site alone; a failed health check swaps .next-prev back and restarts.
#
# Re-running with the same REF and the same NEXT_PUBLIC_* values only ensures the service
# is running and healthy. NEXT_PUBLIC_* values are baked in at build time, so changing them
# in .env.production triggers a rebuild on the next run. --force always rebuilds.
#
# Settings (environment variables, all optional):
#   SAKSI_ROOT=$HOME/saksi  SAKSI_REPO_URL=https://github.com/alertxsto/saksi.git
#   SAKSI_ENV_FILE=$SAKSI_ROOT/web/.env.production  SAKSI_SERVICE=saksi-web.service
#   SAKSI_PORT=3400  SAKSI_HEALTH_URL=http://127.0.0.1:$SAKSI_PORT/api/status
#   HEALTH_RETRIES=30  HEALTH_DELAY=2  HEALTH_STRICT=0 (1: rpc, db and contracts must pass)
#   BUILD_MEMORY_MB=1536 (V8 heap cap for next build)
# shellcheck disable=SC2329  # on_exit and its helpers run from the EXIT trap
set -euo pipefail

SAKSI_ROOT=${SAKSI_ROOT:-$HOME/saksi}
SAKSI_REPO_URL=${SAKSI_REPO_URL:-https://github.com/alertxsto/saksi.git}
SERVICE=${SAKSI_SERVICE:-saksi-web.service}
PORT=${SAKSI_PORT:-3400}
HEALTH_URL=${SAKSI_HEALTH_URL:-http://127.0.0.1:$PORT/api/status}
HEALTH_RETRIES=${HEALTH_RETRIES:-30}
HEALTH_DELAY=${HEALTH_DELAY:-2}
HEALTH_STRICT=${HEALTH_STRICT:-0}
BUILD_MEMORY_MB=${BUILD_MEMORY_MB:-1536}
STATE_DIR=${SAKSI_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/saksi-deploy}
UNIT_DIR=${SAKSI_UNIT_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user}
APP_DIR=$SAKSI_ROOT/web
ENV_FILE=${SAKSI_ENV_FILE:-$APP_DIR/.env.production}
KIT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

export PATH="$HOME/.local/bin:$PATH"
export XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/run/user/$(id -u)}
export NEXT_TELEMETRY_DISABLED=1
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

PHASE=init        # init -> checked_out | stopped -> swapped -> finished; drives the EXIT trap
PREV_SHA=''       # commit checked out before this run (rollback target for the source)
TMP=''
LOCK_DIR=''
DEMO_TOKEN=''
PNPM=()

if [[ -t 1 ]]; then GREEN=$'\e[32m'; RED=$'\e[31m'; YELLOW=$'\e[33m'; RESET=$'\e[0m'; else GREEN=''; RED=''; YELLOW=''; RESET=''; fi
log() { printf '[deploy] %s\n' "$*"; }
warn() { printf '[deploy] %sWARN%s %s\n' "$YELLOW" "$RESET" "$*" >&2; }
die() { printf '[deploy] %sERROR%s %s\n' "$RED" "$RESET" "$*" >&2; exit 1; }
usage() { sed -n '2,22p' "$KIT_DIR/deploy.sh" | sed 's/^# \{0,1\}//'; }
sctl() { systemctl --user "$@"; }
git_root() { git -C "$SAKSI_ROOT" "$@"; }

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

# Fingerprint of the NEXT_PUBLIC_* lines; they are inlined into the client bundle at build.
public_env_key() {
  local lines='' sum=''
  lines=$(grep -E '^[[:space:]]*(export[[:space:]]+)?NEXT_PUBLIC_[A-Za-z0-9_]*=' "$ENV_FILE") || true
  lines=$(printf '%s\n' "$lines" | tr -d '\r' | LC_ALL=C sort)
  sum=$(printf '%s' "$lines" | sha256sum)
  printf '%s' "${sum:0:16}"
}

read_state() { # name -> "sha key" or empty
  if [[ -r $STATE_DIR/$1 ]]; then cat "$STATE_DIR/$1"; fi
}
write_state() { # name sha key
  printf '%s %s\n' "$2" "$3" > "$STATE_DIR/$1.tmp"
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
  for tool in git node curl sha256sum systemctl; do
    command -v "$tool" >/dev/null 2>&1 || die "required command not found: $tool"
  done
  if command -v pnpm >/dev/null 2>&1; then PNPM=(pnpm)
  elif command -v corepack >/dev/null 2>&1; then PNPM=(corepack pnpm)
  else die "pnpm not found (run: corepack enable)"; fi
}

check_linger() {
  command -v loginctl >/dev/null 2>&1 || return 0
  local linger=''
  linger=$(loginctl show-user "$(id -un)" --property=Linger --value 2>/dev/null) || true
  [[ $linger == yes ]] || warn "lingering is off, so the service stops at logout; run: sudo loginctl enable-linger $(id -un)"
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

# Returns a status instead of dying: the EXIT trap also calls it.
install_deps() {
  log "pnpm install --frozen-lockfile"
  (cd "$APP_DIR" && "${PNPM[@]}" install --frozen-lockfile --prefer-offline)
}

build_side_dir() {
  local prefix=(nice -n 19)
  if command -v ionice >/dev/null 2>&1; then prefix=(ionice -c 3 "${prefix[@]}"); fi
  rm -rf "$APP_DIR/.next-new"
  log "building into web/.next-new (heap cap ${BUILD_MEMORY_MB} MB, nice 19)"
  (cd "$APP_DIR" && SAKSI_DIST_DIR=.next-new NODE_OPTIONS="--max-old-space-size=$BUILD_MEMORY_MB" \
    "${prefix[@]}" "${PNPM[@]}" run build) || die "next build failed (output above)"
  # next build adds .next-new/types to tsconfig.json; keep the checkout clean for the next fetch.
  if ! git_root diff --quiet -- web/tsconfig.json; then git_root checkout -- web/tsconfig.json; fi
  [[ -f $APP_DIR/.next-new/BUILD_ID ]] || die "build finished without web/.next-new/BUILD_ID"
}

install_unit() {
  local src=$SAKSI_ROOT/deploy/saksi-web.service enabled=''
  [[ -f $src ]] || src=$TMP/saksi-web.service
  mkdir -p "$UNIT_DIR"
  if ! cmp -s "$src" "$UNIT_DIR/$SERVICE"; then
    install -m 0644 "$src" "$UNIT_DIR/$SERVICE"
    sctl daemon-reload
    log "installed $UNIT_DIR/$SERVICE"
  fi
  enabled=$(sctl is-enabled "$SERVICE" 2>/dev/null) || true
  if [[ $enabled != enabled ]]; then sctl enable --quiet "$SERVICE"; fi
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

health_check() {
  local attempt code='' report='' last=''
  local body=$TMP/status.json headers=$TMP/headers
  ( umask 077; printf 'x-demo-token: %s\n' "$DEMO_TOKEN" > "$headers" )
  for ((attempt = 1; attempt <= HEALTH_RETRIES; attempt++)); do
    rm -f "$body"
    code=$(curl -sS -o "$body" -w '%{http_code}' --max-time 15 -H @"$headers" "$HEALTH_URL" 2>/dev/null) || code=000
    if [[ $code == 200 ]] && report=$(node "$TMP/status-report.mjs" "$body"); then
      if health_gate "$report"; then
        log "health check passed (attempt $attempt): $HEALTH_URL"
        print_report "$report"
        return 0
      fi
      last=$report
      log "health attempt $attempt/$HEALTH_RETRIES: HTTP 200 but strict checks failed"
    elif [[ $code == 200 ]]; then
      log "health attempt $attempt/$HEALTH_RETRIES: HTTP 200 but the body is not a status report"
    else
      log "health attempt $attempt/$HEALTH_RETRIES: HTTP $code"
    fi
    sleep "$HEALTH_DELAY"
  done
  if [[ -n $last ]]; then print_report "$last"; fi
  return 1
}

# The older .next-prev is parked as .next-prev-old until the new build is healthy, so an
# automatic rollback restores both the live build and the one-step manual rollback.
swap_in_new_build() {
  sctl stop "$SERVICE" || true
  rm -rf "$APP_DIR/.next-prev-old"
  if [[ -d $APP_DIR/.next-prev ]]; then mv "$APP_DIR/.next-prev" "$APP_DIR/.next-prev-old"; fi
  if [[ -d $APP_DIR/.next ]]; then mv "$APP_DIR/.next" "$APP_DIR/.next-prev"; fi
  # From here on a failure must put .next-prev back: that is what the 'swapped' handler does.
  PHASE=swapped
  mv "$APP_DIR/.next-new" "$APP_DIR/.next"
  sctl start "$SERVICE"
}

restore_source() {
  log "restoring source to ${PREV_SHA:0:12}; the live build was not touched"
  git_root checkout --force --detach "$PREV_SHA" && install_deps
  rm -rf "$APP_DIR/.next-new"
  if [[ -d $APP_DIR/.next-prev-old && ! -d $APP_DIR/.next-prev ]]; then mv "$APP_DIR/.next-prev-old" "$APP_DIR/.next-prev"; fi
  # The build ran next to the live server; make sure it is still (or again) running.
  if [[ -d $APP_DIR/.next ]]; then sctl start "$SERVICE" 2>/dev/null; fi
}

# Used if a manual rollback dies between stopping the service and finishing the swap.
repair_live_dir() {
  if [[ ! -d $APP_DIR/.next && -d $APP_DIR/.next-swap ]]; then mv "$APP_DIR/.next-swap" "$APP_DIR/.next"; fi
  if [[ ! -d $APP_DIR/.next && -d $APP_DIR/.next-prev ]]; then mv "$APP_DIR/.next-prev" "$APP_DIR/.next"; fi
  sctl start "$SERVICE"
}

rollback_after_failure() {
  if [[ ! -d $APP_DIR/.next-prev ]]; then
    warn "no previous build to roll back to; the new build stays in place (journalctl --user -u $SERVICE)"
    return 0
  fi
  log "rolling back to the previous build (${PREV_SHA:0:12})"
  sctl stop "$SERVICE"
  rm -rf "$APP_DIR/.next-failed"
  if [[ -d $APP_DIR/.next ]]; then mv "$APP_DIR/.next" "$APP_DIR/.next-failed"; fi
  rm -rf "$APP_DIR/.next-new"
  mv "$APP_DIR/.next-prev" "$APP_DIR/.next"
  if [[ -d $APP_DIR/.next-prev-old ]]; then mv "$APP_DIR/.next-prev-old" "$APP_DIR/.next-prev"; fi
  git_root checkout --force --detach "$PREV_SHA"
  install_deps || warn "pnpm install failed during rollback"
  sctl start "$SERVICE"
  if health_check; then
    log "rollback healthy; failed build kept in web/.next-failed for inspection"
    history_note "auto-rollback to $PREV_SHA ok"
  else
    warn "rollback finished but the health check still fails (journalctl --user -u $SERVICE -n 100)"
    history_note "auto-rollback to $PREV_SHA unhealthy"
  fi
}

on_exit() {
  local rc=$?
  set +e
  if [[ $rc -ne 0 ]]; then
    case $PHASE in
      checked_out) restore_source ;;
      stopped) repair_live_dir ;;
      swapped) rollback_after_failure ;;
    esac
  fi
  if [[ -n $TMP ]]; then rm -rf "$TMP"; fi
  if [[ -n $LOCK_DIR ]]; then rmdir "$LOCK_DIR"; fi
  exit "$rc"
}

prepare() {
  check_tools
  check_env
  acquire_lock
  TMP=$(mktemp -d)
  # Private copies: the checkout below may replace or remove the kit's own files.
  cp "$KIT_DIR/status-report.mjs" "$KIT_DIR/saksi-web.service" "$TMP/"
  check_linger
  ensure_repo
  log "fetching origin"
  git_root fetch --prune --tags --force origin
}

deploy() {
  local ref=$1 force=$2 target current cur_sha='' cur_key='' new_key dirty=''
  prepare
  target=$(resolve_ref "$ref")
  PREV_SHA=$(git_root rev-parse --verify --quiet 'HEAD^{commit}') || PREV_SHA=''
  current=$(read_state current)
  if [[ -n $current ]]; then read -r cur_sha cur_key <<< "$current"; fi
  new_key=$(public_env_key)
  log "target $ref = ${target:0:12}; deployed ${cur_sha:0:12}"

  if [[ $force -eq 0 && $target == "$cur_sha" && $new_key == "$cur_key" && $PREV_SHA == "$target" \
      && -f $APP_DIR/.next/BUILD_ID ]]; then
    log "already deployed with the same NEXT_PUBLIC_* values; ensuring the service is up"
    install_unit
    sctl start "$SERVICE"
    health_check || die "service is unhealthy (no changes were made; journalctl --user -u $SERVICE -n 100)"
    return 0
  fi

  dirty=$(git_root status --porcelain --untracked-files=no) || true
  if [[ -n $dirty ]]; then warn "discarding local edits to tracked files:"$'\n'"$dirty"; fi

  if [[ -n $PREV_SHA ]]; then PHASE=checked_out; fi
  git_root checkout --force --detach "$target"
  install_deps || die "pnpm install failed"
  build_side_dir
  install_unit

  swap_in_new_build
  health_check || die "new build ${target:0:12} failed the health check"
  PHASE=finished

  if [[ -n $PREV_SHA ]]; then write_state previous "$PREV_SHA" "${cur_key:-unknown}"; fi
  write_state current "$target" "$new_key"
  rm -rf "$APP_DIR/.next-failed" "$APP_DIR/.next-prev-old"
  history_note "deploy $ref $target ok"
  log "${GREEN}deployed ${target:0:12}${RESET} ($ref); previous build kept in web/.next-prev"
}

rollback() {
  local previous prev_target='' prev_key='' current cur_sha='' cur_key=''
  prepare
  previous=$(read_state previous)
  [[ -n $previous ]] || die "no previous deployment recorded in $STATE_DIR/previous"
  read -r prev_target prev_key <<< "$previous"
  [[ -d $APP_DIR/.next-prev ]] || die "web/.next-prev is missing; redeploy the old commit instead: deploy.sh $prev_target"
  current=$(read_state current)
  if [[ -n $current ]]; then read -r cur_sha cur_key <<< "$current"; fi
  if [[ $prev_key != "$(public_env_key)" ]]; then
    warn "NEXT_PUBLIC_* values changed since ${prev_target:0:12} was built; its bundle keeps the old values"
  fi
  PREV_SHA=$(git_root rev-parse 'HEAD^{commit}')

  log "rolling back to ${prev_target:0:12}"
  PHASE=stopped
  sctl stop "$SERVICE" || true
  mv "$APP_DIR/.next" "$APP_DIR/.next-swap"
  mv "$APP_DIR/.next-prev" "$APP_DIR/.next"
  mv "$APP_DIR/.next-swap" "$APP_DIR/.next-prev"
  # .next-prev now holds the build we left, PREV_SHA its source: the 'swapped' handler undoes this.
  PHASE=swapped
  git_root checkout --force --detach "$prev_target"
  install_deps || die "pnpm install failed"
  sctl start "$SERVICE"
  health_check || die "rolled-back build ${prev_target:0:12} failed the health check"
  PHASE=finished

  write_state current "$prev_target" "$prev_key"
  if [[ -n $cur_sha ]]; then write_state previous "$cur_sha" "$cur_key"; fi
  history_note "rollback $prev_target ok"
  log "${GREEN}rolled back to ${prev_target:0:12}${RESET}; run it again to roll forward"
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

#!/usr/bin/env bash
# Install the Saksi site into an existing, shared Caddy without touching other sites.
#
#   deploy/caddy-install.sh [--dry-run] [--csp-report-only]
#
# 1. Renders deploy/Caddyfile.saksi (CSP connect-src from NEXT_PUBLIC_RPC_* in the env file).
# 2. Stages a copy of /etc/caddy with the new site file and, only if missing, the
#    'import sites/*.caddy' line, then runs 'caddy validate' on the staged copy.
# 3. Prints the diffs, installs (timestamped backups), validates the live files again and
#    reloads Caddy. Any validate or reload failure restores the backups and aborts.
#
# Run as the deploy user (ubuntu); privileged steps use sudo.
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
CADDY_DIR=${CADDY_DIR:-/etc/caddy}
CADDY_MAIN=${CADDY_MAIN:-$CADDY_DIR/Caddyfile}
CADDY_BIN=${CADDY_BIN:-caddy}
CADDY_SERVICE=${CADDY_SERVICE:-caddy}
CADDY_USER=${CADDY_USER:-caddy}
SITE_SOURCE=${SITE_SOURCE:-$SCRIPT_DIR/Caddyfile.saksi}
SITE_NAME=${SITE_NAME:-saksi.caddy}
ENV_FILE=${SAKSI_ENV_FILE:-$HOME/saksi/web/.env.production}
IMPORT_LINE='import sites/*.caddy'

if [[ ${EUID:-$(id -u)} -eq 0 ]]; then SUDO=${SAKSI_SUDO-}; else SUDO=${SAKSI_SUDO-sudo}; fi

DRY_RUN=0
CSP_HEADER=Content-Security-Policy
usage() { sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; }
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=1 ;;
    --csp-report-only) CSP_HEADER=Content-Security-Policy-Report-Only ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 64 ;;
  esac
  shift
done

log() { printf '[caddy-install] %s\n' "$*"; }
die() { printf '[caddy-install] ERROR: %s\n' "$*" >&2; exit 1; }
priv() { if [[ -n $SUDO ]]; then "$SUDO" "$@"; else "$@"; fi; }

# Run caddy as the service user when it exists, so validation sees what the service sees.
caddy_validate() {
  local config=$1
  if [[ -n $SUDO ]] && id -u "$CADDY_USER" >/dev/null 2>&1; then
    "$SUDO" -u "$CADDY_USER" "$CADDY_BIN" validate --adapter caddyfile --config "$config"
  else
    priv "$CADDY_BIN" validate --adapter caddyfile --config "$config"
  fi
}

# Last assignment of NAME in the env file, without surrounding quotes or CR.
env_value() {
  local name=$1 line=''
  [[ -r $ENV_FILE ]] || { printf ''; return 0; }
  line=$(grep -E "^[[:space:]]*(export[[:space:]]+)?${name}=" "$ENV_FILE" | tail -n 1) || true
  line=${line#*=}
  line=${line%$'\r'}
  line=${line#\"}; line=${line%\"}
  line=${line#\'}; line=${line%\'}
  printf '%s' "$line"
}

rpc_origins() {
  local name url origin out=''
  for name in NEXT_PUBLIC_RPC_PRIMARY NEXT_PUBLIC_RPC_SECONDARY NEXT_PUBLIC_RPC_TERTIARY; do
    url=$(env_value "$name")
    [[ -n $url ]] || continue
    if [[ $url =~ ^(https?://[A-Za-z0-9.-]+(:[0-9]+)?)(/|$|\?) ]]; then
      origin=${BASH_REMATCH[1]}
      [[ " $out " == *" $origin "* ]] || out="${out:+$out }$origin"
    else
      log "WARN: $name is not a plain http(s) URL; left out of CSP connect-src" >&2
    fi
  done
  printf '%s' "$out"
}

has_import_line() {
  # Any existing top-level import that already covers sites/*.caddy counts.
  priv grep -Eq '^[[:space:]]*import[[:space:]]+("?)(/etc/caddy/)?sites/\*(\.caddy)?("?)[[:space:]]*$' "$1"
}

show_diff() {
  local old=$1 new=$2 label=$3 out=''
  out=$(priv diff -u --label "$label (current)" --label "$label (new)" "$old" "$new") || true
  if [[ -n $out ]]; then printf '%s\n' "$out"; else log "$label: no change"; fi
}

[[ $CADDY_MAIN == "$CADDY_DIR"/* ]] || die "CADDY_MAIN must live inside CADDY_DIR"
[[ -r $SITE_SOURCE ]] || die "site template not found: $SITE_SOURCE"
command -v "$CADDY_BIN" >/dev/null 2>&1 || die "caddy binary not found: $CADDY_BIN"
priv test -f "$CADDY_MAIN" || die "main Caddyfile not found: $CADDY_MAIN"

WORK=$(mktemp -d)
STAGE=''
cleanup() {
  rm -rf "$WORK"
  if [[ -n $STAGE ]]; then priv rm -rf "$STAGE"; fi
}
trap cleanup EXIT

# 1. Render the site file.
origins=$(rpc_origins)
rendered=$WORK/$SITE_NAME
if [[ -n $origins ]]; then
  log "CSP connect-src RPC origins: $origins"
  sed -E -e "s|\{\\\$SAKSI_RPC_ORIGINS(:[^}]*)?\}|$origins|g" \
    -e "s|\{\\\$SAKSI_CSP_HEADER(:[^}]*)?\}|$CSP_HEADER|g" "$SITE_SOURCE" > "$rendered"
else
  log "WARN: no NEXT_PUBLIC_RPC_* found in $ENV_FILE; keeping the default public Sepolia RPC origins"
  sed -E -e "s|\{\\\$SAKSI_CSP_HEADER(:[^}]*)?\}|$CSP_HEADER|g" "$SITE_SOURCE" > "$rendered"
fi
log "CSP header field: $CSP_HEADER"

# 2. Stage a full copy of the Caddy config dir and apply the change there first.
STAGE=$(priv mktemp -d "${TMPDIR:-/tmp}/saksi-caddy.XXXXXX")
priv cp -a "$CADDY_DIR/." "$STAGE/"
stage_main=$STAGE/${CADDY_MAIN#"$CADDY_DIR"/}
priv mkdir -p "$STAGE/sites"
priv cp "$rendered" "$STAGE/sites/$SITE_NAME"

need_import=0
if has_import_line "$CADDY_MAIN"; then
  log "main Caddyfile already imports sites/*.caddy"
else
  need_import=1
  # Keep a trailing newline before appending so the import is on its own line.
  last_char=$(priv tail -c 1 "$stage_main" | od -An -c | tr -d ' ') || true
  {
    if [[ -n $last_char && $last_char != '\n' ]]; then printf '\n'; fi
    printf '\n# Added by saksi deploy/caddy-install.sh\n%s\n' "$IMPORT_LINE"
  } | priv tee -a "$stage_main" >/dev/null
fi

if [[ -n $SUDO ]] && id -u "$CADDY_USER" >/dev/null 2>&1; then
  priv chgrp -R "$CADDY_USER" "$STAGE"
  priv chmod -R g+rX "$STAGE"
fi

live_site=$CADDY_DIR/sites/$SITE_NAME
if priv test -f "$live_site"; then current_site=$live_site; else current_site=/dev/null; fi
show_diff "$current_site" "$STAGE/sites/$SITE_NAME" "sites/$SITE_NAME"
show_diff "$CADDY_MAIN" "$stage_main" "$(basename -- "$CADDY_MAIN")"

log "validating staged config"
caddy_validate "$stage_main" || die "staged config failed 'caddy validate'; nothing was changed"

if [[ $DRY_RUN -eq 1 ]]; then
  log "dry run: staged config is valid; /etc and the running Caddy were not touched"
  exit 0
fi

# 3. Install with backups, validate the live files, reload.
stamp=$(date +%Y%m%d-%H%M%S)
backup_dir=$CADDY_DIR/backups
priv mkdir -p "$backup_dir" "$CADDY_DIR/sites"
site_backup=''
main_backup=''
if [[ $current_site != /dev/null ]]; then
  site_backup=$backup_dir/$SITE_NAME.$stamp
  priv cp -p "$live_site" "$site_backup"
fi
if [[ $need_import -eq 1 ]]; then
  main_backup=$backup_dir/$(basename -- "$CADDY_MAIN").$stamp
  priv cp -p "$CADDY_MAIN" "$main_backup"
  log "backup of main Caddyfile: $main_backup"
fi

restore() {
  log "restoring previous files"
  if [[ -n $site_backup ]]; then priv cp -p "$site_backup" "$live_site"; else priv rm -f "$live_site"; fi
  if [[ -n $main_backup ]]; then priv cp -p "$main_backup" "$CADDY_MAIN"; fi
}

priv install -m 0644 "$rendered" "$live_site"
if [[ $need_import -eq 1 ]]; then
  priv cp "$stage_main" "$CADDY_MAIN"
fi

log "validating live config"
if ! caddy_validate "$CADDY_MAIN"; then
  restore
  die "live config failed 'caddy validate'; restored backups, Caddy was not reloaded"
fi

log "reloading $CADDY_SERVICE"
if ! priv systemctl reload "$CADDY_SERVICE"; then
  restore
  die "reload failed; restored backups (Caddy keeps its previous config on a failed reload)"
fi
active=$(priv systemctl is-active "$CADDY_SERVICE" 2>/dev/null) || true
[[ $active == active ]] || die "$CADDY_SERVICE is '$active' after reload; check: journalctl -u $CADDY_SERVICE -n 50"
log "done: $live_site installed and $CADDY_SERVICE reloaded"

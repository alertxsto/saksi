#!/usr/bin/env bash
# Demo-day checklist for saksiku.web.id. Read-only: it only resolves names and sends GETs.
#
#   SAKSI_VM_IP=<public VM IP> deploy/preflight.sh [--domain saksiku.web.id] [--ip <VM IP>]
#
# Checks: DNS (apex + www point at the VM, no stray AAAA), HTTPS (certificate valid, not
# expiring within 14 days, HTTP->HTTPS and www->apex redirects, security headers),
# /api/status through the public URL (rpc, db, ai, contracts) and, when run on the VM, the
# systemd units and free disk space. Exit code 1 if anything is red.
#
# The status check needs DEMO_ADMIN_TOKEN, taken from the environment or from
# SAKSI_ENV_FILE (default ~/saksi/web/.env.production). Never pass it as an argument.
# Optional: SAKSI_PUBLIC_URL, SAKSI_STATUS_URL, PREFLIGHT_SKIP="dns tls status host".
set -euo pipefail

DOMAIN=${SAKSI_DOMAIN:-saksiku.web.id}
VM_IP=${SAKSI_VM_IP:-}
ENV_FILE=${SAKSI_ENV_FILE:-$HOME/saksi/web/.env.production}
SERVICE=${SAKSI_SERVICE:-saksi-web.service}
SKIP=" ${PREFLIGHT_SKIP:-} "
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
export PATH="$HOME/.local/bin:$PATH"

while [[ $# -gt 0 ]]; do
  case $1 in
    --domain) DOMAIN=${2:?--domain needs a value}; shift ;;
    --ip) VM_IP=${2:?--ip needs a value}; shift ;;
    -h|--help) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 64 ;;
  esac
  shift
done
PUBLIC_URL=${SAKSI_PUBLIC_URL:-https://$DOMAIN}
STATUS_URL=${SAKSI_STATUS_URL:-$PUBLIC_URL/api/status}

if [[ -t 1 ]]; then GREEN=$'\e[32m'; RED=$'\e[31m'; YELLOW=$'\e[33m'; BOLD=$'\e[1m'; RESET=$'\e[0m'; else GREEN=''; RED=''; YELLOW=''; BOLD=''; RESET=''; fi
PASSES=0; FAILS=0; WARNS=0
pass() { PASSES=$((PASSES + 1)); printf '  %s[PASS]%s %-26s %s\n' "$GREEN" "$RESET" "$1" "${2:-}"; }
fail() { FAILS=$((FAILS + 1)); printf '  %s[FAIL]%s %-26s %s\n' "$RED" "$RESET" "$1" "${2:-}"; }
warn() { WARNS=$((WARNS + 1)); printf '  %s[WARN]%s %-26s %s\n' "$YELLOW" "$RESET" "$1" "${2:-}"; }
section() { printf '\n%s%s%s\n' "$BOLD" "$1" "$RESET"; }
skipped() { [[ $SKIP == *" $1 "* ]]; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

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

# IPv4 (or IPv6 with type AAAA) addresses for a name, one per line, sorted and unique.
resolve() {
  local name=$1 type=${2:-A} out=''
  if command -v dig >/dev/null 2>&1; then
    out=$(dig +short +time=3 +tries=2 "$name" "$type" 2>/dev/null) || true
  elif command -v getent >/dev/null 2>&1; then
    if [[ $type == AAAA ]]; then out=$(getent ahostsv6 "$name" 2>/dev/null) || true
    else out=$(getent ahostsv4 "$name" 2>/dev/null) || true; fi
    out=$(printf '%s\n' "$out" | awk '{print $1}')
  elif command -v host >/dev/null 2>&1; then
    out=$(host -t "$type" "$name" 2>/dev/null) || true
    out=$(printf '%s\n' "$out" | awk '/has (IPv6 )?address/ {print $NF}')
  else
    return 2
  fi
  if [[ $type == AAAA ]]; then
    printf '%s\n' "$out" | grep -E '^[0-9a-fA-F:]+:[0-9a-fA-F:]*$' | sort -u || true
  else
    printf '%s\n' "$out" | grep -E '^[0-9]+(\.[0-9]+){3}$' | sort -u || true
  fi
}

check_dns_name() {
  local name=$1 addrs='' rc=0 joined
  addrs=$(resolve "$name" A) || rc=$?
  if [[ $rc -eq 2 ]]; then warn "dns $name" "no dig/getent/host available"; return; fi
  joined=$(printf '%s' "$addrs" | tr '\n' ' ')
  if [[ -z $addrs ]]; then
    fail "dns $name" "no A record"
  elif [[ -z $VM_IP ]]; then
    warn "dns $name" "resolves to $joined (set SAKSI_VM_IP to compare)"
  elif [[ $addrs == "$VM_IP" ]]; then
    pass "dns $name" "A $VM_IP"
  else
    fail "dns $name" "resolves to $joined, expected only $VM_IP (Cloudflare proxy must be off: DNS only)"
  fi
  addrs=$(resolve "$name" AAAA) || true
  if [[ -n $addrs ]]; then
    joined=$(printf '%s' "$addrs" | tr '\n' ' ')
    warn "dns $name AAAA" "$joined (IPv6 visitors go there; remove it unless the VM serves IPv6)"
  fi
}

check_dns() {
  section "DNS"
  check_dns_name "$DOMAIN"
  check_dns_name "www.$DOMAIN"
}

check_tls() {
  local out='' code='' end='' end_epoch='' redirect='' headers='' lower=''
  section "HTTPS"
  if code=$(curl -sS -o /dev/null --max-time 15 -w '%{http_code}' "$PUBLIC_URL/" 2> "$TMP/curl.err"); then
    pass "https $DOMAIN" "certificate trusted, HTTP $code"
  else
    fail "https $DOMAIN" "$(tr -d '\r' < "$TMP/curl.err" | tail -n 1)"
  fi

  if command -v openssl >/dev/null 2>&1; then
    out=$(openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" < /dev/null 2>/dev/null) || true
    end=$(openssl x509 -noout -enddate <<< "$out" 2>/dev/null) || true
    end=${end#notAfter=}
    if [[ -z $end ]]; then
      fail "certificate expiry" "could not read the certificate"
    elif openssl x509 -noout -checkend $((14 * 86400)) <<< "$out" >/dev/null 2>&1; then
      end_epoch=$(date -d "$end" +%s 2>/dev/null) || end_epoch=''
      if [[ -n $end_epoch ]]; then
        pass "certificate expiry" "$end ($(( (end_epoch - $(date +%s)) / 86400 )) days left)"
      else
        pass "certificate expiry" "$end"
      fi
    else
      fail "certificate expiry" "expires within 14 days: $end"
    fi
  else
    warn "certificate expiry" "openssl not installed"
  fi

  code=$(curl -sS -o /dev/null --max-time 15 -w '%{http_code} %{redirect_url}' "http://$DOMAIN/" 2>/dev/null) || code='000'
  if [[ $code =~ ^30[178]\ https://"$DOMAIN"/ ]]; then pass "http -> https" "${code%% *}"; else fail "http -> https" "got: $code"; fi

  redirect=$(curl -sS -o /dev/null --max-time 15 -w '%{http_code} %{redirect_url}' "https://www.$DOMAIN/" 2>/dev/null) || redirect='000'
  if [[ $redirect =~ ^30[18]\ https://"$DOMAIN"/ ]]; then pass "www -> apex" "${redirect%% *} ${redirect#* }"; else fail "www -> apex" "got: $redirect"; fi

  headers=$(curl -sS -D - -o /dev/null --max-time 15 "$PUBLIC_URL/" 2>/dev/null) || headers=''
  lower=${headers,,}
  local header
  for header in strict-transport-security content-security-policy x-content-type-options referrer-policy; do
    if [[ $lower == *"$header:"* ]]; then pass "header $header"
    elif [[ $header == content-security-policy && $lower == *"content-security-policy-report-only:"* ]]; then warn "header $header" "report-only mode"
    else fail "header $header" "missing"; fi
  done
}

check_status() {
  local token code='' report='' level check detail
  section "/api/status ($STATUS_URL)"
  token=${DEMO_ADMIN_TOKEN:-$(env_value DEMO_ADMIN_TOKEN)}
  if [[ -z $token ]]; then fail "status" "DEMO_ADMIN_TOKEN not set and not found in $ENV_FILE"; return; fi
  ( umask 077; printf 'x-demo-token: %s\n' "$token" > "$TMP/headers" )
  code=$(curl -sS -o "$TMP/status.json" --max-time 20 -w '%{http_code}' -H @"$TMP/headers" "$STATUS_URL" 2> "$TMP/curl.err") || code=000
  if [[ $code != 200 ]]; then
    fail "status" "HTTP $code $(tr -d '\r' < "$TMP/curl.err" | tail -n 1)"
    return
  fi
  report=$(node "$SCRIPT_DIR/status-report.mjs" "$TMP/status.json") || true
  while IFS=$'\t' read -r level check detail; do
    [[ -n $level ]] || continue
    case $level in
      PASS) pass "$check" "$detail" ;;
      WARN) warn "$check" "$detail" ;;
      *) fail "$check" "$detail" ;;
    esac
  done <<< "$report"
}

check_host() {
  local state='' avail=''
  command -v systemctl >/dev/null 2>&1 || return 0
  section "VM"
  if systemctl --user cat "$SERVICE" >/dev/null 2>&1; then
    state=$(systemctl --user is-active "$SERVICE" 2>/dev/null) || true
    if [[ $state == active ]]; then pass "$SERVICE" "active"; else fail "$SERVICE" "$state (journalctl --user -u $SERVICE -n 100)"; fi
  else
    warn "$SERVICE" "not installed for $(id -un) (run deploy/deploy.sh)"
  fi
  state=$(systemctl is-active caddy 2>/dev/null) || true
  if [[ $state == active ]]; then pass "caddy" "active"; else fail "caddy" "${state:-unknown}"; fi
  avail=$(df -Pk "$HOME" 2>/dev/null | awk 'NR == 2 {print $4}') || true
  if [[ -n $avail ]]; then
    if (( avail > 2 * 1024 * 1024 )); then pass "disk free" "$((avail / 1024)) MB in $HOME"
    else warn "disk free" "only $((avail / 1024)) MB in $HOME; a build needs about 2 GB"; fi
  fi
}

printf '%sSaksi preflight%s  %s  %s\n' "$BOLD" "$RESET" "$DOMAIN" "$(date '+%Y-%m-%d %H:%M:%S %Z')"
skipped dns || check_dns
skipped tls || check_tls
skipped status || check_status
skipped host || check_host

printf '\n%s%d passed%s, %s%d warnings%s, %s%d failed%s\n' "$GREEN" "$PASSES" "$RESET" "$YELLOW" "$WARNS" "$RESET" "$RED" "$FAILS" "$RESET"
if [[ $FAILS -gt 0 ]]; then
  printf '%sNOT READY%s\n' "$RED" "$RESET"
  exit 1
fi
printf '%sREADY%s\n' "$GREEN" "$RESET"

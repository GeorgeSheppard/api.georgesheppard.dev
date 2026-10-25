#!/usr/bin/env bash
set -Eeuo pipefail

# Sets up the mac mini to host the stack. Idempotent: re-run it after changing anything in infra/
# and it brings the box back in line — installs dependencies, makes sure OrbStack starts at login,
# stops the machine sleeping and powers it back on after a power cut, syncs deploy.sh into the
# compose directory, and (re)loads the launchd job that runs deploy.sh at load and every 5 minutes.
#
# Everything up to the cutover (installing, logging in, pre-pulling images) is safe to run while another
# Docker runtime is still serving the stack. The cutover (pointing deploys at OrbStack and loading the
# launchd job, which starts the stack) refuses to run until Docker Desktop has been quit, so two runtimes
# never run Postgres against the same ./pgdata.
#
# Usage (on the mac mini, from a checkout of this repo): infra/install.sh
# Optional env: COMPOSE_DIR (defaults to ~/Documents/root)

LABEL="com.docker.compose.update"
COMPOSE_DIR="${COMPOSE_DIR:-$HOME/Documents/root}"
CREDENTIALS_FILE="$HOME/.config/infisical/mac-mini.env"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_FILE="$HOME/docker-launchd.log"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
DOMAIN="gui/$(id -u)"

log() { echo "==> $*"; }
warn() { echo "WARNING: $*" >&2; }

[[ "$(uname)" == "Darwin" ]] || { echo "install.sh only supports macOS" >&2; exit 1; }

# Pause automatic deploys first: the old job could otherwise fire mid-install against whichever runtime the
# docker CLI currently points at. It's loaded again at the end.
log "Pausing the deploy launchd job"
launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true

# Every docker command in this script targets OrbStack, without touching the global context until cutover
export DOCKER_CONTEXT=orbstack

if ! command -v brew >/dev/null 2>&1; then
  log "Installing Homebrew"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
eval "$( (/opt/homebrew/bin/brew shellenv || /usr/local/bin/brew shellenv) 2>/dev/null)"

if [[ ! -d /Applications/OrbStack.app ]]; then
  log "Installing OrbStack"
  brew install --cask orbstack
fi

if ! command -v infisical >/dev/null 2>&1; then
  log "Installing Infisical CLI"
  brew install infisical/get-cli/infisical
fi

log "Starting OrbStack"
# The app installs the orb/docker CLIs into ~/.orbstack/bin on first launch
open -ga OrbStack
export PATH="$HOME/.orbstack/bin:$PATH"
for _ in {1..60}; do
  docker info >/dev/null 2>&1 && break
  sleep 2
done
docker info >/dev/null 2>&1 || { echo "OrbStack did not start, open it manually to finish its setup" >&2; exit 1; }
orb config set app.start_at_login true >/dev/null || warn "Couldn't enable OrbStack 'Start at login', turn it on in OrbStack's settings."

log "Configuring power settings (never sleep, restart after power failure), may ask for your password"
sudo pmset -a sleep 0 disksleep 0 autorestart 1 womp 1

if ! defaults read /Library/Preferences/com.apple.loginwindow autoLoginUser >/dev/null 2>&1; then
  warn "Automatic login is off, so after a reboot nothing starts until someone logs in." \
    "Turn it on in System Settings > Users & Groups (requires FileVault to be off)."
fi

# These are only the Machine Identity credentials deploy.sh uses to log in to Infisical, every app secret
# is fetched fresh from Infisical on each deploy. To rotate them, re-run with the new values exported:
#   INFISICAL_CLIENT_ID=... INFISICAL_CLIENT_SECRET=... INFISICAL_PROJECT_ID=... infra/install.sh
if [[ -n "${INFISICAL_CLIENT_ID:-}" && -n "${INFISICAL_CLIENT_SECRET:-}" && -n "${INFISICAL_PROJECT_ID:-}" ]]; then
  client_id="$INFISICAL_CLIENT_ID"
  client_secret="$INFISICAL_CLIENT_SECRET"
  project_id="$INFISICAL_PROJECT_ID"
elif [[ ! -f "$CREDENTIALS_FILE" ]]; then
  log "Infisical Machine Identity credentials not found, enter them now"
  read -rp "INFISICAL_CLIENT_ID: " client_id
  read -rsp "INFISICAL_CLIENT_SECRET: " client_secret
  echo
  read -rp "INFISICAL_PROJECT_ID: " project_id
fi
if [[ -n "${client_id:-}" ]]; then
  log "Writing Infisical credentials to $CREDENTIALS_FILE"
  mkdir -p "$(dirname "$CREDENTIALS_FILE")"
  (
    umask 077
    printf 'export INFISICAL_CLIENT_ID=%q\nexport INFISICAL_CLIENT_SECRET=%q\nexport INFISICAL_PROJECT_ID=%q\n' \
      "$client_id" "$client_secret" "$project_id" >"$CREDENTIALS_FILE"
  )
fi
chmod 600 "$CREDENTIALS_FILE"

# Docker Desktop points ~/.docker/config.json at its own credential helper, which lives inside Docker.app and isn't
# on the launchd PATH (and disappears when Docker Desktop is uninstalled), so pulls of the private image would fail
if grep -q '"credsStore": *"desktop"' "$HOME/.docker/config.json" 2>/dev/null; then
  log "Switching docker credential store from Docker Desktop's to the macOS keychain"
  cp "$HOME/.docker/config.json" "$HOME/.docker/config.json.bak"
  sed -i '' 's/"credsStore": *"desktop"/"credsStore": "osxkeychain"/' "$HOME/.docker/config.json"
fi

# Pulling now means the cutover only has to start containers, not download images
log "Pre-pulling images into OrbStack"
pull_images() {
  sed -n 's/^ *image: *//p' "$SRC_DIR/compose.yaml" | while read -r image; do
    docker pull -q "$image" >/dev/null || return 1
  done
}
if ! pull_images; then
  log "Pull failed, log in to Docker Hub (needed for the private api image)"
  docker login
  pull_images
fi

log "Syncing deploy.sh into $COMPOSE_DIR"
mkdir -p "$COMPOSE_DIR"
install -m 755 "$SRC_DIR/deploy.sh" "$COMPOSE_DIR/deploy.sh"
if [[ -d "$COMPOSE_DIR/cronjobs" ]]; then
  warn "$COMPOSE_DIR/cronjobs is no longer used (the scheduler generates its cronjobs), delete it once you're happy."
fi

if pgrep -qf "/Applications/Docker.app/"; then
  warn "Prep done, but Docker Desktop is still running so the stack was NOT moved to OrbStack, and automatic" \
    "deploys are paused. To cut over: stop the old stack, quit Docker Desktop, then re-run this script" \
    "(see 'Migrating from Docker Desktop' in infra/README.md)."
  exit 1
fi

log "Pointing the docker CLI at OrbStack"
docker context use orbstack >/dev/null

log "Writing launchd job $PLIST"
mkdir -p "$(dirname "$PLIST")"
cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!-- Generated by infra/install.sh, edit that instead and re-run it -->
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LABEL</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>$HOME/.orbstack/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
        <key>DOCKER_CONTEXT</key>
        <string>orbstack</string>
    </dict>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>source "\$1" &amp;&amp; exec "\$2"</string>
        <string>deploy</string>
        <string>$CREDENTIALS_FILE</string>
        <string>$COMPOSE_DIR/deploy.sh</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>StartInterval</key>
    <integer>300</integer>

    <key>StandardOutPath</key>
    <string>$LOG_FILE</string>

    <key>StandardErrorPath</key>
    <string>$LOG_FILE</string>
</dict>
</plist>
EOF
plutil -lint "$PLIST" >/dev/null

log "Loading launchd job, which kicks off a deploy straight away"
launchctl enable "$DOMAIN/$LABEL"
# bootout is asynchronous, so bootstrap can briefly fail while the old job is still unloading
for attempt in {1..5}; do
  launchctl bootstrap "$DOMAIN" "$PLIST" 2>/dev/null && break
  [[ $attempt -eq 5 ]] && launchctl bootstrap "$DOMAIN" "$PLIST"
  sleep 1
done

log "Done. Follow the deploy with: tail -f $LOG_FILE"

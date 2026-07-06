#!/usr/bin/with-contenv bashio
# ============================================================
#  Anti-Matter add-on launcher
# ============================================================
log_line() {   # $1=LEVEL  $2=ANSI colour  $3=message
    printf '[%s] %s: %b%s\033[0m\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" "$2" "$3"
}

log_line INFO '\033[32m' "Anti-Matter starting on port 8099 (ingress)..."

export ANTIMATTER_DATA="/data"
export ANTIMATTER_OPTIONS="/data/options.json"
export ANTIMATTER_PORT="8099"
export ADDON_VERSION="1.0.3"

# addon_config:rw mounts the add-on config folder at /config.
# On the SAMBA share this shows up as addon_configs\<slug>. Store the vault there
# so backups are reachable over the network and included in HA backups.
if [ -d "/config" ]; then
    log_line INFO '\033[32m' "SAMBA storage active: /config (\\\\<HA-IP>\\addon_configs\\<slug>)"
    export STORAGE_DIR="/config"
else
    log_line WARNING '\033[33m' "/config not mounted — falling back to /data"
    export STORAGE_DIR="$ANTIMATTER_DATA"
fi

exec python3 /app/main.py

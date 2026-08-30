#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-copa-leyendas}"
APP_DIR="${APP_DIR:-/var/www/$APP_NAME}"
API_PORT="${API_PORT:-3000}"
DOMAIN="${DOMAIN:-_}"
APP_DOMAIN="${APP_DOMAIN:-$DOMAIN}"
ROOT_DOMAIN="${ROOT_DOMAIN:-_}"
WWW_DOMAIN="${WWW_DOMAIN:-}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this script as root."
  exit 1
fi

if [[ "$ROOT_DOMAIN" != "_" && -z "$WWW_DOMAIN" ]]; then
  WWW_DOMAIN="www.$ROOT_DOMAIN"
fi

NGINX_PATH="/etc/nginx/sites-available/${APP_NAME}.conf"

if [[ "$ROOT_DOMAIN" != "_" && "$APP_DOMAIN" != "_" ]]; then
  sed \
    -e "s|__APP_DOMAIN__|$APP_DOMAIN|g" \
    -e "s|__ROOT_DOMAIN__|$ROOT_DOMAIN|g" \
    -e "s|__WWW_DOMAIN__|$WWW_DOMAIN|g" \
    -e "s|__APP_DIR__|$APP_DIR|g" \
    -e "s|__API_PORT__|$API_PORT|g" \
    "$APP_DIR/app/deploy/nginx/copa-leyendas-multi-domain.conf" >"$NGINX_PATH"
else
  sed \
    -e "s|__SERVER_NAME__|$APP_DOMAIN|g" \
    -e "s|__APP_DIR__|$APP_DIR|g" \
    -e "s|__API_PORT__|$API_PORT|g" \
    "$APP_DIR/app/deploy/nginx/copa-leyendas.conf" >"$NGINX_PATH"
fi

ln -sf "$NGINX_PATH" "/etc/nginx/sites-enabled/${APP_NAME}.conf"
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

echo "Nginx configured."
echo "Primary domain: $APP_DOMAIN"
if [[ "$ROOT_DOMAIN" != "_" ]]; then
  echo "Additional domains: $ROOT_DOMAIN $WWW_DOMAIN"
fi

#!/bin/bash
# Mizan Bridge — one-shot EC2 setup script
# Run once on the host EC2 instance after cloning the repo.
# Usage: sudo bash bridge/setup.sh <domain> <bridge_secret>
#   e.g. sudo bash bridge/setup.sh bridge.mizan.ai sk-bridge-xxxxx
set -euo pipefail

DOMAIN=${1:?"Usage: $0 <domain> <bridge_secret>"}
BRIDGE_SECRET=${2:?"Usage: $0 <domain> <bridge_secret>"}
ENCLAVE_CID=${ENCLAVE_CID:-16}
BRIDGE_PORT=${BRIDGE_PORT:-3001}

echo "==> Installing nginx and certbot"
apt-get update -qq
apt-get install -y nginx certbot python3-certbot-nginx

echo "==> Writing bridge environment file"
mkdir -p /etc/mizan
cat > /etc/mizan/bridge.env <<EOF
BRIDGE_SECRET=${BRIDGE_SECRET}
ENCLAVE_CID=${ENCLAVE_CID}
BRIDGE_PORT=${BRIDGE_PORT}
EOF
chmod 600 /etc/mizan/bridge.env

echo "==> Installing nginx config"
sed "s/bridge.YOUR_DOMAIN.com/${DOMAIN}/g" \
    "$(dirname "$0")/nginx.conf" \
    > /etc/nginx/sites-available/mizan-bridge
ln -sf /etc/nginx/sites-available/mizan-bridge /etc/nginx/sites-enabled/mizan-bridge
rm -f /etc/nginx/sites-enabled/default
nginx -t

echo "==> Obtaining TLS certificate via Let's Encrypt"
# Temporarily start nginx on port 80 for the ACME challenge
systemctl start nginx || true
certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "admin@${DOMAIN}" --redirect
systemctl reload nginx

echo "==> Installing systemd service"
cp "$(dirname "$0")/mizan-bridge.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable mizan-bridge
systemctl start mizan-bridge

echo "==> Done. Update ENCLAVE_BRIDGE_URL in Vercel to: https://${DOMAIN}"
echo "    Then redeploy: npx vercel --prod"

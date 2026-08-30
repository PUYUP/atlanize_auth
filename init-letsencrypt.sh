#!/bin/bash

if ! [ -x "$(command -v docker)" ]; then
  echo 'Error: docker is not installed.' >&2
  exit 1
fi

# ==========================================
# KONFIGURASI DOMAIN & EMAIL
# ==========================================
domains=("auth.atlanize.com")
email="rahman@atlanize.com" # Wajib diganti dengan email aktif
staging=0 # Ubah ke 1 jika sedang tahap testing agar tidak terkena limit rate Let's Encrypt
# ==========================================

rsa_key_size=4096
data_path="./certbot"

if [ -d "$data_path" ]; then
  read -p "Data certbot lama ditemukan untuk $domains. Lanjutkan dan timpa sertifikat lama? (y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    exit
  fi
fi

echo "### Mengunduh parameter TLS yang disarankan (Nginx) ..."
mkdir -p "$data_path/conf"
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"
echo

echo "### Membuat sertifikat sementara (dummy) untuk $domains ..."
path="/etc/letsencrypt/live/$domains"
mkdir -p "$data_path/conf/live/$domains"
docker compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1\
    -keyout '$path/privkey.pem' \
    -out '$path/fullchain.pem' \
    -subj '/CN=localhost'" certbot
echo

echo "### Menjalankan Nginx untuk merespon Let's Encrypt ..."
docker compose up --force-recreate -d nginx
echo

echo "### Menghapus sertifikat sementara (dummy) untuk $domains ..."
docker compose run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$domains && \
  rm -Rf /etc/letsencrypt/archive/$domains && \
  rm -Rf /etc/letsencrypt/renewal/$domains.conf" certbot
echo

echo "### Meminta sertifikat SSL asli Let's Encrypt untuk $domains ..."
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

# Pilih argumen email
case "$email" in
  "") email_arg="--register-unsafely-without-email" ;;
  *) email_arg="--email $email" ;;
esac

# Jika staging = 1, tambahkan argumen
if [ $staging != "0" ]; then staging_arg="--staging"; fi

docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    $domain_args \
    --rsa-key-size $rsa_key_size \
    --agree-tos \
    --force-renewal" certbot
echo

echo "### Me-reload konfigurasi Nginx ..."
docker compose exec nginx nginx -s reload
echo "Selesai!"

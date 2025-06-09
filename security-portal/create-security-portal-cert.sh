#!/bin/bash

# create-ca-and-cert.sh - Créer une CA et un certificat signé

set -e

echo "🏛️  Création d'une Autorité de Certification locale"

# Créer les répertoires
mkdir -p ssl/ca ssl/server

# 1. Créer la configuration pour la CA
cat > ssl/ca/ca.conf << 'EOF'
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_ca
prompt = no

[req_distinguished_name]
C=TN
ST=Tunis
L=Tunis
O=Security Portal
OU=Local Development
CN=Local Development CA

[v3_ca]
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
basicConstraints = critical,CA:true
keyUsage = critical, digitalSignature, cRLSign, keyCertSign
EOF

# 2. Générer la clé privée de la CA
echo "🔐 Génération de la clé privée de la CA..."
openssl genrsa -out ssl/ca/ca.key 4096

# 3. Créer le certificat de la CA (auto-signé)
echo "📜 Création du certificat de la CA..."
openssl req -new -x509 -days 3650 -key ssl/ca/ca.key -out ssl/ca/ca.crt -config ssl/ca/ca.conf -extensions v3_ca

# 4. Créer la configuration pour le certificat serveur
cat > ssl/server/server.conf << 'EOF'
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C=TN
ST=Tunis
L=Tunis
O=Security Portal
OU=Web Development
CN=localhost

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = security-portal
DNS.2 = *.localhost
DNS.3 = 127.0.0.1
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# 5. Générer la clé privée du serveur
echo "🔑 Génération de la clé privée du serveur..."
openssl genrsa -out ssl/server/localhost.key 2048

# 6. Créer la demande de certificat (CSR)
echo "📋 Création de la demande de certificat..."
openssl req -new -key ssl/server/localhost.key -out ssl/server/localhost.csr -config ssl/server/server.conf

# 7. Signer le certificat serveur avec la CA
echo "✍️  Signature du certificat par la CA..."
openssl x509 -req -in ssl/server/localhost.csr -CA ssl/ca/ca.crt -CAkey ssl/ca/ca.key -CAcreateserial -out ssl/server/localhost.crt -days 365 -extensions v3_req -extfile ssl/server/server.conf

# 8. Copier les certificats finaux dans le répertoire ssl principal
cp ssl/server/localhost.crt ssl/localhost.crt
cp ssl/server/localhost.key ssl/localhost.key
cp ssl/ca/ca.crt ssl/ca-certificate.crt

# 9. Définir les bonnes permissions
chmod 600 ssl/ca/ca.key ssl/server/localhost.key ssl/localhost.key
chmod 644 ssl/ca/ca.crt ssl/server/localhost.crt ssl/localhost.crt ssl/ca-certificate.crt

# 10. Nettoyer les fichiers temporaires
rm ssl/server/localhost.csr ssl/ca/ca.srl

echo ""
echo "✅ Certificats créés avec succès !"
echo "📁 Fichiers générés :"
echo "   - ssl/ca-certificate.crt (Certificat de la CA à importer)"
echo "   - ssl/localhost.crt (Certificat du serveur)"
echo "   - ssl/localhost.key (Clé privée du serveur)"
echo ""
echo "🌐 Pour éliminer l'erreur 'Not Secure' :"
echo "   1. Importez ssl/ca-certificate.crt comme Autorité de Certification"
echo "   2. Redémarrez votre navigateur"
echo "   3. Accédez à https://localhost"
echo ""
echo "📖 Voir les instructions détaillées ci-dessous..."

# Afficher les informations des certificats
echo ""
echo "🔍 Informations du certificat CA :"
openssl x509 -in ssl/ca-certificate.crt -noout -subject -dates

echo ""
echo "🔍 Informations du certificat serveur :"
openssl x509 -in ssl/localhost.crt -noout -subject -dates

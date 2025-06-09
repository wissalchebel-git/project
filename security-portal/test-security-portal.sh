# test-security-portal.sh - Tester la configuration security-portal

echo "🧪 Test de la configuration security-portal"

# 1. Vérifier /etc/hosts
echo "1️⃣ Vérification de /etc/hosts..."
if grep -q "security-portal" /etc/hosts; then
    echo "   ✅ security-portal trouvé dans /etc/hosts"
    grep "security-portal" /etc/hosts
else
    echo "   ❌ security-portal manquant dans /etc/hosts"
    echo "   🔧 Ajoutez: 127.0.0.1 security-portal"
    exit 1
fi

# 2. Vérifier les certificats
echo ""
echo "2️⃣ Vérification des certificats..."
if [[ -f "ssl/localhost.crt" && -f "ssl/localhost.key" ]]; then
    echo "   ✅ Certificats trouvés"
    
    # Vérifier que le certificat contient security-portal
    if openssl x509 -in ssl/localhost.crt -text -noout | grep -q "security-portal"; then
        echo "   ✅ Certificat contient 'security-portal'"
    else
        echo "   ❌ Certificat ne contient pas 'security-portal'"
        echo "   🔧 Exécutez: ./create-security-portal-cert.sh"
        exit 1
    fi
    
    # Afficher les domaines du certificat
    echo "   📋 Domaines dans le certificat:"
    openssl x509 -in ssl/localhost.crt -text -noout | grep -A 3 "Subject Alternative Name" | tail -n 1 | sed 's/DNS://g' | sed 's/IP Address://g'
else
    echo "   ❌ Certificats manquants"
    echo "   🔧 Exécutez: ./create-security-portal-cert.sh"
    exit 1
fi

# 3. Vérifier la configuration Nginx
echo ""
echo "3️⃣ Vérification de la configuration Nginx..."
if [[ -f "docker/nginx.conf" ]] || [[ -f "nginx.conf" ]]; then
    NGINX_FILE="nginx.conf"
    [[ -f "docker/nginx.conf" ]] && NGINX_FILE="docker/nginx.conf"
    
    if grep -q "server_name security-portal" "$NGINX_FILE"; then
        echo "   ✅ Configuration Nginx correcte"
    else
        echo "   ⚠️  Vérifiez que server_name contient 'security-portal'"
    fi
else
    echo "   ⚠️  Fichier nginx.conf non trouvé"
fi

# 4. Test de résolution DNS
echo ""
echo "4️⃣ Test de résolution DNS..."
if ping -c 1 security-portal >/dev/null 2>&1; then
    echo "   ✅ security-portal résolu vers $(getent hosts security-portal | awk '{print $1}')"
else
    echo "   ❌ Impossible de résoudre security-portal"
    echo "   🔧 Vérifiez /etc/hosts"
fi

# 5. Test avec curl (si Docker est en cours)
echo ""
echo "5️⃣ Test de connexion HTTPS..."
if curl -k -s https://security-portal >/dev/null 2>&1; then
    echo "   ✅ Connexion HTTPS réussie"
else
    echo "   ⚠️  Connexion HTTPS échouée (normal si Docker n'est pas démarré)"
fi

echo ""
echo "🚀 Instructions finales:"
echo "   1. Construire et lancer: docker-compose up --build"
echo "   2. Ouvrir le navigateur: https://security-portal"
echo "   3. Vérifier le cadenas vert 🔒"

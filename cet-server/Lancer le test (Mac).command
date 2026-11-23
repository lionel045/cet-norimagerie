#!/bin/bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Installe Node.js LTS : https://nodejs.org"; open https://nodejs.org; read; exit 1; }
[ -d node_modules ] || npm install
(sleep 3; open http://localhost:3000; open http://localhost:3000/boite-test; open http://localhost:3000/tableau-de-bord) &
node server.js

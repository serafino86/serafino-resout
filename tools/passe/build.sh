#!/bin/sh
# Ricostruisce site/assets/passe.js (three.js r170 MIT, tree-shaken) da passe.src.js. Versioni fissate in package.json.
set -e
cd "$(dirname "$0")"
npm ci --no-audit --no-fund
npx esbuild passe.src.js --bundle --minify --format=iife --target=es2020 --legal-comments=eof --outfile=../../site/assets/passe.js
cp node_modules/three/LICENSE ../../site/assets/three-LICENSE.txt

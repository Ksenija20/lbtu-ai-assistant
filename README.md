# LBTU AI Pasniedzēju Meklēšanas Asistents

AI asistents pasniedzēju meklēšanai Latvijas Biozinātņu un tehnoloģiju universitātes Inženierzinātņu un informācijas tehnoloģiju fakultātē.

## Funkcionalitāte
- Meklēšana pēc vārda, priekšmeta, grāda vai amata
- Dabiskās valodas apstrāde
- Čata interfeiss
- Strukturētu rezultātu izvade

## Tehnoloģijas
- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **AI**: OpenRouter
- **Dati**: JSON

## Instalācija un palaišana

### 1. Backend
```bash
cd backend
npm install
echo "DEEPSEEK_API_KEY=jūsu_atslēga" > .env
node server.js
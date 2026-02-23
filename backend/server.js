const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const app = express();

//KONFIGURĀCIJA 
const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

//MIDDLEWARE 
//Iestatām CORS (Cross-Origin Resource Sharing) drošības politiku
app.use(cors({
  origin: '*',  // Atļaujam piekļuvi no visiem avotiem (izstrādes laikā)
  methods: ['GET', 'POST', 'OPTIONS'],  // Atļautās HTTP metodes
  allowedHeaders: ['Content-Type', 'Authorization'],  // Atļautie galvenes
  credentials: false  // Nav nepieciešamas autentifikācijas dati
}));
app.use(express.json());  // Ļauj apstrādāt JSON datus pieprasījumos
app.use(express.urlencoded({ extended: true }));  // Ļauj apstrādāt URL kodētus datus

//DATU IELĀDE 
/**
 * Funkcija pasniedzēju datu ielādei no JSON faila
 * @returns {Promise<Array>} Pasniedzēju saraksts
 */
async function loadTeachersData() {
  try {
    // Nosaka datu faila ceļu
    const dataPath = path.join(__dirname, 'teachers.json');
    // Nolasa faila saturu
    const data = await fs.readFile(dataPath, 'utf8');
    // Pārveido JSON tekstu par JavaScript objektu
    return JSON.parse(data);
  } catch (error) {
    console.error('Kļūda ielādējot pasniedzēju datus:', error.message);
    return [];  // Atgriež tukšu masīvu kļūdas gadījumā
  }
}

//AI APSTRĀDE (OPENROUTER) 
/**
 * Funkcija lietotāja vaicājuma apstrādei ar AI
 * @param {string} userQuery - Lietotāja meklēšanas vaicājums
 * @returns {Promise<string>} - AI ģenerētie atslēgvārdi
 */
async function processWithAI(userQuery) {
  // Pārbauda vai AI API atslēga ir pieejama
  if (!OPENROUTER_API_KEY) {
    console.log('AI NAV pieejams, izmantoju viedu meklēšanu');
    return extractSmartKeywords(userQuery);  // Izmanto alternatīvu metodi
  }
  
  try {
    console.log(`AI apstrādā: "${userQuery}"`);
    
    // Nosūta pieprasījumu uz OpenRouter API
    const response = await axios.post(
      OPENROUTER_URL,
      {
        model: "google/gemini-2.0-flash-exp:free",  // Izmantotais AI modelis
        messages: [
          {
            role: "system",  // Sistēmas ziņojums - instrukcijas AI
            content: `Tu esi LBTU pasniedzēju meklēšanas asistents. 
             
Datu bāzē ir šādi lauki:
- name (vārds)
- degree (akadēmiskais grāds: Dr., Mg., Bc., PhD, Dr. sc. ing., Dr. math., Dr. paed.)
- position (amats: profesors, docents, lektors, pasniedzējs, pētnieks)
- department (nodaļa: Datoru sistēmu institūts, Matemātikas institūts utt.)
- courses (kursi: matemātika, programmēšana, fizika utt.)
- research (pētniecības joma)

Uzdevums: PĀRTAIDĪT lietotāja vaicājumu MEKLĒŠANAS ATSLĒGVĀRDIEM, kas atbilst datu bāzes saturam.

PĀRTAIDES PIEMĒRI:
• "atrod man visus maģistrus" → "Mg., maģistrs"
• "pasniedzēji ar doktora grādu" → "Dr., PhD, Dr. sc. ing."
• "visi profesori" → "profesors"
• "lektori matemātikā" → "lektors, matemātika"
• "kurš māca programmēšanu?" → "programmēšana"
• "pasniedzēji Datoru sistēmu institūtā" → "Datoru sistēmu"
• "docenti ar PhD" → "docents, PhD"
• "visi ar maģistra grādu" → "Mg."
• "bachelor grāda pasniedzēji" → "Bc."
• "pasniedzēji bez akadēmiskā grāda" → "" (tukšs)
• "profesori fizikas nodaļā" → "profesors, fizika"

SVARĪGI: 
1. Izmanto vārdus, kas Faktiski atrodas datu bāzē
2. Pārtaidi jautājumu uz konkrētiem datu bāzes laukiem
3. Atgriezt TIKAI atslēgvārdus, atdalītus ar komatu
4. Maksimums 5 atslēgvārdi

VAICĀJUMS: "${userQuery}"

ATBILDE (TIKAI ATSLĒGVĀRDI):`
          },
          {
            role: "user",  // Lietotāja ziņojums - faktiskais vaicājums
            content: userQuery
          }
        ],
        max_tokens: 100,  // Maksimālais atbildes garums
        temperature: 0.3  // Atbildes radošuma līmenis (zemāks = precīzāks)
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,  // Autentifikācijas galvene
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'LBTU Teacher Search AI'
        },
        timeout: 10000  // Maksimālais gaidīšanas laiks (10 sekundes)
      }
    );
    
    // Izvelk AI atbildi
    const aiKeywords = response.data.choices[0]?.message?.content || userQuery;
    
    // Tīra atbildi no nevajadzīgām rakstzīmēm
    const cleanText = aiKeywords
      .replace(/^["']|["']$/g, '')  // Noņem liekās pēdiņas sākumā/beigās
      .replace(/\.$/g, '')  // Noņem punktu beigās
      .replace(/\n/g, ', ')  // Aizstāj jaunas rindas ar komatiem
      .replace(/,+/g, ',')  // Noņem liekos komatus
      .trim();  // Noņem atstarpes sākumā/beigās
    
    console.log(`AI atslēgvārdi: "${cleanText}"`);
    
    // Ja atslēgvārdi ir tukši, izmanto alternatīvu metodi
    if (!cleanText || cleanText.trim() === '') {
      return extractSmartKeywords(userQuery);
    }
    
    return cleanText;
    
  } catch (error) {
    console.error('AI kļūda:', error.response?.data?.error?.message || error.message);
    return extractSmartKeywords(userQuery);  // Izmanto alternatīvu kļūdas gadījumā
  }
}

//VIEĻA ATSLĒGVĀRDU IZVILKŠANA 
/**
 * Alternatīva metode atslēgvārdu izvilkšanai bez AI
 * @param {string} query - Lietotāja vaicājums
 * @returns {string} - Izvilkto atslēgvārdu virkne
 */
function extractSmartKeywords(query) {
  const normalized = query.toLowerCase();  // Pārveido uz mazajiem burtiem
  
  //Garantētas atbilstības bieži izmantotiem pieprasījumiem
  if (normalized.includes('maģistr') || normalized.includes('magistr')) {
    return "Mg., maģistrs";
  }
  if (normalized.includes('doktor') || normalized.includes('dr.') || normalized.includes('phd')) {
    return "Dr., PhD, doktors";
  }
  if (normalized.includes('bakalaur') || normalized.includes('bc.')) {
    return "Bc., bakalaurs";
  }
  if (normalized.includes('profesor')) {
    return "profesors";
  }
  if (normalized.includes('docen')) {
    return "docents";
  }
  if (normalized.includes('lektor')) {
    return "lektors";
  }
  if (normalized.includes('matemātik')) {
    return "matemātika";
  }
  if (normalized.includes('programmēšan')) {
    return "programmēšana";
  }
  if (normalized.includes('fizik')) {
    return "fizika";
  }
  if (normalized.includes('informātik')) {
    return "informātika";
  }
  
  // Vispārējā loģika - sadala vaicājumu vārdos
  const words = normalized.split(/\s+/).filter(w => w.length > 2);
  
  // Saraksts ar vārdiem, kurus ignorēt
  const ignoreWords = [
    'atrod', 'parādīt', 'lūdzu', 'visus', 'vai', 'kurš', 'kāds',
    'kā', 'kāpēc', 'es', 'tu', 'mēs', 'jūs', 'viņš', 'viņa',
    'gribu', 'vēlos', 'varu', 'vari', 'var', 'ir', 'bija', 'būs',
    'man', 'pasniedzējus', 'pasniedzēji', 'pasniedzēja'
  ];
  
  // Atlasa tikai nozīmīgos vārdus
  const meaningfulWords = words
    .filter(w => !ignoreWords.includes(w))  // Noņem ignorējamos vārdus
    .filter(w => w.length > 2)  // Atstāj tikai garākus vārdus
    .slice(0, 3);  // Ierobežo līdz 3 vārdiem
  
  return meaningfulWords.join(', ') || query;  // Atgriež atslēgvārdus vai oriģinālo vaicājumu
}

//UZLABOTĀ MEKLĒŠANAS FUNKCIJA
/**
 * Uzlabota meklēšanas funkcija pasniedzēju datu bāzē
 * @param {Array} teachers - Pasniedzēju masīvs
 * @param {string} query - Meklēšanas vaicājums vai atslēgvārdi
 * @returns {Array} - Atfiltrētie un sakārtotie pasniedzēji
 */
function enhancedSearch(teachers, query) {
  if (!query || query.trim() === '') return teachers;  // Atgriež visus, ja vaicājums tukšs
  
  // Sadala vaicājumu atslēgvārdos
  const keywords = query
    .split(',')  // Sadala pa komatiem
    .map(k => k.trim())  // Noņem atstarpes
    .filter(k => k.length > 0)  // Noņem tukšos
    .map(k => k.toLowerCase());  // Pārveido uz mazajiem burtiem
  
  console.log(`Meklē pēc atslēgvārdiem: "${keywords.join('", "')}"`);
  
  if (keywords.length === 0) return teachers;  // Atgriež visus, ja nav atslēgvārdu
  
  // Filtrē pasniedzējus pēc atslēgvārdiem
  const results = teachers.filter(teacher => {
    // Izveido meklēšanas tekstu no visiem pasniedzēja laukiem
    const searchText = `
      ${teacher.name || ''}
      ${teacher.degree || ''}
      ${teacher.position || ''}
      ${teacher.department || ''}
      ${teacher.research || ''}
      ${Array.isArray(teacher.courses) ? teacher.courses.join(' ') : ''}
      ${teacher.email || ''}
    `.toLowerCase();  // Pārveido uz mazajiem burtiem
    
    // Pārbauda visus atslēgvārdus
    return keywords.every(keyword => {
      if (!keyword) return true;  // Tukšs atslēgvārds vienmēr atbilst
      
      // Speciālas pārbaudes akadēmiskajām pakāpēm
      if (keyword === 'mg.' || keyword === 'mg' || keyword === 'maģistrs') {
        return teacher.degree && teacher.degree.includes('Mg.');
      }
      
      if (keyword === 'dr.' || keyword === 'dr' || keyword === 'doktors' || keyword === 'phd') {
        return teacher.degree && (
          teacher.degree.includes('Dr.') || 
          teacher.degree.includes('PhD') ||
          teacher.degree.toLowerCase().includes('doktors')
        );
      }
      
      if (keyword === 'bc.' || keyword === 'bc' || keyword === 'bakalaurs') {
        return teacher.degree && teacher.degree.includes('Bc.');
      }
      
      // Pārbauda vai atslēgvārds atrodas jebkurā laukā
      if (searchText.includes(keyword)) {
        return true;
      }
      
      // Pārbauda daļējas sakritības (ja atslēgvārds ir no vairākiem vārdiem)
      const keywordParts = keyword.split(' ');
      return keywordParts.some(part => searchText.includes(part));
    });
  });
  
  // Sakārto rezultātus pēc atbilstības (relevances)
  results.sort((a, b) => {
    const scoreA = calculateEnhancedScore(a, keywords);
    const scoreB = calculateEnhancedScore(b, keywords);
    return scoreB - scoreA;  // Dilšā secībā (augstākais punktu skaits vispirms)
  });
  
  console.log(`Atrasti ${results.length} pasniedzēji`);
  return results;
}

/**
 * Aprēķina pasniedzēja atbilstības punktu skaitu
 * @param {Object} teacher - Pasniedzēja objekts
 * @param {Array} keywords - Atslēgvārdu masīvs
 * @returns {number} - Atbilstības punktu skaits
 */
function calculateEnhancedScore(teacher, keywords) {
  let score = 0;
  
  // Pārbauda katru atslēgvārdu
  keywords.forEach(keyword => {
    const kw = keyword.toLowerCase();
    
    // Augsts prioritāte: vārds
    if (teacher.name && teacher.name.toLowerCase().includes(kw)) {
      score += 20;
    }
    
    // Vidējs prioritāte: akadēmiskais grāds un amats
    if (teacher.degree && teacher.degree.toLowerCase().includes(kw)) {
      score += 15;
    }
    if (teacher.position && teacher.position.toLowerCase().includes(kw)) {
      score += 12;
    }
    
    // Zems prioritāte: nodaļa un kursi
    if (teacher.department && teacher.department.toLowerCase().includes(kw)) {
      score += 10;
    }
    if (teacher.courses && Array.isArray(teacher.courses)) {
      const courseMatch = teacher.courses.some(course => 
        course.toLowerCase().includes(kw)
      );
      if (courseMatch) score += 8;
    }
    
    // Papildu punkti precīzām sakritībām ar grādiem
    if (kw === 'mg.' || kw === 'mg') {
      if (teacher.degree && teacher.degree.includes('Mg.')) {
        score += 25;  // Augsts prioritāte maģistriem
      }
    }
    if (kw === 'dr.' || kw === 'dr' || kw === 'phd') {
      if (teacher.degree && (
        teacher.degree.includes('Dr.') || 
        teacher.degree.includes('PhD')
      )) {
        score += 25;  // Augsts prioritāte doktoriem
      }
    }
  });
  
  return score;
}

//API MARŠRUTI 

//SAKUMLAPA (root route)
app.get('/', (req, res) => {
  res.json({
    projekts: 'LBTU Pasniedzēju Meklēšanas AI Asistents',
    versija: '3.1.0',
    statuss: 'aktīvs',
    valoda: 'latviešu',
    aiPiegādātājs: 'OpenRouter',
    aiModelis: 'Gemini 2.0 Flash (bez maksas)',
    aiPieejams: !!OPENROUTER_API_KEY,  // Pārbauda vai AI ir pieejams
    maršruti: {
      meklēt: 'POST /api/search',
      visiPasniedzēji: 'GET /api/teachers',
      statistika: 'GET /api/stats',
      veselība: 'GET /api/health',
      testetAI: 'GET /api/test-ai'
    }
  });
});

//MEKLĒŠANAS MARŠRUTS
app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;  // Izvelk vaicājumu no pieprasījuma ķermeņa
    
    // Pārbauda vai vaicājums ir norādīts
    if (!query || query.trim() === '') {
      return res.status(400).json({
        kļūda: 'Nepilns pieprasījums',
        ziņojums: 'Lūdzu, ievadiet meklēšanas vaicājumu'
      });
    }
    
    console.log(`\n - Saņemts pieprasījums: "${query}"`);
    const teachers = await loadTeachersData();  // Ielādē pasniedzēju datus
    
    //AI apstrāde
    const keywords = await processWithAI(query);
    console.log(` - AI atslēgvārdi: "${keywords}"`);
    
    // Meklēšana ar uzlaboto funkciju
    const results = enhancedSearch(teachers, keywords);
    
    // Formatē rezultātus frontend lietošanai
    const formatētiRezultāti = results.map(teacher => ({
      id: teacher.id,
      vārds: teacher.name,
      amats: teacher.position,
      nodaļa: teacher.department,
      grāds: teacher.degree,
      kursi: teacher.courses || [],
      epasts: teacher.email,
      pētniecība: teacher.research,
      profilaLinks: teacher.profileUrl
    }));
    
    // Nosūta atbildi
    res.json({
      oriģinālaisVaicājums: query,
      apstrādātieAtslēgvārdi: keywords,
      aiLietots: !!OPENROUTER_API_KEY,
      aiPiegādātājs: 'OpenRouter',
      atrastieSkaits: formatētiRezultāti.length,
      rezultāti: formatētiRezultāti,
      laiks: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Meklēšanas kļūda:', error);
    res.status(500).json({
      kļūda: 'Servera kļūda',
      ziņojums: 'Radās tehniskas problēmas, mēģiniet vēlreiz'
    });
  }
});

//AI TESTĒŠANAS MARŠRUTS
app.get('/api/test-ai', async (req, res) => {
  try {
    // Izmanto testa vaicājumu vai noklusējuma vaicājumu
    const testQuery = req.query.query || "atrod man visus maģistrus";
    
    console.log(` - Testē AI ar vaicājumu: "${testQuery}"`);
    const keywords = await processWithAI(testQuery);
    const teachers = await loadTeachersData();
    const results = enhancedSearch(teachers, keywords);
    
    res.json({
      statuss: 'veiksmīgs',
      testaVaicājums: testQuery,
      iegūtieAtslēgvārdi: keywords,
      atrastiePasniedzēji: results.length,
      pasniedzējuVārdi: results.slice(0, 5).map(t => t.name),
      aiSistēma: OPENROUTER_API_KEY ? 'OpenRouter + Gemini 2.0 Flash' : 'Viedā meklēšana (bez AI)',
      aiPieejams: !!OPENROUTER_API_KEY,
      laiks: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({ statuss: 'kļūda', ziņojums: error.message });
  }
});

//VESI PASNIEDZĒJI (visu pasniedzēju saraksts)
app.get('/api/teachers', async (req, res) => {
  try {
    const teachers = await loadTeachersData();
    
    console.log(` /api/teachers: Loading ${teachers.length} teachers`);
    
    // Formatē visus pasniedzējus frontend lietošanai
    const formatētiPasniedzēji = teachers.map(teacher => ({
      id: teacher.id,
      vārds: teacher.name,
      grāds: teacher.degree,
      amats: teacher.position,
      nodaļa: teacher.department,
      kursi: teacher.courses || [],
      epasts: teacher.email || '',
      pētniecība: teacher.research || '',
      profilaLinks: teacher.profileUrl || ''
    }));
    
    res.json({
      kopējaisSkaits: teachers.length,
      pasniedzēji: formatētiPasniedzēji,
      laiks: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(' Error in /api/teachers:', error);
    res.status(500).json({ 
      kļūda: 'Neizdevās ielādēt datus',
      detalizācija: error.message 
    });
  }
});

// STATISTIKAS MARŠRUTS
app.get('/api/stats', async (req, res) => {
  try {
    const teachers = await loadTeachersData();
    
    // Saskaita pasniedzējus pēc akadēmiskajām pakāpēm
    const mgCount = teachers.filter(t => t.degree && t.degree.includes('Mg.')).length;
    const drCount = teachers.filter(t => t.degree && (t.degree.includes('Dr.') || t.degree.includes('PhD'))).length;
    const bcCount = teachers.filter(t => t.degree && t.degree.includes('Bc.')).length;
    const otherCount = teachers.length - mgCount - drCount - bcCount;
    
    // Saskaita pasniedzējus pēc nodaļām
    const departmentStats = {};
    teachers.forEach(teacher => {
      const dept = teacher.department || 'Nav norādīts';
      departmentStats[dept] = (departmentStats[dept] || 0) + 1;
    });
    
    // Sagatavo statistiku
    const stats = {
      kopāPasniedzēju: teachers.length,
      grāduSadalījums: {
        'Maģistri (Mg.)': mgCount,
        'Doktori (Dr./PhD)': drCount,
        'Bakalauri (Bc.)': bcCount,
        'Citi/bez grāda': otherCount
      },
      nodaļas: Object.entries(departmentStats)
        .sort((a, b) => b[1] - a[1])  // Sakārto dilstošā secībā
        .slice(0, 10),  // Ņem tikai top 10 nodaļas
      arAI: !!OPENROUTER_API_KEY,
      apraksts: 'LBTU pasniedzēju datu bāzes statistika',
      atjaunots: new Date().toISOString()
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ kļūda: 'Statistikas kļūda' });
  }
});

//VESELĪBAS PĀRBAUDES MARŠRUTS
app.get('/api/health', async (req, res) => {
  try {
    const teachers = await loadTeachersData();
    const mgCount = teachers.filter(t => t.degree && t.degree.includes('Mg.')).length;
    const drCount = teachers.filter(t => t.degree && (t.degree.includes('Dr.') || t.degree.includes('PhD'))).length;
    const bcCount = teachers.filter(t => t.degree && t.degree.includes('Bc.')).length;
    
    res.json({
      statuss: 'Vesels',
      sistēma: 'LBTU AI Asistents',
      versija: '3.1.0',
      laiks: new Date().toISOString(),
      pasniedzējuSkaits: teachers.length,
      statistika: {
        maģistri: mgCount,
        doktori: drCount,
        bakalauri: bcCount,
        citi: teachers.length - mgCount - drCount - bcCount
      },
      aiKonfigurēts: !!OPENROUTER_API_KEY,
      atmiņa: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
      darbībasLaiks: `${Math.floor(process.uptime() / 60)} minūtes`
    });
  } catch (error) {
    res.status(500).json({
      statuss: 'Kļūda',
      kļūda: error.message
    });
  }
});

//SERVERA PALEIŠANA 
app.listen(PORT, async () => {
  // Sagatavo mainīgos statistikai
  let teachers = [];
  let totalTeachers = 0;
  let mgCount = 0;
  let drCount = 0;
  let bcCount = 0;
  
  try {
    // Ielādē datus un aprēķina statistiku
    teachers = await loadTeachersData();
    totalTeachers = teachers.length;
    mgCount = teachers.filter(t => t.degree && t.degree.includes('Mg.')).length;
    drCount = teachers.filter(t => t.degree && (t.degree.includes('Dr.') || t.degree.includes('PhD'))).length;
    bcCount = teachers.filter(t => t.degree && t.degree.includes('Bc.')).length;
  } catch (error) {
    console.error('Nevarēja ielādēt pasniedzēju datus');
  }
  
  // Rāda starta ekrānu konsolē
  console.log(`
      LBTU PASNIEDZĒJU MEKLĒŠANAS AI ASISTENTS    
                    VERSIJA 3.1.0                       
  
  Serveris darbojas: http://localhost:${PORT}
  AI Sistēma: ${OPENROUTER_API_KEY ? ' OpenRouter + Gemini 2.0 Flash' : 'NAV AI (tikai viedā meklēšana)'}
  Uzlabotā meklēšana:  Iespējota
  
   API pieejams:
     • http://localhost:${PORT}/              - Sākumlapa
     • http://localhost:${PORT}/api/search    - Meklēt pasniedzējus (POST)
     • http://localhost:${PORT}/api/teachers  - Visi pasniedzēji
     • http://localhost:${PORT}/api/test-ai   - Pārbaudīt AI
     • http://localhost:${PORT}/api/health    - Sistēmas statuss
  
   Testa vaicājumi:
     • "atrod man visus maģistrus"
     • "pasniedzēji ar doktora grādu" 
     • "visi profesori"
     • "lektori matemātikā"
     • "programmēšanas pasniedzēji"
  
  ${!OPENROUTER_API_KEY ? `
   AI IESLĒGŠANAS PAMĀCIBA:
  1. Iegūstiet BEZMAKSAS API atslēgu:
     - Atveriet: https://openrouter.ai/
     - Reģistrējieties (Google vai GitHub)
     - Noklikšķiniet uz "API Keys" augšējā labajā stūrī
     - Nospiediet "Create Key"
     - Kopējiet atslēgu (sākas ar "sk-or-")
     
  2. Pievienojiet atslēgu failā backend/.env:
        OPENROUTER_API_KEY=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
        
  3. Pārstartējiet serveri
  4. AI tagad strādās! 
  ` : ' OpenRouter AI konfigurēts un gatavs lietošanai!'}
  
  `);
  
  // Rāda statistiku
  console.log(` Datu bāzē: ${totalTeachers} pasniedzēju profili`);
  
  if (totalTeachers > 0) {
    console.log(` Statistika pēc grādiem:`);
    console.log(`   • Maģistri (Mg.): ${mgCount}`);
    console.log(`   • Doktori (Dr./PhD): ${drCount}`);
    console.log(`   • Bakalauri (Bc.): ${bcCount}`);
    console.log(`   • Citi/bez grāda: ${totalTeachers - mgCount - drCount - bcCount}`);
    
    // Papildu statistika par nodaļām
    const departments = [...new Set(teachers.map(t => t.department).filter(Boolean))];
    if (departments.length > 0) {
      console.log(`\n  Nodaļas: ${departments.length}`);
      departments.slice(0, 3).forEach(dept => {
        const deptCount = teachers.filter(t => t.department === dept).length;
        console.log(`   • ${dept}: ${deptCount} pasniedzēji`);
      });
      if (departments.length > 3) {
        console.log(`   • ... un vēl ${departments.length - 3} nodaļas`);
      }
    }
  } else {
    console.error(' Datu bāze ir tukša!');
  }
  
  console.log(`\n  Serveris ir gatavs darbam!`);
});

//TĪRA IZIEŠANA 
// Apstrādā Ctrl+C (SIGINT) signālu, lai droši izslēgtu serveri
process.on('SIGINT', () => {
  console.log('\n Serveris tiek droši izslēgts...');
  process.exit(0);  // Iziet ar veiksmīgas beigas kodu
});
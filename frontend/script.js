//GLOBĀLĀS FUNKCIJAS (ĀRĀS NO KLASES) 

// Atslēgvārdu vārdnīca akadēmiskajām pakāpēm un amatiem
// Katrai kategorijai ir atslēgvārdu saraksts meklēšanai
const DEGREE_KEYWORDS = {
  'maģistrs': ['Mg.', 'maģistrs', 'mg.', 'mag.'],  // Maģistra grāda varianti
  'doktors': ['Dr.', 'PhD', 'doktors', 'dr.'],     // Doktora grāda varianti
  'bakalaurs': ['Bc.', 'bakalaurs', 'bc.'],         // Bakalaura grāda varianti
  'profesors': ['profesors', 'profesora'],          // Profesora amata varianti
  'docents': ['docents', 'docent'],                 // Docenta amata varianti
  'lektors': ['lektors', 'lektor']                  // Lektora amata varianti
};

/**
 * Funkcija bot atbildes formatēšanai lietotājam draudzīgā formātā
 * @param {string} query - Lietotāja meklēšanas vaicājums
 * @param {Object} data - Servera atgrieztie meklēšanas dati
 * @returns {string} - Formatēta teksta atbilde
 */
function formatBotResponse(query, data) {
  // Izvelk datus no servera atbildes
  const count = data.atrastieSkaits || 0;      // Atrasto pasniedzēju skaits
  const keywords = data.apstrādātieAtslēgvārdi || '';  // AI ģenerētie atslēgvārdi
  const aiUsed = data.aiLietots;               // Vai tika izmantots AI
  
  let message = '';  // Sagatavo tukšu ziņu
  
  // Ja atrasti pasniedzēji
  if (count > 0) {
    message = `Atradu ${count} pasniedzēju(s) pēc vaicājuma "${query}".\n\n`;
    
    // Pievieno meklēšanas detaļas
    if (keywords) {
      message += `**Meklēšanas atslēgvārdi:** ${keywords}\n`;
    }
    
    if (aiUsed) {
      message += ` **AI izmantots:** Jā (OpenRouter)\n`;
    }
    
    // Pievieno konteksta padomu atkarībā no vaicājuma
    if (query.toLowerCase().includes('maģistr')) {
      message += `\n *Meklēju pasniedzējus ar akadēmisko grādu "Mg." (maģistrs)*`;
    } else if (query.toLowerCase().includes('doktor') || query.toLowerCase().includes('phd') || query.toLowerCase().includes('dr.')) {
      message += `\n *Meklēju pasniedzējus ar akadēmisko grādu "Dr." vai "PhD" (doktors)*`;
    } else if (query.toLowerCase().includes('bakalaur')) {
      message += `\n *Meklēju pasniedzējus ar akadēmisko grādu "Bc." (bakalaurs)*`;
    }
    
  } else {
    // Ja nav atrasti pasniedzēji
    message = `Diemžēl nevarēju atrast pasniedzējus pēc vaicājuma "${query}".\n\n`;
    message += `**Ieteikumi:**\n`;
    message += `• Pārfrāzējiet vaicājumu (piemēram, "maģistri" → "pasniedzēji ar maģistra grādu")\n`;
    message += `• Izmantojiet konkrētākus aprakstus\n`;
    message += `• Meklējiet pēc priekšmeta (piemēram, "matemātika", "programmēšana")\n`;
    message += `• Meklējiet pēc amata (piemēram, "profesors", "docents", "lektors")\n\n`;
    
    // Parāda, kādi atslēgvārdi tika izmantoti
    if (keywords) {
      message += ` **Mēģināju meklēt pēc:** ${keywords}`;
    }
  }
  
  return message;  // Atgriež gatavo ziņu
}

//TEACHERSEARCHAPP KLASE (PRETENDĒŠANAS APLIKĀCIJAS KLASE) 

/**
 * Galvenā klase, kas pārvalda visu pasniedzēju meklēšanas aplikāciju
 * Šī klase apvieno čata interfeisu, meklēšanu un rezultātu attēlošanu
 */
class TeacherSearchApp {
    /**
     * Konstruktors inicializē aplikāciju un saistījumus ar HTML elementiem
     */
    constructor() {
        // API servera bāzes adrese (backends darbojas uz localhost:3000)
        this.API_BASE_URL = 'http://localhost:3000/api';
        
        // HTML elementu saistīšana ar JavaScript mainīgajiem
        this.chatMessages = document.getElementById('chatMessages');  // Čata ziņu konteiners
        this.userInput = document.getElementById('userInput');        // Lietotāja ievades lauks
        this.sendButton = document.getElementById('sendButton');      // Sūtīšanas poga
        this.teachersList = document.getElementById('teachersList');  // Pasniedzēju saraksta konteiners
        this.resultsCount = document.getElementById('resultsCount');  // Rezultātu skaitītājs
        this.searchInfo = document.getElementById('searchInfo');      // Meklēšanas informācijas panelis
        this.apiStatus = document.getElementById('apiStatus');        // API statusa indikators
        this.totalTeachers = document.getElementById('totalTeachers'); // Kopējā pasniedzēju skaita indikators
        this.aiStatus = document.getElementById('aiStatus');          // AI statusa indikators
        
        this.init();  // Palaiž aplikācijas inicializāciju
    }
    
    /**
     * Inicializē aplikāciju - pievieno notikumu klausītājus un ielādē datus
     */
    async init() {
        // Notikumu klausītāju pievienošana
        this.sendButton.addEventListener('click', () => this.sendMessage());  // Sūtīšanas pogas klikšķis
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();  // Enter taustiņš ievades laukā
        });
        
        // Ātrās darbības pogu apstrāde
        document.querySelectorAll('.quick-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const query = e.target.getAttribute('data-query');  // Iegūst vaicājumu no pogas
                this.userInput.value = query;  // Ievieto vaicājumu ievades laukā
                
                //ĪPAŠA APSTRĀDE "VISI PASNIEDZĒJI" VAICĀJUMAM
                if (query === "Parādiet visus pasniedzējus" || 
                    query === "Visi pasniedzēji" ||
                    query.toLowerCase().includes('visus pasniedzējus')) {
                    this.loadAllTeachersDirectly();  // Izmanto tiešo ielādi bez AI
                } else {
                    this.sendMessage();  // Parastā meklēšana
                }
            });
        });
        
        // Sistēmas informācijas ielāde
        await this.checkSystemStatus();  // Pārbauda servera savienojumu
        await this.loadAllTeachers();    // Ielādē kopējo pasniedzēju skaitu
        
        // Sākotnējo vērtību iestatīšana
        this.resultsCount.textContent = '0';  // Parāda 0 rezultātus sākumā
    }
    
    /**
     * Pārbauda vai API serveris darbojas un atjauno statusa indikatoru
     */
    async checkSystemStatus() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/health`);
            const data = await response.json();
            
            // Atjauno statusa indikatoru ar zaļu krāsu
            this.apiStatus.textContent = ' Darbojas';
            this.apiStatus.style.color = '#10b981ff';
            
        } catch (error) {
            console.error('Error checking system status:', error);
            // Atjauno statusa indikatoru ar sarkanu krāsu
            this.apiStatus.textContent = ' Nav pieejams';
            this.apiStatus.style.color = '#ef4444';
        }
    }
    
    /**
     * Ielādē kopējo pasniedzēju skaitu no API
     */
    async loadAllTeachers() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/teachers`);
            const data = await response.json();
            
            // Parāda kopējo pasniedzēju skaitu vai izmanto noklusējuma vērtību
            this.totalTeachers.textContent = data.kopējaisSkaits || data.pasniedzēji?.length || '137';
            
        } catch (error) {
            console.error('Error loading teachers:', error);
            this.totalTeachers.textContent = '137'; // Noklusējuma vērtība, ja neizdodas ielādēt
        }
    }
    
    // JAUNS METODS: VISU PASNIEDZĒJU IELĀDE BEZ AI 
    /**
     * Ielādē visus pasniedzējus tieši no API, neizmantojot AI meklēšanu
     * Šī ir optimizēta metode "visu pasniedzēju" vaicājumam
     */
    async loadAllTeachersDirectly() {
        const query = "Parādiet visus pasniedzējus";
        
        // Notīra ievades lauku
        this.userInput.value = '';
        
        // Pievieno lietotāja ziņu čatā
        this.addUserMessage(query);
        
        // Parāda ielādes indikatoru
        const loadingId = this.showLoading();
        
        try {
            console.log('Loading ALL teachers directly from /api/teachers');
            
            // Nosūta pieprasījumu tieši uz /api/teachers (bez /search maršruta)
            const response = await fetch(`${this.API_BASE_URL}/teachers`);
            const data = await response.json();
            
            // Noņem ielādes indikatoru
            this.removeLoading(loadingId);
            
            // Pārbauda vai ir dati
            if (!data.pasniedzēji || data.pasniedzēji.length === 0) {
                this.addBotMessage('Datu bāzē nav neviena pasniedzēja.');
                return;
            }
            
            console.log(`Loaded ${data.pasniedzēji.length} teachers from API`);
            
            // Formatē datus tāpat kā meklēšanas atbilde
            const searchData = {
                oriģinālaisVaicājums: query,
                apstrādātieAtslēgvārdi: "visi pasniedzēji",
                aiLietots: false,
                aiPiegādātājs: 'Direct API',
                atrastieSkaits: data.pasniedzēji.length,
                rezultāti: data.pasniedzēji,
                laiks: new Date().toISOString()
            };
            
            // Pievieno bot atbildi
            const botMessage = `Ielādēju **${data.pasniedzēji.length}** pasniedzējus no datu bāzes.\n\n`;
            this.addBotMessage(botMessage);
            
            // Parāda rezultātus
            this.displayResults(searchData);
            this.showSearchInfo(searchData);
            
            // Atjauno rezultātu skaitītāju
            this.resultsCount.textContent = data.pasniedzēji.length || '0';
            
        } catch (error) {
            console.error('Error loading all teachers:', error);
            this.removeLoading(loadingId);
            this.addBotMessage('Atvainojiet, radās kļūda ielādējot visus pasniedzējus.');
        }
    }
    
    /**
     * Apstrādā un nosūta lietotāja vaicājumu uz serveri
     */
    async sendMessage() {
        const query = this.userInput.value.trim();
        if (!query) return;  // Ja vaicājums tukšs, neko nedara
        
        // Notīra ievades lauku
        this.userInput.value = '';
        
        // Pievieno lietotāja ziņu čatā
        this.addUserMessage(query);
        
        // Parāda ielādes indikatoru
        const loadingId = this.showLoading();
        
        try {
            // Nosūta meklēšanas pieprasījumu uz serveri
            const response = await fetch(`${this.API_BASE_URL}/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query })  // Nosūta vaicājumu JSON formātā
            });
            
            const data = await response.json();
            
            // Noņem ielādes indikatoru
            this.removeLoading(loadingId);
            
            // Pārbauda vai serveris atgrieza kļūdu
            if (data.kļūda) {
                this.addBotMessage(`Kļūda: ${data.ziņojums || data.kļūda}`);
                this.showSearchInfo(data);
                return;
            }
            
            // Pievieno bot atbildi, izmantojot globālo formatēšanas funkciju
            const botMessage = formatBotResponse(query, data);
            this.addBotMessage(botMessage);
            
            // Parāda meklēšanas rezultātus
            this.displayResults(data);
            this.showSearchInfo(data);
            
            // Atjauno rezultātu skaitītāju
            this.resultsCount.textContent = data.atrastieSkaits || '0';
            
        } catch (error) {
            console.error('Error:', error);
            this.removeLoading(loadingId);
            this.addBotMessage('Atvainojiet, radās kļūda meklēšanas laikā. Pārbaudiet vai serveris darbojas (localhost:3000).');
            this.showError('Nevarēju pieslēgties serverim.');
        }
    }
    
    //ČATA ZIŅU PĀRVALDĪBAS METODI 
    
    /**
     * Pievieno lietotāja ziņu čatā
     * @param {string} text - Lietotāja ziņas teksts
     */
    addUserMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user';  // CSS klase lietotāja ziņai
        
        // Izveido avataru ar cilvēka ikonu
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'avatar';
        avatarDiv.innerHTML = '<i class="fas fa-user"></i>';
        
        // Izveido ziņas satura daļu
        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        
        const textP = document.createElement('p');
        textP.className = 'text';
        textP.textContent = text;
        contentDiv.appendChild(textP);
        
        // Savieno visas daļas
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        
        // Pievieno ziņu čata konteinerim
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();  // Ritina uz leju, lai redzētu jauno ziņu
    }
    
    /**
     * Pievieno bot atbildi čatā ar formatētu tekstu
     * @param {string} text - Bot atbildes teksts
     */
    addBotMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot';  // CSS klase bot ziņai
        
        // Izveido avataru ar robot ikonu
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'avatar';
        avatarDiv.innerHTML = '<i class="fas fa-robot"></i>';
        
        // Izveido ziņas satura daļu
        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        
        const senderP = document.createElement('p');
        senderP.className = 'sender';
        senderP.textContent = 'LBTU AI Asistents';  // Sūtītāja vārds
        
        const textP = document.createElement('p');
        textP.className = 'text';
        
        // Formatē tekstu ar rindu pārtraukumiem un veidnes
        text.split('\n').forEach(line => {
            if (line.trim()) {
                const lineSpan = document.createElement('span');
                lineSpan.style.display = 'block';
                lineSpan.style.marginBottom = '0.5rem';
                
                // Formatē **teksts** kā treknu tekstu
                // Formatē *teksts* kā slīpu tekstu
                let formattedLine = line;
                formattedLine = formattedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                formattedLine = formattedLine.replace(/\*(.*?)\*/g, '<em>$1</em>');
                
                lineSpan.innerHTML = formattedLine;
                textP.appendChild(lineSpan);
            }
        });
        
        contentDiv.appendChild(senderP);
        contentDiv.appendChild(textP);
        
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();  // Ritina uz leju
    }
    
    /**
     * Parāda ielādes indikatoru čatā
     * @returns {string} - Ielādes elementa ID
     */
    showLoading() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot loading';
        messageDiv.id = 'loadingMessage';  // Unikāls ID, lai vēlāk noņemt
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'avatar';
        avatarDiv.innerHTML = '<i class="fas fa-robot"></i>';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        
        const senderP = document.createElement('p');
        senderP.className = 'sender';
        senderP.textContent = 'LBTU AI Asistents';
        
        const textP = document.createElement('p');
        textP.className = 'text';
        textP.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Meklē pasniedzējus...';  // Rotējoša ikona
        
        contentDiv.appendChild(senderP);
        contentDiv.appendChild(textP);
        
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
        
        return 'loadingMessage';  // Atgriež ID, lai varētu noņemt
    }
    
    /**
     * Noņem ielādes indikatoru pēc ID
     * @param {string} id - Ielādes elementa ID
     */
    removeLoading(id) {
        const loadingElement = document.getElementById(id);
        if (loadingElement) {
            loadingElement.remove();  // Izdzēš elementu no DOM
        }
    }
    
    //MEKLĒŠANAS REZULTĀTU ATTIĒLOŠANAS METODI 
    
    /**
     * Parāda detalizētu meklēšanas informāciju labajā panelī
     * @param {Object} data - Meklēšanas dati no servera
     */
    showSearchInfo(data) {
        const aiUsed = data.aiLietots ? 'Jā' : 'Nē';  // Formātē AI statusu
        const time = data.laiks ? new Date(data.laiks).toLocaleTimeString('lv-LV') : new Date().toLocaleTimeString('lv-LV');
        const keywords = data.apstrādātieAtslēgvārdi || 'Nav';
        
        // Izveido HTML struktūru meklēšanas informācijai
        this.searchInfo.innerHTML = `
            <div class="search-summary">
                <h3><i class="fas fa-search"></i> Meklēšanas informācija</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Vaicājums:</span>
                        <span class="info-value">${data.oriģinālaisVaicājums || 'Nav'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Atslēgvārdi:</span>
                        <span class="info-value">${keywords}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">AI izmantots:</span>
                        <span class="info-value">${aiUsed}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Laiks:</span>
                        <span class="info-value">${time}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Attēlo meklēšanas rezultātus pasniedzēju saraksta formā
     * @param {Object} data - Meklēšanas dati no servera
     */
    displayResults(data) {
        // Notīra iepriekšējos rezultātus
        this.teachersList.innerHTML = '';
        
        const resultsCount = data.atrastieSkaits || 0;
        const results = data.rezultāti || [];
        
        console.log(`Displaying ${results.length} teachers (count: ${resultsCount})`);  // Atkļūdošanas informācija
        
        // Ja nav rezultātu, parāda "nav atrasts" ekrānu
        if (resultsCount === 0 || results.length === 0) {
            this.showNoResults();
            return;
        }
        
        // Pievieno virsrakstu ar rezultātu skaitu
        const titleDiv = document.createElement('div');
        titleDiv.className = 'results-title';
        titleDiv.innerHTML = `<h3><i class="fas fa-users"></i> Atrasti ${results.length} pasniedzēji:</h3>`;
        this.teachersList.appendChild(titleDiv);
        
        // Pievieno katram pasniedzējam atsevišķu karti
        results.forEach(teacher => {
            const teacherCard = this.createTeacherCard(teacher);
            this.teachersList.appendChild(teacherCard);
        });
        
        // Atjauno rezultātu skaitītāju virsrakstā
        this.resultsCount.textContent = results.length;
    }
    
    /**
     * Izveido vienas pasniedzēja karti HTML elementā
     * @param {Object} teacher - Pasniedzēja dati
     * @returns {HTMLElement} - Pasniedzēja kartes HTML elements
     */
    createTeacherCard(teacher) {
        const card = document.createElement('div');
        card.className = 'teacher-card';
        
        // Sagatavo kursu tagus (mazas birciņas ar kursu nosaukumiem)
        const courses = teacher.kursi || [];
        const courseTags = courses.length > 0 
            ? courses.map(course => `<span class="course-tag">${course}</span>`).join('')
            : '<span class="course-tag">Nav informācijas par kursiem</span>';
        
        // Formatē visus pasniedzēja datus, izmantojot noklusējuma vērtības
        const research = teacher.pētniecība || 'Nav norādīts';
        const email = teacher.epasts || 'Nav norādīts';
        const degree = teacher.grāds || 'Nav norādīts';
        const position = teacher.amats || 'Nav norādīts';
        const department = teacher.nodaļa || 'Nav norādīts';
        const name = teacher.vārds || 'Nav norādīts';
        const id = teacher.id || '';
        
        // Izveido kartes HTML struktūru
        card.innerHTML = `
            <div class="teacher-header">
                <div class="teacher-name">${name}</div>
                <div class="teacher-degree">${degree}</div>
            </div>
            
            <div class="teacher-position">${position}</div>
            <div class="teacher-department"><i class="fas fa-building"></i> ${department}</div>
            
            <div class="teacher-details">
                <div class="detail">
                    <span class="detail-label"><i class="fas fa-flask"></i> Pētniecība:</span>
                    <span class="detail-value">${research}</span>
                </div>
                ${email && email !== 'Nav norādīts' ? `
                <div class="detail">
                    <span class="detail-label"><i class="fas fa-envelope"></i> E-pasts:</span>
                    <span class="detail-value">${email}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="courses">
                <div class="courses-title"><i class="fas fa-book"></i> Pasniedzamie kursi:</div>
                <div class="course-tags">${courseTags}</div>
            </div>
            
            ${teacher.profilaLinks && teacher.profilaLinks !== '' ? `
                <div class="teacher-actions">
                    <a href="${teacher.profilaLinks}" target="_blank" class="profile-btn">
                        <i class="fas fa-external-link-alt"></i> Skatīt pilno profilu
                    </a>
                </div>
            ` : ''}
        `;
        
        return card;
    }
    
    /**
     * Parāda "nav atrasts" ekrānu, ja meklēšana neatgriež rezultātus
     */
    showNoResults() {
        const noResultsDiv = document.createElement('div');
        noResultsDiv.className = 'no-results';
        noResultsDiv.innerHTML = `
            <div class="no-results-icon">
                <i class="fas fa-search"></i>
            </div>
            <h3>Nav atrasts neviens pasniedzējs</h3>
            <p>Mēģiniet:</p>
            <ul>
                <li>Mainīt meklēšanas kritērijus</li>
                <li>Izmantot citus atslēgvārdus</li>
                <li>Pārbaudīt pareizrakstību</li>
            </ul>
        `;
        this.teachersList.appendChild(noResultsDiv);
    }
    
    /**
     * Parāda kļūdas ziņojumu meklēšanas informācijas panelī
     * @param {string} message - Kļūdas ziņojuma teksts
     */
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>${message}</span>
        `;
        this.searchInfo.appendChild(errorDiv);
    }
    
    /**
     * Ritina čata logu uz leju, lai redzētu jaunākās ziņas
     */
    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
}

//APLIKĀCIJAS PALAIŠANA 

// Inicializē aplikāciju, kad visa lapa ir ielādējusies
document.addEventListener('DOMContentLoaded', () => {
    new TeacherSearchApp();  // Izveido jaunu aplikācijas instanci
});
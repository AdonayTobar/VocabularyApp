
/* CONFIG */
const apiKey = "AIzaSyA9IvlGyhI-PMZEOKItkR5US5kFHh3SPLY"; // La IA inyectará esto en tiempo de ejecución
const TEXT_MODEL = "gemini-2.5-flash-preview-09-2025";
const IMAGE_MODEL = "imagen-4.0-generate-001";

/* STATE */
let lists = JSON.parse(localStorage.getItem('vocab_factory_v4')) || [];
let tempGeneratedItems = [];
let currentListId = null;
let studyQueue = [];
let currentStudyIndex = 0;
let currentStudyListId = null;

/* QUIZ STATE */
let quizQueue = [];
let quizIndex = 0;
let quizErrors = 0;



/* HELPERS */
const getToday = () => new Date().toISOString().split("T")[0];

const save = () => {
    localStorage.setItem('vocab_factory_v4', JSON.stringify(lists));
    updateStatsUI();
};

const updateStatsUI = () => {
    const allItems = lists.flatMap(l => l.items);
    const dueItems = allItems.filter(i => i.nextReview <= getToday());
    const summary = document.getElementById('stats-summary');
    const badge = document.getElementById('badge-due');

    if (summary) summary.textContent = `${allItems.length} TOTAL | ${dueItems.length} PENDIENTES HOY`;
    if (badge) {
        if (dueItems.length > 0) {
            badge.textContent = dueItems.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
};

/* UI CORE */
function showTab(tabId) {
    document.querySelectorAll('[id^="section-"]').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active-tab'));

    document.getElementById(`section-${tabId}`).classList.remove('hidden');
    document.getElementById(`tab-${tabId}`).classList.add('active-tab');

    if (tabId === 'library') {
        document.getElementById('library-main-view').classList.remove('hidden');
        document.getElementById('library-edit-view').classList.add('hidden');
        renderLibrary();
    }
    if (tabId === 'learn' && !currentStudyListId) {
        startStudySession();
    }


    updateStatsUI();
}

/* FACTORY & AI */
/* FACTORY & AI */
async function generateList() {
    const topic = document.getElementById('ai-topic').value.trim();
    if (!topic) return;

    const btnText = document.getElementById('btn-text');
    const loader = document.getElementById('gen-loader');

    btnText.textContent = "Analizando...";
    loader.classList.remove('hidden');

    try {
        const prompt = `
Genera SOLO un objeto JSON válido con la propiedad "items".
"items" debe ser un array de entre 50 y 100 objetos relacionados con el contexto "${topic}" para aprender inglés.

Incluye:
- verbos
- sustantivos
- frases útiles reales
- expresiones comunes del contexto

Cada objeto debe tener EXACTAMENTE esta estructura:
{
  "word": "palabra o frase en inglés",
  "translation": "traducción natural al español",
  "example": "frase corta y realista en inglés usando la palabra",
  "example_translation": "traducción natural al español del ejemplo"
}

No incluyas explicaciones.
No incluyas texto fuera del JSON.
`;


        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.8,
                        responseMimeType: "application/json"
                    }
                })
            }
        );

        const data = await response.json();
        const result = JSON.parse(data.candidates[0].content.parts[0].text);

        tempGeneratedItems = (result.items || []).map(item => ({
            id: crypto.randomUUID(),
            word: item.word,
            translation: item.translation,
            example: item.example,
            example_translation: item.example_translation
        }));


        renderFactoryResults();

    } catch (error) {
        console.error(error);
        openModal(
            "Ups…",
            "No pude generar el vocabulario. Intenta nuevamente.",
            `<button onclick="closeModal()" class="px-6 py-2 bg-slate-100 rounded-xl font-bold">Cerrar</button>`
        );
    } finally {
        btnText.textContent = "Generar con IA";
        loader.classList.add('hidden');
    }
}

function initCardsStudyFromList(listId) {
    const list = lists.find(l => l.id === listId);
    if (!list) return;

    currentStudyListId = listId;

    list.items.forEach(i => {
        if (!i.nextReview) {
            i.nextReview = getToday();
            i.interval = 0;
            i.ease = 2.5;
        }
    });

    studyQueue = [...list.items];
    currentStudyIndex = 0;

    document.getElementById('learn-empty').classList.add('hidden');
    document.getElementById('learn-container').classList.remove('hidden');

    renderCurrentCard();
}




function renderFactoryResults() {
    const container = document.getElementById('result-items');
    document.getElementById('factory-result').classList.remove('hidden');

    container.innerHTML = tempGeneratedItems.map((item, idx) => `
                <div class="word-card flex items-center gap-4 bg-white p-4 rounded-3xl border border-slate-50 shadow-sm">
                    <div class="w-16 h-16 rounded-2xl overflow-hidden shrink-0 img-placeholder border border-slate-100">
                        <img id="temp-img-${idx}" src="${item.image || ''}" class="w-full h-full object-cover ${item.image ? '' : 'hidden'}" onload="this.classList.remove('hidden')">
                    </div>
                    <div>
                        <h5 class="font-bold text-slate-800">${item.word}</h5>
                        <p class="text-xs text-slate-400">${item.translation}</p>
                    </div>
                </div>
            `).join('');

    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function forceFullText(el) {
    el.style.whiteSpace = 'normal';
    el.style.overflow = 'visible';
    el.style.textOverflow = 'unset';
    el.style.maxWidth = '100%';
}


function saveCurrentList() {
    const topic = document.getElementById('ai-topic').value || "Mi Lista";
    lists.unshift({
        id: Date.now().toString(),
        name: topic,
        items: tempGeneratedItems.map(i => ({
            ...i,
            id: Math.random().toString(36).substr(2, 9),
            nextReview: getToday(),
            interval: 0,
            ease: 2.5
        }))
    });
    save();
    tempGeneratedItems = [];
    showTab('library');
}

/* LIBRARY */
function renderLibrary() {
    const container = document.getElementById('library-list');
    if (lists.length === 0) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400 text-sm">No tienes listas aún.</div>`;
        return;
    }
    container.innerHTML = lists.map(l => `
<div class="bg-white p-6 rounded-[2rem] border border-slate-50 shadow-sm flex items-center gap-4 hover:border-indigo-100 transition-all">

    <!-- Info + abrir lista -->
    <div onclick="openListDetails('${l.id}')" class="flex-1 cursor-pointer">
        <h4 class="font-bold text-slate-800 hover:text-indigo-600 transition-colors">
            ${l.name}
        </h4>
        <p class="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-wider">
            ${l.items.length} PALABRAS
        </p>
    </div>

    <!-- Botón estudiar -->
    <button
        onclick="event.stopPropagation(); startStudyFromList('${l.id}')"
        class="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition">
        Estudiar
    </button>

</div>
`).join('');

}

function startStudyFromList(listId) {
    currentStudyListId = listId;
    openStudyModeModal(listId);
}


//js del modal
let pendingStudyListId = null;

function openStudyModeModal(listId) {
    pendingStudyListId = listId;
    document.getElementById('study-mode-modal').classList.remove('hidden');
}

function closeStudyModeModal() {
    pendingStudyListId = null;
    document.getElementById('study-mode-modal').classList.add('hidden');
}

//Inicializar cards
function startCardsStudy() {
    const listId = pendingStudyListId; // 👈 GUARDAR PRIMERO
    closeStudyModeModal();             // 👈 DESPUÉS cerrar

    const list = lists.find(l => l.id === listId);
    if (!list) return;

    currentStudyListId = listId;

    list.items.forEach(i => {
        if (!i.nextReview) {
            i.nextReview = getToday();
            i.interval = 0;
            i.ease = 2.5;
        }
    });

    studyQueue = [...list.items];
    currentStudyIndex = 0;

    showTab('learn');

    document.getElementById('learn-empty').classList.add('hidden');
    document.getElementById('learn-container').classList.remove('hidden');

    renderCurrentCard();
}





//Iniciar quiuz
function startQuizStudy() {
    currentStudyListId = pendingStudyListId; // 👈 PRIMERO
    closeStudyModeModal();                   // 👈 DESPUÉS
    startQuizFromCurrentList();
}


function openListDetails(id) {
    currentListId = id;
    const list = lists.find(l => l.id === id);
    const view = document.getElementById('library-edit-view');
    document.getElementById('library-main-view').classList.add('hidden');
    view.classList.remove('hidden');

    view.innerHTML = `
<div class="flex items-center gap-4 mb-6">
    <button onclick="showTab('library')" class="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-100 shadow-sm text-slate-600">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" stroke-width="3"/></svg>
    </button>

    <h3 onclick="editListName('${list.id}')" class="text-xl font-extrabold text-slate-800 truncate cursor-pointer hover:text-indigo-600">
        ${list.name}
    </h3>

    <button onclick="openAddWordModal()" class="ml-auto w-10 h-10 rounded-2xl bg-indigo-600 text-white font-bold">
        +
    </button>
</div>
                
                <div class="space-y-3">
                    ${list.items.map(i => `
                        <div class="bg-white p-4 rounded-3xl border border-slate-50 flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl overflow-hidden img-placeholder shrink-0">
                                ${i.image ? `<img src="${i.image}" class="w-full h-full object-cover">` : ''}
                            </div>
                            <div class="flex-1">
                                <p class="font-bold text-slate-800 text-sm">${i.word}</p>
                                <p class="text-xs text-slate-400">${i.translation}</p>
                            </div>
                            <button onclick="editWord('${i.id}')" class="text-indigo-400 p-2">
                                Editar
                            </button>
                            <button onclick="deleteWord('${i.id}')" class="text-rose-400 p-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke-width="2"/></svg>
                            </button>
                        </div>
                    `).join('')}
                </div>
                
                <button onclick="deleteList('${list.id}')" class="w-full mt-10 py-4 text-xs font-bold text-rose-500 uppercase tracking-widest bg-rose-50 rounded-2xl">Eliminar Lista Completa</button>
            `;
}

function openAddWordModal() {
    openModal(
        "Agregar palabra o frase",
        `
        <input id="new-word"
            class="w-full p-3 rounded-xl border mb-3"
            placeholder="Palabra o frase en inglés" />

        <input id="new-translation"
            class="w-full p-3 rounded-xl border mb-3"
            placeholder="Traducción al español" />

        <input id="new-example"
            class="w-full p-3 rounded-xl border mb-3"
            placeholder="Ejemplo en inglés" />

        <input id="new-example-translation"
            class="w-full p-3 rounded-xl border"
            placeholder="Traducción del ejemplo al español" />
        `,
        `
        <button onclick="closeModal()" class="px-6 py-3 bg-slate-100 rounded-xl font-bold">
            Cancelar
        </button>
        <button onclick="confirmAddWord()" class="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold">
            Agregar
        </button>
        `
    );
}


function confirmAddWord() {
    const word = document.getElementById('new-word').value.trim();
    const translation = document.getElementById('new-translation').value.trim();
    const example = document.getElementById('new-example').value.trim();
    const exampleTranslation = document.getElementById('new-example-translation').value.trim();

    if (!word || !translation || !example || !exampleTranslation) return;

    const list = lists.find(l => l.id === currentListId);

    list.items.unshift({
        id: crypto.randomUUID(),
        word,
        translation,
        example,
        example_translation: exampleTranslation,

        // 🔑 CLAVE PARA EL REPASO
        nextReview: getToday(),
        interval: 0,
        ease: 2.5
    });

    save();
    closeModal();
    openListDetails(currentListId);
}

function editWord(wordId) {
    const list = lists.find(l => l.id === currentListId);
    const word = list.items.find(i => i.id === wordId);

    openModal(
        "Editar palabra o frase",
        `
        <input id="edit-word"
            class="w-full p-3 rounded-xl border mb-3"
            value="${word.word}" />

        <input id="edit-translation"
            class="w-full p-3 rounded-xl border mb-3"
            value="${word.translation}" />

        <input id="edit-example"
            class="w-full p-3 rounded-xl border mb-3"
            value="${word.example}" />

        <input id="edit-example-translation"
            class="w-full p-3 rounded-xl border"
            value="${word.example_translation}" />
        `,
        `
        <button onclick="closeModal()" class="px-6 py-3 bg-slate-100 rounded-xl font-bold">
            Cancelar
        </button>
        <button onclick="saveEditedWord('${wordId}')" class="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold">
            Guardar
        </button>
        `
    );
}

function saveEditedWord(wordId) {
    const list = lists.find(l => l.id === currentListId);
    const word = list.items.find(i => i.id === wordId);

    word.word = document.getElementById('edit-word').value.trim();
    word.translation = document.getElementById('edit-translation').value.trim();
    word.example = document.getElementById('edit-example').value.trim();
    word.example_translation = document.getElementById('edit-example-translation').value.trim();

    save();
    closeModal();
    openListDetails(currentListId);
}





function deleteWord(wordId) {
    openModal(
        "Eliminar palabra",
        "Esta acción no se puede deshacer.",
        `
        <button onclick="closeModal()" class="px-6 py-3 bg-slate-100 rounded-2xl font-bold">Cancelar</button>
        <button onclick="confirmDeleteWord('${wordId}')" class="px-6 py-3 bg-rose-600 text-white rounded-2xl font-bold">Eliminar</button>
        `
    );
}

function confirmDeleteWord(wordId) {
    const list = lists.find(l => l.id === currentListId);
    list.items = list.items.filter(i => i.id !== wordId);
    save();
    closeModal();
    openListDetails(currentListId);
}


function deleteList(id) {
    openModal(
        "Eliminar lista",
        "Se perderán todas las palabras y el progreso.",
        `
        <button onclick="closeModal()" class="px-6 py-3 bg-slate-100 rounded-2xl font-bold">Cancelar</button>
        <button onclick="confirmDeleteList('${id}')" class="px-6 py-3 bg-rose-600 text-white rounded-2xl font-bold">Eliminar</button>
        `
    );
}

function confirmDeleteList(id) {
    lists = lists.filter(l => l.id !== id);
    save();
    closeModal();
    showTab('library');
}


/* STUDY ENGINE (SM2 Simple) */
function startStudySession() {
    studyQueue = lists.flatMap(l => l.items).filter(i => i.nextReview <= getToday());
    currentStudyIndex = 0;

    if (studyQueue.length === 0) {
        document.getElementById('learn-empty').classList.remove('hidden');
        document.getElementById('learn-container').classList.add('hidden');
    } else {
        document.getElementById('learn-empty').classList.add('hidden');
        document.getElementById('learn-container').classList.remove('hidden');
        renderCurrentCard();
    }
}

function renderCurrentCard() {
    const word = studyQueue[currentStudyIndex];
    const progress = (currentStudyIndex / studyQueue.length) * 100;
    document.getElementById('learn-container').style.overflow = 'visible';


    /* Progress */
    document.getElementById('study-progress-bar').style.width = `${progress}%`;

    /* WORD */
    const wordEl = document.getElementById('word');
    wordEl.textContent = word.word;
    wordEl.className = 'cursor-pointer text-2xl font-extrabold text-slate-800 text-center';
    forceFullText(wordEl);
    wordEl.onclick = () => speakEnglish(word.word);

    /* TRANSLATION (hidden until reveal) */
    const translationEl = document.getElementById('translation');
    translationEl.textContent = word.translation;
    translationEl.classList.add('hidden');
    forceFullText(translationEl);

    /* EXAMPLE */
    const exampleEl = document.getElementById('example');
    const exampleTranslationEl = document.getElementById('example-translation');

    exampleEl.textContent = `"${word.example}"`;
    exampleEl.className = 'cursor-pointer mt-4 text-sm text-slate-600 text-center';
    forceFullText(exampleEl);

    exampleTranslationEl.textContent = word.example_translation;
    exampleTranslationEl.classList.add('hidden');
    forceFullText(exampleTranslationEl);

    exampleEl.onclick = () => {
        speakEnglish(word.example);
        exampleTranslationEl.classList.toggle('hidden');
    };

    /* IMAGE */
    const imgCont = document.getElementById('card-image-container');
    const img = document.getElementById('card-img');

    if (word.image) {
        img.src = word.image;
        imgCont.classList.remove('hidden', 'img-placeholder');
    } else {
        imgCont.classList.add('hidden');
    }

    /* RESET CARD STATE */
    document.getElementById('card-answer').classList.add('hidden');
    document.getElementById('rating-controls').classList.add('hidden');
    document.getElementById('tap-hint').classList.remove('hidden');
    document.getElementById('click-overlay').classList.remove('hidden');
}



function revealCard() {
    document.getElementById('card-answer').classList.remove('hidden');
    document.getElementById('translation').classList.remove('hidden'); // 👈 ESTA ERA LA CLAVE
    document.getElementById('rating-controls').classList.remove('hidden');
    document.getElementById('tap-hint').classList.add('hidden');
    document.getElementById('click-overlay').classList.add('hidden');
}


function toggleExampleTranslation() {
    const el = document.getElementById('example-translation');
    el.classList.toggle('hidden');
}


function rateWord(quality) {
    const word = studyQueue[currentStudyIndex];

    // Lógica Espaciada Simplificada
    if (quality < 3) {
        word.interval = 1;
    } else {
        if (word.interval === 0) word.interval = 1;
        else if (word.interval === 1) word.interval = 3;
        else word.interval = Math.round(word.interval * word.ease);
    }

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + word.interval);
    word.nextReview = nextDate.toISOString().split("T")[0];

    save();

    currentStudyIndex++;
    if (currentStudyIndex < studyQueue.length) {
        renderCurrentCard();
    } else {
        document.getElementById('study-progress-bar').style.width = `100%`;
        setTimeout(() => {
            openModal(
                "¡Sesión Terminada!",
                "Has repasado todas las palabras pendientes de esta lista.",
                `<button onclick="closeModal(); showTab('library');" class="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg">Volver</button>`
            );

            currentStudyListId = null;

        }, 300);
    }
}

/* MODALS & SYSTEM */
function openModal(title, content, actions) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-content').innerHTML = content;
    document.getElementById('modal-actions').innerHTML = actions;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
}

function clearAllData() {
    openModal(
        "Borrar todos los datos",
        "Esta acción es permanente y no se puede deshacer.",
        `
        <button onclick="closeModal()" class="px-6 py-3 bg-slate-100 rounded-2xl font-bold">Cancelar</button>
        <button onclick="confirmClearAll()" class="px-6 py-3 bg-rose-600 text-white rounded-2xl font-bold">Borrar todo</button>
        `
    );
}

function confirmClearAll() {
    localStorage.removeItem('vocab_factory_v4');
    location.reload();
}


function exportLibrary() {
    const data = JSON.stringify(lists, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocabfactory_backup_${getToday()}.json`;
    a.click();
}

function importLibrary(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const imported = JSON.parse(ev.target.result);
            lists = imported;
            save();
            showTab('library');
            openModal("Éxito", "Biblioteca importada correctamente.", `<button onclick="closeModal()" class="px-6 py-2 bg-indigo-600 text-white rounded-xl">OK</button>`);
        } catch (err) {
            openModal("Error", "El archivo no es válido.", `<button onclick="closeModal()" class="px-6 py-2 bg-slate-100 rounded-xl">Cerrar</button>`);
        }
    };
    reader.readAsText(file);
}

function createNewEmptyList() {
    openModal(
        "Nueva lista",
        `
        <input id="new-list-name"
            class="w-full p-4 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Nombre de la lista" />
        `,
        `
        <button onclick="closeModal()" class="px-6 py-3 rounded-2xl bg-slate-100 font-bold">Cancelar</button>
        <button onclick="confirmCreateList()" class="px-6 py-3 rounded-2xl bg-indigo-600 text-white font-bold">Crear</button>
        `
    );
}

function confirmCreateList() {
    const name = document.getElementById('new-list-name').value.trim();
    if (!name) return;

    lists.unshift({
        id: Date.now().toString(),
        name,
        items: []
    });

    save();
    closeModal();
    renderLibrary();
}

function editListName(listId) {
    const list = lists.find(l => l.id === listId);

    openModal(
        "Editar nombre",
        `
        <input id="edit-list-name"
            class="w-full p-4 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
            value="${list.name}" />
        `,
        `
        <button onclick="closeModal()" class="px-6 py-3 bg-slate-100 rounded-2xl font-bold">Cancelar</button>
        <button onclick="saveListName('${listId}')" class="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold">Guardar</button>
        `
    );
}

function saveListName(listId) {
    const name = document.getElementById('edit-list-name').value.trim();
    if (!name) return;

    const list = lists.find(l => l.id === listId);
    list.name = name;

    save();
    closeModal();
    openListDetails(listId);
}

/* 🔊 TEXT TO SPEECH (ENGLISH) */
let englishVoice = null;

function loadEnglishVoice() {
    const voices = speechSynthesis.getVoices();

    englishVoice = voices.find(v =>
        v.lang.startsWith('en') &&
        (v.name.toLowerCase().includes('native') ||
            v.name.toLowerCase().includes('google') ||
            v.name.toLowerCase().includes('english'))
    ) || voices.find(v => v.lang.startsWith('en'));
}

// Algunos navegadores cargan las voces async
speechSynthesis.onvoiceschanged = loadEnglishVoice;
loadEnglishVoice();

function speakEnglish(text) {
    if (!text) return;

    speechSynthesis.cancel(); // corta cualquier audio previo

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    if (englishVoice) utterance.voice = englishVoice;

    speechSynthesis.speak(utterance);
}

//Iniciar quiz

function startQuizFromCurrentList() {
    let sourceItems = [];

    if (currentStudyListId) {
        const list = lists.find(l => l.id === currentStudyListId);
        if (!list) return;
        sourceItems = list.items;
    } else {
        sourceItems = lists.flatMap(l => l.items);
    }

    quizQueue = [...sourceItems];
    quizIndex = 0;
    quizErrors = 0;

    showTab('quiz');
    renderQuizCard();
}

// Renderizar pregunta
function renderQuizCard() {
    const word = quizQueue[quizIndex];
    if (!word) return;

    /* PROGRESS */
    document.getElementById('quiz-progress-text').textContent =
        `${quizIndex + 1} / ${quizQueue.length}`;

    document.getElementById('quiz-errors-text').textContent =
        `Errores: ${quizErrors}`;

    /* TEXTOS EN ESPAÑOL */
    const wordEs = document.getElementById('quiz-word-es');
    const exampleEs = document.getElementById('quiz-example-es');

    wordEs.textContent = word.translation;
    exampleEs.textContent = word.example_translation;

    /* INPUTS */
    const wordInput = document.getElementById('quiz-word-input');
    const exampleInput = document.getElementById('quiz-example-input');

    wordInput.value = '';
    exampleInput.value = '';

    /* FEEDBACK */
    document.getElementById('quiz-feedback').classList.add('hidden');

    /* 🔊 AUDIO + UX */

    // Click en el texto español → dice la respuesta en inglés y enfoca input
    wordEs.onclick = () => {
        speakEnglish(word.word);
        wordInput.focus();
    };

    exampleEs.onclick = () => {
        speakEnglish(word.example);
        exampleInput.focus();
    };

    // Focus en el input → dice lo que debe escribir en inglés
    wordInput.onfocus = () => speakEnglish(word.word);
    exampleInput.onfocus = () => speakEnglish(word.example);

    // Focus inicial
    wordInput.focus();
}



//Validar respuesta
function submitQuizAnswer() {
    const word = quizQueue[quizIndex];

    const userWord = document.getElementById('quiz-word-input').value.trim().toLowerCase();
    const userExample = document.getElementById('quiz-example-input').value.trim().toLowerCase();

    const correctWord = word.word.trim().toLowerCase();
    const correctExample = word.example.trim().toLowerCase();

    const isCorrect =
        userWord === correctWord &&
        userExample === correctExample;

    if (isCorrect) {
        quizIndex++;

        if (quizIndex >= quizQueue.length) {
            openModal(
                "🎉 Quiz completado",
                `Terminaste el quiz.<br><br>
                 Errores totales: <b>${quizErrors}</b>`,
                `<button onclick="closeModal(); showTab('library')" class="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold">
                    Volver
                </button>`
            );
        } else {
            renderQuizCard();
        }
    } else {
        quizErrors++;

        // 🔁 MANDAR AL FINAL
        quizQueue.push(quizQueue.splice(quizIndex, 1)[0]);

        const feedback = document.getElementById('quiz-feedback');
        feedback.innerHTML = `
            ❌ Incorrecto<br>
            <span class="text-xs text-slate-500">
                Escucha bien y vuelve a intentarlo más adelante
            </span>
        `;
        feedback.classList.remove('hidden');

        setTimeout(renderQuizCard, 900);
    }
}


//







/* BOOT */
document.addEventListener('DOMContentLoaded', () => {
    showTab('factory');
});


// Legg til dette helt øverst i filen, før DOMContentLoaded
if (window.Webflow) {
    console.log("Webflow detected, attempting to disable form handling");
    window.Webflow.destroy();
}

// Hjelpefunksjon for å vente på at et element er synlig og tilgjengelig
async function waitForElement(selector, maxAttempts = 20) {
    console.log(`Venter på element: ${selector}`);
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const element = document.querySelector(selector);
        if (element) {
            console.log(`Fant element: ${selector}`);
            return element;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log(`Forsøk ${attempt + 1}/${maxAttempts} på å finne ${selector}`);
    }
    throw new Error(`Kunne ikke finne element: ${selector}`);
}

// 1) Funksjon for å utføre DeepB-søk
async function performSearch(searchText, numResults = 20) {
    const button = document.getElementById('sok_deepb');
    const originalButtonText = button.textContent;

    try {
        // Endre musepeker og knapp mens vi søker
        document.body.classList.add('waiting');
        button.classList.add('button-loading');
        
        // Sett spinner med tekst "Søker..."
        button.innerHTML = `
            <div class="w-embed" style="display: inline-block">
                <svg class="spinner" viewBox="0 0 50 50">
                    <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5"></circle>
                </svg>
            </div>
            Søker...`;

        console.log("Performing search for:", searchText);

        const headers = {
            "accept": "application/json",
            "Authorization": `Bearer o9QOWEjSbx5xFLW`
        };

        const url = new URL(`https://deepb.veta.no/vector_search/${encodeURIComponent(searchText)}`);
        url.searchParams.append('limit', numResults);

        console.log("Fetching from URL:", url.toString());

        const response = await fetch(url, { 
            method: 'GET',
            headers: headers,
            mode: 'cors'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Raw API response:", data);

        const results = data.map(item => ({
            domene: item.domain,
            score: normalizeScore(item.score),
            firmabeskrivelse: item.summary || 'Ingen beskrivelse tilgjengelig'
        }));

        await populateTable(results);
        await toggleTableRows(true);  // Vis radene etter at tabellen er populert

    } catch (error) {
        console.error("Feil ved søk:", error);
        alert('En feil oppstod under søket. Vennligst prøv igjen senere.');
    } finally {
        // Tilbakestill til opprinnelig utseende
        document.body.classList.remove('waiting');
        button.classList.remove('button-loading');
        button.innerHTML = originalButtonText;
    }
}

// 2) Funksjon for å hente oppsummering fra URL
async function fetchSummaryFromUrl() {
    toggleTableRows(false);  // Skjul rader før søk
    const button = document.getElementById('sok_button');
    const originalButtonText = button.textContent;

    try {
        // Endre musepeker og knapp mens vi henter
        document.body.classList.add('waiting');
        button.classList.add('button-loading');
        
        // Sett spinner med tekst "Henter..."
        button.innerHTML = `
            <div class="w-embed" style="display: inline-block">
                <svg class="spinner" viewBox="0 0 50 50">
                    <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5"></circle>
                </svg>
            </div>
            Henter...`;

        const urlInput = document.getElementById('firma_url');
        const firmaText = document.getElementById('firma_text');

        if (!urlInput || !urlInput.value.trim()) {
            alert("Vennligst skriv inn en gyldig URL i tekstfeltet.");
            return;
        }

        const apiURL = `https://deepb.veta.no/summary_search/${encodeURIComponent(urlInput.value.trim())}`;
        const headers = {
            "accept": "application/json",
            "Authorization": `Bearer o9QOWEjSbx5xFLW`
        };

        console.log("Henter oppsummering fra:", apiURL);

        const response = await fetch(apiURL, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("API Response:", data);

        if (data.message === "Domain not found in index.") {
            alert("Domene ikke funnet i indeksen. Prøv en annen URL eller legg inn firmabeskrivelse manuelt.");
            return;
        }

        // Oppdater firma_text input feltet med oppsummeringen
        if (firmaText) {
            firmaText.value = data.summary || "Ingen oppsummering tilgjengelig.";
            console.log("Oppsummering plassert i søkefeltet");
        } else {
            console.error("Fant ikke firma_text input feltet");
        }

    } catch (error) {
        console.error("Error fetching summary:", error);
        alert("En feil oppstod under API-kallet. Vennligst prøv igjen senere.");
    } finally {
        // Tilbakestill til opprinnelig utseende
        document.body.classList.remove('waiting');
        button.classList.remove('button-loading');
        button.innerHTML = originalButtonText;
    }
}

// 3) Hjelpefunksjon for å normalisere score
function normalizeScore(score) {
    console.log("Normalizing score:", score);
    try {
        score = parseFloat(score);
        if (score < 1 || score > 2) {
            console.warn(`Uventet score verdi: ${score}`);
            return "0%";
        }
        const normalized = (score - 1) * 100;
        return `${normalized.toFixed(1)}%`;
    } catch (error) {
        console.error("Feil ved normalisering av score:", error);
        return "0%";
    }
}

// 4) Funksjon for å fylle tabell med resultater
async function populateTable(results) {
    try {
        console.log("Starter populering av tabell med resultater:", results);

        // Finn tabellen i den aktive tab-panen
        const activePane = document.querySelector('.w-tab-pane.w--tab-active');
        if (!activePane) {
            throw new Error("Fant ikke aktiv tab-pane");
        }

        const table = activePane.querySelector('.table');
        if (!table) {
            throw new Error("Fant ikke .table i aktiv tab");
        }

        // Fjern eventuelle tidligere dupliserte rader
        console.log("Fjerner gamle dupliserte rader...");
        const existingDuplicates = table.querySelectorAll('[id^="rad"][id$="_dupe"]');
        existingDuplicates.forEach(row => row.remove());

        // Oppdater de første 4 radene
        console.log("Oppdaterer de første 4 radene...");
        for (let i = 0; i < Math.min(results.length, 4); i++) {
            const result = results[i];
            const row = document.getElementById(`rad${i + 1}`);
            if (!row) {
                console.warn(`Fant ikke rad${i + 1}, hopper over`);
                continue;
            }
            await updateRow(row, result);
        }

        // Dupliser rader for resten av resultatene
        console.log("Starter duplisering av rader");
        for (let i = 4; i < results.length; i++) {
            const result = results[i];
            const baseRowIndex = (i % 4) + 1;
            const originalRow = document.getElementById(`rad${baseRowIndex}`);
            
            if (!originalRow) {
                console.warn(`Fant ikke original rad${baseRowIndex}, hopper over`);
                continue;
            }

            const newRow = originalRow.cloneNode(true);
            newRow.id = `rad${i + 1}_dupe`;
            await updateRow(newRow, result);
            
            // Legg til den nye raden i tabellen
            console.log(`Legger til ny rad: ${newRow.id}`);
            table.appendChild(newRow);
        }

        // Vis alle rader
        console.log("Viser alle rader...");
        await toggleTableRows(true);
        
        console.log("Tabell populert vellykket");
        return true;

    } catch (error) {
        console.error("Feil under populering av tabell:", error);
        throw error;
    }
}

// Hjelpefunksjon for å oppdatere en rad
async function updateRow(row, result) {
    try {
        // Vis raden med CSS-klasse i stedet for inline style
        row.classList.remove('hidden-row');

        // Oppdater domenet
        const domainWrapper = row.querySelector('.grid-cell-2 .domene_wrapper');
        if (domainWrapper) {
            const protocol = result.domene.startsWith("http") ? "" : "https://";
            const link = `${protocol}${result.domene}`;
            domainWrapper.innerHTML = `<a href="${link}" target="_blank">${result.domene}</a>`;
            console.log(`Oppdaterte domene for ${row.id}: ${result.domene}`);
        } else {
            console.warn(`Fant ikke domene-wrapper for rad ${row.id}`);
        }

        // Oppdater score
        const scoreElement = row.querySelector('.deepb_resultat .likhetwrapper .likhetscore');
        if (scoreElement) {
            scoreElement.textContent = result.score;
            console.log(`Oppdaterte score for ${row.id}: ${result.score}`);
        } else {
            console.warn(`Fant ikke score-element for rad ${row.id}`);
        }

        // Oppdater beskrivelse
        const beskrivelse = row.querySelector('.deepb_resultat .beskrivelse');
        if (beskrivelse) {
            beskrivelse.textContent = result.firmabeskrivelse;
            console.log(`Oppdaterte beskrivelse for ${row.id}`);
        } else {
            console.warn(`Fant ikke beskrivelse-element for rad ${row.id}`);
        }

    } catch (error) {
        console.error(`Feil ved oppdatering av rad ${row.id}:`, error);
        throw error;
    }
}

// Legg til ny funksjon for å strippe URL
function stripUrl(inputUrl) {
    try {
        let strippedUrl = inputUrl.replace(/^(https?:\/\/)?(www\.)?/i, '');
        strippedUrl = strippedUrl.replace(/\/+$/, '');
        
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(strippedUrl)) {
            console.error("Ugyldig URL-format:", strippedUrl);
            return null;
        }
        return strippedUrl;
    } catch (error) {
        console.error("Feil ved stripping av URL:", error);
        return null;
    }
}

// Legg til CSS-klasser i head
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    .hidden-row {
        visibility: hidden !important;
    }
    .waiting {
        cursor: wait !important;
    }
    .button-loading {
        opacity: 0.7 !important;
        cursor: wait !important;
        pointer-events: none !important;
    }
    .spinner {
        width: 20px;
        height: 20px;
        animation: spin 1s linear infinite;
    }
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(styleSheet);

// Gjør toggleTableRows spesifikk for rad1-4
async function toggleTableRows(show = false) {
    console.log(`${show ? 'Viser' : 'Skjuler'} tabellrader...`);
    const rows = document.querySelectorAll('#rad1, #rad2, #rad3, #rad4');
    console.log(`Fant ${rows.length} rader å toggle`);
    
    rows.forEach(row => {
        if (row) {
            if (show) {
                row.classList.remove('hidden-row');
            } else {
                row.classList.add('hidden-row');
            }
            console.log(`${show ? 'Viste' : 'Skjulte'} rad ${row.id}`);
        }
    });
}

// Vent til DOM er helt lastet
document.addEventListener('DOMContentLoaded', function () {
    console.log("DOM fully loaded");
    
    // Skjul radene umiddelbart
    toggleTableRows(false);
    
    // Backup: Prøv igjen etter at Webflow er helt ferdig
    setTimeout(() => {
        toggleTableRows(false);
        console.log("Kjørte toggleTableRows på nytt etter timeout");
    }, 500);

    // Håndter url_form
    const urlForm = document.getElementById('url_form');
    if (urlForm) {
        urlForm.addEventListener('submit', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const urlInput = document.getElementById('firma_url');
            if (!urlInput || !urlInput.value.trim()) {
                alert("Vennligst skriv inn en gyldig URL i tekstfeltet.");
                return;
            }

            const strippedUrl = stripUrl(urlInput.value.trim());
            if (!strippedUrl) {
                alert("Ugyldig URL. Vennligst skriv inn en korrekt URL.");
                return;
            }

            console.log("Strippet URL:", strippedUrl);
            urlInput.value = strippedUrl;
            
            fetchSummaryFromUrl();
        });
    }

    // Håndter deepb_form
    const deepbForm = document.getElementById('deepb_form');
    console.log("Looking for deepb_form:", deepbForm);

    if (deepbForm) {
        // Fjern Webflow's form listeners
        deepbForm.setAttribute('data-wf-form-id', 'none');
        deepbForm.removeAttribute('data-name');
        
        deepbForm.addEventListener('submit', function(e) {
            console.log("DeepB form submission intercepted");
            e.preventDefault();
            e.stopPropagation();
            
            const searchText = document.getElementById('firma_text');
            if (!searchText || !searchText.value.trim()) {
                alert("Vennligst fyll inn søketekst.");
                return;
            }
            performSearch(searchText.value.trim());
            return false;
        });
    }

    // Hent og sett opp knapper
    const sokDeepbButton = document.getElementById('sok_deepb');
    const sokButton = document.getElementById('sok_button');

    // Sett type="button" på begge knapper
    if (sokDeepbButton) sokDeepbButton.setAttribute('type', 'button');
    if (sokButton) sokButton.setAttribute('type', 'button');

    // Knytt click-handlers til knappene
    if (sokDeepbButton) {
        sokDeepbButton.addEventListener('click', function(event) {
            event.preventDefault();
            const searchText = document.getElementById('firma_text');
            if (!searchText || !searchText.value.trim()) {
                alert("Vennligst fyll inn søketekst.");
                return;
            }
            performSearch(searchText.value.trim());
        });
    }
});

// Kjør når siden er helt lastet
window.addEventListener('load', () => {
    console.log("Window fully loaded");
    toggleTableRows(false);
});

// Kjør når Webflow er klar
if (window.Webflow && window.Webflow.push) {
    window.Webflow.push(() => {
        console.log("Webflow ready");
        toggleTableRows(false);
    });
}

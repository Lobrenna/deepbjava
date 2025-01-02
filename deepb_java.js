
// 1) Funksjon for å utføre DeepB-søk
async function performSearch(searchText, numResults = 20) {
    const button = document.getElementById('sok_deepb');
    const originalButtonText = button.textContent;
    const originalCursor = document.body.style.cursor;

    try {
        // Skjul tabell før nytt søk
        hideTable();

        // Endre musepeker og knapp mens vi søker
        document.body.style.cursor = 'wait';
        button.style.opacity = '0.7';
        button.style.cursor = 'wait';
        button.style.pointerEvents = 'none';

        // Sett spinner med tekst "Søker..."
        button.innerHTML = `
            <div class="w-embed" style="display: inline-block">
                <svg class="spinner" viewBox="0 0 50 50" style="width: 20px; height: 20px; animation: spin 1s linear infinite;">
                    <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5"></circle>
                </svg>
            </div>
            Søker...`;

        // Legg til CSS for spinner-animasjonen (én gang)
        if (!document.querySelector('#spinner-style')) {
            const style = document.createElement('style');
            style.id = 'spinner-style';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .spinner circle {
                    stroke-dasharray: 90, 150;
                    stroke-dashoffset: 0;
                    transform-origin: center;
                }
            `;
            document.head.appendChild(style);
        }

        console.log("Performing search for:", searchText);

        // Utfør API-kall
        console.log("Utfører API-kall...");
        const headers = {
            "accept": "application/json",
            "Authorization": 'Bearer o9QOWEjSbx5xFLW'
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
            console.error(`HTTP error! status: ${response.status}`);
            console.error("Response headers:", Object.fromEntries(response.headers));
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

    } catch (error) {
        console.error("Feil ved søk:", error);
        alert('En feil oppstod under søket. Vennligst prøv igjen senere.');
    } finally {
        // Tilbakestill til opprinnelig utseende
        document.body.style.cursor = originalCursor;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
        button.style.pointerEvents = 'auto';
        button.innerHTML = originalButtonText;
    }
}

// 2) Funksjon for å hente oppsummering fra URL
async function fetchSummaryFromUrl() {
    const button = document.getElementById('sok_button');
    const originalButtonText = button.textContent;
    const originalCursor = document.body.style.cursor;

    try {
        // Endre musepeker og knapp mens vi henter
        document.body.style.cursor = 'wait';
        button.style.opacity = '0.7';
        button.style.cursor = 'wait';
        button.style.pointerEvents = 'none';

        // Sett spinner med tekst "Henter..."
        button.innerHTML = `
            <div class="w-embed" style="display: inline-block">
                <svg class="spinner" viewBox="0 0 50 50" style="width: 20px; height: 20px; animation: spin 1s linear infinite;">
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
            "Authorization": 'Bearer o9QOWEjSbx5xFLW'
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
        document.body.style.cursor = originalCursor;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
        button.style.pointerEvents = 'auto';
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

        // Vis table heading
        const tableHeading = document.getElementById('table_heading');
        if (tableHeading) {
            tableHeading.style.display = 'grid';
        }

        const activeTabPane = document.querySelector('.w-tab-pane.w--tab-active .table');
        if (!activeTabPane) {
            throw new Error("Fant ikke aktiv tab-pane med tabell");
        }

        const table = activeTabPane;

        // Fjern tidligere dupliserte rader
        const existingDuplicates = table.querySelectorAll('[id^="rad"][id$="_dupe"]');
        existingDuplicates.forEach(row => row.remove());

        // Finn alle fire originalrader
        const rad1 = document.getElementById('rad1');
        const rad2 = document.getElementById('rad2');
        const rad3 = document.getElementById('rad3');
        const rad4 = document.getElementById('rad4');
        
        if (!rad1 || !rad2 || !rad3 || !rad4) {
            throw new Error("Fant ikke alle nødvendige originalrader");
        }

        const templates = [rad1, rad2, rad3, rad4];

        // Oppdater eller opprett de første 4 radene
        for (let i = 0; i < Math.min(results.length, 4); i++) {
            const result = results[i];
            const rowId = `rad${i + 1}`;
            let row = document.getElementById(rowId);

            if (!row) {
                row = templates[i].cloneNode(true);
                row.id = rowId;
                table.appendChild(row);
            }

            row.style.display = 'grid';
            await updateRow(row, result);
        }

        // Legg til flere rader for resultater over 4
        for (let i = 4; i < results.length; i++) {
            const result = results[i];
            // Velg riktig mal basert på posisjon (0-3)
            const templateIndex = i % 4;
            const newRow = templates[templateIndex].cloneNode(true);
            newRow.id = `rad${i + 1}_dupe`;
            newRow.style.display = 'grid';
            await updateRow(newRow, result);
            table.appendChild(newRow);
        }

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

// Oppdatert funksjon for å skjule tabellen
function hideTable() {
    try {
        console.log("Skjuler tabell");
        
        // Skjul table heading
        const tableHeading = document.getElementById('table_heading');
        if (tableHeading) {
            tableHeading.style.display = 'none';
        } else {
            console.warn("Fant ikke table_heading element");
        }

        // Skjul alle rader
        const rows = document.querySelectorAll('[id^="rad"]');
        rows.forEach(row => {
            row.style.display = 'none';
        });
    } catch (error) {
        console.error("Feil ved skjuling av tabell:", error);
    }
}

// Legg til dette helt øverst i filen, før DOMContentLoaded
if (window.Webflow) {
    console.log("Webflow detected, attempting to disable form handling");
    window.Webflow.destroy();
}

document.addEventListener('DOMContentLoaded', function () {
    console.log("DOM fully loaded");
    
    // Skjul tabell ved oppstart
    hideTable();

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

    // Hent knappene
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

    // Legg til event listener for 'sok_button'
    if (sokButton) {
        sokButton.addEventListener('click', function(event) {
            event.preventDefault();
            hideTable(); // Skjul tabell før nytt søk
            fetchSummaryFromUrl();
        });
    }

    // Legg til event listener for ENTER-tasten i 'firma_url' feltet
    const firmaUrlInput = document.getElementById('firma_url');
    if (firmaUrlInput) {
        firmaUrlInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                hideTable(); // Skjul tabell før nytt søk
                fetchSummaryFromUrl();
            }
        });
    }
});

// Kjør når siden er helt lastet, inkludert alle ressurser
window.addEventListener('load', function() {
    console.log("Window fully loaded");
});

// Kjør når Webflow er ferdig med sine operasjoner
if (window.Webflow && window.Webflow.push) {
    window.Webflow.push(function() {
        console.log("Webflow ready");
    });
}

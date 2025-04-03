document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('cricketer-input');
    const guessButton = document.getElementById('guess-button');
    const guessesContainer = document.getElementById('guesses-container');
    const messageArea = document.getElementById('message-area');
    const timerDisplay = document.getElementById('timer');

    let guessCount = 0;
    let gameWon = false;
    let gameLost = false;
    let startTime = Date.now();
    let timerInterval;

    // Initialize Awesomplete
    const awesomplete = new Awesomplete(input, {
        list: ALL_CRICKETER_NAMES,
        minChars: 1,
        maxItems: 7,
    });

    // --- Timer ---
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function startTimer() {
        if (timerInterval) clearInterval(timerInterval); // Clear existing interval if any
        startTime = Date.now(); // Reset start time on first guess (or page load if needed)
         timerDisplay.textContent = '00:00'; // Reset display
        timerInterval = setInterval(() => {
            if (gameWon || gameLost) {
                clearInterval(timerInterval);
                return;
            }
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            timerDisplay.textContent = formatTime(elapsedSeconds);
        }, 1000);
    }

     // Start timer immediately on page load
     // If you want it to start only on the *first* guess, move this call
     // inside the handleGuess function, within the `if (guessCount === 0)` block.
     startTimer();

    // --- Guess Handling ---
    async function handleGuess() {
        const selectedName = input.value.trim();

        if (!selectedName) {
            alert("Please select a cricketer's name.");
            return;
        }

        // Basic check if name exists in our list (client-side validation)
        if (!ALL_CRICKETER_NAMES.includes(selectedName)) {
             // Check if it's a partial match from autocomplete list focus/selection
             const potentialMatch = ALL_CRICKETER_NAMES.find(name => name.toLowerCase() === selectedName.toLowerCase());
             if (!potentialMatch) {
                alert("Invalid cricketer name. Please select from the suggestions.");
                return; // Stop if not a valid name from the list
             }
             // Optionally correct the casing if found
             input.value = potentialMatch;

        }


        if (gameWon || gameLost || guessCount >= MAX_GUESSES) {
            return; // Don't allow more guesses
        }

        guessButton.disabled = true; // Disable button during processing

        try {
            const response = await fetch('/guess', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: selectedName }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            // Clear input after guess
            input.value = '';
            awesomplete.evaluate(); // Refresh awesomplete suggestions if needed

            if (result.error) {
                alert(result.error); // Show server-side errors (e.g., cricketer not found)
            } else {
                guessCount++;
                displayGuess(result.guessed_cricketer, result.comparison, guessCount);

                if (result.correct_guess) {
                    gameWon = true;
                    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
                    displayMessage(`🎉 You've guessed the right cricketer in ${elapsedSeconds} seconds!`, 'success');
                    guessButton.disabled = true;
                    input.disabled = true;
                     clearInterval(timerInterval); // Stop timer
                } else if (guessCount >= MAX_GUESSES) {
                    gameLost = true;
                    displayMessage(`😥 Out of guesses! The cricketer was ${result.mystery_cricketer_name}.`, 'failure');
                    guessButton.disabled = true;
                    input.disabled = true;
                     clearInterval(timerInterval); // Stop timer
                }
            }
        } catch (error) {
            console.error("Error submitting guess:", error);
            messageArea.textContent = 'Error submitting guess. Please try again.';
            messageArea.className = 'failure-message';
        } finally {
             // Re-enable button only if game is not over
            if (!gameWon && !gameLost) {
                 guessButton.disabled = false;
            }
        }
    }

    function displayGuess(cricketer, comparison, number) {
        const guessRow = document.createElement('div');
        guessRow.classList.add('guess-row');

        guessRow.innerHTML = `
            <div class="guess-header">
                <span class="guess-number">${number}</span>
                <span class="guess-name">${cricketer.name}</span>
            </div>
            <div class="guess-details">
                <div class="detail-box ${comparison.debut_year ? 'correct' : ''}">
                    <span class="label">Debut</span>
                    <span class="value">${cricketer.debut_year}</span>
                </div>
                <div class="detail-box ${comparison.country_playing ? 'correct' : ''}">
                    <span class="label">Country Playing</span>
                    <span class="value">${cricketer.country_playing}</span>
                </div>
                <div class="detail-box ${comparison.country_born ? 'correct' : ''}">
                    <span class="label">Country Born</span>
                    <span class="value">${cricketer.country_born}</span>
                </div>
                <div class="detail-box ${comparison.type ? 'correct' : ''}">
                    <span class="label">Type</span>
                    <span class="value">${cricketer.type}</span>
                </div>
                <div class="detail-box ${comparison.ipl_team ? 'correct' : ''}">
                    <span class="label">Current IPL Team</span>
                    <span class="value">${cricketer.ipl_team || 'N/A'}</span>
                </div>
            </div>
        `;
        // Prepend the new guess so latest appears first
        guessesContainer.prepend(guessRow);
    }

    function displayMessage(msg, type) {
        messageArea.textContent = msg;
        messageArea.className = type === 'success' ? 'success-message' : 'failure-message';
    }

    // Event Listeners
    guessButton.addEventListener('click', handleGuess);
    input.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            // Allow Enter key submit, potentially handle awesomplete selection
             handleGuess();
        }
    });
     // Handle selection from Awesomplete dropdown
     input.addEventListener('awesomplete-selectcomplete', function() {
         // Optionally trigger guess immediately after selection, or just populate
         // handleGuess(); // Uncomment if you want auto-guess on selection
     });

});
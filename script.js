document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENT REFERENCES ---
    const scriptText = document.getElementById('script-text');
    const startButton = document.getElementById('start-button');
    const closeBtn = document.getElementById('close-btn');
    const teleprompterDisplay = document.getElementById('teleprompter-display');
    const teleprompterContent = document.getElementById('teleprompter-content');
    const scriptTextWrapper = document.getElementById('script-text-wrapper');

    // Controls
    const fontsizeInput = document.getElementById('fontsize-input');
    const wpmInput = document.getElementById('wpm-input');
    const timeInput = document.getElementById('time-input');
    const mirrorToggle = document.getElementById('mirror-toggle');
    const themePicker = document.getElementById('theme-picker');
    const alignToggleBtn = document.getElementById('align-toggle-btn');
    const alignCenterIcon = document.getElementById('align-center-icon');
    const alignLeftIcon = document.getElementById('align-left-icon');

    // Main Theme Controls
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const lightModeIcon = document.getElementById('light-mode-icon');
    const darkModeIcon = document.getElementById('dark-mode-icon');

    // Prompter Theme Controls
    const classicPrompterToggle = document.getElementById('classic-prompter-toggle');
    const prompterDarkModeToggle = document.getElementById('prompter-dark-mode-toggle');

    // Custom Dropdown References
    const customSelectWrapper = document.querySelector('.custom-select-wrapper');
    const customSelectTrigger = document.getElementById('custom-select-trigger');
    const customSelectText = document.getElementById('custom-select-text');
    const customOptionsContainer = document.getElementById('custom-select-options');
    const customOptionsList = document.querySelectorAll('#custom-select-options li');

    // Preview & Time Display
    const textPreview = document.getElementById('text-preview');
    const totalTimePreview = document.getElementById('total-time-preview');
    const timeRemainingDisplay = document.getElementById('time-remaining');
    const previewScrollBtn = document.getElementById('preview-scroll-btn');
    const previewPlayIcon = document.getElementById('preview-play-icon');
    const previewStopIcon = document.getElementById('preview-stop-icon');

    // Prompter UI
    const prompterUIElements = document.querySelectorAll('.prompter-ui');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const restartBtn = document.getElementById('restart-btn');
    const returnBtn = document.getElementById('return-btn');
    const pauseIndicator = document.getElementById('pause-indicator');

    // --- STATE MANAGEMENT ---
    let animationFrameId = null;
    let isPaused = true;
    let currentBaseTheme = 'nord';
    let currentMode = 'dark';
    let currentAlignment = 'center';
    let useClassicPrompter = true;
    let prompterDarkMode = true;
    let lastEditedPacingControl = 'wpm'; // 'wpm' or 'time'
    let lastPausedPosition = 0;
    let isExpectingProgrammaticScroll = false;
    let hasFinished = false;
    let previewAnimationFrameId = null;
    let uiFadeTimeoutId = null;
    let scrollTimeoutId = null;
    let wasRunningBeforeScroll = false;
    let startTime = 0;
    let elapsedTimeAtPause = 0;
    let totalMilliseconds = 0;
    let formattedTotalTime = '0:00';

    // --- UI VISIBILITY FUNCTIONS ---
    function showPrompterUI() {
        clearTimeout(uiFadeTimeoutId);
        prompterUIElements.forEach(el => el.classList.remove('ui-hidden'));
        teleprompterDisplay.classList.remove('cursor-hidden');
    }

    function hidePrompterUI() {
        if (isPaused || document.querySelector('.prompter-ui:hover')) return;
        clearTimeout(uiFadeTimeoutId);
        prompterUIElements.forEach(el => el.classList.add('ui-hidden'));
        if (!isPaused) {
            teleprompterDisplay.classList.add('cursor-hidden');
        }
    }

    function resetUIFadeTimeout() {
        showPrompterUI();
        if (!isPaused) {
            uiFadeTimeoutId = setTimeout(hidePrompterUI, 3000);
        }
    }

    // --- CORE FUNCTIONS ---
    function startTeleprompter() {
        const text = scriptText.value;
        if (text.trim() === '') {
            alert('Please enter a script.');
            return;
        }

        applyPrompterTheme();

        scriptTextWrapper.textContent = text;
        teleprompterContent.style.fontSize = `${fontsizeInput.value}px`;
        teleprompterDisplay.classList.toggle('mirrored', mirrorToggle.checked);
        scriptTextWrapper.className = `text-align-${currentAlignment}`;
        hasFinished = false;
        isPaused = true;
        wasRunningBeforeScroll = false;
        startTime = 0;
        elapsedTimeAtPause = 0;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        document.getElementById('setup-container').style.display = 'none';
        teleprompterDisplay.style.display = 'block';
        teleprompterDisplay.classList.add('is-paused');
        teleprompterDisplay.scrollTop = 0;
        showPrompterUI();
        setTimeout(() => {
            const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
            const wpm = parseInt(wpmInput.value, 10);
            totalMilliseconds = (wordCount / wpm) * 60 * 1000;
            const totalSeconds = Math.round(totalMilliseconds / 1000);
            const totalMins = Math.floor(totalSeconds / 60);
            const totalSecs = totalSeconds % 60;
            formattedTotalTime = `${totalMins}:${totalSecs.toString().padStart(2, '0')}`;
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
            updateRemainingTime(0);
        }, 100);
    }

    function scrollStep(timestamp) {
        if (isPaused) return;
        if (startTime === 0) startTime = timestamp;
        const currentSegmentTime = timestamp - startTime;
        const totalElapsedTime = elapsedTimeAtPause + currentSegmentTime;
        const totalScrollHeight = teleprompterContent.scrollHeight - teleprompterDisplay.clientHeight;
        if (totalScrollHeight <= 0) {
            stopTeleprompter(false);
            return;
        }
        const progress = Math.min(totalElapsedTime / totalMilliseconds, 1);
        isExpectingProgrammaticScroll = true;
        teleprompterDisplay.scrollTop = totalScrollHeight * progress;
        updateRemainingTime(totalElapsedTime);
        if (progress >= 1) {
            hasFinished = true;
            stopTeleprompter(false);
        } else {
            animationFrameId = requestAnimationFrame(scrollStep);
        }
    }

    function stopTeleprompter(returnToSetup = true) {
        isPaused = true;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        returnBtn.style.display = 'none';
        pauseIndicator.style.display = 'none';
        showPrompterUI();
        clearTimeout(uiFadeTimeoutId);
        if (returnToSetup) {
            document.getElementById('setup-container').style.display = 'flex';
            teleprompterDisplay.style.display = 'none';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
            teleprompterDisplay.classList.add('is-paused');
        }
    }

    function forcePause() {
        if (isPaused) return;
        isPaused = true;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        if (startTime > 0) {
            elapsedTimeAtPause += performance.now() - startTime;
        }
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        teleprompterDisplay.classList.add('is-paused');
        showPrompterUI();
    }

    function togglePause() {
        if (hasFinished) return;
        clearTimeout(scrollTimeoutId);
        wasRunningBeforeScroll = false;
        if (isPaused) {
            isPaused = false;
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
            teleprompterDisplay.classList.remove('is-paused');
            const totalScrollHeight = teleprompterContent.scrollHeight - teleprompterDisplay.clientHeight;
            if (totalScrollHeight > 0) {
                const scrollFraction = teleprompterDisplay.scrollTop / totalScrollHeight;
                elapsedTimeAtPause = totalMilliseconds * scrollFraction;
            }
            startTime = performance.now();
            returnBtn.style.display = 'none';
            pauseIndicator.style.display = 'none';
            resetUIFadeTimeout();
            animationFrameId = requestAnimationFrame(scrollStep);
        } else {
            forcePause();
            lastPausedPosition = teleprompterDisplay.scrollTop;
        }
    }

    function restartScroll() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        hasFinished = false;
        isPaused = true;
        wasRunningBeforeScroll = false;
        startTime = 0;
        elapsedTimeAtPause = 0;
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        teleprompterDisplay.classList.add('is-paused');
        returnBtn.style.display = 'none';
        pauseIndicator.style.display = 'none';
        showPrompterUI();
        teleprompterDisplay.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
        updateRemainingTime(0);
    }

    function returnToLastPosition() {
        teleprompterDisplay.scrollTo({
            top: lastPausedPosition,
            behavior: 'smooth'
        });
        returnBtn.style.display = 'none';
        pauseIndicator.style.display = 'none';
    }

    // --- UTILITY & PREVIEW FUNCTIONS ---
    function calculateTimeFromWPM() {
        const wordCount = scriptText.value.trim().split(/\s+/).filter(Boolean).length;
        if (wordCount === 0) {
            updateTotalTimePreview(0);
            return;
        }
        const wpm = parseInt(wpmInput.value, 10);
        if (wpm > 0) {
            const totalMinutes = wordCount / wpm;
            timeInput.value = totalMinutes.toFixed(2);
            updateTotalTimePreview(totalMinutes);
        }
    }

    function calculateWPMFromTime() {
        const wordCount = scriptText.value.trim().split(/\s+/).filter(Boolean).length;
        if (wordCount === 0) {
            updateTotalTimePreview(0);
            return;
        }
        const totalMinutes = parseFloat(timeInput.value);
        if (totalMinutes > 0) {
            wpmInput.value = Math.round(wordCount / totalMinutes);
            updateTotalTimePreview(totalMinutes);
        }
    }

    function updateTotalTimePreview(totalMinutes) {
        if (isNaN(totalMinutes) || totalMinutes <= 0) {
            totalTimePreview.textContent = '0m 0s';
            return;
        }
        const minutes = Math.floor(totalMinutes);
        const seconds = Math.round((totalMinutes - minutes) * 60);
        totalTimePreview.textContent = `${minutes}m ${seconds}s`;
    }

    function updateRemainingTime(elapsedTime) {
        const safeElapsedTime = Math.max(0, elapsedTime);
        let remainingTimeFormatted = '0:00';
        if (totalMilliseconds > 0) {
            const remainingMs = Math.max(0, totalMilliseconds - safeElapsedTime);
            const remainingSeconds = Math.ceil(remainingMs / 1000);
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            remainingTimeFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        timeRemainingDisplay.textContent = `${remainingTimeFormatted} / ${formattedTotalTime}`;
    }

    function updatePreview() {
        const text = scriptText.value;
        textPreview.textContent = text.trim() === '' ? 'Your text will appear here...' : text;
        textPreview.style.fontSize = `${fontsizeInput.value}px`;
        textPreview.className = `text-align-${currentAlignment}`;
        applyPrompterTheme();
    }

    function updateMirrorPreview() {
        textPreview.classList.toggle('mirrored', mirrorToggle.checked);
    }

    function stopPreviewScroll() {
        if (!previewAnimationFrameId) return;
        cancelAnimationFrame(previewAnimationFrameId);
        previewAnimationFrameId = null;
        textPreview.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
        previewPlayIcon.style.display = 'block';
        previewStopIcon.style.display = 'none';
    }

    function togglePreviewScroll() {
        if (previewAnimationFrameId) {
            stopPreviewScroll();
        } else {
            const text = scriptText.value;
            if (text.trim() === '') return;
            const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
            const wpm = parseInt(wpmInput.value, 10);
            const totalScriptTimeMs = (wordCount / wpm) * 60 * 1000;
            const totalScrollHeight = textPreview.scrollHeight - textPreview.clientHeight;
            if (totalScrollHeight <= 0 || !isFinite(totalScriptTimeMs) || totalScriptTimeMs <= 0) return;
            const pixelsPerMillisecond = totalScrollHeight / totalScriptTimeMs;
            previewPlayIcon.style.display = 'none';
            previewStopIcon.style.display = 'block';
            const animationStartTime = performance.now();

            function previewStep(timestamp) {
                const elapsedTime = timestamp - animationStartTime;
                const newScrollTop = pixelsPerMillisecond * elapsedTime;
                if (newScrollTop >= totalScrollHeight) {
                    stopPreviewScroll();
                } else {
                    textPreview.scrollTop = newScrollTop;
                    previewAnimationFrameId = requestAnimationFrame(previewStep);
                }
            }
            previewAnimationFrameId = requestAnimationFrame(previewStep);
        }
    }

    // --- THEME & SETTINGS MANAGEMENT ---
    function setupCustomSelect() {
        const closeDropdown = () => {
            customSelectWrapper.classList.remove('open');
            customSelectTrigger.setAttribute('aria-expanded', 'false');
        };
        const openDropdown = () => {
            customSelectWrapper.classList.add('open');
            customSelectTrigger.setAttribute('aria-expanded', 'true');
        };
        const selectOption = (option) => {
            themePicker.value = option.getAttribute('data-value');
            handleThemeChange();
            closeDropdown();
            customSelectTrigger.focus();
        };

        customSelectTrigger.addEventListener('click', () => {
            if (customSelectWrapper.classList.contains('open')) {
                closeDropdown();
            } else {
                openDropdown();
                (customOptionsContainer.querySelector('.selected') || customOptionsList[0]).focus();
            }
        });
        customOptionsList.forEach(option => option.addEventListener('click', () => selectOption(option)));
        document.addEventListener('click', (e) => {
            if (!customSelectWrapper.contains(e.target)) closeDropdown();
        });

        customSelectTrigger.addEventListener('keydown', (e) => {
            const isOpen = customSelectWrapper.classList.contains('open');

            if (e.key === 'Tab') {
                if (isOpen) {
                    closeDropdown();
                }
                return;
            }

            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (!isOpen) {
                    openDropdown();
                }
                if (e.key === 'ArrowDown') {
                    (customOptionsContainer.querySelector('.selected') || customOptionsList[0]).focus();
                } else { // ArrowUp
                    (customOptionsContainer.querySelector('.selected') || customOptionsList[customOptionsList.length - 1]).focus();
                }
                return;
            }

            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (isOpen) {
                    closeDropdown();
                } else {
                    openDropdown();
                    (customOptionsContainer.querySelector('.selected') || customOptionsList[0]).focus();
                }
            }
        });

        customOptionsContainer.addEventListener('keydown', (e) => {
            const activeOption = document.activeElement;
            if (activeOption.tagName !== 'LI' || !customOptionsContainer.contains(activeOption)) return;
            if (e.key === 'Tab') {
                e.preventDefault();
                closeDropdown();
                customSelectTrigger.focus();
                return;
            }
            switch (e.key) {
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    selectOption(activeOption);
                    break;
                case 'Escape':
                    e.preventDefault();
                    closeDropdown();
                    customSelectTrigger.focus();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    (activeOption.nextElementSibling || customOptionsList[0]).focus();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    (activeOption.previousElementSibling || customOptionsList[customOptionsList.length - 1]).focus();
                    break;
                case 'Home':
                    e.preventDefault();
                    customOptionsList[0].focus();
                    break;
                case 'End':
                    e.preventDefault();
                    customOptionsList[customOptionsList.length - 1].focus();
                    break;
            }
        });
    }

    function applyMainTheme() {
        const darkOnlyThemes = ['dracula', 'monokai', 'material', 'onedark', 'tomorrow'];
        const isDarkOnly = darkOnlyThemes.includes(currentBaseTheme);

        if (isDarkOnly) {
            currentMode = 'dark';
        }

        document.documentElement.setAttribute('data-theme', `${currentBaseTheme}-${currentMode}`);

        lightModeIcon.style.display = currentMode === 'light' ? 'block' : 'none';
        darkModeIcon.style.display = currentMode === 'dark' ? 'block' : 'none';
        themeToggleBtn.disabled = isDarkOnly;

        const activeOption = document.querySelector(`.custom-select-options li[data-value="${currentBaseTheme}"]`);
        if (activeOption) {
            customSelectText.textContent = activeOption.querySelector('span').textContent;
            customOptionsList.forEach(opt => {
                opt.classList.remove('selected');
                opt.setAttribute('aria-selected', 'false');
            });
            activeOption.classList.add('selected');
            activeOption.setAttribute('aria-selected', 'true');
        }

        const prompterBaseTheme = useClassicPrompter ? 'classic' : currentBaseTheme;
        const isPrompterThemeDarkOnly = darkOnlyThemes.includes(prompterBaseTheme);

        if (isPrompterThemeDarkOnly) {
            prompterDarkMode = true;
            prompterDarkModeToggle.checked = true;
            prompterDarkModeToggle.disabled = true;
        } else {
            prompterDarkModeToggle.disabled = false;
        }

        applyPrompterTheme();
    }

    function applyPrompterTheme() {
        const prompterElements = [textPreview, teleprompterDisplay];

        // Determine the effective theme for the prompter
        const prompterThemeName = useClassicPrompter ? 'classic' : currentBaseTheme;
        const prompterModeName = prompterDarkMode ? 'dark' : 'light';
        const fullPrompterTheme = `${prompterThemeName}-${prompterModeName}`;

        prompterElements.forEach(el => {
            // Remove previous theme attributes if they exist
            el.removeAttribute('data-theme');
            // Set the new theme directly on the prompter elements
            el.setAttribute('data-theme', fullPrompterTheme);
            // Also set the mode for the UI controls inside the prompter
            el.setAttribute('data-prompter-mode', prompterModeName);
        });
    }

    function handleClassicPrompterChange() {
        useClassicPrompter = classicPrompterToggle.checked;
        applyMainTheme();
        saveSettings();
    }

    function handlePrompterModeChange() {
        prompterDarkMode = prompterDarkModeToggle.checked;
        applyMainTheme();
        saveSettings();
    }

    function toggleMainMode() {
        currentMode = currentMode === 'light' ? 'dark' : 'light';
        applyMainTheme();
        saveSettings();
    }

    function handleThemeChange() {
        currentBaseTheme = themePicker.value;
        applyMainTheme();
        saveSettings();
    }

    function toggleAlignment() {
        currentAlignment = currentAlignment === 'center' ? 'left' : 'center';
        alignCenterIcon.style.display = currentAlignment === 'center' ? 'block' : 'none';
        alignLeftIcon.style.display = currentAlignment === 'left' ? 'block' : 'none';
        updatePreview();
        saveSettings();
    }

    function saveSettings() {
        const settings = {
            script: scriptText.value,
            fontSize: fontsizeInput.value,
            wpm: wpmInput.value,
            time: timeInput.value,
            isMirrored: mirrorToggle.checked,
            baseTheme: currentBaseTheme,
            mode: currentMode,
            alignment: currentAlignment,
            prompterDarkMode: prompterDarkMode,
            useClassicPrompter: useClassicPrompter,
            lastEditedPacingControl: lastEditedPacingControl
        };
        localStorage.setItem('teleprompterSettings', JSON.stringify(settings));
    }

    function loadSettings() {
        const settingsJSON = localStorage.getItem('teleprompterSettings');
        if (settingsJSON) {
            const settings = JSON.parse(settingsJSON);
            scriptText.value = settings.script || '';
            fontsizeInput.value = settings.fontSize || 60;
            wpmInput.value = settings.wpm || 150;
            timeInput.value = settings.time || '';
            mirrorToggle.checked = settings.isMirrored || false;
            currentBaseTheme = settings.baseTheme || 'nord';
            currentMode = settings.mode || 'dark';
            currentAlignment = settings.alignment || 'center';
            prompterDarkMode = typeof settings.prompterDarkMode === 'boolean' ? settings.prompterDarkMode : true;
            useClassicPrompter = settings.useClassicPrompter || true;
            lastEditedPacingControl = settings.lastEditedPacingControl || 'wpm';
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            currentBaseTheme = 'nord';
            useClassicPrompter = true;
            currentMode = prefersDark ? 'dark' : 'light';
            lastEditedPacingControl = 'wpm';
        }

        alignCenterIcon.style.display = currentAlignment === 'center' ? 'block' : 'none';
        alignLeftIcon.style.display = currentAlignment === 'left' ? 'block' : 'none';
        classicPrompterToggle.checked = useClassicPrompter;
        prompterDarkModeToggle.checked = prompterDarkMode;

        applyMainTheme();

        if (lastEditedPacingControl === 'time' && timeInput.value) {
            calculateWPMFromTime();
        } else {
            calculateTimeFromWPM();
        }

        updatePreview();
        updateMirrorPreview();
    }

    // --- EVENT LISTENERS ---
    function handleUserScrollStart() {
        clearTimeout(scrollTimeoutId);
        if (!isPaused) {
            wasRunningBeforeScroll = true;
            forcePause();
        }
    }
    startButton.addEventListener('click', startTeleprompter);
    closeBtn.addEventListener('click', () => stopTeleprompter(true));
    playPauseBtn.addEventListener('click', togglePause);
    restartBtn.addEventListener('click', restartScroll);
    returnBtn.addEventListener('click', returnToLastPosition);
    previewScrollBtn.addEventListener('click', togglePreviewScroll);
    alignToggleBtn.addEventListener('click', toggleAlignment);

    themeToggleBtn.addEventListener('click', toggleMainMode);
    classicPrompterToggle.addEventListener('change', handleClassicPrompterChange);
    prompterDarkModeToggle.addEventListener('change', handlePrompterModeChange);

    teleprompterDisplay.addEventListener('click', (e) => {
        if (!e.target.closest('.prompter-ui')) togglePause();
    });
    teleprompterDisplay.addEventListener('wheel', handleUserScrollStart, {
        passive: true
    });
    teleprompterDisplay.addEventListener('touchstart', handleUserScrollStart, {
        passive: true
    });
    teleprompterDisplay.addEventListener('scroll', () => {
        if (isExpectingProgrammaticScroll) {
            isExpectingProgrammaticScroll = false;
            return;
        }
        clearTimeout(scrollTimeoutId);
        const totalScrollHeight = teleprompterContent.scrollHeight - teleprompterDisplay.clientHeight;
        if (totalScrollHeight > 0) {
            const scrollFraction = teleprompterDisplay.scrollTop / totalScrollHeight;
            elapsedTimeAtPause = totalMilliseconds * scrollFraction;
            startTime = 0;
            updateRemainingTime(elapsedTimeAtPause);
        }
        if (wasRunningBeforeScroll) {
            scrollTimeoutId = setTimeout(() => {
                if (isPaused) {
                    wasRunningBeforeScroll = false;
                    togglePause();
                }
            }, 50);
        }
        if (isPaused && !wasRunningBeforeScroll) {
            if (Math.abs(teleprompterDisplay.scrollTop - lastPausedPosition) > 20) {
                if (hasFinished) return;
                returnBtn.style.display = 'flex';
                const position = lastPausedPosition + (teleprompterDisplay.clientHeight / 2);
                pauseIndicator.style.top = `${position - 2}px`;
                pauseIndicator.style.display = 'block';
            } else {
                returnBtn.style.display = 'none';
                pauseIndicator.style.display = 'none';
            }
        }
    });

    teleprompterDisplay.addEventListener('mousemove', resetUIFadeTimeout);
    teleprompterDisplay.addEventListener('mouseleave', hidePrompterUI);
    prompterUIElements.forEach(el => {
        el.addEventListener('mouseenter', showPrompterUI);
        el.addEventListener('mouseleave', resetUIFadeTimeout);
    });
    document.addEventListener('keydown', (e) => {
        if (teleprompterDisplay.style.display === 'block') {
            if (e.key === 'Escape') stopTeleprompter(true);
            else if (e.key === ' ') {
                e.preventDefault();
                togglePause();
            } else if (e.key.toLowerCase() === 'r') restartScroll();
        }
        else {
            if (e.key.toLowerCase() === 'm' && document.activeElement.tagName.toLowerCase() !== 'textarea') {
                e.preventDefault();
                mirrorToggle.checked = !mirrorToggle.checked;
                mirrorToggle.dispatchEvent(new Event('change'));
            }
        }
    });

    scriptText.addEventListener('input', () => {
        if (lastEditedPacingControl === 'wpm') {
            calculateTimeFromWPM();
        } else {
            calculateWPMFromTime();
        }
        updatePreview();
        saveSettings();
        stopPreviewScroll();
    });

    wpmInput.addEventListener('input', () => {
        lastEditedPacingControl = 'wpm';
        calculateTimeFromWPM();
        saveSettings();
        stopPreviewScroll();
    });

    timeInput.addEventListener('input', () => {
        lastEditedPacingControl = 'time';
        calculateWPMFromTime();
        saveSettings();
        stopPreviewScroll();
    });

    fontsizeInput.addEventListener('input', () => {
        updatePreview();
        saveSettings();
        stopPreviewScroll();
    });

    mirrorToggle.addEventListener('change', () => {
        updateMirrorPreview();
        saveSettings();
    });

    // --- INITIALIZATION ---
    loadSettings();
    setupCustomSelect();
});
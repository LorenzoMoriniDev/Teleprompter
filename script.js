document.addEventListener('DOMContentLoaded', () => {
    /* Antony over Caesar's body: a speech written to be delivered to a crowd
       from the front of the mind, which is the job this app is for. */
    const PLACEHOLDER_TEXT = "Friends, Romans, countrymen, lend me your ears; I come to bury Caesar, not to praise him.\n\nThe evil that men do lives after them; the good is oft interred with their bones. So let it be with Caesar. The noble Brutus hath told you Caesar was ambitious: if it were so, it was a grievous fault, and grievously hath Caesar answer'd it.";

    // --- DOM ELEMENT REFERENCES ---
    const scriptText = document.getElementById('script-text');
    const wordCountDisplay = document.getElementById('word-count');
    const startButton = document.getElementById('start-button');
    const closeBtn = document.getElementById('close-btn');
    const teleprompterDisplay = document.getElementById('teleprompter-display');
    const prompterUILayer = document.getElementById('prompter-ui-layer');
    const teleprompterContent = document.getElementById('teleprompter-content');
    const scriptTextWrapper = document.getElementById('script-text-wrapper');

    // Controls
    const fontsizeInput = document.getElementById('fontsize-input');
    const widthInput = document.getElementById('width-input');
    const widthSlider = document.getElementById('width-slider');
    const wpmInput = document.getElementById('wpm-input');
    const timeInput = document.getElementById('time-input');
    const secondsInput = document.getElementById('seconds-input');
    const mirrorHBtn = document.getElementById('mirror-h-btn');
    const mirrorVBtn = document.getElementById('mirror-v-btn');
    const alignToggleBtn = document.getElementById('align-toggle-btn');
    const alignCenterIcon = document.getElementById('align-center-icon');
    const alignLeftIcon = document.getElementById('align-left-icon');

    // Main Theme Controls
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const lightModeIcon = document.getElementById('light-mode-icon');
    const darkModeIcon = document.getElementById('dark-mode-icon');

    // Preview & Time Display
    const previewCard = document.querySelector('.preview-card');
    const textPreview = document.getElementById('text-preview');
    const previewText = document.getElementById('text-preview-text');
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
    let currentMode = 'dark';
    let currentAlignment = 'center';
    let lastEditedPacingControl = 'wpm'; // 'wpm' or 'time'
    let lastPausedPosition = 0;
    /* Position written by the animation itself, so its own scroll events can be
       told apart from the user's. A flag would stay armed when the last write
       moves nothing (at the very end) and would then swallow a real scroll.
       NaN while nothing is running: any number is a real distance away from it,
       where a sentinel like -1 sits within a pixel of the top of the scrollbar,
       which mirrored is the end of the script. */
    let programmaticScrollTop = Number.NaN;
    let hasFinished = false;
    let previewAnimationFrameId = null;
    let uiFadeTimeoutId = null;
    let scrollTimeoutId = null;
    let wasRunningBeforeScroll = false;
    let startTime = 0;
    let elapsedTimeAtPause = 0;
    let totalMilliseconds = 0;
    let formattedTotalTime = '0:00';
    let currentTextWidth = 45;
    let currentWpm = 120;
    let mirrorH = false;
    let mirrorV = false;
    let previewSourceText = '';
    /* How far through the script the preview is showing, as a share of it. Held
       rather than measured back off scrollTop, because a re-break moves the
       pixels under it: the moment the box narrows the browser wraps the already
       broken lines as well, the text grows taller, and the same scrollTop reads
       as a smaller share. Measuring then would lose ground every frame. */
    let previewProgress = 0;

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

    /* The pace is words per minute, so what counts as a word decides how fast
       the script runs. Splitting on whitespace answers that badly: it counts a
       lone dash or a stray "..." as a word to be read aloud, and it counts a
       line of Chinese or Japanese, which carries no spaces, as one. Intl.Segmenter
       applies the Unicode word rules (UAX #29) instead, which is the same
       boundary algorithm a word processor uses, and takes only the segments the
       standard marks as word-like. The preview asks for the count on every
       animation frame, so the last answer is kept. */
    const wordSegmenter = typeof Intl !== 'undefined' && Intl.Segmenter
        ? new Intl.Segmenter(undefined, { granularity: 'word' })
        : null;
    let lastCountedText = null;
    let lastWordCount = 0;

    function countWords(text) {
        if (text === lastCountedText) return lastWordCount;
        let count = 0;
        if (wordSegmenter) {
            for (const segment of wordSegmenter.segment(text)) {
                if (segment.isWordLike) count += 1;
            }
        } else {
            // no Segmenter before Safari 16.4, so fall back to the old split
            count = text.trim().split(/\s+/).filter(Boolean).length;
        }
        lastCountedText = text;
        lastWordCount = count;
        return count;
    }

    /* With the box empty the preview runs the stand-in, so that is the text the
       pacing describes: otherwise the fields read nothing while the preview is
       plainly scrolling through something for a length of time. Read straight
       from the box rather than from previewSourceText, which is only refreshed
       once the preview redraws, a keystroke later than the pacing needs it. */
    function pacedText() {
        return scriptText.value.trim() === '' ? PLACEHOLDER_TEXT : scriptText.value;
    }

    function updateWordCount() {
        const count = countWords(pacedText());
        wordCountDisplay.textContent = `${count} ${count === 1 ? 'word' : 'words'}`;
    }

    // --- CORE FUNCTIONS ---
    /* A run is a progress from 0 to 1 over the script, and where that sits on
       the scrollbar depends on the mirror: flipped top to bottom, the text
       block stands on its head inside its window, so the first line is at the
       bottom of the scrollbar and the run climbs back up it. Everything that
       moves or reads a position goes through these two, so the window itself
       is never transformed and the browser keeps scrolling it natively. */
    function scrollRange(viewport) {
        return Math.max(viewport.scrollHeight - viewport.clientHeight, 0);
    }

    function scrollTopFor(viewport, progress) {
        return scrollRange(viewport) * (mirrorV ? 1 - progress : progress);
    }

    function progressAt(viewport) {
        const range = scrollRange(viewport);
        if (range <= 0) return 0;
        // elastic overscroll can report past either end
        const fraction = Math.min(Math.max(viewport.scrollTop / range, 0), 1);
        return mirrorV ? 1 - fraction : fraction;
    }

    function startTeleprompter() {
        const text = scriptText.value;
        // whatever happens next, nothing should be left running behind it
        stopPreviewScroll();
        if (text.trim() === '') {
            alert('Please enter a script.');
            return;
        }

        textPreview.scrollTop = scrollTopFor(textPreview, 0); // no smooth animation, it must be back at the start now

        teleprompterContent.style.fontSize = `${fontsizeInput.value}px`;
        scriptTextWrapper.className = `text-align-${currentAlignment}`;
        applyMirrorState();
        hasFinished = false;
        playPauseBtn.disabled = false;
        isPaused = true;
        wasRunningBeforeScroll = false;
        startTime = 0;
        elapsedTimeAtPause = 0;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        document.getElementById('setup-container').style.display = 'none';
        document.documentElement.classList.add('is-prompting');
        teleprompterDisplay.style.display = 'block';
        prompterUILayer.style.display = 'block';
        teleprompterDisplay.classList.add('is-paused');
        // only measurable once the screen is up
        renderText(scriptTextWrapper, text);
        teleprompterDisplay.scrollTop = scrollTopFor(teleprompterDisplay, 0);
        showPrompterUI();
        setTimeout(() => {
            totalMilliseconds = (countWords(text) / currentWpm) * 60 * 1000;
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
        if (scrollRange(teleprompterDisplay) <= 0) {
            stopTeleprompter(false);
            return;
        }
        const progress = Math.min(totalElapsedTime / totalMilliseconds, 1);
        programmaticScrollTop = scrollTopFor(teleprompterDisplay, progress);
        teleprompterDisplay.scrollTop = programmaticScrollTop;
        updateRemainingTime(totalElapsedTime);
        if (progress >= 1) {
            hasFinished = true;
            playPauseBtn.disabled = true;
            stopTeleprompter(false);
        } else {
            animationFrameId = requestAnimationFrame(scrollStep);
        }
    }

    function stopTeleprompter(returnToSetup = true) {
        isPaused = true;
        programmaticScrollTop = Number.NaN;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        returnBtn.disabled = true;
        pauseIndicator.style.display = 'none';
        showPrompterUI();
        clearTimeout(uiFadeTimeoutId);
        if (returnToSetup) {
            document.getElementById('setup-container').style.display = 'flex';
            document.documentElement.classList.remove('is-prompting');
            teleprompterDisplay.style.display = 'none';
            prompterUILayer.style.display = 'none';
            /* Closing throws the run away: no leftover progress, paused position
               or finished state to inherit next time it is opened. */
            teleprompterDisplay.scrollTop = 0;
            elapsedTimeAtPause = 0;
            startTime = 0;
            lastPausedPosition = 0;
            hasFinished = false;
            playPauseBtn.disabled = false;
            updateRemainingTime(0);
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
            teleprompterDisplay.classList.add('is-paused');
        }
    }

    function forcePause() {
        if (isPaused) return;
        isPaused = true;
        programmaticScrollTop = Number.NaN;
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
            if (scrollRange(teleprompterDisplay) > 0) {
                elapsedTimeAtPause = totalMilliseconds * progressAt(teleprompterDisplay);
            }
            startTime = performance.now();
            returnBtn.disabled = true;
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
        playPauseBtn.disabled = false;
        isPaused = true;
        wasRunningBeforeScroll = false;
        startTime = 0;
        elapsedTimeAtPause = 0;
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        teleprompterDisplay.classList.add('is-paused');
        returnBtn.disabled = true;
        pauseIndicator.style.display = 'none';
        showPrompterUI();
        teleprompterDisplay.scrollTo({
            top: scrollTopFor(teleprompterDisplay, 0),
            behavior: 'smooth'
        });
        updateRemainingTime(0);
    }

    function returnToLastPosition() {
        teleprompterDisplay.scrollTo({
            top: lastPausedPosition,
            behavior: 'smooth'
        });
        returnBtn.disabled = true;
        pauseIndicator.style.display = 'none';
    }

    // --- UTILITY & PREVIEW FUNCTIONS ---
    function calculateTimeFromWPM() {
        const totalMinutes = countWords(pacedText()) / currentWpm;
        setTimeFields(totalMinutes);
        updateTotalTimePreview(totalMinutes);
    }

    /* The duration is two fields, so it reads like a duration and not like 0.13 */
    function getTotalMinutesFromFields() {
        const minutes = parseInt(timeInput.value, 10) || 0;
        const seconds = parseInt(secondsInput.value, 10) || 0;
        return minutes + seconds / 60;
    }

    function setTimeFields(totalMinutes) {
        if (!isFinite(totalMinutes) || totalMinutes <= 0) {
            timeInput.value = '';
            secondsInput.value = '';
            return;
        }
        let minutes = Math.floor(totalMinutes);
        let seconds = Math.round((totalMinutes - minutes) * 60);
        if (seconds === 60) {
            minutes += 1;
            seconds = 0;
        }
        timeInput.value = minutes;
        secondsInput.value = seconds;
    }

    function calculateWPMFromTime() {
        const wordCount = countWords(pacedText());
        const totalMinutes = getTotalMinutesFromFields();
        if (totalMinutes > 0) {
            applyWPM(Math.round(wordCount / totalMinutes));
            updateTotalTimePreview(totalMinutes);
        }
    }

    function updateTotalTimePreview(totalMinutes) {
        // blank while there is no script to pace, as the field itself is
        const wpmLabel = wpmInput.value === '' ? '' : ` · ${currentWpm} WPM`;
        if (isNaN(totalMinutes) || totalMinutes <= 0) {
            totalTimePreview.textContent = `0m 0s${wpmLabel}`;
            return;
        }
        const minutes = Math.floor(totalMinutes);
        const seconds = Math.round((totalMinutes - minutes) * 60);
        totalTimePreview.textContent = `${minutes}m ${seconds}s${wpmLabel}`;
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

    function applyTextWidth(value, updateInput = true) {
        const min = parseInt(widthInput.min, 10);
        const max = parseInt(widthInput.max, 10);
        currentTextWidth = Math.min(max, Math.max(min, parseInt(value, 10) || currentTextWidth));
        widthSlider.value = currentTextWidth;
        if (updateInput) widthInput.value = currentTextWidth;
        document.documentElement.style.setProperty('--text-width', `${currentTextWidth}%`);
        document.documentElement.style.setProperty('--text-fraction', currentTextWidth / 100);
        /* Only the whole screen loses its corners; anything narrower is a card */
        previewCard.classList.toggle('is-full-bleed', currentTextWidth === 100);
    }

    /* Every read of the pace goes through currentWpm, so the ceiling the markup
       declares is the ceiling the run obeys - a field left blank or holding
       four digits cannot put the script on screen at NaN or 6000 words a
       minute. Typing is left alone; the field is snapped on blur. */
    function applyWPM(value, updateInput = true) {
        const max = parseInt(wpmInput.max, 10);
        const typed = parseInt(value, 10);
        // there is no slowest pace, but zero and below are not paces at all
        let next = typed > 0 ? typed : currentWpm;
        /* The ceiling only applies if the markup declares it: the service worker
           can serve a cached page whose field predates it, and a missing
           attribute has to mean no limit, never NaN words a minute. */
        if (isFinite(max)) next = Math.min(max, next);
        currentWpm = next;
        if (updateInput) wpmInput.value = currentWpm;
        return currentWpm;
    }

    /* --- LINE BALANCING ---------------------------------------------------
       Browsers break lines greedily: each line takes as many words as fit, so
       the last line of a paragraph is often a lonely word. `text-wrap: balance`
       fixes that but Chrome gives up past a handful of lines, which is no use
       for a script.

       This is Knuth-Plass, the algorithm TeX uses: instead of deciding each
       break on its own, it scores every possible set of breaks for a paragraph
       and keeps the cheapest one. A line's badness is the square of the space
       left over at its end, so one very short line costs far more than several
       slightly short ones, and the paragraph comes out even. The last line of a
       paragraph is free, as in TeX, since it is meant to be short.

       Dynamic programming from the end of the paragraph backwards makes it
       O(words x words-per-line), fast enough to run on every keystroke. */
    const measureContext = document.createElement('canvas').getContext('2d');
    const wordWidthCache = new Map();
    const OVERLONG_WORD_PENALTY = 1e6;
    /* TeX leaves the last line free, which lets a paragraph end on a single
       stranded word. Anything shorter than this fraction of the line reads as
       leftover rather than as an ending, so it is charged for the difference. */
    const ORPHAN_FRACTION = 0.3;
    /* Weighted above the ordinary slack cost, otherwise a tidy line above wins
       against a stranded word below. */
    const ORPHAN_WEIGHT = 4;

    function measureWord(word, font) {
        const key = `${font}|~|${word}`;
        let width = wordWidthCache.get(key);
        if (width === undefined) {
            width = measureContext.measureText(word).width;
            wordWidthCache.set(key, width);
        }
        return width;
    }

    function balanceParagraph(paragraph, maxWidth, font) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        if (words.length < 2 || maxWidth <= 0) return paragraph;

        const spaceWidth = measureWord(' ', font);
        // prefix[i] = width of words 0..i-1 set solid, spaces excluded
        const prefix = [0];
        for (let i = 0; i < words.length; i++) {
            prefix.push(prefix[i] + measureWord(words[i], font));
        }
        const lineWidth = (from, to) =>
            prefix[to] - prefix[from] + spaceWidth * (to - from - 1);

        const total = words.length;
        const cost = new Float64Array(total + 1);
        const nextBreak = new Int32Array(total + 1);
        for (let i = total - 1; i >= 0; i--) {
            let best = Infinity;
            let bestBreak = i + 1;
            for (let j = i + 1; j <= total; j++) {
                const width = lineWidth(i, j);
                if (width > maxWidth && j > i + 1) break;
                let penalty;
                if (j === total) {
                    // last line may be short, but not a stranded word
                    const minLast = maxWidth * ORPHAN_FRACTION;
                    const orphan = minLast - width;
                    penalty = orphan > 0 ? ORPHAN_WEIGHT * orphan * orphan : 0;
                } else if (width > maxWidth) {
                    penalty = OVERLONG_WORD_PENALTY; // a single word too wide to fit
                } else {
                    const slack = maxWidth - width;
                    penalty = slack * slack;
                }
                const candidate = penalty + cost[j];
                if (candidate < best) {
                    best = candidate;
                    bestBreak = j;
                }
            }
            cost[i] = best;
            nextBreak[i] = bestBreak;
        }

        const lines = [];
        for (let i = 0; i < total; i = nextBreak[i]) {
            lines.push(words.slice(i, nextBreak[i]).join(' '));
        }
        return lines.join('\n');
    }

    /* Balances `text` for the box it will be rendered in, measuring with that
       box's own font and inner width so preview and prompter agree. */
    function balanceForElement(element, text) {
        if (!text) return text;
        const style = getComputedStyle(element);
        const maxWidth = element.clientWidth -
            parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        if (!isFinite(maxWidth) || maxWidth <= 0) return text;
        const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        measureContext.font = font;
        return text.split('\n')
            .map(paragraph => balanceParagraph(paragraph, maxWidth, font))
            .join('\n');
    }

    /* The prompter pads the script by half a screen so it scrolls up to the reading
       line; the preview does the same with half its own height. */
    function syncPreviewPadding() {
        const halfHeight = textPreview.clientHeight / 2;
        previewText.style.paddingBlock = `${halfHeight}px`;
    }

    /* Balancing measures against the element's own width, so the text has to be
       in the element before it can be balanced. */
    function renderText(container, text) {
        container.textContent = text;
        container.textContent = balanceForElement(container, text);
    }

    function updatePreview() {
        updateWordCount();
        const shown = pacedText();
        previewSourceText = shown;
        textPreview.style.fontSize = `${fontsizeInput.value}px`;
        renderText(previewText, shown);
        previewText.classList.toggle('text-align-center', currentAlignment === 'center');
        previewText.classList.toggle('text-align-left', currentAlignment === 'left');
        syncPreviewPadding();
        /* Re-breaking changes how tall the text is, so the reading line is put
           back by the share of the script it had reached, not by the pixels it
           was at. Idle, that share is nought: the still of the first line. */
        textPreview.scrollTop = scrollTopFor(textPreview, previewProgress);
    }

    /* Mirroring is two independent flips: left-to-right for a beamsplitter,
       top-to-bottom for rigs that bounce the image off a mirror overhead. */
    function applyMirrorState() {
        [previewText, scriptTextWrapper].forEach(el => {
            el.classList.toggle('mirror-h', mirrorH);
            el.classList.toggle('mirror-v', mirrorV);
        });
        mirrorHBtn.classList.toggle('is-active', mirrorH);
        mirrorVBtn.classList.toggle('is-active', mirrorV);
        mirrorHBtn.setAttribute('aria-pressed', String(mirrorH));
        mirrorVBtn.setAttribute('aria-pressed', String(mirrorV));
    }

    function stopPreviewScroll() {
        if (!previewAnimationFrameId) return;
        cancelAnimationFrame(previewAnimationFrameId);
        previewAnimationFrameId = null;
        previewProgress = 0;
        textPreview.scrollTo({
            top: scrollTopFor(textPreview, 0),
            behavior: 'smooth'
        });
        previewPlayIcon.style.display = 'block';
        previewStopIcon.style.display = 'none';
    }

    function togglePreviewScroll() {
        if (previewAnimationFrameId) {
            stopPreviewScroll();
            return;
        }
        previewPlayIcon.style.display = 'none';
        previewStopIcon.style.display = 'block';
        previewProgress = 0;
        let lastFrameTime = performance.now();

        /* Everything is recomputed each frame, so changing the script, the pace,
           the font, the width or the window size never interrupts the run.

           The pace is applied as a rate: each frame adds the ground covered
           since the last one at the pace in force now. Dividing the whole
           elapsed time by the current total instead would rewrite history every
           time the pace changed - raise it halfway through and the run would
           find itself already past the end, and stop. */
        function previewStep(timestamp) {
            const totalScriptTimeMs = (countWords(previewSourceText) / currentWpm) * 60 * 1000;
            if (scrollRange(textPreview) <= 0 || !isFinite(totalScriptTimeMs) || totalScriptTimeMs <= 0) {
                stopPreviewScroll();
                return;
            }
            previewProgress += (timestamp - lastFrameTime) / totalScriptTimeMs;
            lastFrameTime = timestamp;
            if (previewProgress >= 1) {
                stopPreviewScroll();
                return;
            }
            textPreview.scrollTop = scrollTopFor(textPreview, previewProgress);
            previewAnimationFrameId = requestAnimationFrame(previewStep);
        }
        previewAnimationFrameId = requestAnimationFrame(previewStep);
    }

    // --- THEME & SETTINGS MANAGEMENT ---
    function applyMainTheme() {
        document.documentElement.setAttribute('data-theme', `nord-${currentMode}`);
        lightModeIcon.style.display = currentMode === 'light' ? 'block' : 'none';
        darkModeIcon.style.display = currentMode === 'dark' ? 'block' : 'none';
    }

    function toggleMainMode() {
        currentMode = currentMode === 'light' ? 'dark' : 'light';
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
            textWidth: currentTextWidth,
            wpm: currentWpm,
            time: getTotalMinutesFromFields() || '',
            mirrorH,
            mirrorV,
            mode: currentMode,
            alignment: currentAlignment,
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
            widthInput.value = settings.textWidth || 45;
            applyWPM(settings.wpm || 150);
            setTimeFields(parseFloat(settings.time));
            mirrorH = settings.mirrorH ?? settings.isMirrored ?? false;
            mirrorV = settings.mirrorV || false;
            currentMode = settings.mode || 'dark';
            currentAlignment = settings.alignment || 'center';
            lastEditedPacingControl = settings.lastEditedPacingControl || 'wpm';
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            currentMode = prefersDark ? 'dark' : 'light';
            lastEditedPacingControl = 'wpm';
        }

        alignCenterIcon.style.display = currentAlignment === 'center' ? 'block' : 'none';
        alignLeftIcon.style.display = currentAlignment === 'left' ? 'block' : 'none';

        applyMainTheme();

        if (lastEditedPacingControl === 'time' && getTotalMinutesFromFields() > 0) {
            calculateWPMFromTime();
        } else {
            calculateTimeFromWPM();
        }

        applyTextWidth(widthInput.value);
        updatePreview();
        applyMirrorState();
    }

    // --- EVENT LISTENERS ---
    /* Resume shortly after the user stops scrolling. Driven by the wheel itself
       as well as by scroll events, because scrolling at the very end of the
       script, or over the fixed controls, fires no scroll event at all and used
       to leave the prompter paused for good. */
    function scheduleResume() {
        if (!wasRunningBeforeScroll) return;
        clearTimeout(scrollTimeoutId);
        scrollTimeoutId = setTimeout(() => {
            wasRunningBeforeScroll = false;
            if (isPaused) togglePause();
        }, 150);
    }

    function handleUserScrollStart() {
        clearTimeout(scrollTimeoutId);
        if (!isPaused) {
            wasRunningBeforeScroll = true;
            forcePause();
        }
        scheduleResume();
    }
    startButton.addEventListener('click', startTeleprompter);
    closeBtn.addEventListener('click', () => stopTeleprompter(true));
    playPauseBtn.addEventListener('click', togglePause);
    restartBtn.addEventListener('click', restartScroll);
    returnBtn.addEventListener('click', returnToLastPosition);
    previewScrollBtn.addEventListener('click', togglePreviewScroll);
    textPreview.addEventListener('click', togglePreviewScroll);
    alignToggleBtn.addEventListener('click', toggleAlignment);

    themeToggleBtn.addEventListener('click', toggleMainMode);

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
        if (Math.abs(teleprompterDisplay.scrollTop - programmaticScrollTop) < 1.5) return;
        clearTimeout(scrollTimeoutId);
        if (scrollRange(teleprompterDisplay) > 0) {
            const scrollFraction = progressAt(teleprompterDisplay);
            elapsedTimeAtPause = totalMilliseconds * scrollFraction;
            startTime = 0;
            updateRemainingTime(elapsedTimeAtPause);
            /* Reaching the end locks play/pause until a restart. Scrolling back
               into the script means there is something left to read, so unlock. */
            if (hasFinished && scrollFraction < 0.999) {
                hasFinished = false;
                playPauseBtn.disabled = false;
            }
        }
        scheduleResume();
        if (isPaused && !wasRunningBeforeScroll) {
            const awayFromPause = Math.abs(teleprompterDisplay.scrollTop - lastPausedPosition) > 20;
            returnBtn.disabled = !awayFromPause || hasFinished;
            if (awayFromPause && !hasFinished) {
                const position = lastPausedPosition + (teleprompterDisplay.clientHeight / 2);
                pauseIndicator.style.top = `${position - 2}px`;
                pauseIndicator.style.display = 'block';
            } else {
                pauseIndicator.style.display = 'none';
            }
        }
    });

    teleprompterDisplay.addEventListener('mousemove', resetUIFadeTimeout);
    teleprompterDisplay.addEventListener('mouseleave', hidePrompterUI);
    prompterUIElements.forEach(el => {
        el.addEventListener('mouseenter', showPrompterUI);
        el.addEventListener('mouseleave', resetUIFadeTimeout);
        el.addEventListener('wheel', (e) => {
            e.preventDefault();
            handleUserScrollStart();
            teleprompterDisplay.scrollTop += e.deltaY;
        }, {
            passive: false
        });
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
            const tag = document.activeElement.tagName.toLowerCase();
            const isTyping = tag === 'textarea' || tag === 'input';
            if (e.key === ' ' && !isTyping) {
                e.preventDefault();
                togglePreviewScroll();
            }
        }
    });

    /* Editing the script is the only change that stops a running preview: the
       text it was scrolling through no longer exists. Font size, width, pacing
       and window resizes all leave it running. */
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
        const typed = parseInt(wpmInput.value, 10);
        const max = parseInt(wpmInput.max, 10);
        lastEditedPacingControl = 'wpm';
        if (!(typed > 0) || typed > max) return;
        applyWPM(typed, false);
        calculateTimeFromWPM();
        saveSettings();
    });

    /* Pacing is typed in whole numbers. A duration worked out from a pace keeps
       its fractions internally and shows the rounded figure, but a decimal point
       is not something that can be entered into any of these three - nor a sign,
       nor an exponent, nor a pasted "1.5". Deletions carry no data, so they pass. */
    [wpmInput, timeInput, secondsInput].forEach(input => {
        input.addEventListener('beforeinput', (e) => {
            if (e.data && /\D/.test(e.data)) e.preventDefault();
        });
    });

    wpmInput.addEventListener('blur', () => {
        applyWPM(wpmInput.value);
        calculateTimeFromWPM();
        saveSettings();
    });

    [timeInput, secondsInput].forEach(input => {
        input.addEventListener('input', () => {
            lastEditedPacingControl = 'time';
            calculateWPMFromTime();
            saveSettings();
        });
    });

    /* 90 seconds is a valid thing to type; it just becomes 1 min 30 sec. A
       duration too short for the WPM cap settles on the fastest one it allows,
       so the two fields never describe different runs. */
    [timeInput, secondsInput].forEach(input => {
        input.addEventListener('blur', () => {
            if (timeInput.value === '' && secondsInput.value === '') return;
            const asked = getTotalMinutesFromFields();
            const wordCount = countWords(pacedText());
            const fastest = wordCount / currentWpm;
            const settled = wordCount > 0 && asked < fastest ? fastest : asked;
            setTimeFields(settled);
            updateTotalTimePreview(settled); // the fields moved, the summary follows
            saveSettings();
        });
    });

    fontsizeInput.addEventListener('input', () => {
        updatePreview();
        saveSettings();
    });

    widthInput.addEventListener('input', () => {
        easePreviewWidth();
        const typed = parseInt(widthInput.value, 10);
        const min = parseInt(widthInput.min, 10);
        const max = parseInt(widthInput.max, 10);
        if (!isFinite(typed) || typed < min || typed > max) return;
        applyTextWidth(typed, false);
        updatePreview(); // line breaks depend on the width
        saveSettings();
    });

    widthInput.addEventListener('blur', () => {
        easePreviewWidth();
        applyTextWidth(widthInput.value);
        updatePreview();
        saveSettings();
    });

    widthSlider.addEventListener('input', () => {
        easePreviewWidth();
        applyTextWidth(widthSlider.value);
        updatePreview();
        saveSettings();
    });

    /* The preview is a rehearsal in a box on the page, so with the window out of
       focus there is nobody watching it. The frames stop arriving anyway while a
       page is hidden, and since the run is timed against the clock it would come
       back having jumped to where it would have got to, which is worse than
       stopping. The prompter itself is left alone: it is often the window you
       are not clicking in. */
    window.addEventListener('blur', (e) => {
        // only the window losing focus, never a field's own blur passing through
        if (e.target === window) stopPreviewScroll();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopPreviewScroll();
    });

    /* The steppers stand in for the spin buttons the CSS hides: step the field,
       then let its own handlers see it - the blur included, so a stepped value
       lands normalised exactly as a typed one does. */
    document.querySelectorAll('.step-btn').forEach(button => {
        button.addEventListener('click', () => {
            const input = button.closest('.text-field').querySelector('input');
            if (button.dataset.step === 'up') input.stepUp();
            else input.stepDown();
            input.dispatchEvent(new Event('input', { bubbles: true }));
            /* Not bubbling: a real blur does not either, and the window listens
               for its own blur to stop the preview. */
            input.dispatchEvent(new Event('blur'));
        });
    });

    /* The width eases only when the width control is what moved it, so the class
       is armed by those handlers alone and dropped again the moment the run is
       over - or the moment anything else moves the window, even mid-run, since
       a resize or a zoom must land instantly however it arrives. Re-arming is
       idempotent: dragging the slider just keeps pushing the deadline out. */
    let widthEaseTimer = null;

    function easePreviewWidth() {
        clearTimeout(widthEaseTimer);
        previewCard.classList.add('is-easing-width');
        // the class has to be in force before the width moves, or nothing eases
        void previewCard.offsetWidth;
        widthEaseTimer = setTimeout(cutPreviewWidthEase, 400);
    }

    function cutPreviewWidthEase() {
        clearTimeout(widthEaseTimer);
        widthEaseTimer = null;
        previewCard.classList.remove('is-easing-width');
    }

    /* Line breaks are measured against the width of the box, and the box takes
       150ms to get there. The balancer writes its breaks into the text as real
       newlines, so the browser cannot re-wrap them on the way: without this the
       lines stay broken for the old width for the whole animation and then snap
       into place at the end. So they are re-measured on every frame of it. The
       deadline is a stop, in case an end event never arrives. */
    let previewResizeFrame = null;

    function trackPreviewWidth() {
        if (previewResizeFrame) return;
        const deadline = performance.now() + 1000;
        const step = () => {
            updatePreview();
            previewResizeFrame = performance.now() < deadline ? requestAnimationFrame(step) : null;
        };
        previewResizeFrame = requestAnimationFrame(step);
    }

    function settlePreviewWidth() {
        cutPreviewWidthEase();
        if (!previewResizeFrame) return;
        cancelAnimationFrame(previewResizeFrame);
        previewResizeFrame = null;
        updatePreview(); // once more, at the width it actually settled on
    }

    previewCard.addEventListener('transitionstart', (e) => {
        if (e.propertyName === 'width') trackPreviewWidth();
    });

    ['transitionend', 'transitioncancel'].forEach(type => {
        previewCard.addEventListener(type, (e) => {
            if (e.propertyName === 'width') settlePreviewWidth();
        });
    });

    window.addEventListener('resize', () => {
        cutPreviewWidthEase(); // a resize or a zoom lands at once, mid-ease or not
        syncPreviewPadding();
        updatePreview();
    });

    mirrorHBtn.addEventListener('click', () => {
        mirrorH = !mirrorH;
        applyMirrorState();
        saveSettings();
    });

    mirrorVBtn.addEventListener('click', () => {
        /* The flip moves the script to the other end of the scrollbar, so the
           preview is put back at the share of it that it was showing. */
        mirrorV = !mirrorV;
        applyMirrorState();
        textPreview.scrollTop = scrollTopFor(textPreview, previewProgress);
        saveSettings();
    });

    // --- INITIALIZATION ---
    loadSettings();
    /* Measurements taken before the webfont lands are wrong, so redo them. */
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            wordWidthCache.clear();
            updatePreview();
        });
    }
});
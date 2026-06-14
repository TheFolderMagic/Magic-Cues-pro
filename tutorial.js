/**
 * Magic Cues Pro - Fully Self-Contained Onboarding & Play/Pause Controller
 * Dynamically injects styling, guides, and interception hooks without touching index.html.
 *
 * FIX LOG:
 * [FIX-ANIMATION]      applyTutHighlight() now tracks currentHighlightEl and only removes/
 *                       re-adds the CSS class when the target element actually changes,
 *                       so squirclePulse runs continuously without resetting every 250 ms.
 * [FIX-DOUBLE-FIRE]    Added tutTransitioning guard (350 ms cooldown) inside openTutorial()
 *                       to block simultaneous duplicate calls from poll + click racing.
 * [FIX-STEP-ENTRY]     stepEntryTime is stamped on every openTutorial() call.
 * [FIX-PREMATURE-JUMP] All modal-close escape checks (!settingsOpen, !menuOpen, !projectsOpen)
 *                       now require an 800 ms grace period after step entry before firing,
 *                       preventing false-positive jumps during intra-step transitions.
 * [FIX-CLICK-DUPE]     Removed the clickAdvanceMap interceptor entirely. All step transitions
 *                       are driven exclusively by the poll + the volume input listener,
 *                       eliminating the double-fire on every tappable element.
 * [FIX-DOUBLE-INIT]    Removed the deferred openTutorial() call from runOnboardingSetup().
 *                       Startup is now gated exclusively through a single initTutorial() call
 *                       at the end of initSetup().
 */

(function() {
    // Prevent double initialization during reloads or multiple script loads
    if (window.tutInitialized) return;
    window.tutInitialized = true;

    const $_tut = id => document.getElementById(id);

    // Global Onboarding States
    window.tutActive = false;
    window.tutType   = 'basic';
    window.tutStep   = 0;
    let initTutorialCalled = false;

    // [FIX-DOUBLE-FIRE]  Blocks simultaneous duplicate openTutorial() calls
    let tutTransitioning = false;
    // [FIX-STEP-ENTRY]   Records when the current step was entered
    let stepEntryTime = 0;
    // [FIX-ANIMATION]    Tracks the currently highlighted element reference
    let currentHighlightEl = null;

    // Helper to safely trigger parent haptic feedback if available
    const triggerTutHaptic = (pattern) => {
        if (typeof haptic === 'function') haptic(pattern);
        else if (navigator.vibrate) navigator.vibrate(pattern);
    };

    // [FIX-ANIMATION] Only re-apply class when the target element actually changes
    const clearTutHighlights = () => {
        document.querySelectorAll('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));
        currentHighlightEl = null;
    };

    const applyTutHighlight = (targetGetter) => {
        const el = (typeof targetGetter === 'function') ? targetGetter() : null;
        // Same element already highlighted — do nothing, keep animation running
        if (el && el === currentHighlightEl) return;
        clearTutHighlights();
        currentHighlightEl = el;
        if (el) el.classList.add('tut-highlight');
    };

    // Onboarding Steps Array (10 Master Steps Covering All Core Functions)
    const tutSteps = [
        {
            title: "Import Your Music",
            badge: "Step 1 of 10",
            text: "Let's build your cue list. Tap <strong>Add Cue</strong> to load an audio file from your device.",
            target: () => $_tut('add-cue-btn'),
            waitForAction: true
        },
        {
            title: "Access Cue Settings",
            badge: "Step 2 of 10",
            text: "Great! Your track is loaded. Tap the <strong>Settings Gear (⚙)</strong> on the right of the cue card to open its options.",
            target: () => document.querySelector('.tile .edit-trigger'),
            alignTo: () => document.querySelector('.tile'),
            waitForAction: true
        },
        {
            title: "Individual Volume Level",
            badge: "Step 3 of 10",
            text: "Drag the <strong>Volume Slider</strong> to set a custom playback volume level. Tapping or sliding the range input will proceed.",
            target: () => $_tut('cue-volume-slider-row'),
            waitForAction: true
        },
        {
            title: "Voice Command Setup",
            badge: "Step 4 of 10",
            text: "Tapping <strong>Voice Triggers</strong> expands spoken trigger configurations. Assign a phrase here to fire this cue hands-free.",
            target: () => $_tut('cue-voice-details'),
            waitForAction: true
        },
        {
            title: "Timelines & Ducking",
            badge: "Step 5 of 10",
            text: "Tapping <strong>Advanced Settings</strong> expands timelines. Here you can configure custom fade-in/out curves, infinite track looping, or activate automatic background audio ducking.",
            target: () => $_tut('cue-advanced-details'),
            waitForAction: true
        },
        {
            title: "Close Options Panel",
            badge: "Step 6 of 10",
            text: "Now, let's return to the main dashboard. Tap the top-right <strong>Close (X)</strong> button to exit the panel.",
            target: () => document.querySelector('#settings-modal .icon-btn'),
            waitForAction: true
        },
        {
            title: "Cue Context Menu",
            badge: "Step 7 of 10",
            text: "<strong>Long-press</strong> (press and hold) anywhere on the middle of the cue card to open the quick actions context menu.",
            target: () => document.querySelector('.tile'),
            alignTo: () => document.querySelector('.tile'),
            waitForAction: true
        },
        {
            title: "Context Menu Options",
            badge: "Step 8 of 10",
            text: "In this panel, you can duplicate cues, compile cue groups, or tap <strong>Skip Cue</strong> to bypass a track during live performances. Tap the close cross on the top right when done.",
            target: () => document.querySelector('#cue-menu-modal .icon-btn'),
            waitForAction: true
        },
        {
            title: "Manage Shows",
            badge: "Step 9 of 10",
            text: "Tap the <strong>Show Title Header</strong> at the top left to manage projects, restore show backups (with <code>.magic</code> extensions), or export configurations.",
            target: () => $_tut('show-title-header'),
            waitForAction: true
        },
        {
            title: "Onboarding Concluded",
            badge: "Step 10 of 10",
            text: "Guide complete! Replay this interactive guide at any time from App Settings. Tap <strong>Finish</strong> to close and start performing.",
            target: null,
            waitForAction: false
        }
    ];

    // Removes the vector arrow when card runs relative inside dynamic dialog boxes
    const removeArrow = () => {
        const arrow = $_tut('tutorial-arrow');
        if (arrow) arrow.style.display = 'none';
    };

    // Renders the pointing triangle targeting center coordinates of target elements
    const updateArrow = (direction, arrowOffset) => {
        let arrow = $_tut('tutorial-arrow');
        if (!arrow) {
            arrow = document.createElement('div');
            arrow.id = 'tutorial-arrow';
            $_tut('tutorial-bar').appendChild(arrow);
        }

        arrow.style.display      = 'block';
        arrow.style.position     = 'absolute';
        arrow.style.width        = '0';
        arrow.style.height       = '0';
        arrow.style.borderStyle  = 'solid';
        arrow.style.zIndex       = '13001';

        const tutBar = $_tut('tutorial-bar');
        const clampedOffset = Math.max(16, Math.min(tutBar.clientWidth - 32, arrowOffset - 10));
        arrow.style.left = `${clampedOffset}px`;

        if (direction === 'top') {
            arrow.style.top         = '-10px';
            arrow.style.bottom      = 'auto';
            arrow.style.borderWidth = '0 10px 10px 10px';
            arrow.style.borderColor = 'transparent transparent var(--accent) transparent';
        } else {
            arrow.style.bottom      = '-10px';
            arrow.style.top         = 'auto';
            arrow.style.borderWidth = '10px 10px 0 10px';
            arrow.style.borderColor = 'var(--accent) transparent transparent transparent';
        }
    };

    // Absolute screen positioning system with an expanded 24px breathing gap
    const positionPopover = (targetEl, alignEl = null) => {
        const tutBar = $_tut('tutorial-bar');
        if (!tutBar || !targetEl) return;

        const activeDialog = document.querySelector('dialog[open]');
        if (activeDialog) {
            if (tutBar.parentElement !== activeDialog) activeDialog.appendChild(tutBar);
            tutBar.style.position     = 'relative';
            tutBar.style.top          = 'auto';
            tutBar.style.left         = 'auto';
            tutBar.style.right        = 'auto';
            tutBar.style.bottom       = 'auto';
            tutBar.style.transform    = 'none';
            tutBar.style.width        = '100%';
            tutBar.style.maxWidth     = 'none';
            tutBar.style.margin       = '16px 0 0 0';
            tutBar.style.boxShadow    = 'none';
            tutBar.style.border       = '1px solid var(--accent)';
            tutBar.style.background   = 'rgba(128,128,128,0.06)';
            tutBar.style.borderRadius = '18px';
            removeArrow();
            return;
        }

        if (tutBar.parentElement !== document.body) document.body.appendChild(tutBar);

        const rect      = targetEl.getBoundingClientRect();
        const alignRect = alignEl ? alignEl.getBoundingClientRect() : rect;
        const barWidth  = tutBar.offsetWidth || 290;
        const viewWidth = window.innerWidth;
        const viewHeight = window.innerHeight;

        let top = 0;
        let arrowDirection = 'bottom';

        const spaceBelow = viewHeight - rect.bottom;
        const spaceAbove = rect.top;

        if (spaceBelow > spaceAbove) {
            top            = rect.bottom + window.scrollY + 24;
            arrowDirection = 'top';
        } else {
            const mockBarHeight = tutBar.clientHeight || 140;
            top            = rect.top + window.scrollY - mockBarHeight - 24;
            arrowDirection = 'bottom';
        }

        let left = alignEl
            ? (alignRect.right + window.scrollX) - barWidth
            : (rect.left + rect.width / 2 + window.scrollX) - barWidth / 2;

        left = Math.max(12, Math.min(viewWidth - barWidth - 12, left));

        tutBar.style.position     = 'absolute';
        tutBar.style.top          = `${top}px`;
        tutBar.style.left         = `${left}px`;
        tutBar.style.transform    = 'none';
        tutBar.style.width        = 'calc(100% - 24px)';
        tutBar.style.maxWidth     = `${barWidth}px`;
        tutBar.style.margin       = '0';
        tutBar.style.zIndex       = '13000';
        tutBar.style.boxShadow    = '0 20px 50px rgba(0,0,0,0.6)';
        tutBar.style.border       = '2px solid var(--accent)';
        tutBar.style.background   = 'var(--modal-bg)';
        tutBar.style.borderRadius = '24px';

        const targetCenter = rect.left + rect.width / 2 + window.scrollX;
        updateArrow(arrowDirection, targetCenter - left);
    };

    window.adjustTutorialBarParent = () => {
        const step = tutSteps[window.tutStep];
        let targetEl = null, alignEl = null;
        if (step && typeof step.target === 'function') targetEl = step.target();
        if (step && typeof step.alignTo === 'function') alignEl  = step.alignTo();

        if (targetEl) {
            positionPopover(targetEl, alignEl);
        } else {
            const tutBar = $_tut('tutorial-bar');
            if (tutBar) {
                tutBar.style.position  = 'fixed';
                tutBar.style.bottom    = '24px';
                tutBar.style.top       = 'auto';
                tutBar.style.left      = '50%';
                tutBar.style.transform = 'translateX(-50%)';
                tutBar.style.width     = 'calc(100% - 48px)';
                tutBar.style.maxWidth  = '290px';
                tutBar.style.margin    = '0 auto';
                tutBar.style.zIndex    = '13000';
                removeArrow();
            }
        }
    };

    // [FIX-DOUBLE-FIRE] Guard prevents simultaneous or rapid duplicate step changes.
    // nextTutStep/prevTutStep reset the lock before calling to ensure buttons always respond.
    window.openTutorial = (stepIdx = 0) => {
        if (tutTransitioning) return;
        tutTransitioning = true;
        setTimeout(() => { tutTransitioning = false; }, 350);

        window.tutActive = true;
        window.tutType   = 'basic';

        const currentTracks = (typeof tracks !== 'undefined') ? tracks : [];
        if (stepIdx === 0 && currentTracks.length > 0) stepIdx = 1;

        window.tutStep = stepIdx;
        stepEntryTime  = Date.now(); // [FIX-STEP-ENTRY]
        document.body.classList.add('tut-active');
        localStorage.setItem('mc_tutorial_step', stepIdx);

        if (stepIdx === 2) {
            const cueMenuModal = $_tut('cue-menu-modal');
            if (cueMenuModal && cueMenuModal.hasAttribute('open')) {
                cueMenuModal.close();
                document.body.classList.remove('modal-open');
            }
        }

        const step = tutSteps[window.tutStep];
        if (!step) return;

        const titleEl = $_tut('tut-bar-title');
        if (titleEl) titleEl.innerText = step.title;
        $_tut('tut-bar-step').innerText  = `Step ${window.tutStep + 1} of ${tutSteps.length}`;
        $_tut('tut-bar-badge').innerText = step.badge;
        $_tut('tut-bar-text').innerHTML  = step.text;

        applyTutHighlight(step.target);
        window.adjustTutorialBarParent();

        $_tut('tut-bar-next').innerText      = (window.tutStep === tutSteps.length - 1) ? 'Finish' : 'Next';
        $_tut('tut-bar-next').style.display  = step.waitForAction ? 'none' : 'block';
        $_tut('tutorial-bar').style.display  = 'flex';
    };

    window.nextTutStep = () => {
        triggerTutHaptic(10);
        tutTransitioning = false; // User action always takes priority
        if (window.tutStep < tutSteps.length - 1) {
            window.openTutorial(window.tutStep + 1);
        } else {
            window.finishTutorial();
        }
    };

    window.prevTutStep = () => {
        triggerTutHaptic(10);
        tutTransitioning = false; // User action always takes priority
        if (window.tutStep > 0) window.openTutorial(window.tutStep - 1);
    };

    window.skipTutorial = () => {
        triggerTutHaptic([15, 30]);
        window.finishTutorial();
    };

    window.finishTutorial = () => {
        tutTransitioning = false; // Ensure clean state
        clearTutHighlights();
        window.tutActive = false;
        document.body.classList.remove('tut-active');
        localStorage.setItem('mc_tutorial_completed', 'true');
        localStorage.removeItem('mc_tutorial_step');
        $_tut('tutorial-bar').style.display = 'none';
        window.adjustTutorialBarParent();
    };

    // Helper to programmatically map structural IDs onto dynamic elements
    const runDynamicIdSetup = () => {
        const actionBtns = document.querySelectorAll('.action-row .action-btn');
        actionBtns.forEach(btn => {
            if (btn.textContent.includes('Add Cue')) btn.id = 'add-cue-btn';
            else if (btn.textContent.includes('Reset')) btn.id = 'reset-show-btn';
        });

        const titleHeader = document.querySelector('header h1');
        if (titleHeader) titleHeader.id = 'show-title-header';

        const headerBtns = document.querySelectorAll('header .icon-btn');
        headerBtns.forEach(btn => {
            const icon = btn.querySelector('.material-symbols-rounded');
            if (icon) {
                if (icon.textContent === 'settings') btn.id = 'header-settings-btn';
                else if (icon.id === 'lock-icon')    btn.id = 'header-lock-btn';
            }
        });

        const projectsModalBtns = document.querySelectorAll('#projects-modal .action-btn');
        projectsModalBtns.forEach(btn => {
            if (btn.textContent.includes('Import')) btn.id = 'show-import-btn';
            else if (btn.textContent.includes('New')) btn.id = 'show-new-btn';
        });

        const detailsList = document.querySelectorAll('#modal-content details');
        detailsList.forEach(det => {
            const sum = det.querySelector('summary');
            if (sum) {
                if (sum.textContent.includes('Voice Triggers'))    det.id = 'cue-voice-details';
                else if (sum.textContent.includes('Advanced Settings')) det.id = 'cue-advanced-details';
            }
        });

        const volumeInput = document.querySelector('#modal-content input[type="range"]');
        if (volumeInput) {
            const row = volumeInput.closest('.setting-row');
            if (row) row.id = 'cue-volume-slider-row';
        }
    };

    // Configures listeners and state observation loops
    const runOnboardingSetup = () => {
        // 1. Inject Styles
        const styleEl   = document.createElement('style');
        styleEl.type    = 'text/css';
        const cssCode = `
            #tutorial-bar {
                position: absolute;
                width: calc(100% - 48px);
                max-width: 290px;
                background: var(--modal-bg);
                border: 2px solid var(--accent);
                border-radius: 24px;
                padding: 16px;
                z-index: 13000;
                box-shadow: 0 20px 50px rgba(0,0,0,0.6);
                display: none;
                flex-direction: column;
                gap: 10px;
                box-sizing: border-box;
            }
            #tutorial-bar.pos-top  { top: 24px;  bottom: auto; }
            #tutorial-bar.pos-bottom { top: auto; bottom: 24px; }
            #tutorial-bar p {
                margin: 0;
                font-size: 14px !important;
                line-height: 1.5 !important;
                color: var(--text-main);
                font-weight: 500;
            }
            #tutorial-bar .tut-step-indicator {
                font-size: 9px;
                font-weight: 800;
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 4px;
                display: block;
            }
            #tutorial-bar .tut-section-badge {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 6px;
                background: var(--accent-glow);
                color: var(--accent);
                font-size: 9px;
                font-weight: 700;
                margin-bottom: 4px;
                text-transform: uppercase;
            }
            #tutorial-bar .action-btn {
                padding: 6px 12px !important;
                font-size: 12px !important;
            }
            #show-title-header.tut-highlight {
                padding: 6px 16px !important;
                margin-top: -6px !important;
                margin-bottom: -6px !important;
                margin-left: -16px !important;
                margin-right: -16px !important;
                border-radius: 12px !important;
            }
            @keyframes squirclePulse {
              0%   { box-shadow: 0 0 0 1px var(--accent), 0 0 0 2px rgba(0,122,255,0.4),  0 4px 16px rgba(0,122,255,0.15); }
              50%  { box-shadow: 0 0 0 3.5px var(--accent), 0 0 0 10px rgba(0,122,255,0.25), 0 12px 30px rgba(0,122,255,0.45); }
              100% { box-shadow: 0 0 0 1px var(--accent), 0 0 0 2px rgba(0,122,255,0.4),  0 4px 16px rgba(0,122,255,0.15); }
            }
            .tut-highlight {
              border: 2px solid var(--accent) !important;
              animation: squirclePulse 2s infinite cubic-bezier(0.25, 0.8, 0.25, 1) !important;
              transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
              z-index: 13000 !important;
            }
            dialog[open] #tutorial-bar {
              position: relative !important;
              bottom: auto !important;
              top: auto !important;
              left: auto !important;
              transform: none !important;
              width: 100% !important;
              max-width: none !important;
              margin: 16px 0 0 0 !important;
              box-shadow: none !important;
              border: 1px solid var(--accent) !important;
              border-radius: 18px !important;
              background: rgba(128,128,128,0.06) !important;
              display: flex !important;
            }
            body.tut-active dialog         { backdrop-filter: none !important; }
            body.tut-active dialog::backdrop { backdrop-filter: none !important; }
        `;
        if (styleEl.styleSheet) { styleEl.styleSheet.cssText = cssCode; }
        else { styleEl.appendChild(document.createTextNode(cssCode)); }
        document.head.appendChild(styleEl);

        // 2. Setup dynamic play/pause checks safely
        const pauseBtn = $_tut('pause-btn');
        if (pauseBtn) {
            const originalOnclick = pauseBtn.onclick;
            pauseBtn.onclick = null;
            pauseBtn.addEventListener('click', (e) => {
                const activeCues  = (typeof window.activeCues  !== 'undefined') ? window.activeCues  : null;
                const activePads  = (typeof window.activePads  !== 'undefined') ? window.activePads  : null;
                const actSideCues = (typeof window.actSideCues !== 'undefined') ? window.actSideCues : null;
                const actSidePads = (typeof window.actSidePads !== 'undefined') ? window.actSidePads : null;
                const isPly = (activeCues?.size || 0) || (activePads?.size || 0) || (actSideCues?.size || 0) || (actSidePads?.size || 0);
                if (!isPly) { e.stopImmediatePropagation(); return; }
                if (originalOnclick) originalOnclick.call(pauseBtn, e);
            }, true);
        }

        // 3. Inject Dynamic "Interactive Guide" panel under Advanced settings dropdown
        const addGuideSettingsLink = () => {
            const advDetails = document.querySelector('#app-settings details .details-content');
            if (advDetails && !$_tut('interactive-guide-trigger-row')) {
                const guideRow = document.createElement('div');
                guideRow.className = 'nested-nav-row';
                guideRow.id        = 'interactive-guide-trigger-row';
                guideRow.style.borderTop = '1px solid var(--glass-border)';
                guideRow.style.padding   = '16px 0';
                guideRow.innerHTML = `
                    <span>Interactive Guide</span>
                    <span class="material-symbols-rounded" style="color:var(--accent)">play_circle</span>
                `;
                guideRow.addEventListener('click', () => {
                    triggerTutHaptic(10);
                    const appSettingsCloseBtn = document.querySelector('#app-settings .modal-header .icon-btn');
                    if (appSettingsCloseBtn) appSettingsCloseBtn.click();
                    setTimeout(() => window.openTutorial(0), 350);
                });
                advDetails.appendChild(guideRow);
            }
        };

        // 4. Polling loop: monitors system states, maps dynamic IDs, repositions popover.
        //    Step transitions are the SOLE authority for advancing steps — no click map.
        window.tutActive = false;
        if (window.tutPollInterval) clearInterval(window.tutPollInterval);
        window.tutPollInterval = setInterval(() => {
            if (!window.tutActive) return;

            const currentTracks = (typeof tracks !== 'undefined') ? tracks : [];
            runDynamicIdSetup();

            const settingsOpen  = document.querySelector('dialog#settings-modal[open]');
            const menuOpen      = document.querySelector('dialog#cue-menu-modal[open]');
            const projectsOpen  = document.querySelector('dialog#projects-modal[open]');
            const voiceOpen     = $_tut('cue-voice-details')    && $_tut('cue-voice-details').open;
            const advOpen       = $_tut('cue-advanced-details') && $_tut('cue-advanced-details').open;

            // [FIX-PREMATURE-JUMP] Require 800 ms in the current step before any
            // modal-close escape can fire, preventing false-positive jumps during transitions.
            const modalGracePassed = (Date.now() - stepEntryTime) > 800;

            if (window.tutStep === 0) {
                if (currentTracks.length > 0) window.openTutorial(1);
            } else if (window.tutStep === 1) {
                if (settingsOpen) window.openTutorial(2);
            } else if (window.tutStep === 2) {
                if (!settingsOpen && modalGracePassed) window.openTutorial(6);
            } else if (window.tutStep === 3) {
                if (voiceOpen) window.openTutorial(4);
                else if (!settingsOpen && modalGracePassed) window.openTutorial(6);
            } else if (window.tutStep === 4) {
                if (advOpen) window.openTutorial(5);
                else if (!settingsOpen && modalGracePassed) window.openTutorial(6);
            } else if (window.tutStep === 5) {
                if (!settingsOpen && modalGracePassed) window.openTutorial(6);
            } else if (window.tutStep === 6) {
                if (menuOpen) window.openTutorial(7);
            } else if (window.tutStep === 7) {
                if (!menuOpen && modalGracePassed) window.openTutorial(8);
            } else if (window.tutStep === 8) {
                if (projectsOpen) window.openTutorial(9);
            } else if (window.tutStep === 9) {
                if (!projectsOpen && modalGracePassed) window.finishTutorial();
            }

            // [FIX-ANIMATION] Runs after step checks; applyTutHighlight skips re-application
            // when the element hasn't changed, so the CSS animation is never interrupted.
            const activeStep = tutSteps[window.tutStep];
            if (activeStep && typeof activeStep.target === 'function') {
                applyTutHighlight(activeStep.target);
            }
            window.adjustTutorialBarParent();

        }, 250);

        // 5. Volume Slider input — sole driver for step 2 → 3 (no click map duplicate)
        document.addEventListener('input', (e) => {
            if (window.tutActive && window.tutStep === 2 && e.target.closest('#cue-volume-slider-row')) {
                setTimeout(() => window.openTutorial(3), 100);
            }
        }, true);

        // 6. Mutation Observer to inject the app-settings guide link on open
        const settingsObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'open') {
                    const dialog = mutation.target;
                    if (dialog.id === 'app-settings' && dialog.hasAttribute('open')) {
                        addGuideSettingsLink();
                    }
                }
            });
        });
        const appSettingsDialog = $_tut('app-settings');
        if (appSettingsDialog) settingsObserver.observe(appSettingsDialog, { attributes: true });

        // [FIX-DOUBLE-INIT] No deferred openTutorial() here.
        // The single authoritative startup call is made by initTutorial() at the end of initSetup().
    };

    // Safe execution initializer
    const initSetup = () => {
        if (!$_tut('tutorial-bar')) {
            const tutorialBar = document.createElement('div');
            tutorialBar.id = 'tutorial-bar';
            tutorialBar.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%;">
                    <div>
                        <span class="tut-step-indicator" id="tut-bar-step">Step 1</span>
                        <span class="tut-section-badge"  id="tut-bar-badge">Onboarding</span>
                        <h4 id="tut-bar-title" style="margin:4px 0 0 0;font-size:16px;font-weight:700;">Tutorial</h4>
                    </div>
                    <button class="icon-btn" id="tutorial-close-btn" style="width:32px;height:32px;border-radius:10px;background:rgba(128,128,128,0.15);border:none;">
                        <span class="material-symbols-rounded" style="font-size:16px;">close</span>
                    </button>
                </div>
                <p id="tut-bar-text" style="margin:0;font-size:14px;line-height:1.5;color:var(--text-main);font-weight:500;"></p>
                <div style="display:flex;justify-content:flex-end;gap:8px;" id="tut-bar-actions">
                    <button class="action-btn" id="tut-bar-prev" style="padding:8px 16px;font-size:13px;border-radius:10px;flex:none;width:auto;">Back</button>
                    <button class="action-btn" id="tut-bar-next" style="padding:8px 16px;font-size:13px;background:var(--accent);color:#fff;border-radius:10px;flex:none;width:auto;">Next</button>
                </div>
            `;
            document.body.appendChild(tutorialBar);

            tutorialBar.querySelector('#tutorial-close-btn').addEventListener('click', () => window.skipTutorial());
            tutorialBar.querySelector('#tut-bar-prev').addEventListener('click', () => window.prevTutStep());
            tutorialBar.querySelector('#tut-bar-next').addEventListener('click', () => window.nextTutStep());
        }

        const tutBarNode = $_tut('tutorial-bar');
        if (tutBarNode) {
            tutBarNode.style.display      = 'none';
            tutBarNode.style.flexDirection = 'column';
            tutBarNode.style.gap          = '10px';
            tutBarNode.style.padding      = '16px';
            tutBarNode.style.boxSizing    = 'border-box';
            tutBarNode.style.background   = 'var(--modal-bg)';
            tutBarNode.style.border       = '2px solid var(--accent)';
            tutBarNode.style.borderRadius = '24px';
            tutBarNode.style.boxShadow    = '0 20px 50px rgba(0,0,0,0.6)';
        }

        runOnboardingSetup();
        window.initTutorial(); // [FIX-DOUBLE-INIT] Single authoritative startup trigger
    };

    // Expose control functions to window level
    window.skipTutorial = skipTutorial;
    window.prevTutStep  = prevTutStep;
    window.nextTutStep  = nextTutStep;

    // Single execution entry guard — safe to call from external code too
    window.initTutorial = () => {
        if (initTutorialCalled) return;
        initTutorialCalled = true;
        const isCompleted = localStorage.getItem('mc_tutorial_completed') === 'true';
        if (!isCompleted) {
            const savedStep = parseInt(localStorage.getItem('mc_tutorial_step')) || 0;
            setTimeout(() => window.openTutorial(savedStep), 1200);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSetup);
    } else {
        initSetup();
    }

    // [FIX-CLICK-DUPE] clickAdvanceMap interceptor removed entirely.
    // Step transitions are driven exclusively by the poll loop and the input listener above.
    // This eliminates the double-fire that caused steps to skip on every tappable element.

    window.addEventListener('resize', () => {
        if (window.tutActive) window.adjustTutorialBarParent();
    });

})();

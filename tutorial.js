/**
 * Magic Cues Pro - Fully Self-Contained Onboarding & Play/Pause Controller
 * Dynamically injects styling, guides, and interception hooks without touching index.html.
 */

(function() {
    // Prevent double initialization during reloads or multiple script loads
    if (window.tutInitialized) return;
    window.tutInitialized = true;

    // Local safe utility selector to avoid namespace collisions with index.html
    const $_tut = id => document.getElementById(id);

    // Global Onboarding States
    window.tutActive = false;
    window.tutType = 'basic';
    window.tutStep = 0;
    let tutPollInterval = null;

    // Helper to safely trigger parent haptic feedback if available
    const triggerTutHaptic = (pattern) => {
        if (typeof haptic === 'function') {
            haptic(pattern);
        } else if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    };

    // Style cleanup helpers
    const clearTutHighlights = () => {
        document.querySelectorAll('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));
    };

    const applyTutHighlight = (targetGetter) => {
        clearTutHighlights();
        if (typeof targetGetter === 'function') {
            const el = targetGetter();
            if (el) el.classList.add('tut-highlight');
        }
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
            text: "Tapping <strong>Advanced Settings</strong> expands timelines. Here you can configure custom fade-in/out curves, infinite track looping, or activate **automatic background audio ducking**.", 
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
            text: "Tap the <strong>Show Title Header</strong> at the top left to manage projects, restore show backups (with `.magic` extensions), or export configurations.", 
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

    // Renders the pointing triangle targeting center coordinates of target elements [2]
    const updateArrow = (direction, arrowOffset) => {
        let arrow = $_tut('tutorial-arrow');
        if (!arrow) {
            arrow = document.createElement('div');
            arrow.id = 'tutorial-arrow';
            $_tut('tutorial-bar').appendChild(arrow);
        }

        arrow.style.display = 'block';
        arrow.style.position = 'absolute';
        arrow.style.width = '0';
        arrow.style.height = '0';
        arrow.style.borderStyle = 'solid';
        arrow.style.zIndex = '13001';

        // Clamp coordinates within layout boundaries
        const tutBar = $_tut('tutorial-bar');
        const clampedOffset = Math.max(16, Math.min(tutBar.clientWidth - 32, arrowOffset));
        arrow.style.left = `${clampedOffset}px`;

        if (direction === 'top') {
            arrow.style.top = '-10px';
            arrow.style.bottom = 'auto';
            arrow.style.borderWidth = '0 10px 10px 10px';
            arrow.style.borderColor = 'transparent transparent var(--accent) transparent';
        } else {
            arrow.style.bottom = '-10px';
            arrow.style.top = 'auto';
            arrow.style.borderWidth = '10px 10px 0 10px';
            arrow.style.borderColor = 'var(--accent) transparent transparent transparent';
        }
    };

    // Absolute screen positioning system with an expanded 24px breathing gap [2]
    const positionPopover = (targetEl, alignEl = null) => {
        const tutBar = $_tut('tutorial-bar');
        if (!tutBar || !targetEl) return;

        const activeDialog = document.querySelector('dialog[open]');
        if (activeDialog) {
            if (tutBar.parentElement !== activeDialog) {
                activeDialog.appendChild(tutBar);
            }
            tutBar.style.position = 'relative';
            tutBar.style.top = 'auto';
            tutBar.style.left = 'auto';
            tutBar.style.right = 'auto';
            tutBar.style.bottom = 'auto';
            tutBar.style.transform = 'none';
            tutBar.style.width = '100%';
            tutBar.style.maxWidth = 'none';
            tutBar.style.margin = '16px 0 0 0';
            tutBar.style.boxShadow = 'none';
            tutBar.style.border = '1px solid var(--accent)';
            tutBar.style.background = 'rgba(128,128,128,0.06)';
            tutBar.style.borderRadius = '18px';
            removeArrow();
            return;
        }

        if (tutBar.parentElement !== document.body) {
            document.body.appendChild(tutBar);
        }

        // Bounding rect math [2]
        const rect = targetEl.getBoundingClientRect();
        const alignRect = alignEl ? alignEl.getBoundingClientRect() : rect;
        const barWidth = 320;
        const viewWidth = window.innerWidth;
        const viewHeight = window.innerHeight;

        let top = 0;
        let arrowDirection = 'bottom';

        const spaceBelow = viewHeight - rect.bottom;
        const spaceAbove = rect.top;

        // Determine vertical placement based on maximum viewport space with an expanded 24px gap [2]
        if (spaceBelow > spaceAbove) {
            top = rect.bottom + window.scrollY + 24;
            arrowDirection = 'top';
        } else {
            // Get mock bar height offset safely
            const mockBarHeight = tutBar.clientHeight || 140;
            top = rect.top + window.scrollY - mockBarHeight - 24;
            arrowDirection = 'bottom';
        }

        // Horizontal alignment: right-aligned if specified, else centered [2]
        let left = 0;
        if (alignEl) {
            left = (alignRect.right + window.scrollX) - barWidth;
        } else {
            left = (rect.left + rect.width / 2 + window.scrollX) - barWidth / 2;
        }

        // Prevent clipping out of screen boundaries [2]
        left = Math.max(12, Math.min(viewWidth - barWidth - 12, left));

        tutBar.style.position = 'absolute';
        tutBar.style.top = `${top}px`;
        tutBar.style.left = `${left}px`;
        tutBar.style.transform = 'none';
        tutBar.style.width = 'calc(100% - 24px)';
        tutBar.style.maxWidth = `${barWidth}px`;
        tutBar.style.margin = '0';
        tutBar.style.zIndex = '13000';
        tutBar.style.boxShadow = '0 20px 50px rgba(0,0,0,0.6)';
        tutBar.style.border = '2px solid var(--accent)';
        tutBar.style.background = 'var(--modal-bg)';
        tutBar.style.borderRadius = '24px';

        // Point the arrow directly at the target's center, even if card is right-aligned [2]
        const targetCenter = rect.left + rect.width / 2 + window.scrollX;
        updateArrow(arrowDirection, targetCenter - left);
    };

    window.adjustTutorialBarParent = () => {
        const step = tutSteps[window.tutStep];
        let targetEl = null;
        let alignEl = null;
        if (step && typeof step.target === 'function') {
            targetEl = step.target();
        }
        if (step && typeof step.alignTo === 'function') {
            alignEl = step.alignTo();
        }

        if (targetEl) {
            positionPopover(targetEl, alignEl);
        } else {
            const tutBar = $_tut('tutorial-bar');
            if (tutBar) {
                tutBar.style.position = 'fixed';
                tutBar.style.bottom = '24px';
                tutBar.style.top = 'auto';
                tutBar.style.left = '50%';
                tutBar.style.transform = 'translateX(-50%)';
                tutBar.style.width = 'calc(100% - 48px)';
                tutBar.style.maxWidth = '320px';
                tutBar.style.margin = '0 auto';
                tutBar.style.zIndex = '13000';
                removeArrow();
            }
        }
    };

    window.openTutorial = (stepIdx = 0) => {
        window.tutActive = true;
        window.tutType = 'basic';

        // Safe evaluation of global "tracks" variable scope
        const currentTracks = (typeof tracks !== 'undefined') ? tracks : [];

        // Auto-skip Step 0 if tracks already exist
        if (stepIdx === 0 && currentTracks.length > 0) {
            stepIdx = 1;
        }

        window.tutStep = stepIdx;
        document.body.classList.add('tut-active');

        // Save active step index to prevent resets midway [1]
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

        $_tut('tut-bar-step').innerText = `Step ${window.tutStep + 1} of ${tutSteps.length}`;
        $_tut('tut-bar-badge').innerText = step.badge;
        $_tut('tut-bar-text').innerHTML = step.text;

        applyTutHighlight(step.target);
        window.adjustTutorialBarParent();

        $_tut('tut-bar-next').innerText = (window.tutStep === tutSteps.length - 1) ? 'Finish' : 'Next';
        $_tut('tut-bar-next').style.display = step.waitForAction ? 'none' : 'block';
        $_tut('tutorial-bar').style.display = 'flex';
    };

    window.nextTutStep = () => {
        triggerTutHaptic(10);
        if (window.tutStep < tutSteps.length - 1) {
            window.openTutorial(window.tutStep + 1);
        } else {
            window.finishTutorial();
        }
    };

    window.prevTutStep = () => {
        triggerTutHaptic(10);
        if (window.tutStep > 0) {
            window.openTutorial(window.tutStep - 1);
        }
    };

    window.skipTutorial = () => {
        triggerTutHaptic([15, 30]);
        window.finishTutorial();
    };

    window.finishTutorial = () => {
        clearTutHighlights();
        window.tutActive = false;
        document.body.classList.remove('tut-active');
        
        // Save completion status completely decoupled from settings to prevent reloads [1]
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
                else if (icon.id === 'lock-icon') btn.id = 'header-lock-btn';
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
                if (sum.textContent.includes('Voice Triggers')) det.id = 'cue-voice-details';
                else if (sum.textContent.includes('Advanced Settings')) det.id = 'cue-advanced-details';
            }
        });

        const volumeInput = document.querySelector('#modal-content input[type="range"]');
        if (volumeInput) {
            const row = volumeInput.closest('.setting-row');
            if (row) {
                row.id = 'cue-volume-slider-row';
            }
        }
    };

    // Configures listeners and state observation loops
    const runOnboardingSetup = () => {
        // 1. Inject Styles
        const styleEl = document.createElement('style');
        styleEl.type = 'text/css';
        const cssCode = `
            #tutorial-bar {
                position: absolute;
                width: calc(100% - 48px);
                max-width: 320px;
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
            #tutorial-bar.pos-top {
                top: 24px;
                bottom: auto;
            }
            #tutorial-bar.pos-bottom {
                top: auto;
                bottom: 24px;
            }
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
            @keyframes squirclePulse {
              0% {
                box-shadow: 0 0 0 1px var(--accent), 0 0 0 2px rgba(0, 122, 255, 0.4), 0 4px 16px rgba(0, 122, 255, 0.15);
              }
              50% {
                box-shadow: 0 0 0 3.5px var(--accent), 0 0 0 10px rgba(0, 122, 255, 0.25), 0 12px 30px rgba(0, 122, 255, 0.45);
              }
              100% {
                box-shadow: 0 0 0 1px var(--accent), 0 0 0 2px rgba(0, 122, 255, 0.4), 0 4px 16px rgba(0, 122, 255, 0.15);
              }
            }
            .tut-highlight {
              animation: squirclePulse 2s infinite cubic-bezier(0.25, 0.8, 0.25, 1) !important;
              border-color: var(--accent) !important;
              border-radius: 20px !important;
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
            body.tut-active dialog {
              backdrop-filter: none !important;
            }
            body.tut-active dialog::backdrop {
              backdrop-filter: none !important;
            }
        `;
        if (styleEl.styleSheet) {
            styleEl.styleSheet.cssText = cssCode;
        } else {
            styleEl.appendChild(document.createTextNode(cssCode));
        }
        document.head.appendChild(styleEl);

        // 2. Setup dynamic play/pause checks safely
        const pauseBtn = $_tut('pause-btn');
        if (pauseBtn) {
            const originalOnclick = pauseBtn.onclick;
            pauseBtn.onclick = null;
            pauseBtn.addEventListener('click', (e) => {
                const activeCues = (typeof window.activeCues !== 'undefined') ? window.activeCues : null;
                const activePads = (typeof window.activePads !== 'undefined') ? window.activePads : null;
                const actSideCues = (typeof window.actSideCues !== 'undefined') ? window.actSideCues : null;
                const actSidePads = (typeof window.actSidePads !== 'undefined') ? window.actSidePads : null;
                const isPly = (activeCues?.size || 0) || (activePads?.size || 0) || (actSideCues?.size || 0) || (actSidePads?.size || 0);
                if (!isPly) {
                    e.stopImmediatePropagation();
                    return;
                }
                if (originalOnclick) {
                    originalOnclick.call(pauseBtn, e);
                }
            }, true);
        }

        // 3. Inject Dynamic "Interactive Guide" panel under Advanced settings dropdown
        const addGuideSettingsLink = () => {
            const advDetails = document.querySelector('#app-settings details .details-content');
            if (advDetails && !$_tut('interactive-guide-trigger-row')) {
                const guideRow = document.createElement('div');
                guideRow.className = 'nested-nav-row';
                guideRow.id = 'interactive-guide-trigger-row';
                guideRow.style.borderTop = '1px solid var(--glass-border)';
                guideRow.style.padding = '16px 0';
                guideRow.innerHTML = `
                    <span>Interactive Guide</span>
                    <span class="material-symbols-rounded" style="color:var(--accent)">play_circle</span>
                `;
                guideRow.addEventListener('click', () => {
                    triggerTutHaptic(10);
                    // Standard modal dismissal to redirect back to home dashboard
                    const appSettingsDialogNode = $_tut('app-settings');
                    if (appSettingsDialogNode && appSettingsDialogNode.hasAttribute('open')) {
                        appSettingsDialogNode.close();
                        document.body.classList.remove('modal-open');
                    }
                    setTimeout(() => {
                        window.openTutorial(0);
                    }, 350);
                });
                advDetails.appendChild(guideRow);
            }
        };

        // 4. Polling loop: Monitors system states, maps dynamic IDs, and repositions popover
        window.tutActive = false;
        if (tutPollInterval) clearInterval(tutPollInterval);
        tutPollInterval = setInterval(() => {
            if (!window.tutActive) return;

            const currentTracks = (typeof tracks !== 'undefined') ? tracks : [];

            // Execute dynamic element mapping
            runDynamicIdSetup();

            const settingsOpen = document.querySelector('dialog#settings-modal[open]');
            const menuOpen = document.querySelector('dialog#cue-menu-modal[open]');
            const projectsOpen = document.querySelector('dialog#projects-modal[open]');
            const voiceOpen = $_tut('cue-voice-details') && $_tut('cue-voice-details').open;
            const advOpen = $_tut('cue-advanced-details') && $_tut('cue-advanced-details').open;

            // Run status-driven progression checks
            if (window.tutStep === 0) {
                // If tracks have been successfully loaded, progress to Step 2
                if (currentTracks.length > 0) {
                    window.openTutorial(1);
                }
            } else if (window.tutStep === 1) {
                // Wait for Settings modal to open
                if (settingsOpen) {
                    window.openTutorial(2);
                }
            } else if (window.tutStep === 2) {
                // If modal is closed prematurely, return to dashboard sequence
                if (!settingsOpen) window.openTutorial(6);
            } else if (window.tutStep === 3) {
                if (voiceOpen) window.openTutorial(4);
                if (!settingsOpen) window.openTutorial(6);
            } else if (window.tutStep === 4) {
                if (advOpen) window.openTutorial(5);
                if (!settingsOpen) window.openTutorial(6);
            } else if (window.tutStep === 5) {
                // Settings Modal closed
                if (!settingsOpen) window.openTutorial(6);
            } else if (window.tutStep === 6) {
                // Wait for long-press contextual Menu modal to open
                if (menuOpen) window.openTutorial(7);
            } else if (window.tutStep === 7) {
                // Wait for cue-menu-modal to close
                if (!menuOpen) window.openTutorial(8);
            } else if (window.tutStep === 8) {
                // Wait for Projects modal to open
                if (projectsOpen) {
                    window.openTutorial(9);
                }
            } else if (window.tutStep === 9) {
                // Once projects modal closes, onboarding completes
                if (!projectsOpen) {
                    window.finishTutorial();
                }
            }

            // Real-time responsive positioning and focused highlights application
            const activeStep = tutSteps[window.tutStep];
            if (activeStep && typeof activeStep.target === 'function') {
                applyTutHighlight(activeStep.target);
            }
            window.adjustTutorialBarParent();

        }, 250);

        // 5. Monitor Volume Slider changes to progress steps
        document.addEventListener('input', (e) => {
            if (window.tutActive && window.tutStep === 2 && e.target.closest('#cue-volume-slider-row')) {
                setTimeout(() => {
                    window.openTutorial(3);
                }, 100);
            }
        }, true);

        // 6. Dynamic Mutation Observer to map the app settings row guide triggers
        const settingsObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'open') {
                    const dialog = mutation.target;
                    const isOpen = dialog.hasAttribute('open');
                    if (dialog.id === 'app-settings' && isOpen) {
                        addGuideSettingsLink();
                    }
                }
            });
        });
        const appSettingsDialog = $_tut('app-settings');
        if (appSettingsDialog) {
            settingsObserver.observe(appSettingsDialog, { attributes: true });
        }

        // 7. Decoupled tutorial completion check via local storage
        const isCompleted = localStorage.getItem('mc_tutorial_completed') === 'true';
        if (!isCompleted) {
            // Restore active step from storage to prevent midway resets
            const savedStep = parseInt(localStorage.getItem('mc_tutorial_step')) || 0;
            setTimeout(() => window.openTutorial(savedStep), 1200);
        }
    };

    // Safe execution initializer
    const initSetup = () => {
        // Inject tutorial layout panel dynamically
        if (!$_tut('tutorial-bar')) {
            const tutorialBar = document.createElement('div');
            tutorialBar.id = 'tutorial-bar';
            tutorialBar.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                    <div>
                        <span class="tut-step-indicator" id="tut-bar-step">Step 1</span>
                        <span class="tut-section-badge" id="tut-bar-badge">Onboarding</span>
                        <h4 id="tut-bar-title" style="margin: 4px 0 0 0; font-size: 16px; font-weight: 700;">Tutorial</h4>
                    </div>
                    <button class="icon-btn" id="tutorial-close-btn" style="width: 32px; height: 32px; border-radius: 10px; background: rgba(128,128,128,0.15); border: none;">
                        <span class="material-symbols-rounded" style="font-size: 16px;">close</span>
                    </button>
                </div>
                <p id="tut-bar-text" style="margin: 0; font-size: 14px; line-height: 1.5; color: var(--text-main); font-weight: 500;"></p>
                <div style="display: flex; justify-content: flex-end; gap: 8px;" id="tut-bar-actions">
                    <button class="action-btn" id="tut-bar-prev" style="padding: 8px 16px; font-size: 13px; border-radius: 10px; flex: none; width: auto;">Back</button>
                    <button class="action-btn" id="tut-bar-next" style="padding: 8px 16px; font-size: 13px; background: var(--accent); color: #fff; border-radius: 10px; flex: none; width: auto;">Next</button>
                </div>
            `;
            document.body.appendChild(tutorialBar);

            // Programmatic Event bindings to bypass IIFE scope boundaries
            const closeBtn = tutorialBar.querySelector('#tutorial-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    window.skipTutorial();
                });
            }
            const prevBtn = tutorialBar.querySelector('#tut-bar-prev');
            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    window.prevTutStep();
                });
            }
            const nextBtn = tutorialBar.querySelector('#tut-bar-next');
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    window.nextTutStep();
                });
            }
        }

        // Apply fallback base styles inline to prevent container rendering bugs on layout styles loading latency
        const tutBarNode = $_tut('tutorial-bar');
        if (tutBarNode) {
            tutBarNode.style.display = 'none';
            tutBarNode.style.flexDirection = 'column';
            tutBarNode.style.gap = '10px';
            tutBarNode.style.padding = '16px';
            tutBarNode.style.boxSizing = 'border-box';
            tutBarNode.style.background = 'var(--modal-bg)';
            tutBarNode.style.border = '2px solid var(--accent)';
            tutBarNode.style.borderRadius = '24px';
            tutBarNode.style.boxShadow = '0 20px 50px rgba(0,0,0,0.6)';
        }

        runOnboardingSetup();
    };

    // Expose control functions to the window level to guarantee absolute availability
    window.skipTutorial = skipTutorial;
    window.prevTutStep = prevTutStep;
    window.nextTutStep = nextTutStep;

    // Execution monitor
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSetup);
    } else {
        initSetup();
    }

    // Global click-to-advance intercepter mapping to proceed steps automatically
    document.addEventListener('click', (e) => {
        if (!window.tutActive) return;
        const step = tutSteps[window.tutStep];
        if (!step || !step.target) return;
        const targetEl = step.target();
        if (!targetEl) return;

        if (targetEl.contains(e.target) || e.target === targetEl) {
            const clickAdvanceMap = {
                1: 2,   // Settings gear -> Volume sliders (Step 3)
                2: 3,   // Volume slider -> Voice triggers menu (Step 4)
                3: 4,   // Voice triggers summary -> Advanced Cues expander (Step 5)
                4: 5,   // Advanced Cues summary -> Close modal button (Step 6)
                5: 6,   // Close modal -> Show Manager Title (Step 7)
                7: 8,   // Close context menu -> Show Manager Header (Step 9)
                8: 9    // Show Manager header -> Finish (Step 10)
            };
            if (clickAdvanceMap[window.tutStep] !== undefined) {
                setTimeout(() => {
                    window.openTutorial(clickAdvanceMap[window.tutStep]);
                }, 100);
            }
        }
    }, true);

    // Keep popup positions aligned on window resizing and screen rotates
    window.addEventListener('resize', () => {
        if (window.tutActive) {
            window.adjustTutorialBarParent();
        }
    });

})();

(function() {
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

    // Onboarding Steps Array (10 Bite-Sized Interactive Modules)
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
            text: "Great! Your track is loaded. Tap the <strong>Settings Gear (⚙)</strong> on the right of the cue card to open its settings.", 
            target: () => document.querySelector('.tile .edit-trigger'), 
            waitForAction: true 
        },
        { 
            title: "Individual Volume Level", 
            badge: "Step 3 of 10", 
            text: "Drag the <strong>Volume Slider</strong> to adjust this track's playback volume. Slide it now to proceed.", 
            target: () => document.querySelector('#cue-volume-slider-row input[type="range"]'), 
            waitForAction: true 
        },
        { 
            title: "Voice Command Setup", 
            badge: "Step 4 of 10", 
            text: "Tap on <strong>Voice Triggers</strong> to expand the voice activation options.", 
            target: () => document.querySelector('#cue-voice-details summary'), 
            waitForAction: true 
        },
        { 
            title: "Timelines & Ducking", 
            badge: "Step 5 of 10", 
            text: "Tap on <strong>Advanced Settings</strong> to locate audio trimming, custom fades, looping modes, and ducking timelines.", 
            target: () => document.querySelector('#cue-advanced-details summary'), 
            waitForAction: true 
        },
        { 
            title: "Close Options Panel", 
            badge: "Step 6 of 10", 
            text: "Tap the top-right <strong>Close (X)</strong> button to exit the cue options panel.", 
            target: () => document.querySelector('#settings-modal .icon-btn'), 
            waitForAction: true 
        },
        { 
            title: "Manage Shows", 
            badge: "Step 7 of 10", 
            text: "Tap the <strong>Show Title Header</strong> at the top of the screen to open your Show Manager.", 
            target: () => $_tut('show-title-header'), 
            waitForAction: true 
        },
        { 
            title: "Close Show Manager", 
            badge: "Step 8 of 10", 
            text: "Exit the show manager by tapping the <strong>Close (X)</strong> button.", 
            target: () => document.querySelector('#projects-modal .icon-btn'), 
            waitForAction: true 
        },
        { 
            title: "Lock Your Workspace", 
            badge: "Step 9 of 10", 
            text: "Before going live, tap the <strong>Lock Icon</strong> to prevent accidental touches and enable screen-secure Pocket Mode.", 
            target: () => $_tut('header-lock-btn'), 
            waitForAction: true 
        },
        { 
            title: "Guide Concluded", 
            badge: "Step 10 of 10", 
            text: "You are ready to perform! Replay this interactive guide at any time from App Settings. Tap <strong>Finish</strong> to start.", 
            target: null, 
            waitForAction: false 
        }
    ];

    // Horizontal & vertical layout engine. Automatically positions the bar 
    // above or below target components based on remaining viewport space.
    window.adjustTutorialBarParent = () => {
        const activeDialog = document.querySelector('dialog[open]');
        const tutBar = $_tut('tutorial-bar');
        if (!tutBar) return;
        
        if (activeDialog) {
            if (tutBar.parentElement !== activeDialog) {
                activeDialog.appendChild(tutBar);
            }
            tutBar.style.position = 'relative';
            tutBar.style.bottom = 'auto';
            tutBar.style.top = 'auto';
            tutBar.style.left = 'auto';
            tutBar.style.right = 'auto';
            tutBar.style.transform = 'none';
            tutBar.style.width = '100%';
            tutBar.style.maxWidth = 'none';
            tutBar.style.margin = '16px 0 0 0';
            tutBar.style.boxShadow = 'none';
            tutBar.style.border = '1px solid var(--accent)';
            tutBar.style.background = 'rgba(128,128,128,0.06)';
            tutBar.style.borderRadius = '18px';
        } else {
            if (tutBar.parentElement !== document.body) {
                document.body.appendChild(tutBar);
            }

            const step = tutSteps[window.tutStep];
            let targetEl = null;
            if (step && typeof step.target === 'function') {
                targetEl = step.target();
            }

            tutBar.style.position = 'fixed';
            tutBar.style.left = '50%';
            tutBar.style.transform = 'translateX(-50%)';
            tutBar.style.width = 'calc(100% - 48px)';
            tutBar.style.maxWidth = '360px';
            tutBar.style.margin = '0';
            tutBar.style.zIndex = '13000';
            tutBar.style.boxShadow = '0 20px 50px rgba(0,0,0,0.6)';
            tutBar.style.border = '2px solid var(--accent)';
            tutBar.style.background = 'var(--modal-bg)';
            tutBar.style.borderRadius = '24px';

            if (targetEl) {
                const rect = targetEl.getBoundingClientRect();
                const viewHeight = window.innerHeight;
                const spaceAbove = rect.top;
                const spaceBelow = viewHeight - rect.bottom;

                // Position automatically above or below the target elements based on layout space
                if (spaceBelow > spaceAbove) {
                    tutBar.style.top = `${Math.min(viewHeight - 150, rect.bottom + 12)}px`;
                    tutBar.style.bottom = 'auto';
                } else {
                    tutBar.style.bottom = `${Math.min(viewHeight - 150, viewHeight - rect.top + 12)}px`;
                    tutBar.style.top = 'auto';
                }
            } else {
                tutBar.style.bottom = '24px';
                tutBar.style.top = 'auto';
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
        
        const activeSettings = (typeof settings !== 'undefined') ? settings : null;
        if (activeSettings) {
            activeSettings.tutorialCompleted = true;
            localStorage.setItem('mc_settings', JSON.stringify(activeSettings));
        }

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
        styleEl.innerHTML = `
            #tutorial-bar p { margin: 0; }
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
              left: auto !important;
              transform: none !important;
              width: 100% !important;
              max-width: none !important;
              margin: 16px 0 0 0 !important;
              box-shadow: none !important;
              border: 1px solid var(--accent) !important;
              border-radius: 18px !important;
              background: rgba(128,128,128,0.06) !important;
            }
            body.tut-active dialog {
              backdrop-filter: none !important;
            }
            body.tut-active dialog::backdrop {
              backdrop-filter: none !important;
            }
        `;
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
                const isActive = (activeCues?.size || 0) || (activePads?.size || 0) || (actSideCues?.size || 0) || (actSidePads?.size || 0);
                if (!isActive) {
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
                    // Dismiss app-settings modal cleanly before launching guide on home screen
                    if (typeof window.closeModal === 'function') {
                        window.closeModal('app-settings');
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

            // Run status-driven progression checks
            if (window.tutStep === 0) {
                // If tracks have been successfully loaded, progress to Step 2
                if (currentTracks.length > 0) {
                    window.openTutorial(1);
                }
            } else if (window.tutStep === 1) {
                // Wait for Settings modal to open
                if (document.querySelector('dialog#settings-modal[open]')) {
                    window.openTutorial(2);
                }
            } else if (window.tutStep === 5) {
                // Wait for Settings modal to be closed
                if (!document.querySelector('dialog#settings-modal[open]')) {
                    window.openTutorial(6);
                }
            } else if (window.tutStep === 6) {
                // Wait for Projects modal to open
                if (document.querySelector('dialog#projects-modal[open]')) {
                    window.openTutorial(7);
                }
            } else if (window.tutStep === 7) {
                // Wait for Projects modal to be closed
                if (!document.querySelector('dialog#projects-modal[open]')) {
                    window.openTutorial(8);
                }
            } else if (window.tutStep === 8) {
                // Wait for Locked mode to activate
                if (document.body.classList.contains('locked')) {
                    window.openTutorial(9);
                }
            }

            // Real-time responsive positioning calculations
            window.adjustTutorialBarParent();

        }, 250);

        // 5. Track dynamic volume slider releases on change
        document.addEventListener('change', (e) => {
            if (window.tutStep === 2 && e.target.closest('#cue-volume-slider-row')) {
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

        // 7. Init dynamic config parameters safely in current scope
        const currentSettings = (typeof settings !== 'undefined') ? settings : null;
        if (currentSettings && currentSettings.tutorialCompleted === undefined) {
            currentSettings.tutorialCompleted = false;
        }

        if (currentSettings && !currentSettings.tutorialCompleted) {
            setTimeout(() => window.openTutorial(0), 1200);
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
                    <button class="icon-btn" style="width: 32px; height: 32px; border-radius: 10px; background: rgba(128,128,128,0.15); border: none;" onclick="if (typeof skipTutorial === 'function') skipTutorial()">
                        <span class="material-symbols-rounded" style="font-size: 16px;">close</span>
                    </button>
                </div>
                <p id="tut-bar-text" style="margin: 0; font-size: 14px; line-height: 1.5; color: var(--text-main); font-weight: 500;"></p>
                <div style="display: flex; justify-content: flex-end; gap: 8px;" id="tut-bar-actions">
                    <button class="action-btn" id="tut-bar-prev" style="padding: 8px 16px; font-size: 13px; border-radius: 10px; flex: none; width: auto;" onclick="if (typeof prevTutStep === 'function') prevTutStep()">Back</button>
                    <button class="action-btn" id="tut-bar-next" style="padding: 8px 16px; font-size: 13px; background: var(--accent); color: #fff; border-radius: 10px; flex: none; width: auto;" onclick="if (typeof nextTutStep === 'function') nextTutStep()">Next</button>
                </div>
            `;
            document.body.appendChild(tutorialBar);
        }

        runOnboardingSetup();
    };

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
                1: 2,   // Settings gear -> Volume sliders
                2: 3,   // Volume slider -> Voice triggers menu
                3: 4,   // Voice triggers click -> Timelines panel
                4: 5,   // Timelines panel click -> Close modal button
                5: 6,   // Close modal -> Show Manager Title
                6: 7,   // Show Manager click -> Close Show Manager modal
                7: 8,   // Close Show Manager -> Lock button
                8: 9    // Lock button -> Concluding step
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

/**
 * Magic Cues Pro - Fully Self-Contained Onboarding & Play/Pause Controller
 * Dynamically injects styling, guides, and interception hooks without touching index.html.
 */

(function() {
    // Local safe utility selector to avoid namespace collisions with index.html
    const $_tut = id => document.getElementById(id);

    // Global Onboarding States
    window.tutActive = false;
    window.tutType = 'basic';
    window.tutStep = 0;

    // Helper to safely trigger parent haptic feedback
    const triggerTutHaptic = (pattern) => {
        if (typeof window.haptic === 'function') {
            window.haptic(pattern);
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

    // Onboarding Steps Array
    const tutSteps = [
        {
            title: "Import Your Music",
            badge: "Step 1: Add a Track",
            text: "Let's build your cue list. Tap <strong>Add Cue</strong> to load an audio file from your device.",
            target: () => $_tut('add-cue-btn'), 
            waitForAction: true 
        },
        { 
            title: "Access Cue Settings", 
            badge: "Step 2: Cue Configuration", 
            text: "Great! Your track is loaded. Tap the <strong>Settings Gear (⚙)</strong> on the right of the cue card to open its settings.", 
            target: () => document.querySelector('.tile .edit-trigger'), 
            waitForAction: true 
        },
        { 
            title: "Cue Playback Modes", 
            badge: "Step 3: Cue Types", 
            text: "Choose how this cue behaves:<br>• <strong>Main</strong>: Sequential tracks in your main playlist.<br>• <strong>Instant</strong>: Quick-trigger pads in the grid below.", 
            target: () => $_tut('cue-type-selector-row'), 
            waitForAction: false 
        },
        { 
            title: "Individual Volume Level", 
            badge: "Step 4: Custom Volume", 
            text: "Drag the <strong>Volume Slider</strong> to adjust this track's playback volume. Slide it now to automatically proceed.", 
            target: () => document.querySelector('#cue-volume-slider-row input[type="range"]'), 
            waitForAction: true 
        },
        { 
            title: "Voice Command Setup", 
            badge: "Step 5: Voice Setup", 
            text: "Tap on <strong>Voice Triggers</strong> to expand the voice activation options.", 
            target: () => document.querySelector('#cue-voice-details summary'), 
            waitForAction: true 
        },
        { 
            title: "Spoken Commands", 
            badge: "Step 6: Setup Commands", 
            text: "Set a phrase here to trigger this cue hands-free. Toggle <strong>Global</strong> to listen for this command even when the track is not next in queue.", 
            target: () => $_tut('cue-voice-details'), 
            waitForAction: false 
        },
        { 
            title: "Timelines & Atmospheric Ducking", 
            badge: "Step 7: Advanced Settings", 
            text: "Open <strong>Advanced Settings</strong> to find audio trimming, custom fades, looping background modes, and automatic volume ducking.", 
            target: () => $_tut('cue-advanced-details'), 
            waitForAction: true 
        },
        { 
            title: "Close Options Panel", 
            badge: "Step 8: Return to Main", 
            text: "Tap the top-right <strong>Close (X)</strong> button to exit the settings panel.", 
            target: () => document.querySelector('#settings-modal .icon-btn'), 
            waitForAction: true 
        },
        { 
            title: "Context Options Menu", 
            badge: "Step 9: Long-Press Menu", 
            text: "<strong>Long-press</strong> (press and hold) the middle of your cue card to open the quick actions menu.", 
            target: () => document.querySelector('.tile-info'), 
            waitForAction: true 
        },
        { 
            title: "Sequence Bypassing", 
            badge: "Step 10: Skipping Tracks", 
            text: "Tap <strong>Skip Cue</strong> to bypass this track during your show without deleting it.", 
            target: () => $_tut('ctx-skip-btn'), 
            waitForAction: true 
        },
        { 
            title: "Cloning", 
            badge: "Step 11: Duplicate Cue", 
            text: "Tap <strong>Duplicate</strong> to quickly copy this cue and all of its settings.", 
            target: () => $_tut('ctx-dup-btn'), 
            waitForAction: true 
        },
        { 
            title: "Create Group Container", 
            badge: "Step 12: Cue Groups", 
            text: "Tap <strong>Create Group</strong> to combine tracks. This opens a nested sideload player.", 
            target: () => $_tut('ctx-group-btn'), 
            waitForAction: true 
        },
        { 
            title: "Close Cue Options Menu", 
            badge: "Step 13: Close Menu", 
            text: "Let's head back. Dismiss this menu by tapping the <strong>Close (X)</strong> button.", 
            target: () => document.querySelector('#cue-menu-modal .icon-btn'), 
            waitForAction: true 
        },
        { 
            title: "Manual Sorting", 
            badge: "Step 14: Manual Sorting", 
            text: "Drag cards by their <strong>handles (☰)</strong> on the left to reorder them. Drag one cue directly over another to group them.", 
            target: () => document.querySelector('.tile .drag-handle'), 
            waitForAction: false 
        },
        { 
            title: "Manage Shows", 
            badge: "Step 15: Project Files", 
            text: "Tap the <strong>Show Title Header</strong> at the top of the screen to open your Show Manager.", 
            target: () => $_tut('show-title-header'), 
            waitForAction: true 
        },
        { 
            title: "Clean Show Sheets", 
            badge: "Step 16: New Show Files", 
            text: "Tap <strong>New</strong> to start a completely fresh show sheet.", 
            target: () => $_tut('show-new-btn'), 
            waitForAction: false 
        },
        { 
            title: "File Imports", 
            badge: "Step 17: Imports", 
            text: "Tap <strong>Import</strong> to restore backup show files (with the <code>.magic</code> extension).", 
            target: () => $_tut('show-import-btn'), 
            waitForAction: false 
        },
        { 
            title: "Context Projects Customization", 
            badge: "Step 18: Edit Shows List", 
            text: "<strong>Long-press</strong> any show in the list to rename, duplicate, export, or delete it. Tap the <strong>Close (X)</strong> button to exit the show manager.", 
            target: () => document.querySelector('#projects-modal .icon-btn'), 
            waitForAction: true 
        },
        { 
            title: "Adjust Haptics & Fade Speed", 
            badge: "Step 19: App Settings", 
            text: "Tap the <strong>Settings Cog (⚙)</strong> in the header to change themes, languages, UI size, haptics, and global sequence fades.", 
            target: () => $_tut('header-settings-btn'), 
            waitForAction: true 
        },
        { 
            title: "Onboarding Sequence Concluded", 
            badge: "Step 20: Ready to Go", 
            text: "You are ready to create! To replay this tutorial anytime, find the <strong>Interactive Guide</strong> in <strong>Advanced Settings</strong>. Tap <strong>Finish</strong> to close.", 
            target: null, 
            waitForAction: false 
        }
    ];

    // Handles positioning dynamically while bypassing any left/right offsets
    window.adjustTutorialBarParent = () => {
        const activeDialog = document.querySelector('dialog[open]');
        const tutBar = $_tut('tutorial-bar');
        if (!tutBar) return;
        
        if (activeDialog) {
            if (tutBar.parentElement !== activeDialog) {
                activeDialog.appendChild(tutBar);
            }
        } else {
            if (tutBar.parentElement !== document.body) {
                document.body.appendChild(tutBar);
            }
        }
        
        // Reset manual inline styles to prevent conflicts with mobile responsive classes
        tutBar.style.position = '';
        tutBar.style.bottom = '';
        tutBar.style.left = '';
        tutBar.style.right = '';
        tutBar.style.transform = '';
        tutBar.style.width = '';
        tutBar.style.maxWidth = '';
        tutBar.style.margin = '';
    };

    window.openTutorial = (stepIdx = 0) => {
        window.tutActive = true;
        window.tutType = 'basic';
        window.tutStep = stepIdx;
        document.body.classList.add('tut-active');

        if (stepIdx === 2) {
            if (typeof window.closeModal === 'function') window.closeModal('cue-menu-modal');
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
        
        if (window.settings) {
            window.settings.tutorialCompleted = true;
            localStorage.setItem('mc_settings', JSON.stringify(window.settings));
        }

        $_tut('tutorial-bar').style.display = 'none';
        window.adjustTutorialBarParent();
    };

    // Evaluates task actions
    window.evalTutorialStep = (action, details) => {
        if (!window.tutActive) return;

        const voiceOpen = $_tut('cue-voice-details') && $_tut('cue-voice-details').open;
        const advOpen = $_tut('cue-advanced-details') && $_tut('cue-advanced-details').open;

        if (window.tutStep === 0 && (action === 'hFiles' || (window.tracks && window.tracks.length > 0))) {
            window.openTutorial(1);
        } else if (window.tutStep === 1 && (action === 'openModal' && details === 'settings-modal')) {
            window.openTutorial(2);
        } else if (window.tutStep === 4 && (voiceOpen || (action === 'openModal' && details === 'cue-voice-details'))) {
            window.openTutorial(5);
        } else if (window.tutStep === 6 && (advOpen || (action === 'openModal' && details === 'cue-advanced-details'))) {
            window.openTutorial(7);
        } else if (window.tutStep === 7 && (action === 'closeModal' && details === 'settings-modal')) {
            window.openTutorial(8);
        } else if (window.tutStep === 8 && (action === 'openModal' && details === 'cue-menu-modal')) {
            window.openTutorial(9);
        } else if (window.tutStep === 12 && (action === 'closeModal' && details === 'cue-menu-modal')) {
            window.openTutorial(13);
        } else if (window.tutStep === 14 && (action === 'openModal' && details === 'projects-modal')) {
            window.openTutorial(15);
        } else if (window.tutStep === 17 && (action === 'closeModal' && details === 'projects-modal')) {
            window.openTutorial(18);
        } else if (window.tutStep === 18 && (action === 'openModal' && details === 'app-settings')) {
            window.openTutorial(19);
        }
    };

    // Inject styles and configuration dynamically
    const runOnboardingSetup = () => {
        // 1. Inject Styles
        const styleEl = document.createElement('style');
        styleEl.innerHTML = `
            #tutorial-bar {
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%);
                width: calc(100% - 48px);
                max-width: 360px;
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
            #tutorial-bar p {
                font-size: 13px !important;
                line-height: 1.4 !important;
                margin: 0 0 6px 0 !important;
                color: var(--text-main);
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

        // 2. Map structural UI IDs onto elements programmatically
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

        const editModalBtns = document.querySelectorAll('#edit-show-modal .action-btn, #edit-show-modal .btn-delete');
        editModalBtns.forEach(btn => {
            if (btn.textContent.includes('Export')) btn.id = 'show-export-btn';
            else if (btn.textContent.includes('Duplicate')) btn.id = 'show-dup-btn';
            else if (btn.textContent.includes('Save')) btn.id = 'show-save-btn';
            else if (btn.classList.contains('btn-delete')) btn.id = 'show-delete-btn';
        });

        const cueMenuBtns = document.querySelectorAll('#cue-menu-modal .action-btn');
        cueMenuBtns.forEach(btn => {
            if (btn.textContent.includes('Skip')) btn.id = 'ctx-skip-btn';
            else if (btn.textContent.includes('Duplicate')) btn.id = 'ctx-dup-btn';
            else if (btn.textContent.includes('Group')) btn.id = 'ctx-group-btn';
        });

        // 3. Setup dynamic play/pause checks safely
        const pauseBtn = $_tut('pause-btn');
        if (pauseBtn) {
            const originalOnclick = pauseBtn.onclick;
            pauseBtn.onclick = null;
            pauseBtn.addEventListener('click', (e) => {
                const activeCues = window.activeCues;
                const activePads = window.activePads;
                const actSideCues = window.actSideCues;
                const actSidePads = window.actSidePads;
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

        // 4. Inject Dynamic "Interactive Guide" panel under Advanced settings dropdown
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
                    if (typeof window.closeModal === 'function') window.closeModal('app-settings');
                    setTimeout(() => {
                        window.openTutorial(0);
                    }, 150);
                });
                advDetails.appendChild(guideRow);
            }
        };

        // 5. Dynamic Mutation Observer to track system dialog open/close states
        const dialogObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'open') {
                    const dialog = mutation.target;
                    const isOpen = dialog.hasAttribute('open');
                    if (dialog.id === 'app-settings' && isOpen) {
                        addGuideSettingsLink();
                    }
                    window.evalTutorialStep(isOpen ? 'openModal' : 'closeModal', dialog.id);
                }
            });
        });
        document.querySelectorAll('dialog').forEach(dialog => {
            dialogObserver.observe(dialog, { attributes: true });
        });

        // 6. Dynamic Mutation Observer to track music file loading
        const trackObserver = new MutationObserver(() => {
            if (window.tracks && window.tracks.length > 0) {
                window.evalTutorialStep('hFiles');
            }
        });
        const trackListContainer = $_tut('track-list');
        if (trackListContainer) {
            trackObserver.observe(trackListContainer, { childList: true });
        }

        // 7. Track dynamic values inside Settings panel on inputs
        const modalContent = $_tut('modal-content');
        if (modalContent) {
            modalContent.addEventListener('input', (e) => {
                if (e.target.type === 'range') {
                    window.evalTutorialStep('updTrk', { k: 'volume', v: e.target.value });
                }
            });
        }

        // 8. Track toggling Voice/Advanced cues expansions
        document.addEventListener('toggle', (e) => {
            if (e.target.id === 'cue-voice-details' || e.target.id === 'cue-advanced-details') {
                window.evalTutorialStep('openModal', e.target.id);
            }
        }, true);

        // 9. Init dynamic config parameters
        if (window.settings && window.settings.tutorialCompleted === undefined) {
            window.settings.tutorialCompleted = false;
        }

        if (window.settings && !window.settings.tutorialCompleted) {
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
                1: 2,   // Settings gear -> Playback modes
                2: 3,   // Type click -> Volume Level
                4: 5,   // Voice trig summary -> commands summary
                6: 7,   // Advanced summary summary -> close options
                7: 8,   // Close options panel -> long press trigger
                9: 10,  // Skip cue button -> Clone
                10: 11, // Clone -> create group
                11: 12, // Create group -> Dismiss options
                12: 13, // Close actions menu -> Sorting
                14: 15, // Title header -> New Show sheet
                17: 18, // Close show manager -> app settings
                18: 19  // settings cog click -> Concluding
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

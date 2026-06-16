/**
 * Magic Cues Pro - Fully Self-Contained Onboarding & Play/Pause Controller
 * Dynamically injects styling, guides, and interception hooks without touching index.html.
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

    // Blocks simultaneous duplicate openTutorial() calls
    let tutTransitioning = false;
    // Records when the current step was entered
    let stepEntryTime = 0;
    // Tracks the currently highlighted element reference
    let currentHighlightEl = null;

    // Helper to safely trigger parent haptic feedback if available
    const triggerTutHaptic = (pattern) => {
        if (typeof haptic === 'function') haptic(pattern);
        else if (navigator.vibrate) navigator.vibrate(pattern);
    };

    // Helper to dynamically match contextual menu elements by their text label
    const findMenuBtnByText = (text) => {
        return Array.from(document.querySelectorAll('#cue-menu-modal button, #cue-menu-modal .action-btn, #cue-menu-modal div, #cue-menu-modal span'))
            .find(btn => btn.textContent.trim().toLowerCase() === text.toLowerCase() || btn.textContent.trim().toLowerCase().includes(text.toLowerCase()));
    };

    // Helper to determine if a dynamic modal container is fully visible
    const isElementOpen = (id) => {
        const el = $_tut(id);
        if (!el) return false;
        return el.hasAttribute('open') || 
               el.classList.contains('open') || 
               el.classList.contains('show') || 
               (window.getComputedStyle(el).display !== 'none' && window.getComputedStyle(el).visibility !== 'hidden');
    };

    // Only re-apply class when the target element actually changes
    const clearTutHighlights = () => {
        document.querySelectorAll('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));
        currentHighlightEl = null;
    };

    const applyTutHighlight = (targetGetter) => {
        const step = tutSteps[window.tutStep];
        if (step && step.highlight === false) {
            clearTutHighlights();
            return;
        }
        const el = (typeof targetGetter === 'function') ? targetGetter() : null;
        if (el && el === currentHighlightEl) return;
        clearTutHighlights();
        currentHighlightEl = el;
        if (el) el.classList.add('tut-highlight');
    };

    // Onboarding Steps Array (17 Master Steps Covering All Core Functions)
    const tutSteps = [
        {
            title: "Import Your Music",
            badge: "Step 1 of 17",
            text: "Let's build your cue list. Tap <strong>Add Cue</strong> to load an audio file from your device.",
            target: () => $_tut('add-cue-btn'),
            waitForAction: true
        },
        {
            title: "Access Cue Settings",
            badge: "Step 2 of 17",
            text: "Great! Your track is loaded. Tap the <strong>Settings Gear (⚙)</strong> on the right of the cue card to open its options.",
            target: () => document.querySelector('.tile .edit-trigger'),
            alignTo: () => document.querySelector('.tile'),
            waitForAction: true
        },
        {
            title: "Individual Volume Level",
            badge: "Step 3 of 17",
            text: "Drag the <strong>Volume Slider</strong> to set a custom playback volume level. Tapping or sliding the range input will proceed.",
            target: () => $_tut('cue-volume-slider-row'),
            waitForAction: true
        },
        {
            title: "Voice Command Setup",
            badge: "Step 4 of 17",
            text: "Tap on <strong>Voice Triggers</strong> to expand spoken trigger configurations.",
            target: () => $_tut('cue-voice-details'),
            waitForAction: true
        },
        {
            title: "Voice triggers & Global Mode",
            badge: "Step 5 of 17",
            text: "Assign a voice trigger phrase. Tap the <strong>Global</strong> switch to listen even when this cue is not next in queue.",
            target: () => {
                const cb = document.querySelector('#cue-voice-details input[type="checkbox"]');
                if (!cb) return null;
                const switchEl = cb.closest('.switch') || cb.closest('.switch-container') || cb.closest('.toggle') || cb.closest('.slider');
                if (switchEl) return switchEl;
                return cb.closest('label') || cb.parentElement;
            },
            waitForAction: true,
            preferPosition: "bottom" // Exposes the text input field situated above the toggle switch
        },
        {
            title: "Open Advanced Settings",
            badge: "Step 6 of 17",
            text: "Tap <strong>Advanced Settings</strong> to expand timelines, ducking, and looping parameters.",
            target: () => $_tut('cue-advanced-details'),
            waitForAction: true
        },
        {
            title: "Timelines & Ducking",
            badge: "Step 7 of 17",
            text: "Configure custom fade-in/out curves, infinite track looping, or background ducking. Click <strong>Next</strong> to proceed.",
            target: () => $_tut('cue-advanced-details'),
            waitForAction: false
        },
        {
            title: "Close Options Panel",
            badge: "Step 8 of 17",
            text: "Now, let's return to the main dashboard. Tap the top-right <strong>Close (X)</strong> button to exit the panel.",
            target: () => document.querySelector('#settings-modal .icon-btn'),
            positionTarget: () => $_tut('cue-advanced-details'),
            waitForAction: true
        },
        {
            title: "Cue Context Menu",
            badge: "Step 9 of 17",
            text: "<strong>Long-press</strong> (press and hold) anywhere on the middle of the cue card to open the quick actions context menu.",
            target: () => document.querySelector('.tile'),
            alignTo: () => document.querySelector('.tile'),
            waitForAction: true
        },
        {
            title: "Context Menu Rename",
            badge: "Step 10 of 17",
            text: "Type in a new name and tap the <strong>Rename</strong> button or input to easily change this cue's title.",
            target: () => $_tut('rename-cue-input') || document.querySelector('#cue-menu-modal input'),
            waitForAction: true,
            preferPosition: "top" // Ensures the card stays above the input and doesn't block context buttons
        },
        {
            title: "Skip Cue Sequence",
            badge: "Step 11 of 17",
            text: "Tap <strong>Skip Cue</strong> to bypass a track during live performances without deleting it.",
            target: () => findMenuBtnByText('skip') || $_tut('ctx-skip-btn'),
            waitForAction: true
        },
        {
            title: "Duplicate & Groups Cues",
            badge: "Step 12 of 17",
            text: "Tap <strong>Duplicate</strong> to quickly copy cues, or <strong>Create Group</strong> to combine tracks.",
            target: () => findMenuBtnByText('duplicate') || $_tut('ctx-dup-btn'),
            waitForAction: true
        },
        {
            title: "Close Context Menu",
            badge: "Step 13 of 17",
            text: "Let's return to the workspace. Tap the close cross on the top right.",
            target: () => document.querySelector('#cue-menu-modal .icon-btn'),
            positionTarget: () => findMenuBtnByText('duplicate') || $_tut('ctx-dup-btn'),
            waitForAction: true
        },
        {
            title: "Manage Shows",
            badge: "Step 14 of 17",
            text: "Tap the <strong>Show Title Header</strong> at the top left to manage projects.",
            target: () => $_tut('show-title-header'),
            waitForAction: true
        },
        {
            title: "Save, Rename & Import Backup",
            badge: "Step 15 of 17",
            text: "Tap <strong>Import</strong> to restore backups, or long-press a show in the list to export or duplicate it. Click <strong>Next</strong> to proceed.",
            target: () => $_tut('show-import-btn'),
            alignTo: () => $_tut('projects-modal'),
            waitForAction: false
        },
        {
            title: "Close Show Manager",
            badge: "Step 16 of 17",
            text: "Exit the show manager by tapping the <strong>Close (X)</strong> button.",
            target: () => document.querySelector('#projects-modal .icon-btn'),
            positionTarget: () => $_tut('show-import-btn'),
            waitForAction: true
        },
        {
            title: "Onboarding Concluded",
            badge: "Step 17 of 17",
            text: "Guide complete! You can replay this interactive guide at any time by tapping the <strong>Settings Gear (⚙)</strong> in the header and opening <strong>Advanced Settings</strong>. Tap <strong>Finish</strong> to close and start performing.",
            target: () => {
                return $_tut('header-settings-btn') || 
                       document.querySelector('header button[id*="settings"]') || 
                       document.querySelector('header .icon-btn') || 
                       document.querySelector('.header-settings-btn') || 
                       Array.from(document.querySelectorAll('header button, header div, header span')).find(el => el.textContent.includes('settings') || (el.className && el.className.includes('settings')));
            },
            alignTo: () => document.querySelector('header'),
            waitForAction: false
        }
    ];

    // Removes the vector arrow when needed
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
        arrow.style.zIndex       = '2147483647';

        const tutBar = $_tut('tutorial-bar');
        const clampedOffset = Math.max(20, Math.min(tutBar.offsetWidth - 40, arrowOffset - 12));
        arrow.style.left = `${clampedOffset}px`;

        if (direction === 'top') {
            arrow.style.top         = '-12px';
            arrow.style.bottom      = 'auto';
            arrow.style.borderWidth = '0 12px 12px 12px';
            arrow.style.borderColor = 'transparent transparent var(--accent) transparent';
        } else {
            arrow.style.bottom      = '-12px';
            arrow.style.top         = 'auto';
            arrow.style.borderWidth = '12px 12px 0 12px';
            arrow.style.borderColor = 'var(--accent) transparent transparent transparent';
        }
    };

    // Floating viewport positioning system
    const positionPopover = (targetEl, alignEl = null) => {
        const tutBar = $_tut('tutorial-bar');
        if (!tutBar || !targetEl) return;

        const activeDialog = document.querySelector('dialog[open]');
        
        // Append to dialog to inherit top-layer z-index priority without breaking flow
        if (activeDialog) {
            if (tutBar.parentElement !== activeDialog) activeDialog.appendChild(tutBar);
        } else {
            if (tutBar.parentElement !== document.body) document.body.appendChild(tutBar);
        }

        const rect      = targetEl.getBoundingClientRect();
        const alignRect = alignEl ? alignEl.getBoundingClientRect() : rect;
        const barWidth  = tutBar.offsetWidth || 280; 
        const viewWidth = window.innerWidth;
        const viewHeight = window.innerHeight;

        let top = 0;
        let arrowDirection = 'bottom';

        const spaceBelow = viewHeight - rect.bottom;
        const spaceAbove = rect.top;

        const step = tutSteps[window.tutStep];
        const preferPosition = step ? step.preferPosition : null;

        if (preferPosition === 'top') {
            const mockBarHeight = tutBar.offsetHeight || 160;
            top            = rect.top - mockBarHeight - 20; 
            arrowDirection = 'bottom';
        } else if (preferPosition === 'bottom') {
            top            = rect.bottom + 20; 
            arrowDirection = 'top';
        } else {
            if (spaceBelow > spaceAbove) {
                top            = rect.bottom + 20; 
                arrowDirection = 'top';
            } else {
                const mockBarHeight = tutBar.offsetHeight || 160;
                top            = rect.top - mockBarHeight - 20; 
                arrowDirection = 'bottom';
            }
        }

        // Viewport clamping safety net to prevent off-screen rendering
        const minTop = 16;
        const maxTop = viewHeight - (tutBar.offsetHeight || 160) - 16;
        top = Math.max(minTop, Math.min(top, maxTop));

        let left = alignEl
            ? (alignRect.right) - barWidth
            : (rect.left + rect.width / 2) - barWidth / 2;

        left = Math.max(12, Math.min(viewWidth - barWidth - 12, left));

        // In case native dialogs use transforms, compensate fixed offsets
        let offsetX = 0;
        let offsetY = 0;
        if (activeDialog && window.getComputedStyle(activeDialog).transform !== 'none') {
            const dialogRect = activeDialog.getBoundingClientRect();
            offsetX = dialogRect.left;
            offsetY = dialogRect.top;
        }

        tutBar.style.position     = 'fixed';
        tutBar.style.top          = `${top - offsetY}px`;
        tutBar.style.left         = `${left - offsetX}px`;
        tutBar.style.bottom       = 'auto'; // Reset potential leftover from fallback mode
        tutBar.style.height       = 'auto'; // Reset potential leftover scaling
        tutBar.style.transform    = 'none';
        tutBar.style.width        = 'calc(100% - 24px)';
        tutBar.style.maxWidth     = '280px';
        tutBar.style.margin       = '0';
        tutBar.style.zIndex       = '2147483647';
        tutBar.style.boxShadow    = '0 20px 50px rgba(0,0,0,0.6)';
        tutBar.style.border       = '2px solid var(--accent)';
        tutBar.style.background   = 'var(--modal-bg)';
        tutBar.style.borderRadius = '24px';

        const targetCenter = rect.left + rect.width / 2;
        updateArrow(arrowDirection, targetCenter - left);
    };

    window.adjustTutorialBarParent = () => {
        const step = tutSteps[window.tutStep];
        let targetEl = null, alignEl = null;
        if (step) {
            if (typeof step.positionTarget === 'function') targetEl = step.positionTarget();
            else if (typeof step.target === 'function') targetEl = step.target();
            
            if (typeof step.alignTo === 'function') alignEl  = step.alignTo();
        }

        const activeDialog = document.querySelector('dialog[open]');
        const tutBar = $_tut('tutorial-bar');

        if (tutBar) {
            if (activeDialog) {
                if (tutBar.parentElement !== activeDialog) activeDialog.appendChild(tutBar);
            } else {
                if (tutBar.parentElement !== document.body) document.body.appendChild(tutBar);
            }

            if (targetEl) {
                positionPopover(targetEl, alignEl);
            } else {
                tutBar.style.position  = 'fixed';
                tutBar.style.bottom    = '24px';
                tutBar.style.top       = 'auto';
                tutBar.style.left      = '50%';
                tutBar.style.transform = 'translateX(-50%)';
                tutBar.style.width     = 'calc(100% - 48px)';
                tutBar.style.maxWidth  = '280px'; 
                tutBar.style.margin    = '0 auto';
                tutBar.style.zIndex    = '2147483647';
                tutBar.style.boxShadow = '0 20px 50px rgba(0,0,0,0.6)';
                tutBar.style.border    = '2px solid var(--accent)';
                tutBar.style.background = 'var(--modal-bg)';
                tutBar.style.borderRadius = '24px';
                removeArrow();
            }
        }
    };

    window.openTutorial = (stepIdx = 0) => {
        if (tutTransitioning) return;
        tutTransitioning = true;
        setTimeout(() => { tutTransitioning = false; }, 350);

        window.tutActive = true;
        window.tutType   = 'basic';

        const currentTracks = (typeof tracks !== 'undefined') ? tracks : [];
        if (stepIdx === 0 && currentTracks.length > 0) stepIdx = 1;

        window.tutStep = stepIdx;
        stepEntryTime  = Date.now(); 
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
        $_tut('tut-bar-step').innerText  = `Interactive Guide`;
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
        tutTransitioning = false; 
        if (window.tutStep < tutSteps.length - 1) {
            window.openTutorial(window.tutStep + 1);
        } else {
            window.finishTutorial();
        }
    };

    window.skipTutorial = () => {
        triggerTutHaptic([15, 30]);
        window.finishTutorial();
    };

    window.finishTutorial = () => {
        tutTransitioning = false; 
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

    // Failsafe injection helper for dynamic modal menus
    const addGuideSettingsLink = () => {
        const appSettings = document.getElementById('app-settings') || document.querySelector('dialog[id*="settings"]');
        if (!appSettings) return;

        // Try to identify custom detail lists containing "Advanced" configurations
        const detailsList = appSettings.querySelectorAll('details');
        let advDetails = null;

        detailsList.forEach(det => {
            const summary = det.querySelector('summary');
            if (summary && (summary.textContent.toLowerCase().includes('advanced') || summary.textContent.toLowerCase().includes('more'))) {
                advDetails = det.querySelector('.details-content') || det.querySelector('.content') || det;
            }
        });

        // Fallback structures if no dedicated structural content wrapper was matched
        if (!advDetails) {
            advDetails = appSettings.querySelector('details') || appSettings.querySelector('.modal-content') || appSettings;
        }

        if (advDetails && !$_tut('interactive-guide-trigger-row')) {
            const guideRow = document.createElement('div');
            guideRow.className = 'nested-nav-row';
            guideRow.id        = 'interactive-guide-trigger-row';
            guideRow.style.borderTop = '1px solid var(--glass-border)';
            guideRow.style.padding   = '16px 0';
            guideRow.style.cursor    = 'pointer';
            guideRow.innerHTML = `
                <span>Interactive Guide</span>
                <span class="material-symbols-rounded" style="color:var(--accent)">play_circle</span>
            `;
            guideRow.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                triggerTutHaptic(10);
                
                const appSettingsCloseBtn = appSettings.querySelector('.modal-header .icon-btn') || appSettings.querySelector('.icon-btn') || appSettings.querySelector('[class*="close"]');
                if (appSettingsCloseBtn) {
                    appSettingsCloseBtn.click();
                } else if (typeof appSettings.close === 'function') {
                    appSettings.close();
                }
                
                document.body.classList.remove('modal-open');
                
                // Clear state variables to guarantee a clean tutorial restart
                localStorage.removeItem('mc_tutorial_completed');
                localStorage.removeItem('mc_tutorial_step');
                
                setTimeout(() => window.openTutorial(0), 350);
            });
            advDetails.appendChild(guideRow);
        }
    };

    // Configures listeners and state observation loops
    const runOnboardingSetup = () => {
        // 1. Inject Styles
        const styleEl   = document.createElement('style');
        styleEl.type    = 'text/css';
        const cssCode = `
            #tutorial-bar {
                display: none;
                flex-direction: column;
                gap: 12px;
                box-sizing: border-box;
                padding: 20px !important;
                z-index: 2147483647 !important;
                max-height: 90vh;
                overflow-y: auto;
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
              border-radius: 12px !important;
              animation: squirclePulse 2s infinite cubic-bezier(0.25, 0.8, 0.25, 1) !important;
              transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
              z-index: 2147483647 !important;
            }
            /* Match highlights on switches or toggle containers with pill layout and breathing gap */
            .switch.tut-highlight, 
            .switch-container.tut-highlight, 
            .toggle.tut-highlight, 
            .slider.tut-highlight, 
            [class*="switch"].tut-highlight, 
            [class*="toggle"].tut-highlight {
              border-radius: 24px !important;
              padding: 6px !important;
              margin: -6px !important;
            }
            body.tut-active dialog         { backdrop-filter: none !important; }
            body.tut-active dialog::backdrop { backdrop-filter: none !important; }
            /* Prevent dialog overflow layout clipping tutorial containers */
            body.tut-active dialog,
            body.tut-active dialog .modal-content,
            body.tut-active dialog .modal-body,
            body.tut-active #cue-menu-modal,
            body.tut-active #settings-modal,
            body.tut-active #projects-modal {
                overflow: visible !important;
                contain: none !important;
            }
        `;
        if (styleEl.styleSheet) { styleEl.styleSheet.cssText = cssCode; }
        else { styleEl.appendChild(document.createTextNode(cssCode)); }
        document.head.appendChild(styleEl);

        // 2. Setup play/pause dynamic lock safely
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

        // 3. Failsafe body event interceptor for dynamic Settings button interactions
        document.addEventListener('click', (e) => {
            const settingsBtn = e.target.closest('#header-settings-btn') || e.target.closest('header .icon-btn') || e.target.closest('[id*="settings"]');
            if (settingsBtn) {
                setTimeout(addGuideSettingsLink, 100);
                setTimeout(addGuideSettingsLink, 300);
                setTimeout(addGuideSettingsLink, 600);
            }
        }, true);

        // 4. Polling loop: monitors system states, maps dynamic IDs, repositions popover.
        window.tutActive = false;
        if (window.tutPollInterval) clearInterval(window.tutPollInterval);
        window.tutPollInterval = setInterval(() => {
            if (!window.tutActive) return;

            const currentTracks = (typeof tracks !== 'undefined') ? tracks : [];
            runDynamicIdSetup();

            const settingsOpen  = isElementOpen('settings-modal') || isElementOpen('app-settings');
            const menuOpen      = isElementOpen('cue-menu-modal');
            const projectsOpen  = isElementOpen('projects-modal');
            const voiceOpen     = $_tut('cue-voice-details')    && $_tut('cue-voice-details').open;
            const advOpen       = $_tut('cue-advanced-details') && $_tut('cue-advanced-details').open;

            const modalGracePassed = (Date.now() - stepEntryTime) > 800;

            if (window.tutStep === 0) {
                if (currentTracks.length > 0) window.openTutorial(1);
            } else if (window.tutStep === 1) {
                if (settingsOpen) window.openTutorial(2);
            } else if (window.tutStep === 2) {
                if (!settingsOpen && modalGracePassed) window.openTutorial(8); 
            } else if (window.tutStep === 3) {
                if (voiceOpen) window.openTutorial(4);
                else if (!settingsOpen && modalGracePassed) window.openTutorial(8);
            } else if (window.tutStep === 4) {
                if (!settingsOpen && modalGracePassed) window.openTutorial(8);
            } else if (window.tutStep === 5) {
                if (advOpen) window.openTutorial(6);
                else if (!settingsOpen && modalGracePassed) window.openTutorial(8);
            } else if (window.tutStep === 6) {
                if (!settingsOpen && modalGracePassed) window.openTutorial(8);
            } else if (window.tutStep === 7) {
                if (!settingsOpen && modalGracePassed) window.openTutorial(8);
            } else if (window.tutStep === 8) {
                if (menuOpen) window.openTutorial(9);
            } else if (window.tutStep === 9) {
                if (!menuOpen && modalGracePassed) window.openTutorial(13);
            } else if (window.tutStep === 10) {
                if (!menuOpen && modalGracePassed) window.openTutorial(13);
            } else if (window.tutStep === 11) {
                if (!menuOpen && modalGracePassed) window.openTutorial(13);
            } else if (window.tutStep === 12) {
                if (!menuOpen && modalGracePassed) window.openTutorial(13); 
            } else if (window.tutStep === 13) {
                if (projectsOpen) window.openTutorial(14);
            } else if (window.tutStep === 14) {
                if (!projectsOpen && modalGracePassed) window.openTutorial(16);
            } else if (window.tutStep === 15) {
                if (!projectsOpen && modalGracePassed) window.openTutorial(16); 
            }

            // Runs after step checks; applyTutHighlight keeps pulsing active target
            const activeStep = tutSteps[window.tutStep];
            if (activeStep && typeof activeStep.target === 'function') {
                applyTutHighlight(activeStep.target);
            }
            window.adjustTutorialBarParent();

        }, 250);

        // 5. Volume Slider input — sole driver for Step 3 → 4
        document.addEventListener('input', (e) => {
            if (window.tutActive && window.tutStep === 2 && e.target.closest('#cue-volume-slider-row')) {
                setTimeout(() => window.openTutorial(3), 100);
            }
        }, true);

        // 6. Interactive Click Listeners to dynamically advance features on action execution
        document.addEventListener('click', (e) => {
            if (!window.tutActive) return;

            // Global Checkbox Click (Step 5 → 6 transition)
            if (window.tutStep === 4) {
                const voiceDetails = $_tut('cue-voice-details');
                if (voiceDetails) {
                    const globalCheckbox = voiceDetails.querySelector('input[type="checkbox"]');
                    if (globalCheckbox && (e.target === globalCheckbox || globalCheckbox.contains(e.target))) {
                        setTimeout(() => window.openTutorial(5), 100);
                    }
                }
            }

            // Rename Execution Check (Step 10 → 11 transition)
            else if (window.tutStep === 9) {
                const renameInput = $_tut('rename-cue-input') || document.querySelector('#cue-menu-modal input');
                const isInputClick = e.target === renameInput;
                const isRenameBtnClick = e.target.tagName === 'BUTTON' && e.target.textContent.toLowerCase().includes('rename');
                const isModalActionClick = e.target.closest('#cue-menu-modal') && e.target.textContent.toLowerCase().includes('rename');

                if (isInputClick || isRenameBtnClick || isModalActionClick) {
                    setTimeout(() => { if (window.tutStep === 9) window.openTutorial(10); }, 150);
                }
            }

            // Skip Cue Execution Check (Step 11 → 12 transition)
            else if (window.tutStep === 10) {
                const skipBtn = findMenuBtnByText('skip') || $_tut('ctx-skip-btn');
                const clickedSkip = (skipBtn && (e.target === skipBtn || skipBtn.contains(e.target))) || 
                                    (e.target.closest('button') && e.target.closest('button').textContent.toLowerCase().includes('skip'));
                if (clickedSkip) {
                    setTimeout(() => { if (window.tutStep === 10) window.openTutorial(11); }, 150);
                }
            }

            // Duplicate Execution Check (Step 12 → 13 transition)
            else if (window.tutStep === 11) {
                const dupBtn = findMenuBtnByText('duplicate') || $_tut('ctx-dup-btn');
                const clickedDup = (dupBtn && (e.target === dupBtn || dupBtn.contains(e.target))) || 
                                   (e.target.closest('button') && e.target.closest('button').textContent.toLowerCase().includes('duplicate'));
                if (clickedDup) {
                    setTimeout(() => { if (window.tutStep === 11) window.openTutorial(12); }, 150);
                }
            }
        }, true);

        // 7. Global Mutation Observer to intercept dynamic mounting or open states on any dialog
        const settingsObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'open') {
                    const dialog = mutation.target;
                    if (dialog && dialog.tagName === 'DIALOG' && (dialog.id === 'app-settings' || dialog.id === 'settings-modal' || dialog.id.includes('settings')) && dialog.hasAttribute('open')) {
                        addGuideSettingsLink();
                    }
                }
                if (mutation.type === 'childList') {
                    const appSettings = document.getElementById('app-settings') || document.querySelector('dialog[id*="settings"]');
                    if (appSettings && appSettings.hasAttribute('open')) {
                        addGuideSettingsLink();
                    }
                }
            });
        });
        settingsObserver.observe(document.body, { 
            attributes: true, 
            childList: true, 
            subtree: true, 
            attributeFilter: ['open'] 
        });

        // 8. Decoupled tutorial completion check via local storage
        const isCompleted = localStorage.getItem('mc_tutorial_completed') === 'true';
        if (!isCompleted) {
            const savedStep = parseInt(localStorage.getItem('mc_tutorial_step')) || 0;
            setTimeout(() => window.openTutorial(savedStep), 1200);
        }
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
                    <button class="action-btn" id="tut-bar-next" style="padding:8px 16px;font-size:13px;background:var(--accent);color:#fff;border-radius:10px;flex:none;width:auto;">Next</button>
                </div>
            `;
            document.body.appendChild(tutorialBar);

            // Programmatic Event bindings to bypass IIFE scope boundaries
            tutorialBar.querySelector('#tutorial-close-btn').addEventListener('click', () => window.skipTutorial());
            tutorialBar.querySelector('#tut-bar-next').addEventListener('click', () => window.nextTutStep());
        }

        runOnboardingSetup();
    };

    // Expose control functions to window level
    window.skipTutorial = skipTutorial;
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

    window.addEventListener('resize', () => {
        if (window.tutActive) window.adjustTutorialBarParent();
    });

})();

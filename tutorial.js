/**
 * Magic Cues Pro - Fully Self-Contained Onboarding & Play/Pause Controller
 * Dynamically injects styling, guides, and interception hooks without touching index.html.
 *
 * FIX LOG (this revision):
 * [FIX-SQUARE-HIGHLIGHT]  .tut-highlight now forces a consistent border-radius on every
 *                         target, so a plain row (like the Global toggle) gets the same
 *                         rounded glow as buttons that already had their own rounding.
 * [FIX-MENU-OVERLAP]      Dialog-mode positioning is now centralised in
 *                         positionWithinDialog(). "Insert next to the row" placement is
 *                         only attempted inside the Settings modal (the only dialog with a
 *                         reliable row structure); every other dialog — the long-press
 *                         context menu, the Show Manager — safely appends the bar to the
 *                         end of the dialog instead, and the in-dialog card now uses a
 *                         solid background/border instead of a near-transparent one, so it
 *                         can't render illegibly behind the modal's own content again.
 * [FIX-FINAL-STEP-TARGET] Step 17 now targets and highlights the header Settings gear —
 *                         the button that actually opens Advanced Settings / the guide
 *                         replay link — instead of pointing at nothing.
 * [FIX-LONG-CARD]         Added a hard max-height + scroll fallback on the card, clamped
 *                         the calculated top position to sane page bounds, and added a
 *                         follow-up re-measurement one frame later, closing the timing
 *                         window that occasionally let a mid-animation measurement produce
 *                         an oversized card.
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
                return cb.closest('.switch') || cb.closest('.switch-container') || cb.closest('label') || cb.parentElement;
            },
            waitForAction: true
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
            waitForAction: true
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
            target: () => $_tut('projects-modal'),
            highlight: false,
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
            text: "Guide complete! You can replay this interactive guide anytime by tapping the <strong>Settings Gear</strong> above and opening <strong>Advanced Settings</strong>. Tap <strong>Finish</strong> to close and start performing.",
            target: () => $_tut('header-settings-btn'),
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

    // Resolves a safe insertion container for a target element so the tutorial bar can sit
    // next to it instead of just being appended to the dialog. Only ever called for the
    // Settings modal (see positionWithinDialog below) — the one dialog with a consistent
    // ".setting-row"-style structure to hook into.
    const getSafeInsertionPoint = (el) => {
        if (!el) return null;
        let container = el.closest('.setting-row') || el.closest('.setting-item') || el.closest('.control-row') || el.closest('.voice-trigger-row');
        if (!container) {
            const label = el.closest('label');
            if (label) {
                container = label.parentElement;
            } else {
                container = el.parentElement;
            }
        }
        return container || el;
    };

    // [FIX-MENU-OVERLAP] Single source of truth for "tutorial bar lives inside an open
    // dialog" positioning, used by both positionPopover() and adjustTutorialBarParent()'s
    // no-target fallback so the two code paths can never drift apart again. "Insert next
    // to the row" placement is reserved for the Settings modal; every other dialog gets
    // the bar appended at the very end, guaranteed to render on top of its content.
    const positionWithinDialog = (activeDialog, targetEl) => {
        const tutBar = $_tut('tutorial-bar');
        if (!tutBar || !activeDialog) return;

        const canInsertNearTarget = activeDialog.id === 'settings-modal';
        const insertionEl = canInsertNearTarget ? getSafeInsertionPoint(targetEl) : null;

        if (insertionEl && activeDialog.contains(insertionEl)) {
            if (insertionEl.nextSibling !== tutBar) {
                insertionEl.parentNode.insertBefore(tutBar, insertionEl.nextSibling);
            }
        } else if (tutBar.parentElement !== activeDialog) {
            activeDialog.appendChild(tutBar);
        }

        tutBar.style.position     = 'relative';
        tutBar.style.top          = 'auto';
        tutBar.style.left         = 'auto';
        tutBar.style.right        = 'auto';
        tutBar.style.bottom       = 'auto';
        tutBar.style.transform    = 'none';
        tutBar.style.width        = 'calc(100% - 32px)';
        tutBar.style.maxWidth     = '280px';
        tutBar.style.margin       = '16px auto';
        tutBar.style.zIndex       = '13000';
        // [FIX-MENU-OVERLAP] Solid background + real border/shadow, matching the floating
        // card's contrast, so the bar reads clearly no matter what's rendered behind it.
        tutBar.style.boxShadow    = '0 12px 28px rgba(0,0,0,0.5)';
        tutBar.style.border       = '2px solid var(--accent)';
        tutBar.style.background   = 'var(--modal-bg)';
        tutBar.style.borderRadius = '18px';
        removeArrow();

        // Belt-and-braces: pulls the bar into view in case the dialog's own content scrolls.
        tutBar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    // Absolute screen positioning system with an expanded 24px breathing gap
    const positionPopover = (targetEl, alignEl = null) => {
        const tutBar = $_tut('tutorial-bar');
        if (!tutBar || !targetEl) return;

        const activeDialog = document.querySelector('dialog[open]');
        if (activeDialog) {
            positionWithinDialog(activeDialog, targetEl);
            return;
        }

        if (tutBar.parentElement !== document.body) document.body.appendChild(tutBar);

        const rect       = targetEl.getBoundingClientRect();
        const alignRect  = alignEl ? alignEl.getBoundingClientRect() : rect;
        const barWidth   = tutBar.offsetWidth  || 280;
        const barHeight  = tutBar.offsetHeight || 160;
        const viewWidth  = window.innerWidth;
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

        // [FIX-LONG-CARD] Clamp to the page's real scrollable bounds. A target mid-
        // animation can momentarily report an extreme rect, which is what occasionally
        // sent the card to an extreme top value and made it look "stretched."
        const pageBottom = Math.max(document.documentElement.scrollHeight, viewHeight) + window.scrollY;
        top = Math.max(window.scrollY + 12, Math.min(top, pageBottom - barHeight - 12));

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
        if (step) {
            if (typeof step.positionTarget === 'function') targetEl = step.positionTarget();
            else if (typeof step.target === 'function') targetEl = step.target();

            if (typeof step.alignTo === 'function') alignEl = step.alignTo();
        }

        const activeDialog = document.querySelector('dialog[open]');
        const tutBar = $_tut('tutorial-bar');

        if (targetEl) {
            positionPopover(targetEl, alignEl);
        } else if (tutBar) {
            if (activeDialog) {
                positionWithinDialog(activeDialog, null);
            } else {
                if (tutBar.parentElement !== document.body) document.body.appendChild(tutBar);
                tutBar.style.position  = 'fixed';
                tutBar.style.bottom    = '24px';
                tutBar.style.top       = 'auto';
                tutBar.style.left      = '50%';
                tutBar.style.transform = 'translateX(-50%)';
                tutBar.style.width     = 'calc(100% - 48px)';
                tutBar.style.maxWidth  = '280px';
                tutBar.style.margin    = '0 auto';
                tutBar.style.zIndex    = '13000';
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
        $_tut('tut-bar-step').innerText  = `Step ${window.tutStep + 1} of ${tutSteps.length}`;
        $_tut('tut-bar-badge').innerText = step.badge;
        $_tut('tut-bar-text').innerHTML  = step.text;

        applyTutHighlight(step.target);
        window.adjustTutorialBarParent();

        // [FIX-LONG-CARD] One more positioning pass after layout has fully settled —
        // catches cases where the call above measured a target still mid-transition.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (window.tutStep === stepIdx) window.adjustTutorialBarParent();
        }));

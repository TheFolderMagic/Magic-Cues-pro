/**
 * Magic Cues Pro - Onboarding Companion Script
 * Dynamic runtime injector to preserve Cordova, NFC, and dragging models.
 */

(function() {
  // Inject the modern Apple squircle pulsing highlights and self-scaling container styles
  const style = document.createElement('style');
  style.innerHTML = `
    /* High-Finesse organic pulsing Squircle focus ring */
    @keyframes squirclePulse {
      0% {
        box-shadow: 0 0 0 1px var(--accent), 0 0 0 2px rgba(0, 122, 255, 0.4), 0 4px 16px rgba(0, 122, 255, 0.15);
      }
      50% {
        box-shadow: 0 0 0 3.5px var(--accent), 0 0 0 10px rgba(0, 122, 255, 0.25), 0 12px 32px rgba(0, 122, 255, 0.45);
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

    /* Circle overrides for circular buttons */
    .tut-highlight[style*="border-radius: 50%"],
    .tut-highlight[style*="border-radius:50%"],
    #pocket-exit-btn.tut-highlight,
    #mic-btn.tut-highlight,
    #pause-btn.tut-highlight {
      border-radius: 50% !important;
    }

    /* Smart dynamic layout: scales to fit bottom of any opened modal dialog gracefully */
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
      background: rgba(128, 128, 128, 0.06) !important;
    }
    body.tut-active dialog {
      backdrop-filter: none !important;
    }
    body.tut-active dialog::backdrop {
      backdrop-filter: none !important;
    }
  `;
  document.head.appendChild(style);

  // Define the 20 onboarding guide steps
  window.tutSteps = [
    {
      title: "Import Your Music",
      badge: "Step 1: Add a Track",
      text: "Let's build your cue list. Tap <strong>Add Cue</strong> to load an audio file from your device.",
      target: () => document.getElementById('add-cue-btn'),
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
      target: () => document.getElementById('cue-type-selector-row'),
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
      target: () => document.getElementById('cue-voice-details'),
      waitForAction: false
    },
    {
      title: "Timelines & Atmospheric Ducking",
      badge: "Step 7: Advanced Settings",
      text: "Open <strong>Advanced Settings</strong> to find audio trimming, custom fades, looping background modes, and automatic volume ducking.",
      target: () => document.getElementById('cue-advanced-details'),
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
      target: () => document.getElementById('ctx-skip-btn'),
      waitForAction: true
    },
    {
      title: "Cloning",
      badge: "Step 11: Duplicate Cue",
      text: "Tap <strong>Duplicate</strong> to quickly copy this cue and all of its settings.",
      target: () => document.getElementById('ctx-dup-btn'),
      waitForAction: true
    },
    {
      title: "Create Group Container",
      badge: "Step 12: Cue Groups",
      text: "Tap <strong>Create Group</strong> to combine tracks. This opens a nested sideload player.",
      target: () => document.getElementById('ctx-group-btn'),
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
      target: () => document.getElementById('show-title-header'),
      waitForAction: true
    },
    {
      title: "Clean Show Sheets",
      badge: "Step 16: New Show Files",
      text: "Tap <strong>New</strong> to start a completely fresh show sheet.",
      target: () => document.getElementById('show-new-btn'),
      waitForAction: false
    },
    {
      title: "File Imports",
      badge: "Step 17: Imports",
      text: "Tap <strong>Import</strong> to restore backup show files (with the <code>.magic</code> extension).",
      target: () => document.getElementById('show-import-btn'),
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
      target: () => document.getElementById('header-settings-btn'),
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

  // Dynamically inject the onboarding panel HTML if not present
  function injectTutorialHTML() {
    if (document.getElementById('tutorial-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'tutorial-bar';
    bar.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
        <div>
          <span class="tut-step-indicator" id="tut-bar-step">Step 1 of 20</span>
          <span class="tut-section-badge" id="tut-bar-badge">Basic Understanding</span>
          <h4 id="tut-bar-title" style="margin: 4px 0 0 0; font-size: 16px; font-weight: 700;">Welcome to Magic Cues</h4>
        </div>
        <button class="icon-btn" style="width: 32px; height: 32px; border-radius: 10px; background: rgba(128,128,128,0.15); border: none;" onclick="skipTutorial()">
          <span class="material-symbols-rounded" style="font-size: 16px;">close</span>
        </button>
      </div>
      <p id="tut-bar-text" style="margin: 0; font-size: 14px; line-height: 1.5; color: var(--text-muted); font-weight: 500;"></p>
      <div style="display: flex; justify-content: flex-end; gap: 8px;" id="tut-bar-actions">
        <button class="action-btn" id="tut-bar-prev" style="padding: 8px 16px; font-size: 13px; border-radius: 10px; flex: none; width: auto;" onclick="prevTutStep()">Back</button>
        <button class="action-btn" id="tut-bar-next" style="padding: 8px 16px; font-size: 13px; background: var(--accent); color: #fff; border-radius: 10px; flex: none; width: auto;" onclick="nextTutStep()">Next</button>
      </div>
    `;
    document.body.appendChild(bar);
  }

  // Manage Onboarding Guide Bar parent DOM positions
  window.adjustTutorialBarParent = function() {
    const activeDialog = document.querySelector('dialog[open]');
    const tutBar = document.getElementById('tutorial-bar');
    if (!tutBar) return;
    if (activeDialog) {
      if (tutBar.parentElement !== activeDialog) {
        activeDialog.appendChild(tutBar);
      }
      tutBar.style.position = 'fixed';
      tutBar.style.bottom = '16px';
      tutBar.style.top = 'auto';
      tutBar.style.left = '16px';
      tutBar.style.right = '16px';
      tutBar.style.width = 'calc(100% - 32px)';
      tutBar.style.maxWidth = '360px';
      tutBar.style.margin = '0 auto';
      tutBar.style.zIndex = '13000';
    } else {
      if (tutBar.parentElement !== document.body) {
        document.body.appendChild(tutBar);
      }
      tutBar.style.position = 'fixed';
      tutBar.style.bottom = '24px';
      tutBar.style.top = 'auto';
      tutBar.style.left = '24px';
      tutBar.style.right = '24px';
      tutBar.style.width = 'calc(100% - 48px)';
      tutBar.style.maxWidth = '360px';
      tutBar.style.margin = '0 auto';
      tutBar.style.zIndex = '13000';
    }
  };

  window.clearTutHighlights = function() {
    document.querySelectorAll('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));
  };

  window.applyTutHighlight = function(targetGetter) {
    window.clearTutHighlights();
    if (typeof targetGetter === 'function') {
      const el = targetGetter();
      if (el) el.classList.add('tut-highlight');
    }
  };

  window.openTutorial = function(stepIdx = 0) {
    window.tutActive = true;
    window.tutStep = stepIdx;
    document.body.classList.add('tut-active');

    if (stepIdx === 2) {
      if (window.closeModal) window.closeModal('cue-menu-modal');
    }

    const step = window.tutSteps[window.tutStep];
    if (!step) return;

    const barStep = document.getElementById('tut-bar-step');
    const barBadge = document.getElementById('tut-bar-badge');
    const barText = document.getElementById('tut-bar-text');
    const barNext = document.getElementById('tut-bar-next');
    const barContainer = document.getElementById('tutorial-bar');

    if (barStep) barStep.innerText = `Step ${window.tutStep + 1} of ${window.tutSteps.length}`;
    if (barBadge) barBadge.innerText = step.badge;
    if (barText) barText.innerHTML = step.text;

    window.applyTutHighlight(step.target);
    window.adjustTutorialBarParent();

    if (barNext) {
      barNext.innerText = (window.tutStep === window.tutSteps.length - 1) ? 'Finish' : 'Next';
      barNext.style.display = step.waitForAction ? 'none' : 'block';
    }
    if (barContainer) barContainer.style.display = 'flex';
  };

  window.nextTutStep = function() {
    if (window.haptic) window.haptic(10);
    if (window.tutStep < window.tutSteps.length - 1) {
      window.openTutorial(window.tutStep + 1);
    } else {
      window.finishTutorial();
    }
  };

  window.prevTutStep = function() {
    if (window.haptic) window.haptic(10);
    if (window.tutStep > 0) {
      window.openTutorial(window.tutStep - 1);
    }
  };

  window.skipTutorial = function() {
    if (window.haptic) window.haptic([15, 30]);
    window.finishTutorial();
  };

  window.finishTutorial = function() {
    window.clearTutHighlights();
    window.tutActive = false;
    document.body.classList.remove('tut-active');
    if (window.updSet) {
      window.updSet('tutorialCompleted', true);
    } else {
      localStorage.setItem('mc_settings', JSON.stringify({ ...JSON.parse(localStorage.getItem('mc_settings') || '{}'), tutorialCompleted: true }));
    }
    const barContainer = document.getElementById('tutorial-bar');
    if (barContainer) barContainer.style.display = 'none';
    window.adjustTutorialBarParent();
  };

  window.evalTutorialStep = function() {
    if (!window.tutActive) return;

    const settingsOpen = document.getElementById('settings-modal')?.open; 
    const cueMenuOpen = document.getElementById('cue-menu-modal')?.open;
    const projectsOpen = document.getElementById('projects-modal')?.open;
    const appSettingsOpen = document.getElementById('app-settings')?.open;
    const voiceOpen = document.getElementById('cue-voice-details')?.open;
    const advOpen = document.getElementById('cue-advanced-details')?.open;

    if (window.tutStep === 0 && window.tracks && window.tracks.length > 0) {
      window.openTutorial(1);
    } else if (window.tutStep === 1 && settingsOpen) {
      window.openTutorial(2);
    } else if (window.tutStep === 4 && voiceOpen) {
      window.openTutorial(5);
    } else if (window.tutStep === 6 && advOpen) {
      window.openTutorial(7);
    } else if (window.tutStep === 7 && !settingsOpen) {
      window.openTutorial(8);
    } else if (window.tutStep === 8 && cueMenuOpen) {
      window.openTutorial(9);
    } else if (window.tutStep === 12 && !cueMenuOpen) {
      window.openTutorial(13);
    } else if (window.tutStep === 14 && projectsOpen) {
      window.openTutorial(15);
    } else if (window.tutStep === 17 && !projectsOpen) {
      window.openTutorial(18);
    } else if (window.tutStep === 18 && appSettingsOpen) {
      window.openTutorial(19);
    }
  };

  // Case-sensitive Click-to-Advance Interception [1]
  document.addEventListener('click', (e) => {
    if (!window.tutActive) return;
    const step = window.tutSteps[window.tutStep];
    if (!step || !step.target) return;
    const targetEl = step.target();
    if (!targetEl) return;

    if (targetEl.contains(e.target) || e.target === targetEl) {
      const clickAdvanceMap = {
        1: 2,   // Step 2 settings gear click -> Step 3
        4: 5,   // Step 5 voice triggers summary click -> Step 6
        6: 7,   // Step 7 advanced settings summary click -> Step 8
        7: 8,   // Step 8 close settings modal click -> Step 9
        9: 10,  // Step 10 Skip cue click -> Step 11
        10: 11, // Step 11 Duplicate click -> Step 12
        11: 12, // Step 12 Create Group click -> Step 13
        12: 13, // Step 13 close cue options modal click -> Step 14
        14: 15, // Step 15 Show Title Header click -> Step 16
        17: 18, // Step 18 close projects modal click -> Step 19
        18: 19  // Step 19 settings cog click -> Step 20
      };
      if (clickAdvanceMap[window.tutStep] !== undefined) {
        setTimeout(() => {
          window.openTutorial(clickAdvanceMap[window.tutStep]);
        }, 100);
      }
    }
  }, true);

  // Initialize runtime overrides on window load
  window.addEventListener('load', () => {
    injectTutorialHTML();
    
    // Inject runtime life-cycle listeners [1]
    if (window.openModal) {
      const originalOpenModal = window.openModal;
      window.openModal = function(id) {
        originalOpenModal(id);
        if (window.tutActive) window.evalTutorialStep();
      };
    }
    if (window.closeModal) {
      const originalCloseModal = window.closeModal;
      window.closeModal = function(id) {
        originalCloseModal(id);
        if (window.tutActive) window.evalTutorialStep();
      };
    }
    if (window.updTrk) {
      const originalUpdTrk = window.updTrk;
      window.updTrk = function(k, v) {
        originalUpdTrk(k, v);
        if (window.tutActive && window.tutStep === 3 && k === 'volume') {
          window.openTutorial(4); // Advance on volume slider changes
        }
      };
    }
    if (window.openProjects) {
      const originalOpenProjects = window.openProjects;
      window.openProjects = function() {
        originalOpenProjects();
        if (window.tutActive && window.tutStep === 14) {
          window.openTutorial(15);
        }
      };
    }
    if (window.stCuePrs) {
      const originalStCuePrs = window.stCuePrs;
      window.stCuePrs = function(e, id, s) {
        originalStCuePrs(e, id, s);
        if (window.tutActive && window.tutStep === 8) {
          window.openTutorial(9);
        }
      };
    }
    if (window.openSet) {
      const originalOpenSet = window.openSet;
      window.openSet = function(id, s) {
        originalOpenSet(id, s);
        if (window.tutActive && window.tutStep === 1) {
          window.openTutorial(2);
        }
      };
    }

    // Auto-run on first startup
    setTimeout(() => {
      if (window.settings && !window.settings.tutorialCompleted) {
        window.openTutorial(0);
      }
    }, 1200);
  });
})();

// accessibility-bar.js
(function() {
  'use strict';

  // Configuración inicial
  const config = {
    fontSize: 100,
    contrast: 'normal',
    grayscale: false,
    highlightLinks: false,
    readableFont: false,
    lineHeight: 'normal',
    letterSpacing: 'normal'
  };

  // Cargar configuración guardada
  function loadConfig() {
    const saved = localStorage.getItem('accessibilityConfig');
    if (saved) {
      Object.assign(config, JSON.parse(saved));
      applyAllSettings();
    }
  }

  // Guardar configuración
  function saveConfig() {
    localStorage.setItem('accessibilityConfig', JSON.stringify(config));
  }

  // Crear HTML de la barra
  function createAccessibilityBar() {
    const html = `
      <div id="accessibility-container">
        <button id="accessibility-toggle" aria-label="Abrir opciones de accesibilidad" aria-expanded="false">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="8" r="1.5"></circle>
            <path d="M12 10v6"></path>
            <path d="M8 13h8"></path>
          </svg>
        </button>
        
        <div id="accessibility-panel" class="hidden">
          <div class="acc-header">
            <h3>Opciones de Accesibilidad</h3>
            <button id="acc-close" aria-label="Cerrar panel">×</button>
          </div>
          
          <div class="acc-content">
            <!-- Tamaño de fuente -->
            <div class="acc-option">
              <label>Tamaño de texto</label>
              <div class="acc-controls">
                <button class="acc-btn" data-action="decreaseFont" aria-label="Disminuir tamaño">A-</button>
                <span id="font-size-display">100%</span>
                <button class="acc-btn" data-action="increaseFont" aria-label="Aumentar tamaño">A+</button>
              </div>
            </div>

            <!-- Contraste -->
            <div class="acc-option">
              <label>Contraste</label>
              <div class="acc-controls">
                <button class="acc-btn-full" data-action="toggleContrast">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 2v20"></path>
                  </svg>
                  Alto Contraste
                </button>
              </div>
            </div>

            <!-- Escala de grises -->
            <div class="acc-option">
              <label>Escala de grises</label>
              <div class="acc-controls">
                <button class="acc-btn-full" data-action="toggleGrayscale">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                    <path d="M3 12h18"></path>
                  </svg>
                  Activar
                </button>
              </div>
            </div>

            <!-- Resaltar enlaces -->
            <div class="acc-option">
              <label>Resaltar enlaces</label>
              <div class="acc-controls">
                <button class="acc-btn-full" data-action="toggleHighlightLinks">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                  Activar
                </button>
              </div>
            </div>

            <!-- Fuente legible -->
            <div class="acc-option">
              <label>Fuente legible</label>
              <div class="acc-controls">
                <button class="acc-btn-full" data-action="toggleReadableFont">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M4 7V4h16v3"></path>
                    <path d="M9 20h6"></path>
                    <path d="M12 4v16"></path>
                  </svg>
                  Activar
                </button>
              </div>
            </div>

            <!-- Espaciado de líneas -->
            <div class="acc-option">
              <label>Espaciado de líneas</label>
              <div class="acc-controls">
                <button class="acc-btn" data-action="decreaseLineHeight">-</button>
                <span id="line-height-display">Normal</span>
                <button class="acc-btn" data-action="increaseLineHeight">+</button>
              </div>
            </div>

            <!-- Espaciado de letras -->
            <div class="acc-option">
              <label>Espaciado de letras</label>
              <div class="acc-controls">
                <button class="acc-btn" data-action="decreaseLetterSpacing">-</button>
                <span id="letter-spacing-display">Normal</span>
                <button class="acc-btn" data-action="increaseLetterSpacing">+</button>
              </div>
            </div>

            <!-- Restablecer -->
            <div class="acc-option">
              <button class="acc-btn-reset" data-action="reset">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                  <path d="M21 3v5h-5"></path>
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                  <path d="M3 21v-5h5"></path>
                </svg>
                Restablecer todo
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  // Crear estilos CSS
  function createStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #accessibility-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      }

      #accessibility-toggle {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: #2563eb;
        color: white;
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
      }

      #accessibility-toggle:hover {
        background: #1d4ed8;
        transform: scale(1.05);
      }

      #accessibility-panel {
        position: absolute;
        top: 60px;
        right: 0;
        width: 320px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        overflow: hidden;
        transition: all 0.3s ease;
      }

      #accessibility-panel.hidden {
        opacity: 0;
        visibility: hidden;
        transform: translateY(-10px);
      }

      .acc-header {
        background: #2563eb;
        color: white;
        padding: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .acc-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      #acc-close {
        background: none;
        border: none;
        color: white;
        font-size: 28px;
        cursor: pointer;
        line-height: 1;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background 0.2s;
      }

      #acc-close:hover {
        background: rgba(255,255,255,0.1);
      }

      .acc-content {
        padding: 16px;
        max-height: 500px;
        overflow-y: auto;
      }

      .acc-option {
        margin-bottom: 16px;
        padding-bottom: 16px;
        border-bottom: 1px solid #e5e7eb;
      }

      .acc-option:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
      }

      .acc-option label {
        display: block;
        font-size: 14px;
        font-weight: 500;
        color: #374151;
        margin-bottom: 8px;
      }

      .acc-controls {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .acc-btn {
        padding: 8px 16px;
        background: #f3f4f6;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
        flex: 0 0 auto;
      }

      .acc-btn:hover {
        background: #e5e7eb;
        border-color: #9ca3af;
      }

      .acc-btn-full {
        width: 100%;
        padding: 10px 16px;
        background: #f3f4f6;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 8px;
        justify-content: center;
      }

      .acc-btn-full:hover {
        background: #e5e7eb;
        border-color: #9ca3af;
      }

      .acc-btn-full.active {
        background: #2563eb;
        color: white;
        border-color: #2563eb;
      }

      .acc-btn-full.active:hover {
        background: #1d4ed8;
      }

      .acc-btn-reset {
        width: 100%;
        padding: 10px 16px;
        background: #ef4444;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 8px;
        justify-content: center;
      }

      .acc-btn-reset:hover {
        background: #dc2626;
      }

      #font-size-display,
      #line-height-display,
      #letter-spacing-display {
        flex: 1;
        text-align: center;
        font-size: 14px;
        color: #374151;
        font-weight: 500;
      }

      /* Estilos aplicados al body */
      body.high-contrast {
        filter: contrast(150%);
      }

      body.grayscale {
        filter: grayscale(100%);
      }

      body.high-contrast.grayscale {
        filter: contrast(150%) grayscale(100%);
      }

      body.highlight-links a {
        background: #fef08a !important;
        padding: 2px 4px !important;
        border-radius: 3px !important;
      }

      body.readable-font,
      body.readable-font * {
        font-family: Arial, sans-serif !important;
      }

      /* Scrollbar personalizado */
      .acc-content::-webkit-scrollbar {
        width: 6px;
      }

      .acc-content::-webkit-scrollbar-track {
        background: #f1f1f1;
      }

      .acc-content::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 3px;
      }

      .acc-content::-webkit-scrollbar-thumb:hover {
        background: #555;
      }

      @media (max-width: 768px) {
        #accessibility-container {
          top: 10px;
          right: 10px;
        }

        #accessibility-panel {
          width: calc(100vw - 40px);
          right: -10px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Aplicar tamaño de fuente
  function applyFontSize() {
    document.documentElement.style.fontSize = config.fontSize + '%';
    document.getElementById('font-size-display').textContent = config.fontSize + '%';
  }

  // Aplicar contraste
  function applyContrast() {
    const btn = document.querySelector('[data-action="toggleContrast"]');
    if (config.contrast === 'high') {
      document.body.classList.add('high-contrast');
      btn.classList.add('active');
      btn.innerHTML = btn.innerHTML.replace('Alto Contraste', 'Contraste Normal');
    } else {
      document.body.classList.remove('high-contrast');
      btn.classList.remove('active');
      btn.innerHTML = btn.innerHTML.replace('Contraste Normal', 'Alto Contraste');
    }
  }

  // Aplicar escala de grises
  function applyGrayscale() {
    const btn = document.querySelector('[data-action="toggleGrayscale"]');
    if (config.grayscale) {
      document.body.classList.add('grayscale');
      btn.classList.add('active');
      btn.lastChild.textContent = ' Desactivar';
    } else {
      document.body.classList.remove('grayscale');
      btn.classList.remove('active');
      btn.lastChild.textContent = ' Activar';
    }
  }

  // Aplicar resaltado de enlaces
  function applyHighlightLinks() {
    const btn = document.querySelector('[data-action="toggleHighlightLinks"]');
    if (config.highlightLinks) {
      document.body.classList.add('highlight-links');
      btn.classList.add('active');
      btn.lastChild.textContent = ' Desactivar';
    } else {
      document.body.classList.remove('highlight-links');
      btn.classList.remove('active');
      btn.lastChild.textContent = ' Activar';
    }
  }

  // Aplicar fuente legible
  function applyReadableFont() {
    const btn = document.querySelector('[data-action="toggleReadableFont"]');
    if (config.readableFont) {
      document.body.classList.add('readable-font');
      btn.classList.add('active');
      btn.lastChild.textContent = ' Desactivar';
    } else {
      document.body.classList.remove('readable-font');
      btn.classList.remove('active');
      btn.lastChild.textContent = ' Activar';
    }
  }

  // Aplicar altura de línea
  function applyLineHeight() {
    const values = { normal: '1.5', medium: '1.8', large: '2.1' };
    const labels = { normal: 'Normal', medium: 'Medio', large: 'Grande' };
    document.body.style.lineHeight = values[config.lineHeight];
    document.getElementById('line-height-display').textContent = labels[config.lineHeight];
  }

  // Aplicar espaciado de letras
  function applyLetterSpacing() {
    const values = { normal: '0', medium: '0.05em', large: '0.1em' };
    const labels = { normal: 'Normal', medium: 'Medio', large: 'Grande' };
    document.body.style.letterSpacing = values[config.letterSpacing];
    document.getElementById('letter-spacing-display').textContent = labels[config.letterSpacing];
  }

  // Aplicar todas las configuraciones
  function applyAllSettings() {
    applyFontSize();
    applyContrast();
    applyGrayscale();
    applyHighlightLinks();
    applyReadableFont();
    applyLineHeight();
    applyLetterSpacing();
  }

  // Manejadores de eventos
  function setupEventListeners() {
    const toggle = document.getElementById('accessibility-toggle');
    const panel = document.getElementById('accessibility-panel');
    const close = document.getElementById('acc-close');

    toggle.addEventListener('click', () => {
      const isHidden = panel.classList.contains('hidden');
      panel.classList.toggle('hidden');
      toggle.setAttribute('aria-expanded', isHidden);
    });

    close.addEventListener('click', () => {
      panel.classList.add('hidden');
      toggle.setAttribute('aria-expanded', 'false');
    });

    // Cerrar al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!document.getElementById('accessibility-container').contains(e.target)) {
        panel.classList.add('hidden');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Acciones de los botones
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        
        switch(action) {
          case 'increaseFont':
            config.fontSize = Math.min(config.fontSize + 10, 200);
            applyFontSize();
            break;
          case 'decreaseFont':
            config.fontSize = Math.max(config.fontSize - 10, 80);
            applyFontSize();
            break;
          case 'toggleContrast':
            config.contrast = config.contrast === 'normal' ? 'high' : 'normal';
            applyContrast();
            break;
          case 'toggleGrayscale':
            config.grayscale = !config.grayscale;
            applyGrayscale();
            break;
          case 'toggleHighlightLinks':
            config.highlightLinks = !config.highlightLinks;
            applyHighlightLinks();
            break;
          case 'toggleReadableFont':
            config.readableFont = !config.readableFont;
            applyReadableFont();
            break;
          case 'increaseLineHeight':
            const lhOrder = ['normal', 'medium', 'large'];
            const lhIdx = lhOrder.indexOf(config.lineHeight);
            config.lineHeight = lhOrder[Math.min(lhIdx + 1, lhOrder.length - 1)];
            applyLineHeight();
            break;
          case 'decreaseLineHeight':
            const lhOrder2 = ['normal', 'medium', 'large'];
            const lhIdx2 = lhOrder2.indexOf(config.lineHeight);
            config.lineHeight = lhOrder2[Math.max(lhIdx2 - 1, 0)];
            applyLineHeight();
            break;
          case 'increaseLetterSpacing':
            const lsOrder = ['normal', 'medium', 'large'];
            const lsIdx = lsOrder.indexOf(config.letterSpacing);
            config.letterSpacing = lsOrder[Math.min(lsIdx + 1, lsOrder.length - 1)];
            applyLetterSpacing();
            break;
          case 'decreaseLetterSpacing':
            const lsOrder2 = ['normal', 'medium', 'large'];
            const lsIdx2 = lsOrder2.indexOf(config.letterSpacing);
            config.letterSpacing = lsOrder2[Math.max(lsIdx2 - 1, 0)];
            applyLetterSpacing();
            break;
          case 'reset':
            config.fontSize = 100;
            config.contrast = 'normal';
            config.grayscale = false;
            config.highlightLinks = false;
            config.readableFont = false;
            config.lineHeight = 'normal';
            config.letterSpacing = 'normal';
            applyAllSettings();
            break;
        }
        
        saveConfig();
      });
    });
  }

  // Inicializar
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        createStyles();
        createAccessibilityBar();
        loadConfig();
        setupEventListeners();
      });
    } else {
      createStyles();
      createAccessibilityBar();
      loadConfig();
      setupEventListeners();
    }
  }

  init();
})();
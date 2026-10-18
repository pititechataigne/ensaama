
/* effects-perso.js
   Effets pour les images des écrans A-Frame
*/

AFRAME.registerComponent('screen-effects', {
  init: function () {
    const el = this.el;

    this.basePosition = el.object3D.position.clone();
    this.originalSrc = el.getAttribute('src');
    this.originalMaterial = el.getAttribute('material');

    this.glitchTimer = null;
    this.glitchEndTimer = null;
    this.isScreenOff = false;

    // GLITCH : clignotement et déplacement léger
    el.addEventListener('screen-glitch', () => {
     if (this.isScreenOff) return;

     this.stopGlitch();

     this.glitchTimer = setInterval(() => {
      if (this.isScreenOff) {
       this.stopGlitch();
       return;
      }

       el.object3D.position.x =
       this.basePosition.x + (Math.random() - 0.5) * 0.08;

       el.object3D.position.y =
       this.basePosition.y + (Math.random() - 0.5) * 0.05;

       el.object3D.position.z =
       this.basePosition.z + (Math.random() - 0.5) * 0.03;

      el.object3D.visible = Math.random() > 0.3;
     }, 65);
    });

    // ÉCRAN BLEU
    el.addEventListener('screen-blue', () => {
      if (this.isScreenOff) return;

      this.stopGlitch();

      el.object3D.position.copy(this.basePosition);
      el.object3D.visible = true;

      const mesh = el.getObject3D('mesh');

      if (!mesh) {
        console.warn('screen-blue : aucun mesh trouvé', el);
        return;
      }

      mesh.material = new THREE.MeshBasicMaterial({
        color: 0x0755ff,
        side: THREE.DoubleSide
      });

      mesh.material.needsUpdate = true;
      mesh.visible = true;
    });

    // EXTINCTION : reste éteint jusqu'à screen-reset
    el.addEventListener('screen-off', () => {
      this.isScreenOff = true;
      this.stopGlitch();

      el.object3D.position.copy(this.basePosition);
      el.object3D.visible = false;
    });

    // RÉINITIALISATION
    el.addEventListener('screen-reset', () => {
      this.stopGlitch();

      this.isScreenOff = false;
      el.object3D.position.copy(this.basePosition);
      el.object3D.visible = true;

      if (this.originalSrc) {
        el.setAttribute('src', this.originalSrc);
      }

      if (this.originalMaterial) {
        el.setAttribute('material', this.originalMaterial);
      }
    });
  },

  stopGlitch: function () {
    if (this.glitchTimer !== null) {
      clearInterval(this.glitchTimer);
      this.glitchTimer = null;
    }

    if (this.glitchEndTimer !== null) {
      clearTimeout(this.glitchEndTimer);
      this.glitchEndTimer = null;
    }

    // Ne jamais rallumer un écran verrouillé en extinction
    if (!this.isScreenOff) {
      this.el.object3D.visible = true;
    }

    this.el.object3D.position.copy(this.basePosition);
  },

  remove: function () {
    this.stopGlitch();
  }
});



/* Orchestration progressive des écrans */

AFRAME.registerComponent('screen-sequence', {
  schema: {
    selector: { type: 'string', default: '.screen-image' },
    stagger: { type: 'number', default: 250 }
  },

  init: function () {
    this.el.addEventListener('screen-sequence-glitch', () => {
      this.playSequence('screen-glitch');
    });

    this.el.addEventListener('screen-sequence-blue', () => {
      this.playSequence('screen-blue');
    });

    this.el.addEventListener('screen-sequence-off', () => {
      document.querySelectorAll(this.data.selector).forEach(screen => {
        screen.emit('screen-off');
      });
    });
  },

  playSequence: function (eventName) {
    const screens = document.querySelectorAll(this.data.selector);

    screens.forEach((screen, i) => {
      setTimeout(() => {
        screen.emit(eventName);
      }, i * this.data.stagger);
    });
  }
});


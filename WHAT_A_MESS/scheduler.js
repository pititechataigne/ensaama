
 // version 20260927
// scheduler : orchestre les événements dans le temps.

(function () {

    AFRAME.registerComponent('scheduler', {
        schema: {
            config: {
                type: 'string',
                default: ''
            },
            duration: {
                type: 'number',
                default: 60000
            },
            loop: {
                type: 'boolean',
                default: false
            },
            autostart: {
                type: 'boolean',
                default: true
            }
        },

        init: function () {
            var self = this;

            this.playing = false;
            this.clock = 0;
            this.lastFrameTime = null;
            this.rafId = null;
            this.timeline = [];
            this.randomRules = [];

            // Événements de contrôle du scheduler.
            this.el.addEventListener('start', function () {
                self.start();
            });
            this.el.addEventListener('stop', function () {
                self.stop();
            });
            this.el.addEventListener('pause', function () {
                self.pause();
            });
            this.el.addEventListener('resume', function () {
                self.resume();
            });

            // Extinction des projections lorsque la contamination est terminée.
            this.onProjectionContaminationComplete = function () {
                self.fireEvent(
                    '#projections-aleatoires',
                    'projection-sequence-off'
                );
            };

            this.el.sceneEl.addEventListener(
                'projection-contamination-complete',
                this.onProjectionContaminationComplete
            );

            // Chargement de la configuration.
            this.loadConfig();

            // Démarrage automatique si demandé.
            if (this.data.autostart) {
                if (this.el.sceneEl.hasLoaded) {
                    this.start();
                } else {
                    this.el.sceneEl.addEventListener('loaded', function () {
                        self.start();
                    }, { once: true });
                }
            }
        },

        // Lit la configuration JSON.
        loadConfig: function () {
            var raw = this.data.config;

            if (!raw) {
                console.warn(
                    "scheduler : aucun attribut 'config' fourni sur '" +
                    this.el.id + "'"
                );
                return;
            }

            var text = raw;

            if (raw.charAt(0) === '#' || raw.charAt(0) === '.') {
                var configElement = document.querySelector(raw);

                if (!configElement) {
                    console.warn(
                        "scheduler : élément '" + raw +
                        "' introuvable pour la config"
                    );
                    return;
                }

                text = configElement.textContent;
            }

            var json;

            try {
                json = JSON.parse(text);
            } catch (err) {
                console.error(
                    "scheduler : JSON invalide dans la config de '" +
                    this.el.id + "'",
                    err
                );
                return;
            }

            var defaultTarget = json.target || null;

            this.timeline = (json.timeline || []).map(function (cue) {
                return {
                    time: cue.time,
                    target: cue.target || defaultTarget,
                    event: cue.event,
                    fired: false
                };
            }).sort(function (a, b) {
                return a.time - b.time;
            });

            this.randomRules = (json.random || []).map(function (rule) {
                return {
                    target: rule.target || defaultTarget,
                    events: rule.events || [],
                    interval: rule.interval || 1000,
                    jitter: typeof rule.jitter === 'number'
                        ? rule.jitter
                        : 0,
                    nextFire: 0
                };
            });

            var missingTarget =
                this.timeline.some(function (cue) {
                    return !cue.target;
                }) ||
                this.randomRules.some(function (rule) {
                    return !rule.target;
                });

            if (missingTarget) {
                console.warn(
                    "scheduler : au moins une cue/règle n'a pas de cible"
                );
            }
        },

        // Démarre ou redémarre le scénario.
        start: function () {
            var self = this;

            // Évite plusieurs boucles requestAnimationFrame simultanées.
            if (this.rafId !== null) {
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }

            this.clock = 0;

            this.timeline.forEach(function (cue) {
                cue.fired = false;
            });

            this.randomRules.forEach(function (rule) {
                rule.nextFire =
                    rule.interval * (0.3 + Math.random() * 0.7);
            });

            this.playing = true;
            this.lastFrameTime = performance.now();

            this.rafId = requestAnimationFrame(function (time) {
                self.tick(time);
            });

            console.log(
                "scheduler : démarrage sur '" + this.el.id +
                "' (durée " + this.data.duration + "ms)"
            );
        },

        // Arrête le scénario.
        stop: function () {
            this.playing = false;

            if (this.rafId !== null) {
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }

            this.el.emit('scheduler-ended');

            console.log(
                "scheduler : arrêt sur '" + this.el.id + "'"
            );
        },

        // Met le scénario en pause.
        pause: function () {
            if (!this.playing) return;

            this.playing = false;

            if (this.rafId !== null) {
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }
        },

        // Reprend le scénario.
        resume: function () {
            var self = this;

            if (this.playing) return;

            this.playing = true;
            this.lastFrameTime = performance.now();

            this.rafId = requestAnimationFrame(function (time) {
                self.tick(time);
            });
        },

        // Boucle principale de l'horloge.
        tick: function (now) {
            var self = this;

            if (!this.playing) return;

            var delta = now - this.lastFrameTime;
            this.lastFrameTime = now;
            this.clock += delta;

            // Événements programmés dans la timeline.
            this.timeline.forEach(function (cue) {
                if (!cue.fired && self.clock >= cue.time) {
                    cue.fired = true;
                    self.fireEvent(cue.target, cue.event);
                }
            });

            // Événements périodiques et aléatoires.
            this.randomRules.forEach(function (rule) {
                if (rule.events.length === 0) return;

                if (self.clock >= rule.nextFire) {
                    var pick = rule.events[
                        Math.floor(Math.random() * rule.events.length)
                    ];

                    self.fireEvent(rule.target, pick);

                    var jitterFactor =
                        1 + (Math.random() * 2 - 1) * rule.jitter;

                    rule.nextFire = self.clock +
                        Math.max(50, rule.interval * jitterFactor);
                }
            });

            // Fin du scénario.
            if (
                this.data.duration > 0 &&
                this.clock >= this.data.duration
            ) {
                if (this.data.loop) {
                    this.start();
                    return;
                }

                this.stop();
                return;
            }

            this.rafId = requestAnimationFrame(function (time) {
                self.tick(time);
            });
        },

        // Envoie un événement à une ou plusieurs cibles CSS.
        fireEvent: function (targetSelector, eventName) {
            if (!targetSelector || !eventName) return;

            var targets = document.querySelectorAll(targetSelector);

            if (targets.length === 0) {
                console.warn(
                    "scheduler : aucune cible trouvée pour '" +
                    targetSelector + "'"
                );
                return;
            }

            targets.forEach(function (el) {
                el.emit(eventName);
            });

            console.log(
                "scheduler [" + Math.round(this.clock) +
                "ms] : event '" + eventName +
                "' envoyé à '" + targetSelector + "'"
            );
        },

        // Nettoyage à la suppression du composant.
        remove: function () {
            this.playing = false;

            if (this.rafId !== null) {
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }

            if (this.onProjectionContaminationComplete && this.el.sceneEl) {
                this.el.sceneEl.removeEventListener(
                    'projection-contamination-complete',
                    this.onProjectionContaminationComplete
                );
            }
        }
    });

})();

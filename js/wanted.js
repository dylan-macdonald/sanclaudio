// San Claudio - Wanted System
// 5-star system, police/SWAT/military escalation, escape mechanics

export class WantedSystem {
    constructor(game) {
        this.game = game;
        this.level = 0;
        this.heat = 0; // Accumulates toward next star
        this.heatThresholds = [2, 4, 7, 10, 14];

        // Escape
        this.isEscaping = false;
        this.escapeTimer = 0;
        this.escapeTimes = [0, 15, 25, 40, 60, 90]; // seconds per star level
        this.wantedRadius = [0, 50, 80, 120, 170, 250];

        // Police units
        this.policeUnits = [];
        this.maxPolice = [0, 2, 4, 6, 8, 12];
        this.spawnTimer = 0;
        this.spawnInterval = 5;

        // Roadblocks
        this.roadblocks = [];
        this._roadblockTimer = 0;

        // Spike strips
        this.spikeStrips = [];
        this._spikeStripTimer = 0;
        this._maxSpikeStrips = 2;

        // Siren timer
        this._sirenTimer = 0;

        // Police helicopter
        this._policeHeli = null;
        this._heliSpotlight = null;

        // Police flasher state
        this._policeFlashTimer = 0;
        this._policeFlashState = false;

        // Cop dialogue
        this.copDialogue = [
            "Stop right there!", "Pull over NOW!", "You're under arrest!",
            "Suspect on foot!", "We need backup!", "Don't make this harder!",
            "Taser! Taser!",
            "Get on the ground!", "You picked the wrong day, pal!",
            "Dispatch, suspect heading east!", "I said FREEZE!",
            "Hands where I can see 'em!"
        ];
        this.highStarDialogue = [
            "SWAT is en route!", "All units respond!",
            "Lethal force authorized!", "Bring in the heavy units!",
            "This guy's insane!",
            "We've got a 10-99, officer down!", "Air support, move in!",
            "Suspect is heavily armed!", "We need the chopper NOW!",
            "This is out of control!"
        ];
        this.chaseDialogue = [
            "Suspect is fleeing on foot!", "Don't let him get away!",
            "Cut him off at the intersection!", "He's heading for the docks!",
            "I've got eyes on the suspect!", "Stay on him!",
            "He can't run forever!", "Requesting roadblock ahead!"
        ];
        this.spottedDialogue = [
            "There he is!", "Suspect spotted!", "I see him!",
            "Visual on the target!", "Got a visual, moving in!",
            "He's right there!", "Contact! Contact!",
            "Target acquired, closing in!"
        ];

        // Dialogue dedup tracking — last 3 spoken lines
        this._recentDialogue = [];

        // Pay N Spray locations
        this.payNSprayLocations = [
            { x: -50,  z: 75,   name: 'Downtown Pay N Spray' },
            { x: 200,  z: -150, name: 'Strip Pay N Spray' },
            { x: -180, z: 200,  name: 'Docks Pay N Spray' },
            { x: -220, z: -180, name: 'Hillside Pay N Spray' }
        ];
        this.payNSprayCost = [0, 200, 500, 1000, 2000, 5000]; // Cost per star level
        this.payNSprayMarkers = [];
        this.payNSprayCooldown = 0; // Prevent instant re-use
        this._sprayActive = false;
        this._sprayTimer = 0;

        // Wanted edge flash
        this._edgeFlashEl = null;

        // Bribe star pickups
        this._bribeStars = [];
        this._bribeStarPositions = [
            { x: 80, z: 20 },      // Downtown alley
            { x: -120, z: -120 },   // Hillside road
            { x: 200, z: 160 },     // Industrial
            { x: -200, z: 180 },    // Docks backstreet
            { x: 150, z: -180 },    // Strip side road
        ];

        // Escape zones (hide to lose wanted faster)
        this._escapeZones = [];
        this._escapeZonePositions = [
            { x: -215, z: 225, name: 'Garage' },     // Near player garage
            { x: 30, z: -80, name: 'Alley' },        // Downtown alley
            { x: -150, z: 150, name: 'Warehouse' },   // Docks warehouse
        ];
        this._inEscapeZone = false;
        this._escapeZoneTimer = 0;
    }

    init() {
        this.createPayNSprayMarkers();
        this._createEdgeFlash();
        this._createBribeStars();
        this._createEscapeZones();
    }

    createPayNSprayMarkers() {
        for (const loc of this.payNSprayLocations) {
            const group = new THREE.Group();

            // Building shell — small garage
            const wallMat = new THREE.MeshStandardMaterial({ color: 0xccccbb, roughness: 0.9 });
            const roofMat = new THREE.MeshStandardMaterial({ color: 0x884422, roughness: 0.8 });

            // Back wall
            const backWall = new THREE.Mesh(
                new THREE.BoxGeometry(8, 4, 0.3), wallMat
            );
            backWall.position.set(0, 2, -3);
            backWall.castShadow = true;
            group.add(backWall);

            // Side walls
            for (const side of [-1, 1]) {
                const sideWall = new THREE.Mesh(
                    new THREE.BoxGeometry(0.3, 4, 6), wallMat
                );
                sideWall.position.set(side * 4, 2, 0);
                sideWall.castShadow = true;
                group.add(sideWall);
            }

            // Roof
            const roof = new THREE.Mesh(
                new THREE.BoxGeometry(8.6, 0.3, 6.6), roofMat
            );
            roof.position.set(0, 4, 0);
            roof.castShadow = true;
            group.add(roof);

            // Spray icon — floating rotating spray can marker
            const markerGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 8);
            const markerMat = new THREE.MeshStandardMaterial({
                color: 0x00ff88,
                emissive: 0x00ff88,
                emissiveIntensity: 0.5
            });
            const marker = new THREE.Mesh(markerGeo, markerMat);
            marker.position.set(0, 5.5, 2);
            group.add(marker);

            // Sign text using canvas
            const signCanvas = document.createElement('canvas');
            signCanvas.width = 256;
            signCanvas.height = 64;
            const sCtx = signCanvas.getContext('2d');
            sCtx.fillStyle = '#222222';
            sCtx.fillRect(0, 0, 256, 64);
            sCtx.fillStyle = '#00ff88';
            sCtx.font = 'bold 28px Arial';
            sCtx.textAlign = 'center';
            sCtx.fillText('PAY N SPRAY', 128, 42);
            const signTex = new THREE.CanvasTexture(signCanvas);
            const signGeo = new THREE.PlaneGeometry(4, 1);
            const signMesh = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ map: signTex }));
            signMesh.position.set(0, 4.8, 3.01);
            group.add(signMesh);

            group.position.set(loc.x, 0, loc.z);
            this.game.scene.add(group);

            this.payNSprayMarkers.push({ group, marker, loc });

            // Add collider for the structure
            const world = this.game.systems.world;
            if (world && world.colliders) {
                // Back wall collider
                world.colliders.push({
                    minX: loc.x - 4, maxX: loc.x + 4,
                    minZ: loc.z - 3.15, maxZ: loc.z - 2.85,
                    height: 4, type: 'building'
                });
                // Side wall colliders
                world.colliders.push({
                    minX: loc.x - 4.15, maxX: loc.x - 3.85,
                    minZ: loc.z - 3, maxZ: loc.z + 3,
                    height: 4, type: 'building'
                });
                world.colliders.push({
                    minX: loc.x + 3.85, maxX: loc.x + 4.15,
                    minZ: loc.z - 3, maxZ: loc.z + 3,
                    height: 4, type: 'building'
                });
            }
        }
    }

    _createEdgeFlash() {
        // Red vignette overlay that pulses when wanted
        let el = document.getElementById('wanted-edge-flash');
        if (!el) {
            el = document.createElement('div');
            el.id = 'wanted-edge-flash';
            el.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                pointer-events: none; z-index: 90;
                background: radial-gradient(ellipse at center, transparent 50%, rgba(255,0,0,0) 100%);
                opacity: 0; transition: opacity 0.1s;
            `;
            document.body.appendChild(el);
        }
        this._edgeFlashEl = el;
    }

    update(dt) {
        // Pay N Spray cooldown and spray animation tick even when not wanted
        this.payNSprayCooldown = Math.max(0, this.payNSprayCooldown - dt);
        this._updatePayNSpray(dt);
        this._animatePayNSprayMarkers(dt);
        this._updateEdgeFlash(dt);
        this._updateBribeStars(dt);
        this._updateEscapeZones(dt);

        if (this.level <= 0) return;

        const player = this.game.systems.player;

        // Check if player is outside wanted radius
        let outsideRadius = true;
        for (const unit of this.policeUnits) {
            if (!unit.mesh) continue;
            const dist = unit.mesh.position.distanceTo(player.position);
            if (dist < this.wantedRadius[this.level]) {
                outsideRadius = false;
                break;
            }
        }

        if (outsideRadius && this.policeUnits.length > 0) {
            if (!this.isEscaping) {
                this.isEscaping = true;
                this.escapeTimer = this.escapeTimes[this.level];
            }

            this.escapeTimer -= dt;

            // Show escape timer
            const timerEl = document.getElementById('hud-escape-timer');
            if (timerEl) {
                timerEl.style.display = 'block';
                timerEl.textContent = `Escaping: ${Math.ceil(this.escapeTimer)}s`;
            }

            if (this.escapeTimer <= 0) {
                this.clearWanted();
            }
        } else {
            this.isEscaping = false;
            const timerEl = document.getElementById('hud-escape-timer');
            if (timerEl) timerEl.style.display = 'none';
        }

        // Spawn police
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.policeUnits.length < this.maxPolice[this.level]) {
            this.spawnPoliceUnit();
            this.spawnTimer = this.spawnInterval;
        }

        // Update police AI
        for (const unit of this.policeUnits) {
            this.updatePoliceUnit(unit, dt);
        }

        // Update police vehicle lightbar flashers (red/blue alternating)
        this._updatePoliceLightbars(dt);

        // Police carjack at 3+ stars — officers pull player from vehicle
        if (this.level >= 3 && player.inVehicle && player.currentVehicle) {
            for (const unit of this.policeUnits) {
                if (!unit.alive || !unit.mesh) continue;
                const policeNearDistance = unit.mesh.position.distanceTo(player.position);
                if (policeNearDistance < 3) {
                    // Force player exit from vehicle
                    player.exitVehicle();
                    this.game.systems.ui.showMissionText('BUSTED!', 2);
                    break; // Only one officer needs to do this per frame
                }
            }
        }

        // Periodic siren sounds from nearby police
        this._sirenTimer -= dt;
        if (this._sirenTimer <= 0) {
            this._sirenTimer = 3 + Math.random() * 4;
            const nearbyUnit = this.policeUnits.find(u => u.alive && u.mesh &&
                u.mesh.position.distanceTo(player.position) < 60);
            if (nearbyUnit) {
                this.game.systems.audio.playSiren();
            }
        }

        // Spike strips at 2+ stars
        if (this.level >= 2) {
            this._spikeStripTimer -= dt;
            if (this._spikeStripTimer <= 0 && this.spikeStrips.length < this._maxSpikeStrips) {
                this._spikeStripTimer = 8 + Math.random() * 6;
                this._spawnSpikeStrip();
            }
        }

        // Update spike strips
        this._updateSpikeStrips(dt);

        // Roadblocks at 3+ stars
        if (this.level >= 3) {
            this._roadblockTimer -= dt;
            if (this._roadblockTimer <= 0 && this.roadblocks.length < this.level - 1) {
                this._roadblockTimer = 15 + Math.random() * 10;
                this._spawnRoadblock();
            }
        }

        // Update roadblocks
        this._updateRoadblocks(dt);

        // Police helicopter at 3+ stars
        if (this.level >= 3) {
            this._updatePoliceHelicopter(dt);
        } else if (this._policeHeli) {
            this._removePoliceHelicopter();
        }

        // Weather: fog reduces detection
        if (this.game.currentWeather === 'fog') {
            // Effectively larger radius for escape (easier to hide)
        }
    }

    _updatePayNSpray(dt) {
        // Handle spray animation
        if (this._sprayActive) {
            this._sprayTimer -= dt;
            const player = this.game.systems.player;
            const vehicle = player.inVehicle ? player.currentVehicle : null;

            if (vehicle) {
                // Slowly rotate vehicle during spray
                vehicle.mesh.rotation.y += dt * 0.8;

                // Water spray particles during first 1.0 seconds
                if (this._sprayTimer > 0.5) {
                    this._spawnSprayParticles(vehicle.mesh.position);
                }

                // Camera zoom in during spray
                const cam = this.game.systems.camera;
                if (cam && cam.camera) {
                    const targetFov = 45;
                    cam.camera.fov += (targetFov - cam.camera.fov) * dt * 3;
                    cam.camera.updateProjectionMatrix();
                }

                // Pulse emissive during spray
                const t = this._sprayTimer / 1.5;
                vehicle.mesh.traverse(child => {
                    if (child.isMesh && child.material && child.material.emissive) {
                        child.material.emissiveIntensity = 0.3 + Math.sin(t * 10) * 0.2;
                    }
                });
            }

            if (this._sprayTimer <= 0) {
                this._sprayActive = false;
                // Restore camera FOV
                const cam = this.game.systems.camera;
                if (cam && cam.camera) {
                    cam.camera.fov = 65;
                    cam.camera.updateProjectionMatrix();
                }
                // Apply random new color (re-check vehicle in case player exited during spray)
                const currentVehicle = player.inVehicle ? player.currentVehicle : vehicle;
                if (currentVehicle && currentVehicle.mesh) {
                    const colors = [0xcc3333, 0x3333cc, 0x33cc33, 0xcccc33, 0xeeeeee, 0xff8800, 0x8800ff, 0x00cccc];
                    const newColor = colors[Math.floor(Math.random() * colors.length)];
                    currentVehicle.mesh.traverse(child => {
                        if (child.isMesh && child.material && !child.name?.startsWith('wheel')) {
                            child.material = child.material.clone();
                            child.material.color.setHex(newColor);
                            if (child.material.emissive) {
                                child.material.emissive.setHex(0x000000);
                                child.material.emissiveIntensity = 0;
                            }
                        }
                    });
                }
                // Cleanup spray particles
                this._cleanupSprayParticles();
            }
            return;
        }

        const player = this.game.systems.player;
        const input = this.game.systems.input;
        if (!player.inVehicle || this.level <= 0 || this.payNSprayCooldown > 0) return;

        const vPos = player.currentVehicle.mesh.position;

        for (const pns of this.payNSprayLocations) {
            const dx = vPos.x - pns.x;
            const dz = vPos.z - pns.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 8) {
                const cost = this.payNSprayCost[this.level];
                const promptEl = document.getElementById('hud-interact-prompt');
                if (!promptEl) continue;
                if (player.cash >= cost) {
                    promptEl.textContent = `Press E — Pay N Spray ($${cost}) — Clear ${this.level}★ wanted`;
                    promptEl.classList.add('visible');

                    if (input.justPressed('interact')) {
                        // Pay and clear
                        player.cash -= cost;
                        this.clearWanted();

                        // Repair vehicle
                        const vehicle = player.currentVehicle;
                        vehicle.health = vehicle.maxHealth;

                        // Spray animation — briefly flash vehicle white
                        this._sprayActive = true;
                        this._sprayTimer = 1.5;
                        vehicle.mesh.traverse(child => {
                            if (child.isMesh && child.material && !child.name?.startsWith('wheel')) {
                                child.material = child.material.clone();
                                child.material.color.setHex(0xffffff);
                                child.material.emissive = new THREE.Color(0xffffff);
                                child.material.emissiveIntensity = 0.5;
                            }
                        });

                        // Stop vehicle during spray
                        vehicle.speed = 0;

                        this.payNSprayCooldown = 10;
                        this.game.systems.audio.playPickup();
                        this.game.systems.ui.showMissionText(
                            `${pns.name}\nWanted level cleared! Vehicle repaired.`, 3
                        );
                    }
                } else {
                    promptEl.textContent = `Pay N Spray — Need $${cost} (have $${Math.floor(player.cash)})`;
                    promptEl.classList.add('visible');
                }
                return; // Only check closest
            }
        }
    }

    _animatePayNSprayMarkers(dt) {
        const time = Date.now() * 0.001;
        for (const pns of this.payNSprayMarkers) {
            // Rotate and bob the spray can marker
            pns.marker.rotation.y = time * 2;
            pns.marker.position.y = 5.5 + Math.sin(time * 3) * 0.3;

            // Pulse emissive when player has wanted level
            if (this.level > 0) {
                const pulse = 0.5 + Math.sin(time * 4) * 0.3;
                pns.marker.material.emissiveIntensity = pulse;
            } else {
                pns.marker.material.emissiveIntensity = 0.2;
            }
        }
    }

    _updateEdgeFlash(dt) {
        if (!this._edgeFlashEl) return;

        if (this.level > 0) {
            // Pulsing red edge flash, intensity increases with star level
            const intensity = Math.min(0.6, this.level * 0.1);
            const pulse = 0.5 + Math.sin(Date.now() * 0.004 * this.level) * 0.5;
            const alpha = intensity * pulse;
            this._edgeFlashEl.style.background = `radial-gradient(ellipse at center, transparent 40%, rgba(255,0,0,${alpha * 0.8}) 100%)`;
            this._edgeFlashEl.style.opacity = '1';
        } else {
            this._edgeFlashEl.style.opacity = '0';
        }
    }

    addHeat(amount) {
        if (this.game.systems.player.isDead) return;

        this.heat += amount;

        // Check if we should increase star level
        while (this.level < 5 && this.heat >= this.heatThresholds[this.level]) {
            this.level++;
            this.isEscaping = false;

            // Track stats
            if (this.level > this.game.stats.maxWantedSurvived) {
                this.game.stats.maxWantedSurvived = this.level;
            }
        }

        // Update HUD
        this.updateStarDisplay();
    }

    setLevel(level) {
        this.level = Math.max(0, Math.min(5, level));
        this.heat = level > 0 ? this.heatThresholds[level - 1] : 0;
        this.updateStarDisplay();

        if (level === 0) {
            this.clearWanted();
        }
    }

    clearWanted() {
        this.level = 0;
        this.heat = 0;
        this.isEscaping = false;

        // Despawn all police
        for (const unit of this.policeUnits) {
            if (unit.mesh) {
                this.game.scene.remove(unit.mesh);
            }
            if (unit.vehicle && unit.vehicle.mesh) {
                this.game.scene.remove(unit.vehicle.mesh);
            }
        }
        this.policeUnits = [];

        // Remove police helicopter
        this._removePoliceHelicopter();

        // Remove spike strips
        for (const ss of this.spikeStrips) {
            if (ss.mesh) {
                this.game.scene.remove(ss.mesh);
                ss.mesh.traverse(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
            }
        }
        this.spikeStrips = [];

        // Remove roadblocks
        for (const rb of this.roadblocks) {
            if (rb.strip) {
                this.game.scene.remove(rb.strip);
                rb.strip.geometry.dispose();
                rb.strip.material.dispose();
            }
            for (const car of rb.cars) {
                if (car.mesh) {
                    this.game.scene.remove(car.mesh);
                }
            }
        }
        this.roadblocks = [];

        this.updateStarDisplay();
        document.getElementById('hud-escape-timer').style.display = 'none';
    }

    updateStarDisplay() {
        const stars = document.querySelectorAll('#hud-wanted .star');
        const container = document.getElementById('hud-wanted');

        stars.forEach((star, i) => {
            if (i < this.level) {
                star.textContent = '\u2605';
                star.classList.add('active');
            } else {
                star.textContent = '\u2606';
                star.classList.remove('active');
            }
        });

        if (this.level > 0) {
            container.classList.add('flashing');
        } else {
            container.classList.remove('flashing');
        }
    }

    _updatePoliceHelicopter(dt) {
        const player = this.game.systems.player;

        if (!this._policeHeli) {
            this._spawnPoliceHelicopter();
        }

        if (!this._policeHeli) return;

        // Follow player from above
        const targetX = player.position.x + Math.sin(Date.now() * 0.0003) * 15;
        const targetZ = player.position.z + Math.cos(Date.now() * 0.0003) * 15;
        const targetY = 40 + Math.sin(Date.now() * 0.001) * 3;

        this._policeHeli.position.x += (targetX - this._policeHeli.position.x) * dt * 1.5;
        this._policeHeli.position.z += (targetZ - this._policeHeli.position.z) * dt * 1.5;
        this._policeHeli.position.y += (targetY - this._policeHeli.position.y) * dt * 2;

        // Rotate helicopter toward movement direction
        const dx = targetX - this._policeHeli.position.x;
        const dz = targetZ - this._policeHeli.position.z;
        if (Math.abs(dx) > 0.1 || Math.abs(dz) > 0.1) {
            this._policeHeli.rotation.y = Math.atan2(dx, dz);
        }

        // Slight tilt forward
        this._policeHeli.rotation.x = -0.1;

        // Spotlight cone tracks player
        if (this._heliSpotlight) {
            this._heliSpotlight.target.position.set(
                player.position.x,
                0,
                player.position.z
            );
        }

        // Update spotlight cone mesh
        if (this._spotlightCone) {
            this._spotlightCone.position.copy(this._policeHeli.position);
            this._spotlightCone.position.y -= 1;
            this._spotlightCone.lookAt(player.position.x, 0, player.position.z);
            this._spotlightCone.rotateX(Math.PI / 2);

            // Ground circle follows player
            if (this._spotlightGround) {
                this._spotlightGround.position.set(player.position.x, 0.1, player.position.z);
            }
        }

        // Rotor spin animation
        if (this._policeHeli.userData.rotor) {
            this._policeHeli.userData.rotor.rotation.y += dt * 25;
        }
    }

    _spawnPoliceHelicopter() {
        const player = this.game.systems.player;
        const group = new THREE.Group();

        // Fuselage
        const bodyGeo = new THREE.CylinderGeometry(0.8, 1.0, 4, 8);
        const heliTexture = this.game.systems.vehicles._generateVehicleTexture('helicopter', 0x222244);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222244, roughness: 0.4, metalness: 0.6, map: heliTexture });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.x = Math.PI / 2;
        group.add(body);

        // Cockpit
        const cockpitGeo = new THREE.SphereGeometry(0.9, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
        const cockpitMat = new THREE.MeshStandardMaterial({ color: 0x445588, roughness: 0.2, metalness: 0.5 });
        const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
        cockpit.position.set(0, 0.3, 2);
        cockpit.rotation.x = Math.PI / 2;
        group.add(cockpit);

        // Tail boom
        const tailGeo = new THREE.CylinderGeometry(0.3, 0.15, 3, 6);
        const tail = new THREE.Mesh(tailGeo, bodyMat);
        tail.rotation.x = Math.PI / 2;
        tail.position.set(0, 0.3, -3.5);
        group.add(tail);

        // Main rotor
        const rotorGeo = new THREE.BoxGeometry(8, 0.05, 0.3);
        const rotorMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8 });
        const rotor = new THREE.Mesh(rotorGeo, rotorMat);
        rotor.position.y = 1.2;
        group.add(rotor);
        group.userData.rotor = rotor;

        // Police markings - flashing lights
        const lightGeo = new THREE.SphereGeometry(0.15, 4, 4);
        const redLight = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        redLight.position.set(-0.9, 0, 1);
        group.add(redLight);

        const blueLight = new THREE.Mesh(lightGeo.clone(), new THREE.MeshBasicMaterial({ color: 0x0044ff }));
        blueLight.position.set(0.9, 0, 1);
        group.add(blueLight);

        group.userData.redLight = redLight;
        group.userData.blueLight = blueLight;

        // Position above player
        group.position.set(
            player.position.x + 30,
            45,
            player.position.z + 30
        );

        this.game.scene.add(group);
        this._policeHeli = group;

        // Spotlight (Three.js SpotLight)
        const spotlight = new THREE.SpotLight(0xffffcc, 2, 80, Math.PI / 8, 0.5, 1);
        spotlight.position.set(0, -1, 0);
        group.add(spotlight);
        spotlight.target.position.set(player.position.x, 0, player.position.z);
        this.game.scene.add(spotlight.target);
        this._heliSpotlight = spotlight;

        // Visible spotlight cone
        const coneHeight = 40;
        const coneRadius = coneHeight * Math.tan(Math.PI / 8);
        const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 16, 1, true);
        const coneMat = new THREE.MeshBasicMaterial({
            color: 0xffffaa,
            transparent: true,
            opacity: 0.06,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        this.game.scene.add(cone);
        this._spotlightCone = cone;

        // Ground circle
        const groundGeo = new THREE.RingGeometry(3, 5, 24);
        const groundMat = new THREE.MeshBasicMaterial({
            color: 0xffffaa,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(player.position.x, 0.1, player.position.z);
        this.game.scene.add(ground);
        this._spotlightGround = ground;

        // Flashing light animation
        this._heliFlashInterval = setInterval(() => {
            if (!this._policeHeli) return;
            const t = Date.now() % 1000;
            if (group.userData.redLight) group.userData.redLight.visible = t < 500;
            if (group.userData.blueLight) group.userData.blueLight.visible = t >= 500;
        }, 100);
    }

    _removePoliceHelicopter() {
        if (this._policeHeli) {
            this.game.scene.remove(this._policeHeli);
            this._policeHeli = null;
        }
        if (this._heliSpotlight) {
            if (this._heliSpotlight.target) {
                this.game.scene.remove(this._heliSpotlight.target);
            }
            this._heliSpotlight = null;
        }
        if (this._spotlightCone) {
            this.game.scene.remove(this._spotlightCone);
            this._spotlightCone.geometry.dispose();
            this._spotlightCone.material.dispose();
            this._spotlightCone = null;
        }
        if (this._spotlightGround) {
            this.game.scene.remove(this._spotlightGround);
            this._spotlightGround.geometry.dispose();
            this._spotlightGround.material.dispose();
            this._spotlightGround = null;
        }
        if (this._heliFlashInterval) {
            clearInterval(this._heliFlashInterval);
            this._heliFlashInterval = null;
        }
    }

    spawnPoliceUnit() {
        const player = this.game.systems.player;
        const angle = Math.random() * Math.PI * 2;
        const dist = 40 + Math.random() * 30;

        const x = player.position.x + Math.cos(angle) * dist;
        const z = player.position.z + Math.sin(angle) * dist;

        let unitType = 'cop';
        let health = 50;
        let color = 0x2244aa;

        if (this.level >= 4) {
            if (Math.random() > 0.5) {
                unitType = 'swat';
                health = 100;
                color = 0x222222;
            }
        }
        if (this.level >= 5 && Math.random() > 0.6) {
            unitType = 'military';
            health = 100;
            color = 0x445533;
        }

        // Create cop model
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 });
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.7 });

        // Head
        const headGeo = new THREE.SphereGeometry(0.16, 6, 6);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.y = 1.7;
        group.add(head);

        // Torso
        const torsoGeo = new THREE.CylinderGeometry(0.25, 0.28, 0.6, 7);
        const torso = new THREE.Mesh(torsoGeo, mat);
        torso.position.y = 1.1;
        group.add(torso);

        // Arms
        for (const side of [-1, 1]) {
            const armGeo = new THREE.CylinderGeometry(0.05, 0.045, 0.55, 5);
            const arm = new THREE.Mesh(armGeo, mat);
            arm.position.set(side * 0.33, 1.15, 0);
            group.add(arm);
        }

        // Legs
        for (const side of [-1, 1]) {
            const legGeo = new THREE.CylinderGeometry(0.065, 0.055, 0.7, 5);
            const leg = new THREE.Mesh(legGeo, new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.8 }));
            leg.position.set(side * 0.1, 0.4, 0);
            group.add(leg);
        }

        group.position.set(x, 0, z);
        this.game.scene.add(group);

        const unit = {
            mesh: group,
            type: unitType,
            health: health,
            alive: true,
            hasGun: this.level >= 3,
            shootTimer: 2 + Math.random() * 3,
            dialogueTimer: 3 + Math.random() * 5,
            animTime: 0,
            vehicle: null
        };

        // At 2+ stars, some arrive in police cars
        if (this.level >= 2 && Math.random() > 0.4) {
            const models = this.game.systems.models;
            const usePoliceModel = models && models.hasModel('police');
            const car = this.game.systems.vehicles.spawnVehicle(x + 3, z + 3, 'sedan');
            if (car) {
                if (usePoliceModel) {
                    // Replace mesh with police .glb model
                    this.game.scene.remove(car.mesh);
                    car.mesh = models.cloneVehicle('police');
                    car.mesh.position.set(x + 3, 0, z + 3);
                    // Apply police texture
                    const policeTexture = this.game.systems.vehicles._generateVehicleTexture('police', 0xffffff);
                    car.mesh.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                        }
                    });
                    // Apply police texture to body meshes
                    car.mesh.traverse((child) => {
                        if (child.isMesh) {
                            if (child.name && child.name.startsWith('wheel')) return;
                            if (child.material.transparent) return;
                            if (child.material.metalness > 0.8) return;
                            child.material = child.material.clone();
                            child.material.map = policeTexture;
                            child.material.roughness = Math.max(0.3, Math.min(0.5, child.material.roughness));
                            child.material.metalness = Math.max(0.5, Math.min(0.6, child.material.metalness));
                            child.material.needsUpdate = true;
                        }
                    });
                    // Collect wheel references
                    const wheels = [];
                    car.mesh.traverse((child) => {
                        if (child.name && child.name.startsWith('wheel')) wheels.push(child);
                    });
                    car.mesh.userData.wheels = wheels;
                    car.mesh.userData.useGLB = true;
                    this.game.scene.add(car.mesh);
                } else {
                    // Fallback: recolor sedan to look like police car
                    const policeTexture = this.game.systems.vehicles._generateVehicleTexture('police', 0xffffff);
                    car.mesh.traverse((child) => {
                        if (child.isMesh && child.material) {
                            child.material = new THREE.MeshStandardMaterial({
                                color: 0xffffff,
                                roughness: 0.4,
                                metalness: 0.6,
                                map: policeTexture
                            });
                        }
                    });
                }
                // Add split red/blue lightbar to police vehicle
                this._addPoliceLightbar(car);
                unit.vehicle = car;
            }
        }

        this.policeUnits.push(unit);
    }

    _addPoliceLightbar(car) {
        const vType = this.game.systems.vehicles.vehicleTypes[car.type] ||
                      this.game.systems.vehicles.vehicleTypes['sedan'];
        const barY = vType ? vType.height + 0.1 : 1.6;

        // Left half — red
        const leftGeo = new THREE.BoxGeometry(0.4, 0.15, 0.3);
        const leftMat = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 1.0,
            transparent: true,
            opacity: 0.9
        });
        const leftLight = new THREE.Mesh(leftGeo, leftMat);
        leftLight.position.set(-0.22, barY, 0);
        car.mesh.add(leftLight);

        // Right half — blue
        const rightGeo = new THREE.BoxGeometry(0.4, 0.15, 0.3);
        const rightMat = new THREE.MeshStandardMaterial({
            color: 0x0044ff,
            emissive: 0x0044ff,
            emissiveIntensity: 1.0,
            transparent: true,
            opacity: 0.9
        });
        const rightLight = new THREE.Mesh(rightGeo, rightMat);
        rightLight.position.set(0.22, barY, 0);
        car.mesh.add(rightLight);

        // Store references for flash toggling
        car._lightbarLeft = leftLight;
        car._lightbarRight = rightLight;
    }

    _updatePoliceLightbars(dt) {
        this._policeFlashTimer = (this._policeFlashTimer || 0) + dt;
        if (this._policeFlashTimer > 0.25) {
            this._policeFlashTimer = 0;
            this._policeFlashState = !this._policeFlashState;
        }

        for (const unit of this.policeUnits) {
            if (!unit.vehicle) continue;
            const car = unit.vehicle;
            if (!car._lightbarLeft || !car._lightbarRight) continue;

            if (this._policeFlashState) {
                // Left = red bright, right = blue dim
                car._lightbarLeft.material.emissive.setHex(0xff0000);
                car._lightbarLeft.material.emissiveIntensity = 1.0;
                car._lightbarLeft.material.opacity = 0.9;
                car._lightbarRight.material.emissive.setHex(0x0044ff);
                car._lightbarRight.material.emissiveIntensity = 0.1;
                car._lightbarRight.material.opacity = 0.3;
            } else {
                // Left = red dim, right = blue bright
                car._lightbarLeft.material.emissive.setHex(0xff0000);
                car._lightbarLeft.material.emissiveIntensity = 0.1;
                car._lightbarLeft.material.opacity = 0.3;
                car._lightbarRight.material.emissive.setHex(0x0044ff);
                car._lightbarRight.material.emissiveIntensity = 1.0;
                car._lightbarRight.material.opacity = 0.9;
            }
        }

        // Also update roadblock car lightbars
        for (const rb of this.roadblocks) {
            for (const car of rb.cars) {
                if (!car._lightbarLeft || !car._lightbarRight) continue;

                if (this._policeFlashState) {
                    car._lightbarLeft.material.emissive.setHex(0xff0000);
                    car._lightbarLeft.material.emissiveIntensity = 1.0;
                    car._lightbarLeft.material.opacity = 0.9;
                    car._lightbarRight.material.emissive.setHex(0x0044ff);
                    car._lightbarRight.material.emissiveIntensity = 0.1;
                    car._lightbarRight.material.opacity = 0.3;
                } else {
                    car._lightbarLeft.material.emissive.setHex(0xff0000);
                    car._lightbarLeft.material.emissiveIntensity = 0.1;
                    car._lightbarLeft.material.opacity = 0.3;
                    car._lightbarRight.material.emissive.setHex(0x0044ff);
                    car._lightbarRight.material.emissiveIntensity = 1.0;
                    car._lightbarRight.material.opacity = 0.9;
                }
            }
        }
    }

    _pickDialogueLine(lines) {
        // Filter out recently spoken lines to avoid repetition
        const available = lines.filter(l => !this._recentDialogue.includes(l));
        const pool = available.length > 0 ? available : lines;
        const line = pool[Math.floor(Math.random() * pool.length)];

        // Track the line and trim to last 3
        this._recentDialogue.push(line);
        if (this._recentDialogue.length > 3) {
            this._recentDialogue.shift();
        }

        return line;
    }

    updatePoliceUnit(unit, dt) {
        if (!unit.alive || !unit.mesh) return;

        const player = this.game.systems.player;
        const toPlayer = new THREE.Vector3().subVectors(player.position, unit.mesh.position);
        const dist = toPlayer.length();

        // Chase player
        if (dist > 3) {
            toPlayer.normalize();
            const speed = this.level >= 3 ? 6 : 4;
            const newX = unit.mesh.position.x + toPlayer.x * speed * dt;
            const newZ = unit.mesh.position.z + toPlayer.z * speed * dt;

            const collision = this.game.systems.world.checkCollision(newX, newZ, 0.4);
            if (!collision) {
                unit.mesh.position.x = newX;
                unit.mesh.position.z = newZ;
            }

            unit.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
        }

        // Walk animation
        unit.animTime += dt * 6;
        const children = unit.mesh.children;
        if (children.length >= 6) {
            const swing = Math.sin(unit.animTime) * 0.3;
            children[2].rotation.x = swing;
            children[3].rotation.x = -swing;
            children[4].rotation.x = -swing;
            children[5].rotation.x = swing;
        }

        // Melee attack when close
        if (dist < 2.5 && !unit.hasGun) {
            unit.shootTimer -= dt;
            if (unit.shootTimer <= 0) {
                player.takeDamage(10);
                unit.shootTimer = 1.0;
            }
        }

        // Ranged attack
        if (unit.hasGun && dist < 40 && dist > 5) {
            unit.shootTimer -= dt;
            if (unit.shootTimer <= 0) {
                // Shoot at player
                const hitChance = 0.3;
                if (Math.random() < hitChance) {
                    const damage = unit.type === 'swat' ? 15 : (unit.type === 'military' ? 20 : 10);
                    player.takeDamage(damage);
                }
                this.game.systems.audio.playGunshot('pistol');
                unit.shootTimer = 1.5 + Math.random();
            }
        }

        // Dialogue
        unit.dialogueTimer -= dt;
        if (unit.dialogueTimer <= 0 && dist < 30) {
            // Pick dialogue pool based on context
            let lines;
            if (this.level >= 4) {
                lines = this.highStarDialogue;
            } else if (dist > 15) {
                // Far away — use spotted/chase lines
                lines = Math.random() > 0.5 ? this.chaseDialogue : this.spottedDialogue;
            } else {
                lines = this.copDialogue;
            }
            const line = this._pickDialogueLine(lines);

            // Show subtitle
            this.game.systems.npcs.showNPCSubtitle({ mesh: unit.mesh, alive: true }, line);
            this.game.systems.audio.playAnimalese(line, 160, 'authoritative');

            unit.dialogueTimer = 4 + Math.random() * 6;
        }

        // Police vehicle chase — drive toward player
        if (unit.vehicle && unit.vehicle.mesh && dist > 10) {
            const carToPlayer = new THREE.Vector3().subVectors(player.position, unit.vehicle.mesh.position);
            const carDist = carToPlayer.length();
            if (carDist > 8) {
                carToPlayer.normalize();
                const carSpeed = 12 + this.level * 3;
                unit.vehicle.mesh.position.x += carToPlayer.x * carSpeed * dt;
                unit.vehicle.mesh.position.z += carToPlayer.z * carSpeed * dt;
                unit.vehicle.mesh.rotation.y = Math.atan2(carToPlayer.x, carToPlayer.z);
                // Cop follows car
                unit.mesh.position.set(
                    unit.vehicle.mesh.position.x,
                    0,
                    unit.vehicle.mesh.position.z
                );
                unit.mesh.visible = false; // Hide cop, they're "inside" the car
            } else {
                // Close enough — cop exits vehicle and chases on foot
                unit.mesh.visible = true;
                unit.vehicle = null;
            }
        }
    }

    _spawnSpikeStrip() {
        const player = this.game.systems.player;
        const world = this.game.systems.world;
        if (!world) return;

        // Only deploy if player is in a vehicle and moving
        if (!player.inVehicle || !player.currentVehicle) return;

        // Place spike strip 40-60 units ahead of the player's direction of travel
        const playerDir = this.game.systems.camera
            ? this.game.systems.camera.getForwardDirection()
            : new THREE.Vector3(0, 0, 1);

        const stripDist = 40 + Math.random() * 20;
        let stripX = player.position.x + playerDir.x * stripDist;
        let stripZ = player.position.z + playerDir.z * stripDist;

        // Snap to nearest road
        const bs = world.blockSize;
        const rw = world.roadWidth;
        const nearestRoadX = Math.round(stripX / bs) * bs;
        const nearestRoadZ = Math.round(stripZ / bs) * bs;
        const distToXRoad = Math.abs(stripX - nearestRoadX);
        const distToZRoad = Math.abs(stripZ - nearestRoadZ);

        let stripRotation = 0;
        if (distToXRoad < distToZRoad) {
            // On a vertical road (running N-S), strip goes across it (E-W)
            stripX = nearestRoadX;
            stripRotation = Math.PI / 2;
        } else {
            // On a horizontal road (running E-W), strip goes across it (N-S)
            stripZ = nearestRoadZ;
            stripRotation = 0;
        }

        // Build spike strip mesh group
        const group = new THREE.Group();

        // Flat base strip (dark rubber mat)
        const baseGeo = new THREE.BoxGeometry(rw, 0.04, 0.6);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.02;
        group.add(base);

        // Small spike triangles along the strip
        const spikeMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.8 });
        const spikeCount = 18;
        for (let i = 0; i < spikeCount; i++) {
            const spikeGeo = new THREE.ConeGeometry(0.08, 0.18, 4);
            const spike = new THREE.Mesh(spikeGeo, spikeMat);
            const xOff = ((i / (spikeCount - 1)) - 0.5) * (rw - 0.5);
            spike.position.set(xOff, 0.13, 0);
            group.add(spike);
        }

        // Yellow caution stripes on edges
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0xccaa00, roughness: 0.6 });
        for (const side of [-1, 1]) {
            const stripeGeo = new THREE.BoxGeometry(rw, 0.05, 0.08);
            const stripe = new THREE.Mesh(stripeGeo, stripeMat);
            stripe.position.set(0, 0.025, side * 0.28);
            group.add(stripe);
        }

        group.position.set(stripX, 0, stripZ);
        group.rotation.y = stripRotation;
        this.game.scene.add(group);

        this.spikeStrips.push({
            mesh: group,
            position: new THREE.Vector3(stripX, 0, stripZ),
            rotation: stripRotation,
            triggered: false
        });
    }

    _updateSpikeStrips(dt) {
        const player = this.game.systems.player;

        for (let i = this.spikeStrips.length - 1; i >= 0; i--) {
            const ss = this.spikeStrips[i];

            // Remove spike strips that are too far behind the player (>120 units away)
            const dist = ss.position.distanceTo(player.position);
            if (dist > 120) {
                this.game.scene.remove(ss.mesh);
                ss.mesh.traverse(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
                this.spikeStrips.splice(i, 1);
                continue;
            }

            // Check if player vehicle drives over the spike strip
            if (!ss.triggered && player.inVehicle && player.currentVehicle) {
                const vehicle = player.currentVehicle;
                const vPos = vehicle.mesh.position;
                const stripDist = vPos.distanceTo(ss.position);

                if (stripDist < 4 && Math.abs(vehicle.speed) > 3) {
                    ss.triggered = true;

                    // Pop tires
                    vehicle._tiresPopped = true;
                    const vType = this.game.systems.vehicles.vehicleTypes[vehicle.type];
                    if (vType) {
                        vehicle._originalMaxSpeed = vehicle._originalMaxSpeed || vType.maxSpeed;
                        vehicle._poppedMaxSpeed = vehicle._originalMaxSpeed * 0.3;
                    }

                    // Immediately reduce current speed
                    vehicle.speed *= 0.4;

                    // Reduce handling
                    vehicle.handling *= 0.5;

                    // Visual: lower the vehicle slightly (popped tires)
                    vehicle._tireLowerOffset = 0.15;

                    this.game.systems.audio.playCrash(0.6);
                    this.game.systems.ui.showMissionText('TIRES POPPED!', 2.5);
                    this.game.systems.camera.addShake(0.4);
                }
            }
        }
    }

    _spawnRoadblock() {
        const player = this.game.systems.player;
        const world = this.game.systems.world;
        if (!world) return;

        // Place roadblock ahead of player at an intersection
        const playerDir = this.game.systems.camera
            ? this.game.systems.camera.getForwardDirection()
            : new THREE.Vector3(0, 0, 1);

        const blockDist = 60 + Math.random() * 40;
        let blockX = player.position.x + playerDir.x * blockDist;
        let blockZ = player.position.z + playerDir.z * blockDist;

        // Snap to nearest intersection (road grid)
        const bs = world.blockSize;
        const rw = world.roadWidth;
        blockX = Math.round(blockX / bs) * bs;
        blockZ = Math.round(blockZ / bs) * bs;

        // Determine roadblock facing direction (perpendicular to player approach)
        const toBlock = new THREE.Vector3(blockX - player.position.x, 0, blockZ - player.position.z).normalize();
        let roadblockRotation = Math.atan2(toBlock.x, toBlock.z);

        const group = new THREE.Group();

        // V-formation: 2-3 police sedans forming a V barrier
        const carCount = this.level >= 4 ? 3 : 2;
        const vAngle = 0.45; // Angle of V-formation spread
        const vDepth = 2.5;  // How far forward the center car is

        const carPositions = [];
        if (carCount === 2) {
            // Two cars angled inward forming a V
            carPositions.push({ offX: -3.5, offZ: 0, rot: vAngle });
            carPositions.push({ offX:  3.5, offZ: 0, rot: -vAngle });
        } else {
            // Three cars: center one forward, two sides angled in
            carPositions.push({ offX: -4, offZ: -vDepth, rot: vAngle });
            carPositions.push({ offX:  0, offZ:  vDepth, rot: 0 });
            carPositions.push({ offX:  4, offZ: -vDepth, rot: -vAngle });
        }

        for (const cp of carPositions) {
            // Rotate offset by roadblock facing direction
            const cosR = Math.cos(roadblockRotation);
            const sinR = Math.sin(roadblockRotation);
            const worldOffX = cp.offX * cosR - cp.offZ * sinR;
            const worldOffZ = cp.offX * sinR + cp.offZ * cosR;

            const car = this.game.systems.vehicles.spawnVehicle(
                blockX + worldOffX,
                blockZ + worldOffZ,
                'sedan'
            );
            if (car) {
                // White police paint with blue stripe effect
                car.mesh.traverse((child) => {
                    if (child.isMesh && child.material) {
                        child.material = new THREE.MeshStandardMaterial({
                            color: 0xffffff, roughness: 0.3, metalness: 0.5
                        });
                    }
                });
                car.mesh.rotation.y = roadblockRotation + cp.rot;
                car.isTraffic = false;

                // Add split red/blue lightbar to roadblock car
                this._addPoliceLightbar(car);

                group.userData.cars = group.userData.cars || [];
                group.userData.cars.push(car);
            }
        }

        // Spike strip behind the V-formation
        const stripGeo = new THREE.BoxGeometry(rw, 0.05, 0.5);
        const stripMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
        const strip = new THREE.Mesh(stripGeo, stripMat);
        strip.position.set(blockX, 0.03, blockZ);
        strip.rotation.y = roadblockRotation;
        this.game.scene.add(strip);

        this.roadblocks.push({
            position: new THREE.Vector3(blockX, 0, blockZ),
            group: group,
            strip: strip,
            cars: group.userData.cars || [],
            flashTime: 0
        });
    }

    _updateRoadblocks(dt) {
        const player = this.game.systems.player;

        for (const rb of this.roadblocks) {
            // Lightbar flashing is now handled by _updatePoliceLightbars()

            // Spike strip damage: pop tires if player drives over
            if (player.inVehicle && player.currentVehicle) {
                const vPos = player.currentVehicle.mesh.position;
                const dist = vPos.distanceTo(rb.position);
                if (dist < 6 && Math.abs(player.currentVehicle.speed) > 5) {
                    if (!rb._popped) {
                        rb._popped = true;
                        // Reduce vehicle speed and handling
                        player.currentVehicle.speed *= 0.3;
                        player.currentVehicle.handling *= 0.5;
                        this.game.systems.audio.playCrash(0.5);
                        this.game.systems.ui.showMissionText('TIRES BLOWN!', 2);
                    }
                }
            }
        }
    }

    // === BRIBE STAR PICKUPS ===

    _createBribeStars() {
        for (const pos of this._bribeStarPositions) {
            // Star shape using octahedron
            const geo = new THREE.OctahedronGeometry(0.6);
            const mat = new THREE.MeshBasicMaterial({
                color: 0xffdd00,
                transparent: true,
                opacity: 0.8
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(pos.x, 1.5, pos.z);
            this.game.scene.add(mesh);

            // Glow ring
            const ringGeo = new THREE.RingGeometry(0.9, 1.1, 6);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0xffdd00,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(pos.x, 0.1, pos.z);
            this.game.scene.add(ring);

            this._bribeStars.push({
                mesh, ring,
                x: pos.x, z: pos.z,
                active: true,
                respawnTimer: 0
            });
        }
    }

    _updateBribeStars(dt) {
        const player = this.game.systems.player;

        for (const star of this._bribeStars) {
            if (star.active) {
                star.mesh.rotation.y += dt * 2;
                star.mesh.position.y = 1.5 + Math.sin(Date.now() * 0.003) * 0.3;

                // Only show when wanted
                star.mesh.visible = this.level > 0;
                star.ring.visible = this.level > 0;

                if (this.level > 0) {
                    const dx = player.position.x - star.x;
                    const dz = player.position.z - star.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);

                    if (dist < 4) {
                        // Reduce wanted by 1 star
                        this.level = Math.max(0, this.level - 1);
                        this.heat = Math.max(0, this.heat - 3);
                        star.active = false;
                        star.mesh.visible = false;
                        star.ring.visible = false;
                        star.respawnTimer = 90; // 90 second respawn

                        this.game.systems.ui.showMissionText('BRIBE STAR! -1 Wanted Level', 2);
                        this.game.systems.audio.playPickup();

                        if (this.level <= 0) {
                            this.clearWanted();
                        }
                    }
                }
            } else {
                star.respawnTimer -= dt;
                if (star.respawnTimer <= 0) {
                    star.active = true;
                }
            }
        }
    }

    // === ESCAPE ZONES ===

    _createEscapeZones() {
        for (const pos of this._escapeZonePositions) {
            // Semi-transparent safe zone circle
            const geo = new THREE.RingGeometry(4, 5, 24);
            const mat = new THREE.MeshBasicMaterial({
                color: 0x00ff88,
                transparent: true,
                opacity: 0.2,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const ring = new THREE.Mesh(geo, mat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(pos.x, 0.05, pos.z);
            this.game.scene.add(ring);

            this._escapeZones.push({
                ring,
                x: pos.x, z: pos.z,
                name: pos.name,
                radius: 5
            });
        }
    }

    _updateEscapeZones(dt) {
        if (this.level <= 0) {
            for (const zone of this._escapeZones) zone.ring.visible = false;
            this._inEscapeZone = false;
            return;
        }

        const player = this.game.systems.player;
        let inZone = false;

        for (const zone of this._escapeZones) {
            zone.ring.visible = true;
            // Pulse animation
            const pulse = 1 + Math.sin(Date.now() * 0.003) * 0.1;
            zone.ring.scale.setScalar(pulse);

            const dx = player.position.x - zone.x;
            const dz = player.position.z - zone.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < zone.radius) {
                inZone = true;

                if (!this._inEscapeZone) {
                    this._inEscapeZone = true;
                    this._escapeZoneTimer = 0;
                    this.game.systems.ui.showMissionText(`SAFE ZONE: ${zone.name}\nStay hidden to lose wanted...`, 3);
                }

                this._escapeZoneTimer += dt;

                // Accelerate escape: reduce escape timer 3x faster while in zone
                if (this.isEscaping) {
                    this.escapeTimer -= dt * 2; // Extra 2x (on top of normal 1x in update)
                }

                // After 15 seconds in zone, auto-clear wanted
                if (this._escapeZoneTimer >= 15) {
                    this.game.systems.ui.showMissionText('ESCAPED!', 3);
                    this.clearWanted();
                    this._inEscapeZone = false;
                    return;
                }
            }
        }

        if (!inZone && this._inEscapeZone) {
            this._inEscapeZone = false;
            this._escapeZoneTimer = 0;
        }
    }

    // === PAY N SPRAY PARTICLE EFFECTS ===

    _spawnSprayParticles(pos) {
        if (!this._sprayParticles) this._sprayParticles = [];
        if (this._sprayParticles.length > 40) return;

        for (let i = 0; i < 3; i++) {
            const geo = new THREE.SphereGeometry(0.15 + Math.random() * 0.1, 4, 4);
            const colors = [0x4488ff, 0x88ccff, 0xffffff, 0x44aaff];
            const mat = new THREE.MeshBasicMaterial({
                color: colors[Math.floor(Math.random() * colors.length)],
                transparent: true,
                opacity: 0.6,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(
                pos.x + (Math.random() - 0.5) * 3,
                1 + Math.random() * 2,
                pos.z + (Math.random() - 0.5) * 3
            );
            this.game.scene.add(mesh);

            this._sprayParticles.push({
                mesh,
                velX: (Math.random() - 0.5) * 3,
                velY: 1 + Math.random() * 2,
                velZ: (Math.random() - 0.5) * 3,
                life: 0.5 + Math.random() * 0.5
            });
        }

        // Update existing particles
        const dt = this.game.deltaTime;
        for (let i = this._sprayParticles.length - 1; i >= 0; i--) {
            const p = this._sprayParticles[i];
            p.life -= dt;
            p.mesh.position.x += p.velX * dt;
            p.mesh.position.y += p.velY * dt;
            p.mesh.position.z += p.velZ * dt;
            p.velY -= 3 * dt; // Gravity
            p.mesh.material.opacity = Math.max(0, p.life);

            if (p.life <= 0) {
                this.game.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this._sprayParticles.splice(i, 1);
            }
        }
    }

    _cleanupSprayParticles() {
        if (!this._sprayParticles) return;
        for (const p of this._sprayParticles) {
            this.game.scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
        }
        this._sprayParticles = [];
    }
}

// San Claudio - Weapon System
// All 10 weapons, shooting, melee, grenades, atomizer, pickups, weapon wheel

export class WeaponManager {
    constructor(game) {
        this.game = game;
        this.pickups = [];
        this.projectiles = [];
        this.tracers = [];
        this.grenades = [];
        this.grenadeArcLine = null;
        this.grenadeHolding = false;

        // Melee combo system
        this.comboCount = 0;
        this.comboTimer = 0;
        this.comboMaxTime = 1.0; // seconds to continue combo
        this.comboChains = {
            fists: { maxHits: 3, damageMultipliers: [1.0, 1.3, 2.0], names: ['Jab', 'Cross', 'Uppercut!'] },
            bat: { maxHits: 2, damageMultipliers: [1.0, 1.8], names: ['Swing', 'HOME RUN!'] },
            knife: { maxHits: 3, damageMultipliers: [1.0, 1.2, 1.5], names: ['Slash', 'Stab', 'Eviscerate!'] }
        };

        this.weaponDefs = {
            fists: { type: 'melee', damage: 10, range: 2, rate: 0.4, icon: 'FISTS', ammo: Infinity, clipSize: Infinity },
            bat: { type: 'melee', damage: 25, range: 2.5, rate: 0.5, icon: 'BAT', ammo: Infinity, clipSize: Infinity },
            knife: { type: 'melee', damage: 35, range: 1.8, rate: 0.25, icon: 'KNIFE', ammo: Infinity, clipSize: Infinity },
            pistol: { type: 'ranged', damage: 20, range: 60, rate: 0.3, icon: 'PISTOL', clipSize: 17, crosshair: 'dot' },
            smg: { type: 'ranged', damage: 12, range: 40, rate: 0.08, icon: 'SMG', clipSize: 30, crosshair: 'dot', auto: true },
            shotgun: { type: 'ranged', damage: 15, range: 15, rate: 0.7, icon: 'SHOTGUN', clipSize: 8, crosshair: 'circle', pellets: 5 },
            rifle: { type: 'ranged', damage: 30, range: 100, rate: 0.15, icon: 'RIFLE', clipSize: 30, crosshair: 'cross' },
            sniper: { type: 'ranged', damage: 100, range: 200, rate: 1.2, icon: 'SNIPER', clipSize: 5, crosshair: 'cross', scope: true },
            grenade: { type: 'thrown', damage: 80, range: 8, rate: 1.0, icon: 'GREN', clipSize: 10 },
            atomizer: { type: 'special', damage: 30, range: 50, rate: 0.8, icon: 'ATOM', clipSize: 20, crosshair: 'circle' }
        };

        this.attackCooldown = 0;

        // Weapon shops
        this.shops = [];
        this.shopOpen = false;
        this.shopSelectedIndex = 0;
        this.shopInventory = [
            { id: 'bat', price: 100, ammo: Infinity },
            { id: 'knife', price: 200, ammo: Infinity },
            { id: 'pistol', price: 500, ammo: 34 },
            { id: 'smg', price: 1500, ammo: 60 },
            { id: 'shotgun', price: 2000, ammo: 16 },
            { id: 'rifle', price: 3000, ammo: 60 },
            { id: 'sniper', price: 5000, ammo: 10 },
            { id: 'grenade', price: 800, ammo: 5 },
            // Ammo refills
            { id: 'pistol_ammo', label: 'Pistol Ammo x34', price: 150, ammoFor: 'pistol', ammo: 34 },
            { id: 'smg_ammo', label: 'SMG Ammo x60', price: 400, ammoFor: 'smg', ammo: 60 },
            { id: 'shotgun_ammo', label: 'Shotgun Shells x8', price: 300, ammoFor: 'shotgun', ammo: 8 },
            { id: 'rifle_ammo', label: 'Rifle Ammo x30', price: 500, ammoFor: 'rifle', ammo: 30 },
            { id: 'sniper_ammo', label: 'Sniper Rounds x5', price: 400, ammoFor: 'sniper', ammo: 5 },
        ];
    }

    init() {
        this.spawnPickups();
        this.createShops();
    }

    createShops() {
        const shopLocations = [
            { x: 40, z: -40, name: 'Ammu-Nation Downtown' },
            { x: 220, z: -260, name: 'Ammu-Nation Strip' },
            { x: -180, z: 240, name: 'Ammu-Nation Docks' },
        ];

        for (const loc of shopLocations) {
            // Shop marker
            const geo = new THREE.CylinderGeometry(0.4, 0.4, 3, 8);
            const mat = new THREE.MeshStandardMaterial({
                color: 0xff4400,
                emissive: 0xff4400,
                emissiveIntensity: 0.3,
                transparent: true,
                opacity: 0.6
            });
            const marker = new THREE.Mesh(geo, mat);
            marker.position.set(loc.x, 1.5, loc.z);
            this.game.scene.add(marker);

            // Sign above
            const signCanvas = document.createElement('canvas');
            signCanvas.width = 256;
            signCanvas.height = 64;
            const ctx = signCanvas.getContext('2d');
            ctx.fillStyle = '#1a1a2a';
            ctx.fillRect(0, 0, 256, 64);
            ctx.fillStyle = '#ff4400';
            ctx.font = 'bold 24px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('AMMU-NATION', 128, 40);
            const signTex = new THREE.CanvasTexture(signCanvas);
            const signGeo = new THREE.PlaneGeometry(3, 0.75);
            const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true });
            const sign = new THREE.Mesh(signGeo, signMat);
            sign.position.set(loc.x, 3.5, loc.z);
            this.game.scene.add(sign);

            this.shops.push({
                marker,
                sign,
                position: new THREE.Vector3(loc.x, 0, loc.z),
                name: loc.name
            });
        }
    }

    _updateShops() {
        const player = this.game.systems.player;
        const input = this.game.systems.input;

        // Animate shop markers
        for (const shop of this.shops) {
            shop.marker.rotation.y += 0.02;
        }

        if (this.shopOpen) {
            this._updateShopMenu();
            return;
        }

        // Check proximity to shops
        for (const shop of this.shops) {
            const dist = player.position.distanceTo(shop.position);
            if (dist < 4) {
                const promptEl = document.getElementById('hud-interact-prompt');
                if (!promptEl) return;
                promptEl.textContent = `Press E to browse ${shop.name}`;
                promptEl.classList.add('visible');

                if (input.justPressed('interact')) {
                    this._openShop(shop);
                }
                return;
            }
        }
    }

    _openShop(shop) {
        this.shopOpen = true;
        this.shopSelectedIndex = 0;
        this.game.systems.ui.showMissionText(shop.name, 2);
        this._drawShopMenu();
    }

    _closeShop() {
        this.shopOpen = false;
        const el = document.getElementById('shop-menu');
        if (el) el.style.display = 'none';
    }

    _updateShopMenu() {
        const input = this.game.systems.input;

        // Throttle navigation to avoid rapid scrolling
        this._shopNavTimer = (this._shopNavTimer || 0) - (1 / 60);

        if (this._shopNavTimer <= 0) {
            // Navigate with W/S or arrow keys
            if (input.keys['KeyW'] || input.keys['ArrowUp']) {
                this.shopSelectedIndex = Math.max(0, this.shopSelectedIndex - 1);
                this._drawShopMenu();
                this._shopNavTimer = 0.15;
            }
            if (input.keys['KeyS'] || input.keys['ArrowDown']) {
                this.shopSelectedIndex = Math.min(this.shopInventory.length - 1, this.shopSelectedIndex + 1);
                this._drawShopMenu();
                this._shopNavTimer = 0.15;
            }
        }

        // Buy with E
        if (input.justPressed('interact')) {
            this._buyItem(this.shopSelectedIndex);
            this._drawShopMenu();
        }

        // Close with Escape or Backspace
        if (input.justPressed('pause') || input.keys['Backspace']) {
            this._closeShop();
        }
    }

    _buyItem(index) {
        const item = this.shopInventory[index];
        if (!item) return;

        const player = this.game.systems.player;

        if (player.cash < item.price) {
            this.game.systems.ui.showMissionText('Not enough cash!', 1.5);
            return;
        }

        player.cash -= item.price;

        if (item.ammoFor) {
            // Ammo refill - find existing weapon and add ammo
            const existing = player.weapons.find(w => w.id === item.ammoFor);
            if (existing) {
                existing.ammo = (existing.ammo || 0) + item.ammo;
                this.game.systems.audio.playPickup();
                this.game.systems.ui.showMissionText(`Bought ${item.label}`, 1.5);
            } else {
                // Don't have the weapon yet - refund
                player.cash += item.price;
                this.game.systems.ui.showMissionText('You need the weapon first!', 1.5);
            }
        } else {
            // Weapon purchase
            const def = this.weaponDefs[item.id];
            player.addWeapon({
                id: item.id,
                ammo: item.ammo,
                clipSize: def ? def.clipSize : Infinity
            });
            this.game.systems.audio.playPickup();
            this.game.systems.ui.showMissionText(`Bought ${item.id.toUpperCase()}!`, 1.5);
        }
    }

    _drawShopMenu() {
        let el = document.getElementById('shop-menu');
        if (!el) {
            el = document.createElement('div');
            el.id = 'shop-menu';
            el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
                'background:rgba(10,10,20,0.92);border:1px solid rgba(255,68,0,0.2);border-radius:4px;' +
                'padding:20px 30px;z-index:55;font-family:Rajdhani,sans-serif;min-width:320px;';
            document.body.appendChild(el);
        }
        el.style.display = 'block';

        const player = this.game.systems.player;
        let html = `<div style="color:#ff4400;font-size:1.2rem;font-weight:700;letter-spacing:2px;margin-bottom:12px;text-align:center;">AMMU-NATION</div>`;
        html += `<div style="color:#7ec87e;font-size:0.9rem;text-align:right;margin-bottom:10px;">Cash: $${player.cash.toLocaleString()}</div>`;

        for (let i = 0; i < this.shopInventory.length; i++) {
            const item = this.shopInventory[i];
            const selected = i === this.shopSelectedIndex;
            const canAfford = player.cash >= item.price;
            const label = item.label || (this.weaponDefs[item.id] ? this.weaponDefs[item.id].icon : item.id.toUpperCase());

            html += `<div style="display:flex;justify-content:space-between;align-items:center;` +
                `padding:4px 8px;margin:2px 0;border-radius:2px;` +
                `background:${selected ? 'rgba(255,68,0,0.15)' : 'transparent'};` +
                `color:${canAfford ? (selected ? '#fff' : 'rgba(255,255,255,0.6)') : 'rgba(255,255,255,0.2)'};` +
                `font-size:0.85rem;">` +
                `<span>${selected ? '> ' : '  '}${label}</span>` +
                `<span style="color:${canAfford ? '#7ec87e' : '#dd4444'}">$${item.price.toLocaleString()}</span>` +
                `</div>`;
        }

        html += `<div style="color:rgba(255,255,255,0.25);font-size:0.7rem;text-align:center;margin-top:12px;">W/S: Navigate | E: Buy | Esc: Close</div>`;

        el.innerHTML = html;
    }

    spawnPickups() {
        // Weapon pickup locations
        const pickupData = [
            { x: 50, z: 50, weapon: 'pistol', ammo: 34 },
            { x: -30, z: -60, weapon: 'smg', ammo: 60 },
            { x: 200, z: -200, weapon: 'shotgun', ammo: 16 },
            { x: -200, z: 200, weapon: 'rifle', ammo: 60 },
            { x: 250, z: 250, weapon: 'knife', ammo: Infinity },
            { x: -100, z: -150, weapon: 'bat', ammo: Infinity },
            { x: 100, z: -300, weapon: 'sniper', ammo: 10 },
            { x: -300, z: 300, weapon: 'grenade', ammo: 5 },
            { x: -250, z: -250, weapon: 'pistol', ammo: 34 },
            // Atomizer - rare, in Industrial
            { x: -280, z: 280, weapon: 'atomizer', ammo: 20 },
        ];

        for (const pd of pickupData) {
            this.createPickup(pd.x, pd.z, pd.weapon, pd.ammo);
        }
    }

    createPickup(x, z, weaponId, ammo) {
        const def = this.weaponDefs[weaponId];
        if (!def) return;

        const colors = {
            fists: 0xffaa00, bat: 0x886633, knife: 0xcccccc,
            pistol: 0x666666, smg: 0x444444, shotgun: 0x553311,
            rifle: 0x335533, sniper: 0x333366, grenade: 0x336633,
            atomizer: 0x6600ff
        };

        const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const mat = new THREE.MeshStandardMaterial({
            color: colors[weaponId] || 0xffffff,
            emissive: colors[weaponId] || 0xffffff,
            emissiveIntensity: 0.5,
            roughness: 0.3
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, 0.8, z);
        this.game.scene.add(mesh);

        this.pickups.push({
            mesh: mesh,
            weaponId: weaponId,
            ammo: ammo,
            collected: false,
            respawnTimer: 0,
            originalPos: { x, z }
        });
    }

    checkPickups(playerPos) {
        for (const pickup of this.pickups) {
            if (pickup.collected) continue;

            const dist = playerPos.distanceTo(pickup.mesh.position);
            if (dist < 2) {
                // Auto-pickup
                this.collectPickup(pickup);
            }
        }
    }

    collectPickup(pickup) {
        const player = this.game.systems.player;
        player.addWeapon({
            id: pickup.weaponId,
            ammo: pickup.ammo,
            clipSize: this.weaponDefs[pickup.weaponId].clipSize
        });

        pickup.collected = true;
        pickup.mesh.visible = false;
        pickup.respawnTimer = 60; // Respawn after 60 seconds

        // Sound
        this.game.systems.audio.playPickup();

        // Show prompt
        this.game.systems.ui.showMissionText(`Picked up ${pickup.weaponId.toUpperCase()}`);
    }

    update(dt) {
        const input = this.game.systems.input;
        const player = this.game.systems.player;

        // Shops always update (even in vehicle for marker animation)
        this._updateShops();

        if (player.isDead || player.inVehicle) {
            if (this.shopOpen) this._closeShop();
            return;
        }

        // If shop is open, don't process weapon inputs
        if (this.shopOpen) return;

        // Attack cooldown
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);

        // Combo timer decay
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.comboCount = 0;
            }
        }

        // Weapon cycling
        if (input.justPressed('weaponCycle') || input.justPressed('weaponNext')) {
            player.cycleWeapon(1);
        }
        if (input.justPressed('weaponPrev')) {
            player.cycleWeapon(-1);
        }

        // Direct weapon select by number (1-9)
        if (input.actions.weaponSelect > 0) {
            player.selectWeapon(input.actions.weaponSelect - 1);
        }

        // Attack
        if (input.isDown('attack') && this.attackCooldown <= 0) {
            this.attack();
        }

        // Grenade — hold to show arc, release to throw
        if (input.isDown('grenade')) {
            this.grenadeHolding = true;
            this._updateGrenadeArc();
        } else if (this.grenadeHolding) {
            this.grenadeHolding = false;
            this._removeGrenadeArc();
            this.throwGrenade();
        }

        // Update pickups (spin, respawn)
        for (const pickup of this.pickups) {
            if (pickup.collected) {
                pickup.respawnTimer -= dt;
                if (pickup.respawnTimer <= 0) {
                    pickup.collected = false;
                    pickup.mesh.visible = true;
                }
            } else {
                pickup.mesh.rotation.y += dt * 2;
                pickup.mesh.position.y = 0.8 + Math.sin(Date.now() * 0.003) * 0.15;
            }
        }

        // Update projectiles
        this.updateProjectiles(dt);

        // Update tracers
        this.updateTracers(dt);

        // Update grenades
        this.updateGrenades(dt);

        // Update crosshair
        this.updateCrosshair();
    }

    attack() {
        const player = this.game.systems.player;
        const weapon = player.getCurrentWeapon();
        const def = this.weaponDefs[weapon.id];
        if (!def) return;

        this.attackCooldown = def.rate;

        if (def.type === 'melee') {
            this.meleeAttack(def);
        } else if (def.type === 'ranged') {
            if (weapon.ammo <= 0 && weapon.ammo !== Infinity) return;
            this.rangedAttack(def, weapon);
        } else if (def.type === 'special') {
            if (weapon.ammo <= 0 && weapon.ammo !== Infinity) return;
            this.atomizerAttack(def, weapon);
        } else if (def.type === 'thrown') {
            // Thrown weapons use the dedicated grenade key, not attack button
            this.attackCooldown = 0; // Don't lock out the player
            return;
        }
    }

    meleeAttack(def) {
        const player = this.game.systems.player;
        const weapon = player.getCurrentWeapon();
        const combo = this.comboChains[weapon.id];

        // Combo tracking
        if (combo && this.comboTimer > 0) {
            this.comboCount = Math.min(this.comboCount + 1, combo.maxHits - 1);
        } else {
            this.comboCount = 0;
        }
        this.comboTimer = this.comboMaxTime;

        const multiplier = combo ? combo.damageMultipliers[this.comboCount] : 1.0;
        const comboName = combo ? combo.names[this.comboCount] : null;
        const damage = Math.round(def.damage * multiplier);

        player.playPunchAnimation();

        // Audio — higher pitch for later combo hits
        this.game.systems.audio.playPunch();

        // Camera shake scales with combo
        const shakeIntensity = 0.1 + this.comboCount * 0.15;
        this.game.systems.camera.addShake(shakeIntensity);

        // Show combo text for hits beyond the first
        if (comboName && this.comboCount > 0) {
            this.game.systems.ui.showMissionText(comboName, 1);
        }

        // Check hit on NPCs
        const npcs = this.game.systems.npcs;
        if (npcs) {
            const forward = new THREE.Vector3(
                Math.sin(player.rotation),
                0,
                Math.cos(player.rotation)
            );

            for (const npc of npcs.pedestrians) {
                if (!npc.alive || !npc.mesh) continue;
                const toNPC = new THREE.Vector3().subVectors(npc.mesh.position, player.position);
                const dist = toNPC.length();
                if (dist > def.range) continue;

                // Check if facing NPC
                toNPC.normalize();
                const dot = forward.dot(toNPC);
                if (dot > 0.3) {
                    npc.takeDamage(damage);
                    // Knife backstab = 1-hit kill (player behind the NPC)
                    if (def === this.weaponDefs.knife) {
                        const npcForward = new THREE.Vector3(
                            Math.sin(npc.mesh.rotation.y), 0, Math.cos(npc.mesh.rotation.y)
                        );
                        // If player's attack direction aligns with NPC's facing (both looking same way), it's from behind
                        if (forward.dot(npcForward) > 0.5) {
                            npc.takeDamage(999);
                        }
                    }
                    // Final combo hit knockback
                    if (combo && this.comboCount === combo.maxHits - 1) {
                        const knockDir = forward.clone().multiplyScalar(3);
                        npc.mesh.position.x += knockDir.x;
                        npc.mesh.position.z += knockDir.z;
                    }
                }
            }
        }
    }

    rangedAttack(def, weapon) {
        const player = this.game.systems.player;
        if (weapon.ammo !== Infinity) weapon.ammo--;

        // Audio
        this.game.systems.audio.playGunshot(weapon.id);

        // NPC reaction to gunfire
        const npcs = this.game.systems.npcs;
        if (npcs) npcs.reactToGunfire(player.position);

        const origin = player.position.clone();
        origin.y += 1.5; // Shoot from chest height

        const forward = new THREE.Vector3(
            Math.sin(player.rotation),
            0,
            Math.cos(player.rotation)
        );

        // Muzzle flash
        this.createMuzzleFlash(origin, forward);

        // Screen shake based on weapon power
        const shakeAmounts = { pistol: 0.15, smg: 0.08, shotgun: 0.4, rifle: 0.2, sniper: 0.5 };
        const shakeAmount = shakeAmounts[weapon.id] || 0.15;
        this.game.systems.camera.addShake(shakeAmount);

        // Shell casing
        this.createShellCasing(origin, forward);

        const pellets = def.pellets || 1;

        for (let p = 0; p < pellets; p++) {
            const dir = forward.clone();
            if (pellets > 1) {
                // Spread for shotgun
                dir.x += (Math.random() - 0.5) * 0.15;
                dir.z += (Math.random() - 0.5) * 0.15;
                dir.normalize();
            }

            // Create tracer
            this.createTracer(origin.clone(), dir.clone(), def.range);

            // Raycast for hit detection
            this.checkRangedHit(origin, dir, def);
        }
    }

    createMuzzleFlash(origin, direction) {
        const flashPos = origin.clone().add(direction.clone().multiplyScalar(1.2));

        // Flash sprite - bright yellow/white sphere
        const geo = new THREE.SphereGeometry(0.2, 6, 6);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffdd44,
            transparent: true,
            opacity: 1
        });
        const flash = new THREE.Mesh(geo, mat);
        flash.position.copy(flashPos);
        this.game.scene.add(flash);

        // Point light
        const light = new THREE.PointLight(0xffaa33, 3, 8);
        light.position.copy(flashPos);
        this.game.scene.add(light);

        const startTime = Date.now();
        const animate = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            const scale = 1 + elapsed * 8;
            flash.scale.set(scale, scale, scale);
            mat.opacity = 1 - elapsed * 20;
            light.intensity = Math.max(0, 3 - elapsed * 60);
            if (elapsed < 0.06) {
                requestAnimationFrame(animate);
            } else {
                this.game.scene.remove(flash);
                this.game.scene.remove(light);
                geo.dispose();
                mat.dispose();
            }
        };
        animate();
    }

    createShellCasing(origin, direction) {
        const right = new THREE.Vector3(-direction.z, 0, direction.x);
        const casingPos = origin.clone().add(right.multiplyScalar(0.3));
        casingPos.y += 0.1;

        const geo = new THREE.CylinderGeometry(0.02, 0.02, 0.06, 4);
        const mat = new THREE.MeshStandardMaterial({ color: 0xccaa44, metalness: 0.8, roughness: 0.2 });
        const casing = new THREE.Mesh(geo, mat);
        casing.position.copy(casingPos);
        this.game.scene.add(casing);

        const vel = {
            x: right.x * 2 + (Math.random() - 0.5),
            y: 3 + Math.random() * 2,
            z: right.z * 2 + (Math.random() - 0.5)
        };
        const startTime = Date.now();
        const animate = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            const dt = 1 / 60;
            vel.y -= 15 * dt;
            casing.position.x += vel.x * dt;
            casing.position.y += vel.y * dt;
            casing.position.z += vel.z * dt;
            casing.rotation.x += 10 * dt;
            casing.rotation.z += 8 * dt;

            if (casing.position.y < 0) {
                casing.position.y = 0;
                vel.y *= -0.3;
                vel.x *= 0.5;
                vel.z *= 0.5;
            }

            if (elapsed < 2) {
                requestAnimationFrame(animate);
            } else {
                this.game.scene.remove(casing);
                geo.dispose();
                mat.dispose();
            }
        };
        animate();
    }

    atomizerAttack(def, weapon) {
        if (weapon.ammo !== Infinity) weapon.ammo--;

        const player = this.game.systems.player;

        // Audio
        this.game.systems.audio.playAtomizer();

        // NPC reaction to atomizer fire
        const npcs = this.game.systems.npcs;
        if (npcs) npcs.reactToGunfire(player.position);

        const origin = player.position.clone();
        origin.y += 1.5;

        const forward = new THREE.Vector3(
            Math.sin(player.rotation),
            0,
            Math.cos(player.rotation)
        );

        // Create energy ball projectile
        const ballGeo = new THREE.SphereGeometry(0.3, 8, 8);
        const ballMat = new THREE.MeshStandardMaterial({
            color: 0x6600ff,
            emissive: 0x6600ff,
            emissiveIntensity: 1.0,
            transparent: true,
            opacity: 0.8
        });
        const ball = new THREE.Mesh(ballGeo, ballMat);
        ball.position.copy(origin);
        this.game.scene.add(ball);

        // Point light on ball
        const light = new THREE.PointLight(0x6600ff, 2, 10);
        ball.add(light);

        this.projectiles.push({
            mesh: ball,
            direction: forward.clone(),
            speed: 40,
            damage: def.damage,
            range: def.range,
            traveled: 0,
            isAtomizer: true
        });
    }

    throwGrenade() {
        this._removeGrenadeArc();
        const player = this.game.systems.player;
        const grenadeWeapon = player.weapons.find(w => w.id === 'grenade');
        if (!grenadeWeapon || grenadeWeapon.ammo <= 0) return;
        grenadeWeapon.ammo--;

        const origin = player.position.clone();
        origin.y += 1.5;

        const forward = new THREE.Vector3(
            Math.sin(player.rotation),
            0.5, // Arc upward
            Math.cos(player.rotation)
        ).normalize();

        const geo = new THREE.SphereGeometry(0.15, 6, 6);
        const mat = new THREE.MeshStandardMaterial({ color: 0x336633 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(origin);
        this.game.scene.add(mesh);

        this.grenades.push({
            mesh: mesh,
            velocity: forward.multiplyScalar(20),
            fuseTimer: 2.0,
            bounced: false
        });
    }

    _updateGrenadeArc() {
        const player = this.game.systems.player;
        const grenadeWeapon = player.weapons.find(w => w.id === 'grenade');
        if (!grenadeWeapon || grenadeWeapon.ammo <= 0) {
            this._removeGrenadeArc();
            return;
        }

        const origin = player.position.clone();
        origin.y += 1.5;

        const forward = new THREE.Vector3(
            Math.sin(player.rotation),
            0.5,
            Math.cos(player.rotation)
        ).normalize().multiplyScalar(20);

        // Simulate trajectory
        const points = [];
        const pos = origin.clone();
        const vel = forward.clone();
        const steps = 40;
        const stepDt = 0.05;

        for (let i = 0; i <= steps; i++) {
            points.push(pos.clone());
            vel.y -= 15 * stepDt;
            pos.add(vel.clone().multiplyScalar(stepDt));
            if (pos.y < 0.15) break;
        }

        // Remove old arc
        this._removeGrenadeArc();

        // Create dotted arc using dashed line
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineDashedMaterial({
            color: 0x88ff88,
            dashSize: 0.5,
            gapSize: 0.3,
            transparent: true,
            opacity: 0.6
        });
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        this.game.scene.add(line);
        this.grenadeArcLine = line;

        // Landing indicator
        const lastPoint = points[points.length - 1];
        const ringGeo = new THREE.RingGeometry(0.3, 0.5, 12);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(lastPoint.x, 0.15, lastPoint.z);
        this.game.scene.add(ring);
        this.grenadeArcLine._landingRing = ring;
    }

    _removeGrenadeArc() {
        if (this.grenadeArcLine) {
            this.game.scene.remove(this.grenadeArcLine);
            this.grenadeArcLine.geometry.dispose();
            this.grenadeArcLine.material.dispose();
            if (this.grenadeArcLine._landingRing) {
                this.game.scene.remove(this.grenadeArcLine._landingRing);
                this.grenadeArcLine._landingRing.geometry.dispose();
                this.grenadeArcLine._landingRing.material.dispose();
            }
            this.grenadeArcLine = null;
        }
    }

    createTracer(origin, direction, range) {
        const end = origin.clone().add(direction.clone().multiplyScalar(range));
        const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
        const mat = new THREE.LineBasicMaterial({
            color: 0xffff88,
            transparent: true,
            opacity: 0.6
        });
        const line = new THREE.Line(geo, mat);
        this.game.scene.add(line);

        this.tracers.push({
            mesh: line,
            lifetime: 0.1
        });
    }

    checkRangedHit(origin, direction, def) {
        const npcs = this.game.systems.npcs;
        if (!npcs) return;

        // Rapier raycast against static geometry (walls/buildings)
        let wallDist = def.range;
        const physics = this.game.systems.physics;
        if (physics && physics.ready) {
            const hit = physics.castRayStatic(
                { x: origin.x, y: origin.y, z: origin.z },
                { x: direction.x, y: direction.y, z: direction.z },
                def.range
            );
            if (hit) {
                wallDist = hit.toi;
                this.createImpactEffect(hit.point);
            }
        }

        // Ray-sphere intersection with NPCs (only if NPC is closer than wall)
        for (const npc of npcs.pedestrians) {
            if (!npc.alive || !npc.mesh) continue;

            const toNPC = new THREE.Vector3().subVectors(npc.mesh.position, origin);
            toNPC.y = 0;
            const proj = toNPC.dot(direction);
            if (proj < 0 || proj > Math.min(def.range, wallDist)) continue;

            const closest = origin.clone().add(direction.clone().multiplyScalar(proj));
            const dist = closest.distanceTo(new THREE.Vector3(npc.mesh.position.x, origin.y, npc.mesh.position.z));

            if (dist < 1.0) {
                npc.takeDamage(def.damage);
                break;
            }
        }
    }

    createImpactEffect(point) {
        // Central flash
        const geo = new THREE.SphereGeometry(0.15, 6, 6);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffcc44,
            transparent: true,
            opacity: 1
        });
        const flash = new THREE.Mesh(geo, mat);
        flash.position.set(point.x, point.y, point.z);
        this.game.scene.add(flash);

        const startTime = Date.now();
        const animate = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            const scale = 1 + elapsed * 4;
            flash.scale.set(scale, scale, scale);
            mat.opacity = 1 - elapsed * 5;
            if (elapsed < 0.2) {
                requestAnimationFrame(animate);
            } else {
                this.game.scene.remove(flash);
                geo.dispose();
                mat.dispose();
            }
        };
        animate();

        // Spark particles flying outward
        for (let i = 0; i < 6; i++) {
            const sGeo = new THREE.SphereGeometry(0.03, 4, 4);
            const sMat = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0xffcc44 : 0xffffff,
                transparent: true,
                opacity: 1
            });
            const spark = new THREE.Mesh(sGeo, sMat);
            spark.position.set(point.x, point.y, point.z);
            const sparkVel = new THREE.Vector3(
                (Math.random() - 0.5) * 6,
                Math.random() * 4,
                (Math.random() - 0.5) * 6
            );
            this.game.scene.add(spark);

            const sStart = Date.now();
            const sAnimate = () => {
                const dt = (Date.now() - sStart) / 1000;
                sparkVel.y -= 10 * 0.016;
                spark.position.add(sparkVel.clone().multiplyScalar(0.016));
                sMat.opacity = Math.max(0, 1 - dt * 5);
                if (dt < 0.25) {
                    requestAnimationFrame(sAnimate);
                } else {
                    this.game.scene.remove(spark);
                    sGeo.dispose();
                    sMat.dispose();
                }
            };
            sAnimate();
        }
    }

    updateProjectiles(dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            const move = proj.direction.clone().multiplyScalar(proj.speed * dt);
            proj.mesh.position.add(move);
            proj.traveled += proj.speed * dt;

            let removed = false;

            // Check hit on NPCs
            const npcs = this.game.systems.npcs;
            if (npcs) {
                for (const npc of npcs.pedestrians) {
                    if (!npc.alive || !npc.mesh) continue;
                    if (proj.mesh.position.distanceTo(npc.mesh.position) < 2) {
                        npc.takeDamage(proj.damage);

                        if (proj.isAtomizer) {
                            // Atomizer ragdoll effect
                            this.game.systems.ragdoll.triggerNPCRagdoll(npc, proj.direction.clone().multiplyScalar(15), true);
                        }

                        this.removeProjectile(i);
                        removed = true;
                        break;
                    }
                }
            }

            // Max range — only if not already removed
            if (!removed && proj.traveled > proj.range) {
                this.removeProjectile(i);
            }
        }
    }

    removeProjectile(index) {
        const proj = this.projectiles[index];
        this.game.scene.remove(proj.mesh);
        if (proj.mesh.geometry) proj.mesh.geometry.dispose();
        if (proj.mesh.material) proj.mesh.material.dispose();
        this.projectiles.splice(index, 1);
    }

    updateTracers(dt) {
        for (let i = this.tracers.length - 1; i >= 0; i--) {
            this.tracers[i].lifetime -= dt;
            if (this.tracers[i].lifetime <= 0) {
                this.game.scene.remove(this.tracers[i].mesh);
                this.tracers[i].mesh.geometry.dispose();
                this.tracers[i].mesh.material.dispose();
                this.tracers.splice(i, 1);
            }
        }
    }

    updateGrenades(dt) {
        for (let i = this.grenades.length - 1; i >= 0; i--) {
            const g = this.grenades[i];

            // Physics
            g.velocity.y -= 15 * dt; // Gravity
            g.mesh.position.add(g.velocity.clone().multiplyScalar(dt));

            // Ground bounce
            if (g.mesh.position.y < 0.15) {
                g.mesh.position.y = 0.15;
                g.velocity.y *= -0.3;
                g.velocity.x *= 0.7;
                g.velocity.z *= 0.7;
            }

            // Fuse countdown
            g.fuseTimer -= dt;
            if (g.fuseTimer <= 0) {
                this.explode(g.mesh.position, 8, 80);
                this.game.scene.remove(g.mesh);
                g.mesh.geometry.dispose();
                g.mesh.material.dispose();
                this.grenades.splice(i, 1);
            }
        }
    }

    explode(position, radius, damage) {
        // Visual: flash + expanding sphere
        const flashGeo = new THREE.SphereGeometry(radius * 0.3, 8, 8);
        const flashMat = new THREE.MeshBasicMaterial({
            color: 0xff8800,
            transparent: true,
            opacity: 1
        });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(position);
        this.game.scene.add(flash);

        // Expand and fade
        const startTime = Date.now();
        const animate = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            const scale = 1 + elapsed * 8;
            flash.scale.set(scale, scale, scale);
            flashMat.opacity = 1 - elapsed * 3;

            if (elapsed < 0.4) {
                requestAnimationFrame(animate);
            } else {
                this.game.scene.remove(flash);
                flashGeo.dispose();
                flashMat.dispose();
            }
        };
        animate();

        // Debris particles — small flying chunks
        const debrisColors = [0xff4400, 0xff8800, 0xffcc00, 0x444444, 0x666666];
        for (let i = 0; i < 15; i++) {
            const dGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
            const dColor = debrisColors[Math.floor(Math.random() * debrisColors.length)];
            const dMat = new THREE.MeshBasicMaterial({ color: dColor, transparent: true, opacity: 1 });
            const debris = new THREE.Mesh(dGeo, dMat);
            debris.position.copy(position);

            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 15,
                Math.random() * 12 + 3,
                (Math.random() - 0.5) * 15
            );

            this.game.scene.add(debris);
            const dStart = Date.now();
            const dAnimate = () => {
                const dt = (Date.now() - dStart) / 1000;
                vel.y -= 15 * 0.016;
                debris.position.add(vel.clone().multiplyScalar(0.016));
                debris.rotation.x += 0.2;
                debris.rotation.y += 0.15;
                dMat.opacity = Math.max(0, 1 - dt * 2);
                if (dt < 0.8) {
                    requestAnimationFrame(dAnimate);
                } else {
                    this.game.scene.remove(debris);
                    dGeo.dispose();
                    dMat.dispose();
                }
            };
            dAnimate();
        }

        // Point light flash
        const light = new THREE.PointLight(0xff8800, 5, radius * 2);
        light.position.copy(position);
        this.game.scene.add(light);
        setTimeout(() => this.game.scene.remove(light), 200);

        // Audio
        this.game.systems.audio.playExplosion();

        // Screen shake
        this.game.systems.camera.addShake(1.5);

        // NPC reaction to explosion
        const npcs = this.game.systems.npcs;
        if (npcs) npcs.reactToExplosion(position);

        // Damage NPCs in radius
        if (npcs) {
            for (const npc of npcs.pedestrians) {
                if (!npc.alive || !npc.mesh) continue;
                const dist = position.distanceTo(npc.mesh.position);
                if (dist < radius) {
                    const dmg = damage * (1 - dist / radius);
                    npc.takeDamage(dmg);

                    // Ragdoll force
                    const forceDir = new THREE.Vector3().subVectors(npc.mesh.position, position).normalize();
                    forceDir.y = 0.5;
                    this.game.systems.ragdoll.triggerNPCRagdoll(npc, forceDir.multiplyScalar(20));
                }
            }
        }

        // Damage vehicles in radius
        for (const v of this.game.systems.vehicles.vehicles) {
            if (!v.mesh) continue;
            const dist = position.distanceTo(v.mesh.position);
            if (dist < radius) {
                v.health -= damage * (1 - dist / radius);
            }
        }

        // Damage player
        const player = this.game.systems.player;
        const playerDist = position.distanceTo(player.position);
        if (playerDist < radius) {
            player.takeDamage(damage * (1 - playerDist / radius));
        }
    }

    updateCrosshair() {
        const player = this.game.systems.player;
        const weapon = player.getCurrentWeapon();
        const def = this.weaponDefs[weapon.id];
        const crosshair = document.getElementById('crosshair');
        if (!crosshair) return;

        if (def && def.crosshair && !player.inVehicle) {
            crosshair.style.display = 'block';
            crosshair.className = def.crosshair;
        } else {
            crosshair.style.display = 'none';
        }
    }

    // ── Procedural Weapon 3D Models ──────────────────────────────────

    createWeaponModel(weaponId) {
        if (!this._weaponModelCache) this._weaponModelCache = {};
        if (this._weaponModelCache[weaponId]) {
            return this._weaponModelCache[weaponId].clone();
        }

        // Try to use GLB model first
        const models = this.game.systems.models;
        const glbName = `weapon_${weaponId}`;
        if (models && models.hasModel(glbName)) {
            const model = models.models[glbName].clone();
            model.traverse(child => { if (child.isMesh) child.castShadow = true; });
            this._weaponModelCache[weaponId] = model;
            return model.clone();
        }

        // Fallback: procedural generation
        const group = new THREE.Group();
        const metal = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.7 });
        const wood = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0.1 });
        const matte = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.3 });

        switch (weaponId) {
            case 'fists':
                // No model for fists
                break;

            case 'bat': {
                // Wooden baseball bat
                const shaft = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.02, 0.035, 0.55, 6),
                    wood(0x8B5A2B)
                );
                shaft.rotation.x = Math.PI / 2;
                shaft.position.z = 0.25;
                group.add(shaft);
                // Grip tape
                const grip = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.022, 0.022, 0.12, 6),
                    matte(0x222222)
                );
                grip.rotation.x = Math.PI / 2;
                grip.position.z = -0.02;
                group.add(grip);
                break;
            }

            case 'knife': {
                // Combat knife
                const blade = new THREE.Mesh(
                    new THREE.BoxGeometry(0.008, 0.025, 0.18),
                    metal(0xbbccdd)
                );
                blade.position.z = 0.14;
                group.add(blade);
                // Handle
                const handle = new THREE.Mesh(
                    new THREE.BoxGeometry(0.022, 0.032, 0.08),
                    wood(0x332211)
                );
                handle.position.z = 0.01;
                group.add(handle);
                // Guard
                const guard = new THREE.Mesh(
                    new THREE.BoxGeometry(0.04, 0.008, 0.008),
                    metal(0x888888)
                );
                guard.position.z = 0.05;
                group.add(guard);
                break;
            }

            case 'pistol': {
                // Semi-auto pistol
                const slide = new THREE.Mesh(
                    new THREE.BoxGeometry(0.028, 0.032, 0.14),
                    metal(0x2a2a2a)
                );
                slide.position.z = 0.06;
                group.add(slide);
                // Barrel (extends from slide)
                const barrel = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.008, 0.008, 0.04, 6),
                    metal(0x333333)
                );
                barrel.rotation.x = Math.PI / 2;
                barrel.position.z = 0.15;
                group.add(barrel);
                // Grip
                const pGrip = new THREE.Mesh(
                    new THREE.BoxGeometry(0.024, 0.06, 0.03),
                    matte(0x1a1a1a)
                );
                pGrip.position.set(0, -0.04, -0.005);
                pGrip.rotation.x = 0.2;
                group.add(pGrip);
                // Trigger guard
                const tGuard = new THREE.Mesh(
                    new THREE.BoxGeometry(0.003, 0.02, 0.03),
                    metal(0x333333)
                );
                tGuard.position.set(0, -0.018, 0.02);
                group.add(tGuard);
                break;
            }

            case 'smg': {
                // Compact SMG
                const body = new THREE.Mesh(
                    new THREE.BoxGeometry(0.035, 0.04, 0.22),
                    metal(0x222222)
                );
                body.position.z = 0.08;
                group.add(body);
                // Barrel shroud
                const shroud = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6),
                    metal(0x333333)
                );
                shroud.rotation.x = Math.PI / 2;
                shroud.position.z = 0.23;
                group.add(shroud);
                // Grip
                const sGrip = new THREE.Mesh(
                    new THREE.BoxGeometry(0.025, 0.055, 0.025),
                    matte(0x1a1a1a)
                );
                sGrip.position.set(0, -0.04, 0.02);
                sGrip.rotation.x = 0.15;
                group.add(sGrip);
                // Magazine
                const mag = new THREE.Mesh(
                    new THREE.BoxGeometry(0.02, 0.06, 0.015),
                    metal(0x2a2a2a)
                );
                mag.position.set(0, -0.045, 0.08);
                group.add(mag);
                // Folding stock stub
                const stock = new THREE.Mesh(
                    new THREE.BoxGeometry(0.025, 0.015, 0.06),
                    metal(0x2a2a2a)
                );
                stock.position.set(0, 0.01, -0.06);
                group.add(stock);
                break;
            }

            case 'shotgun': {
                // Pump-action shotgun
                const sgBarrel = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6),
                    metal(0x3a3a3a)
                );
                sgBarrel.rotation.x = Math.PI / 2;
                sgBarrel.position.z = 0.22;
                group.add(sgBarrel);
                // Pump tube (underneath)
                const pump = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.01, 0.01, 0.12, 6),
                    metal(0x444444)
                );
                pump.rotation.x = Math.PI / 2;
                pump.position.set(0, -0.02, 0.15);
                group.add(pump);
                // Receiver
                const recv = new THREE.Mesh(
                    new THREE.BoxGeometry(0.035, 0.04, 0.12),
                    metal(0x2a2a2a)
                );
                recv.position.z = -0.02;
                group.add(recv);
                // Stock
                const sgStock = new THREE.Mesh(
                    new THREE.BoxGeometry(0.025, 0.04, 0.18),
                    wood(0x6b4226)
                );
                sgStock.position.set(0, -0.005, -0.17);
                sgStock.rotation.x = -0.08;
                group.add(sgStock);
                // Grip
                const sgGrip = new THREE.Mesh(
                    new THREE.BoxGeometry(0.022, 0.045, 0.02),
                    wood(0x5a3520)
                );
                sgGrip.position.set(0, -0.035, -0.01);
                sgGrip.rotation.x = 0.2;
                group.add(sgGrip);
                break;
            }

            case 'rifle': {
                // Assault rifle
                const rBarrel = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.01, 0.01, 0.3, 6),
                    metal(0x333333)
                );
                rBarrel.rotation.x = Math.PI / 2;
                rBarrel.position.z = 0.28;
                group.add(rBarrel);
                // Handguard
                const handguard = new THREE.Mesh(
                    new THREE.BoxGeometry(0.032, 0.03, 0.16),
                    matte(0x2a2a2a)
                );
                handguard.position.z = 0.18;
                group.add(handguard);
                // Upper/lower receiver
                const rRecv = new THREE.Mesh(
                    new THREE.BoxGeometry(0.035, 0.045, 0.14),
                    metal(0x222222)
                );
                rRecv.position.z = 0.02;
                group.add(rRecv);
                // Magazine
                const rMag = new THREE.Mesh(
                    new THREE.BoxGeometry(0.018, 0.065, 0.018),
                    metal(0x2a2a2a)
                );
                rMag.position.set(0, -0.05, 0.03);
                rMag.rotation.x = 0.1;
                group.add(rMag);
                // Stock
                const rStock = new THREE.Mesh(
                    new THREE.BoxGeometry(0.028, 0.04, 0.14),
                    matte(0x2a2a2a)
                );
                rStock.position.set(0, -0.005, -0.12);
                group.add(rStock);
                // Grip
                const rGrip = new THREE.Mesh(
                    new THREE.BoxGeometry(0.02, 0.04, 0.02),
                    matte(0x1a1a1a)
                );
                rGrip.position.set(0, -0.035, -0.02);
                rGrip.rotation.x = 0.25;
                group.add(rGrip);
                // Front sight
                const fSight = new THREE.Mesh(
                    new THREE.BoxGeometry(0.003, 0.015, 0.003),
                    metal(0x444444)
                );
                fSight.position.set(0, 0.025, 0.25);
                group.add(fSight);
                break;
            }

            case 'sniper': {
                // Bolt-action sniper rifle
                const sBarrel = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.012, 0.01, 0.55, 6),
                    metal(0x333333)
                );
                sBarrel.rotation.x = Math.PI / 2;
                sBarrel.position.z = 0.35;
                group.add(sBarrel);
                // Body
                const sBody = new THREE.Mesh(
                    new THREE.BoxGeometry(0.035, 0.04, 0.25),
                    metal(0x222222)
                );
                sBody.position.z = 0.03;
                group.add(sBody);
                // Scope
                const scope = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.015, 0.015, 0.12, 8),
                    metal(0x111111)
                );
                scope.rotation.x = Math.PI / 2;
                scope.position.set(0, 0.035, 0.06);
                group.add(scope);
                // Scope lens (front)
                const lens = new THREE.Mesh(
                    new THREE.CircleGeometry(0.014, 8),
                    new THREE.MeshStandardMaterial({ color: 0x4488ff, metalness: 0.9, roughness: 0.1 })
                );
                lens.position.set(0, 0.035, 0.12);
                group.add(lens);
                // Bolt handle
                const bolt = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.005, 0.005, 0.025, 4),
                    metal(0x444444)
                );
                bolt.rotation.z = Math.PI / 2;
                bolt.position.set(0.025, 0.01, 0.0);
                group.add(bolt);
                // Stock
                const sStock = new THREE.Mesh(
                    new THREE.BoxGeometry(0.03, 0.045, 0.2),
                    wood(0x5a3520)
                );
                sStock.position.set(0, -0.005, -0.18);
                sStock.rotation.x = -0.05;
                group.add(sStock);
                // Grip
                const sGrip = new THREE.Mesh(
                    new THREE.BoxGeometry(0.02, 0.04, 0.02),
                    matte(0x1a1a1a)
                );
                sGrip.position.set(0, -0.035, -0.03);
                sGrip.rotation.x = 0.25;
                group.add(sGrip);
                // Bipod legs (folded)
                for (const side of [-1, 1]) {
                    const leg = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.003, 0.003, 0.08, 4),
                        metal(0x444444)
                    );
                    leg.rotation.x = Math.PI / 2;
                    leg.position.set(side * 0.015, -0.02, 0.2);
                    group.add(leg);
                }
                break;
            }

            case 'grenade': {
                // Fragmentation grenade
                const gBody = new THREE.Mesh(
                    new THREE.SphereGeometry(0.035, 8, 8),
                    matte(0x445533)
                );
                gBody.position.z = 0.02;
                group.add(gBody);
                // Top cap / spoon
                const cap = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.012, 0.015, 0.025, 6),
                    metal(0x666666)
                );
                cap.position.set(0, 0.035, 0.02);
                group.add(cap);
                // Pin ring
                const ring = new THREE.Mesh(
                    new THREE.TorusGeometry(0.01, 0.002, 4, 8),
                    metal(0x888888)
                );
                ring.position.set(0, 0.05, 0.02);
                ring.rotation.x = Math.PI / 2;
                group.add(ring);
                break;
            }

            case 'atomizer': {
                // Sci-fi energy weapon
                const aBody = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.025, 0.03, 0.2, 8),
                    metal(0x4a3a6a)
                );
                aBody.rotation.x = Math.PI / 2;
                aBody.position.z = 0.08;
                group.add(aBody);
                // Emitter head
                const emitter = new THREE.Mesh(
                    new THREE.SphereGeometry(0.03, 8, 8),
                    new THREE.MeshStandardMaterial({
                        color: 0x6644cc,
                        emissive: 0x4422aa,
                        emissiveIntensity: 0.6,
                        roughness: 0.2,
                        metalness: 0.8
                    })
                );
                emitter.position.z = 0.2;
                group.add(emitter);
                // Energy coils
                for (let i = 0; i < 3; i++) {
                    const coil = new THREE.Mesh(
                        new THREE.TorusGeometry(0.028, 0.003, 4, 8),
                        new THREE.MeshStandardMaterial({
                            color: 0x8866ff,
                            emissive: 0x6644cc,
                            emissiveIntensity: 0.4
                        })
                    );
                    coil.position.z = 0.04 + i * 0.06;
                    group.add(coil);
                }
                // Grip
                const aGrip = new THREE.Mesh(
                    new THREE.BoxGeometry(0.022, 0.05, 0.025),
                    matte(0x2a2a3a)
                );
                aGrip.position.set(0, -0.04, 0.02);
                aGrip.rotation.x = 0.2;
                group.add(aGrip);
                break;
            }
        }

        group.traverse(child => { if (child.isMesh) child.castShadow = true; });
        this._weaponModelCache[weaponId] = group;
        return group.clone();
    }
}

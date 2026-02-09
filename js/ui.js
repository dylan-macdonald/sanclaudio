// San Claudio - UI Manager
// HUD updates, minimap, full map, menus

export class UIManager {
    constructor(game) {
        this.game = game;
        this.minimapCanvas = null;
        this.minimapCtx = null;
        this.fullmapCanvas = null;
        this.fullmapCtx = null;
        this.minimapZoom = 1;

        this.missionTextTimer = 0;
        this.missionTextEl = null;

        // Waypoint
        this.waypoint = null;

        // Weapon wheel
        this.weaponWheelOpen = false;
        this.weaponWheelCanvas = null;
        this.weaponWheelCtx = null;
        this.weaponWheelHovered = -1;

        // Map zoom/pan state
        this.mapZoom = 1.0;
        this.mapPanX = 0;
        this.mapPanZ = 0;
        this.mapDragging = false;
        this.mapDragStartX = 0;
        this.mapDragStartZ = 0;
        this.mapPanStartX = 0;
        this.mapPanStartZ = 0;
    }

    init() {
        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        this.fullmapCanvas = document.getElementById('fullmap-canvas');
        this.fullmapCtx = this.fullmapCanvas.getContext('2d');
        this.weaponWheelCanvas = document.getElementById('weapon-wheel-canvas');
        this.weaponWheelCtx = this.weaponWheelCanvas ? this.weaponWheelCanvas.getContext('2d') : null;
        this.missionTextEl = document.getElementById('hud-mission-text');

        // Weapon wheel mouse tracking
        if (this.weaponWheelCanvas) {
            this.weaponWheelCanvas.addEventListener('mousemove', (e) => {
                if (!this.weaponWheelOpen) return;
                const rect = this.weaponWheelCanvas.getBoundingClientRect();
                const cx = (e.clientX - rect.left) / rect.width * 400 - 200;
                const cy = (e.clientY - rect.top) / rect.height * 400 - 200;
                const dist = Math.sqrt(cx * cx + cy * cy);
                if (dist < 30 || dist > 160) {
                    this.weaponWheelHovered = -1;
                    return;
                }
                let angle = Math.atan2(cy, cx) + Math.PI / 2;
                if (angle < 0) angle += Math.PI * 2;
                const weapons = this.game.systems.player.weapons;
                const sliceAngle = (Math.PI * 2) / weapons.length;
                this.weaponWheelHovered = Math.floor(angle / sliceAngle) % weapons.length;
            });

            this.weaponWheelCanvas.addEventListener('click', (e) => {
                if (this.weaponWheelOpen && this.weaponWheelHovered >= 0) {
                    this.game.systems.player.selectWeapon(this.weaponWheelHovered);
                    this.closeWeaponWheel();
                }
            });
        }

        // Full map click for waypoint (inverse-transformed for zoom/pan)
        this.fullmapCanvas.addEventListener('click', (e) => {
            if (e.button !== 0) return;
            const rect = this.fullmapCanvas.getBoundingClientRect();
            const canvasX = (e.clientX - rect.left) / rect.width * 800;
            const canvasZ = (e.clientY - rect.top) / rect.height * 800;
            // Inverse transform: screen -> world
            const worldX = (canvasX - 400) / this.mapZoom + this.mapPanX;
            const worldZ = (canvasZ - 400) / this.mapZoom + this.mapPanZ;
            this.waypoint = { x: worldX, z: worldZ };
        });

        // Map zoom with mouse wheel
        this.fullmapCanvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
            this.mapZoom = Math.max(0.5, Math.min(8.0, this.mapZoom * zoomFactor));
        }, { passive: false });

        // Map pan with right-click drag
        this.fullmapCanvas.addEventListener('mousedown', (e) => {
            if (e.button === 2) {
                this.mapDragging = true;
                this.mapDragStartX = e.clientX;
                this.mapDragStartZ = e.clientY;
                this.mapPanStartX = this.mapPanX;
                this.mapPanStartZ = this.mapPanZ;
                e.preventDefault();
            }
        });
        window.addEventListener('mousemove', (e) => {
            if (this.mapDragging) {
                const dx = (e.clientX - this.mapDragStartX) / this.mapZoom;
                const dz = (e.clientY - this.mapDragStartZ) / this.mapZoom;
                this.mapPanX = this.mapPanStartX - dx;
                this.mapPanZ = this.mapPanStartZ - dz;
            }
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 2) this.mapDragging = false;
        });
        this.fullmapCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Pause menu buttons
        document.querySelectorAll('.menu-btn[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.handleMenuAction(btn.dataset.action);
            });
        });

        // Close buttons
        document.getElementById('close-controls')?.addEventListener('click', () => {
            document.getElementById('controls-help').style.display = 'none';
            document.getElementById('pause-menu').style.display = 'flex';
        });

        document.getElementById('close-stats')?.addEventListener('click', () => {
            document.getElementById('stats-screen').style.display = 'none';
            document.getElementById('pause-menu').style.display = 'flex';
        });
    }

    update(dt) {
        this.updateHUD();
        this.updateMinimap();
        this.updateMissionText(dt);
        this.checkWaypoint();
        this.updateDistrictDisplay(dt);
        this.updateBreathMeter();
    }

    updateHUD() {
        const player = this.game.systems.player;
        const veh = this.game.systems.vehicles;

        // Health
        const healthFill = document.getElementById('hud-health-fill');
        healthFill.style.width = (player.health / player.maxHealth * 100) + '%';

        // Armor
        const armorFill = document.getElementById('hud-armor-fill');
        armorFill.style.width = (player.armor / player.maxArmor * 100) + '%';

        // Cash
        const cashEl = document.getElementById('hud-cash');
        cashEl.textContent = '$' + player.cash.toLocaleString();

        // Weapon
        const weapon = player.getCurrentWeapon();
        const weaponDef = this.game.systems.weapons.weaponDefs[weapon.id];
        const weaponIcon = document.getElementById('weapon-icon');
        const weaponAmmo = document.getElementById('weapon-ammo');
        weaponIcon.textContent = weaponDef ? weaponDef.icon : 'FISTS';
        if (weapon.ammo !== Infinity && weapon.ammo !== undefined) {
            weaponAmmo.textContent = weapon.ammo;
        } else {
            weaponAmmo.textContent = '';
        }

        // Speed display
        const speedEl = document.getElementById('hud-speed');
        if (!player.inVehicle) {
            speedEl.style.display = 'none';
        } else {
            // Show speed for normal (non-drift) driving
            if (!veh.isDrifting) {
                const speed = player.currentVehicle ? Math.abs(Math.round(player.currentVehicle.speed * 3.6)) : 0;
                speedEl.textContent = speed + ' km/h';
                speedEl.style.display = 'block';
            }
        }

        // FPS
        const fpsEl = document.getElementById('hud-fps');
        if (fpsEl.style.display !== 'none') {
            fpsEl.textContent = this.game.fps + ' FPS';
        }

        // Radio station display
        if (this.game.systems.vehicles.radioDisplayTimer > 0 && this.game.systems.player.inVehicle) {
            const vehicles = this.game.systems.vehicles;
            const station = vehicles.radioStations[vehicles.radioStation];
            const alpha = Math.min(1, vehicles.radioDisplayTimer);

            const radioEl = document.getElementById('hud-radio');
            if (radioEl) {
                radioEl.style.display = 'block';
                radioEl.style.opacity = alpha;
                if (station.genre === 'off') {
                    radioEl.innerHTML = '<span style="color:#888">Radio Off</span>';
                } else {
                    const song = station.songs[vehicles.currentSongIndex];
                    radioEl.innerHTML = `<span style="color:#ffcc44;font-size:14px">${station.name}</span><br><span style="color:#aaa;font-size:11px">\u266A ${song}</span>`;
                }
            }
        } else {
            const radioEl = document.getElementById('hud-radio');
            if (radioEl) radioEl.style.display = 'none';
        }

        // Drift score display
        if (veh.isDrifting && player.inVehicle) {
            const score = Math.floor(veh.driftScore * veh.driftMultiplier);
            const multiplierColor = veh.driftMultiplier >= 4 ? '#ff4444' :
                                    veh.driftMultiplier >= 3 ? '#ff8844' :
                                    veh.driftMultiplier >= 2 ? '#ffcc44' : '#ffffff';
            speedEl.innerHTML = `${Math.abs(Math.round(player.currentVehicle.speed * 3.6))} km/h<br>` +
                `<span style="color:${multiplierColor};font-size:18px;font-weight:bold">DRIFT ${score}</span>` +
                (veh.driftMultiplier > 1 ? `<span style="color:${multiplierColor}"> x${veh.driftMultiplier}</span>` : '');
            speedEl.style.display = 'block';
        }
    }

    updateMinimap() {
        const ctx = this.minimapCtx;
        const size = 200;
        const player = this.game.systems.player;
        const scale = 0.5 * this.minimapZoom;

        ctx.clearRect(0, 0, size, size);

        // Background
        ctx.fillStyle = 'rgba(20, 25, 30, 0.9)';
        ctx.beginPath();
        ctx.arc(100, 100, 100, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(100, 100);

        // Rotate with player heading
        const cam = this.game.systems.camera;
        ctx.rotate(-cam.yaw);

        // Draw roads
        ctx.strokeStyle = 'rgba(80, 80, 80, 0.6)';
        ctx.lineWidth = 2;
        const blockSize = this.game.systems.world.blockSize;
        for (let g = -400; g < 400; g += blockSize) {
            const rx = (g - player.position.x) * scale;
            const rz = (g - player.position.z) * scale;
            // Vertical road lines
            ctx.beginPath();
            ctx.moveTo(rx, -100);
            ctx.lineTo(rx, 100);
            ctx.stroke();
            // Horizontal road lines
            ctx.beginPath();
            ctx.moveTo(-100, rz);
            ctx.lineTo(100, rz);
            ctx.stroke();
        }

        // Draw buildings (simplified rects)
        const buildings = this.game.systems.world.colliders;
        ctx.fillStyle = 'rgba(100, 100, 120, 0.4)';
        for (const b of buildings) {
            if (b.type !== 'building') continue;
            const bx = (b.minX + b.maxX) / 2;
            const bz = (b.minZ + b.maxZ) / 2;
            const rx = (bx - player.position.x) * scale;
            const rz = (bz - player.position.z) * scale;
            const w = (b.maxX - b.minX) * scale;
            const h = (b.maxZ - b.minZ) * scale;

            if (Math.abs(rx) < 110 && Math.abs(rz) < 110) {
                ctx.fillRect(rx - w / 2, rz - h / 2, w, h);
            }
        }

        // Draw NPCs (gray dots)
        const npcs = this.game.systems.npcs;
        ctx.fillStyle = 'rgba(150, 150, 150, 0.5)';
        for (const npc of npcs.pedestrians) {
            if (!npc.alive || !npc.mesh) continue;
            const nx = (npc.mesh.position.x - player.position.x) * scale;
            const nz = (npc.mesh.position.z - player.position.z) * scale;
            if (Math.abs(nx) < 100 && Math.abs(nz) < 100) {
                ctx.beginPath();
                ctx.arc(nx, nz, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Draw vehicles (small rects)
        ctx.fillStyle = 'rgba(200, 200, 100, 0.5)';
        for (const v of this.game.systems.vehicles.vehicles) {
            if (!v.mesh) continue;
            const vx = (v.mesh.position.x - player.position.x) * scale;
            const vz = (v.mesh.position.z - player.position.z) * scale;
            if (Math.abs(vx) < 100 && Math.abs(vz) < 100) {
                ctx.fillRect(vx - 2, vz - 1.5, 4, 3);
            }
        }

        // Draw POI icons
        this._drawMinimapPOIs(ctx, player, scale);

        // Draw police (blue dots)
        ctx.fillStyle = '#4488ff';
        const policeUnits = this.game.systems.wanted.policeUnits;
        for (const unit of policeUnits) {
            if (!unit.mesh || !unit.alive) continue;
            const px = (unit.mesh.position.x - player.position.x) * scale;
            const pz = (unit.mesh.position.z - player.position.z) * scale;
            if (Math.abs(px) < 100 && Math.abs(pz) < 100) {
                ctx.beginPath();
                ctx.arc(px, pz, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Draw wanted radius
        if (this.game.systems.wanted.level > 0) {
            const radius = this.game.systems.wanted.wantedRadius[this.game.systems.wanted.level] * scale;
            ctx.strokeStyle = 'rgba(255, 50, 50, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, Math.min(radius, 100), 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw waypoint
        if (this.waypoint) {
            const wx = (this.waypoint.x - player.position.x) * scale;
            const wz = (this.waypoint.z - player.position.z) * scale;
            ctx.fillStyle = '#ff4444';
            ctx.beginPath();
            ctx.arc(wx, wz, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        // Draw player arrow (always center, points up = forward)
        ctx.fillStyle = '#ffffff';
        ctx.save();
        ctx.translate(100, 100);
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(-4, 4);
        ctx.lineTo(4, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Compass
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '10px Rajdhani';
        ctx.textAlign = 'center';
        ctx.fillText('N', 100, 15);

        // Street name at bottom of minimap
        const streetName = this._getStreetName(player.position.x, player.position.z);
        if (streetName) {
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = 'bold 9px Rajdhani';
            ctx.textAlign = 'center';
            ctx.fillText(streetName, 100, 193);
        }
    }

    _drawMinimapPOIs(ctx, player, scale) {
        const iconSize = 4;

        // Weapon shops (gun icon = small crosshair)
        const weapons = this.game.systems.weapons;
        if (weapons && weapons.shops) {
            for (const shop of weapons.shops) {
                if (!shop.position) continue;
                const sx = (shop.position.x - player.position.x) * scale;
                const sz = (shop.position.z - player.position.z) * scale;
                if (Math.abs(sx) > 95 || Math.abs(sz) > 95) continue;
                // Gun icon — small orange crosshair
                ctx.strokeStyle = '#ff8800';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(sx - iconSize, sz);
                ctx.lineTo(sx + iconSize, sz);
                ctx.moveTo(sx, sz - iconSize);
                ctx.lineTo(sx, sz + iconSize);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(sx, sz, iconSize - 1, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // Pay N Spray locations (green spray icon = circle with dot)
        const wanted = this.game.systems.wanted;
        if (wanted && wanted.payNSprayLocations) {
            for (const pns of wanted.payNSprayLocations) {
                const px = (pns.x - player.position.x) * scale;
                const pz = (pns.z - player.position.z) * scale;
                if (Math.abs(px) > 95 || Math.abs(pz) > 95) continue;
                ctx.fillStyle = '#00ff88';
                ctx.strokeStyle = '#00ff88';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(px, pz, iconSize, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(px, pz, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Garage (wrench icon = 'G' letter)
        const vehicles = this.game.systems.vehicles;
        if (vehicles && vehicles.garagePos) {
            const gx = (vehicles.garagePos.x - player.position.x) * scale;
            const gz = (vehicles.garagePos.z - player.position.z) * scale;
            if (Math.abs(gx) < 95 && Math.abs(gz) < 95) {
                ctx.fillStyle = '#44aaff';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('G', gx, gz);
                ctx.textBaseline = 'alphabetic';
            }
        }

        // Mission markers (yellow dots)
        const missions = this.game.systems.missions;
        if (missions && missions.markers) {
            ctx.fillStyle = '#ffcc00';
            for (const m of missions.markers) {
                if (!m.mesh || !m.mesh.visible) continue;
                const mx = (m.mesh.position.x - player.position.x) * scale;
                const mz = (m.mesh.position.z - player.position.z) * scale;
                if (Math.abs(mx) > 95 || Math.abs(mz) > 95) continue;
                ctx.beginPath();
                ctx.arc(mx, mz, 3.5, 0, Math.PI * 2);
                ctx.fill();
                // 'M' letter
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 6px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('M', mx, mz);
                ctx.textBaseline = 'alphabetic';
                ctx.fillStyle = '#ffcc00';
            }
        }
    }

    _getStreetName(x, z) {
        const blockSize = this.game.systems.world.blockSize;
        const roadWidth = this.game.systems.world.roadWidth;
        const roadHalf = roadWidth / 2;

        // Check if on a road (close to a grid line)
        const nearestGridX = Math.round(x / blockSize) * blockSize;
        const nearestGridZ = Math.round(z / blockSize) * blockSize;
        const distToXRoad = Math.abs(x - nearestGridX);
        const distToZRoad = Math.abs(z - nearestGridZ);

        // Street name arrays — NS streets named, EW streets numbered
        const nsStreetNames = [
            'Ocean Dr', 'Palm Ave', 'Main St', 'Market St', 'Broadway',
            'Pacific Blvd', 'Harbor Rd', 'Industrial Way', 'Elm St', 'Oak Ave',
            'Cedar Dr', 'Pine Rd', 'Vine St', 'Liberty Ave', 'Franklin Blvd',
            'Mission St', 'Valencia Ave'
        ];

        const nsIndex = Math.round(x / blockSize) + 8; // Offset so center is ~8
        const ewIndex = Math.round(z / blockSize) + 8;

        const onXRoad = distToXRoad < roadHalf;
        const onZRoad = distToZRoad < roadHalf;

        if (onXRoad && onZRoad) {
            // At intersection
            const nsName = nsStreetNames[Math.abs(nsIndex) % nsStreetNames.length];
            const ewNum = Math.abs(ewIndex) + 1;
            const suffix = ewNum === 1 ? 'st' : ewNum === 2 ? 'nd' : ewNum === 3 ? 'rd' : 'th';
            return `${nsName} & ${ewNum}${suffix} St`;
        } else if (onXRoad) {
            const nsName = nsStreetNames[Math.abs(nsIndex) % nsStreetNames.length];
            return nsName;
        } else if (onZRoad) {
            const ewNum = Math.abs(ewIndex) + 1;
            const suffix = ewNum === 1 ? 'st' : ewNum === 2 ? 'nd' : ewNum === 3 ? 'rd' : 'th';
            return `${ewNum}${suffix} Street`;
        }

        // Not on a road — show district name
        return this._getDistrictName(x, z);
    }

    _getDistrictName(x, z) {
        // Use world.js getDistrictName if available
        const world = this.game.systems.world;
        if (world && world.getDistrictName) {
            return world.getDistrictName(x, z);
        }
        return '';
    }

    showFullMap() {
        document.getElementById('full-map').style.display = 'flex';
        // Center on player
        const player = this.game.systems.player;
        this.mapPanX = player.position.x;
        this.mapPanZ = player.position.z;
        this.drawFullMap();
    }

    hideFullMap() {
        document.getElementById('full-map').style.display = 'none';
    }

    drawFullMap() {
        const ctx = this.fullmapCtx;
        const size = 800;
        const zoom = this.mapZoom;
        const panX = this.mapPanX;
        const panZ = this.mapPanZ;

        ctx.clearRect(0, 0, size, size);

        // Background
        ctx.fillStyle = '#1a1a2a';
        ctx.fillRect(0, 0, size, size);

        // Apply zoom/pan transform: world coords -> screen coords
        ctx.save();
        ctx.translate(size / 2, size / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-panX, -panZ);

        // World-space scale: 1 world unit = 1 canvas pixel (before zoom)
        // District colors
        const districts = this.game.systems.world.districts;
        for (const [key, d] of Object.entries(districts)) {
            ctx.fillStyle = 'rgba(' + this.hexToRGB(d.colors[0]) + ', 0.3)';
            ctx.fillRect(d.bounds.minX, d.bounds.minZ,
                d.bounds.maxX - d.bounds.minX, d.bounds.maxZ - d.bounds.minZ);

            // District label - scale inversely so text stays readable
            ctx.save();
            const cx = (d.bounds.minX + d.bounds.maxX) / 2;
            const cz = (d.bounds.minZ + d.bounds.maxZ) / 2;
            ctx.translate(cx, cz);
            ctx.scale(1 / zoom, 1 / zoom);
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = 'bold 18px Rajdhani';
            ctx.textAlign = 'center';
            ctx.fillText(d.name, 0, 6);
            ctx.restore();
        }

        // Water area
        ctx.fillStyle = 'rgba(34, 102, 170, 0.4)';
        ctx.fillRect(100, 100, 300, 300);

        // Road grid lines
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.6)';
        ctx.lineWidth = 1.5 / zoom;
        const blockSize = this.game.systems.world.blockSize;
        for (let g = -400; g <= 400; g += blockSize) {
            ctx.beginPath();
            ctx.moveTo(g, -400);
            ctx.lineTo(g, 400);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-400, g);
            ctx.lineTo(400, g);
            ctx.stroke();
        }

        // Buildings
        ctx.fillStyle = 'rgba(100, 100, 120, 0.5)';
        for (const b of this.game.systems.world.colliders) {
            if (b.type !== 'building') continue;
            ctx.fillRect(b.minX, b.minZ, b.maxX - b.minX, b.maxZ - b.minZ);
        }

        // Vehicles
        ctx.fillStyle = 'rgba(200, 200, 100, 0.5)';
        for (const v of this.game.systems.vehicles.vehicles) {
            if (!v.mesh) continue;
            ctx.fillRect(v.mesh.position.x - 2, v.mesh.position.z - 1.5, 4, 3);
        }

        // NPCs
        ctx.fillStyle = 'rgba(150, 150, 150, 0.4)';
        const npcs = this.game.systems.npcs;
        if (npcs) {
            for (const npc of npcs.pedestrians) {
                if (!npc.alive || !npc.mesh) continue;
                ctx.beginPath();
                ctx.arc(npc.mesh.position.x, npc.mesh.position.z, 1.5 / zoom, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Mission markers
        const missions = this.game.systems.missions;
        if (missions && missions.missionDefs) {
            ctx.fillStyle = '#ffaa00';
            for (const m of missions.missionDefs) {
                if (missions.completedMissions.has(m.id) || !m.markerPos) continue;
                ctx.save();
                ctx.translate(m.markerPos.x, m.markerPos.z);
                ctx.rotate(Math.PI / 4);
                const ds = 4 / zoom;
                ctx.fillRect(-ds, -ds, ds * 2, ds * 2);
                ctx.restore();
            }
        }

        // POI Icons on full map
        this._drawFullMapPOIs(ctx, zoom);

        // Player indicator
        const player = this.game.systems.player;
        const cam = this.game.systems.camera;
        const playerYaw = cam ? -cam.yaw : 0;

        ctx.save();
        ctx.translate(player.position.x, player.position.z);
        ctx.rotate(playerYaw);
        const ps = 1 / zoom;
        ctx.scale(ps, ps);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(-5, 6);
        ctx.lineTo(0, 3);
        ctx.lineTo(5, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Waypoint
        if (this.waypoint) {
            const wr = 6 / zoom;
            ctx.fillStyle = '#ff4444';
            ctx.beginPath();
            ctx.arc(this.waypoint.x, this.waypoint.z, wr, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 2 / zoom;
            ctx.stroke();

            // Line from player to waypoint
            ctx.beginPath();
            ctx.setLineDash([4 / zoom, 4 / zoom]);
            ctx.strokeStyle = 'rgba(255, 68, 68, 0.5)';
            ctx.moveTo(player.position.x, player.position.z);
            ctx.lineTo(this.waypoint.x, this.waypoint.z);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.restore();
    }

    updateFullMap() {
        this.drawFullMap();
    }

    _drawFullMapPOIs(ctx, zoom) {
        const iconScale = 1 / zoom;

        // Weapon shops — orange gun icon
        const weapons = this.game.systems.weapons;
        if (weapons && weapons.shops) {
            for (const shop of weapons.shops) {
                if (!shop.position) continue;
                ctx.save();
                ctx.translate(shop.position.x, shop.position.z);
                ctx.scale(iconScale, iconScale);
                // Crosshair
                ctx.strokeStyle = '#ff8800';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, 6, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(-8, 0); ctx.lineTo(8, 0);
                ctx.moveTo(0, -8); ctx.lineTo(0, 8);
                ctx.stroke();
                // Label
                ctx.fillStyle = '#ff8800';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Ammu-Nation', 0, -12);
                ctx.restore();
            }
        }

        // Pay N Spray — green spray icon
        const wanted = this.game.systems.wanted;
        if (wanted && wanted.payNSprayLocations) {
            for (const pns of wanted.payNSprayLocations) {
                ctx.save();
                ctx.translate(pns.x, pns.z);
                ctx.scale(iconScale, iconScale);
                ctx.fillStyle = '#00ff88';
                ctx.strokeStyle = '#00ff88';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, 7, 0, Math.PI * 2);
                ctx.stroke();
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('$', 0, 1);
                ctx.textBaseline = 'alphabetic';
                // Label
                ctx.font = 'bold 10px Arial';
                ctx.fillText('Pay N Spray', 0, -12);
                ctx.restore();
            }
        }

        // Garage — blue G icon
        const vehicles = this.game.systems.vehicles;
        if (vehicles && vehicles.garagePos) {
            ctx.save();
            ctx.translate(vehicles.garagePos.x, vehicles.garagePos.z);
            ctx.scale(iconScale, iconScale);
            ctx.fillStyle = '#44aaff';
            ctx.strokeStyle = '#44aaff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('G', 0, 1);
            ctx.textBaseline = 'alphabetic';
            ctx.font = 'bold 10px Arial';
            ctx.fillText('Garage', 0, -12);
            ctx.restore();
        }
    }

    hexToRGB(hex) {
        const r = (hex >> 16) & 255;
        const g = (hex >> 8) & 255;
        const b = hex & 255;
        return `${r}, ${g}, ${b}`;
    }

    showMissionText(text, duration) {
        this.missionTextEl.textContent = text;
        this.missionTextEl.classList.add('visible');
        this.missionTextTimer = duration || 3;
    }

    updateMissionText(dt) {
        if (this.missionTextTimer > 0) {
            this.missionTextTimer -= dt;
            if (this.missionTextTimer <= 0) {
                this.missionTextEl.classList.remove('visible');
            }
        }
    }

    updateDistrictDisplay(dt) {
        const player = this.game.systems.player;
        const world = this.game.systems.world;
        const districtName = world.getDistrictName(player.position.x, player.position.z);
        const el = document.getElementById('hud-district');
        if (!el) return;

        if (districtName !== this._lastDistrict) {
            this._lastDistrict = districtName;
            el.textContent = districtName;
            el.classList.add('visible');

            // Fade out after 3 seconds
            clearTimeout(this._districtTimer);
            this._districtTimer = setTimeout(() => {
                el.classList.remove('visible');
            }, 3000);
        }
    }

    updateBreathMeter() {
        const player = this.game.systems.player;
        const breathEl = document.getElementById('hud-breath');
        const breathFill = document.getElementById('hud-breath-fill');
        if (!breathEl || !breathFill) return;

        if (player.isSwimming) {
            breathEl.style.display = 'block';
            // Show breath based on drown timer (5 seconds max)
            const drownTimer = player._drownTimer || 0;
            const breathPct = Math.max(0, 1 - drownTimer / 5);
            breathFill.style.width = (breathPct * 100) + '%';

            // Color change when low
            if (breathPct < 0.3) {
                breathFill.style.background = '#dd4444';
            } else {
                breathFill.style.background = '#44aadd';
            }
        } else {
            breathEl.style.display = 'none';
        }
    }

    checkWaypoint() {
        if (!this.waypoint) return;
        const player = this.game.systems.player;
        const dist = Math.sqrt(
            (player.position.x - this.waypoint.x) ** 2 +
            (player.position.z - this.waypoint.z) ** 2
        );
        if (dist < 10) {
            this.waypoint = null;
        }
    }

    handleMenuAction(action) {
        switch (action) {
            case 'resume':
                this.game.setState('playing');
                document.getElementById('pause-menu').style.display = 'none';
                break;
            case 'save':
                this.game.systems.save.save();
                this.showMissionText('Game Saved', 2);
                break;
            case 'load':
                this.game.systems.save.load();
                this.game.setState('playing');
                document.getElementById('pause-menu').style.display = 'none';
                this.showMissionText('Game Loaded', 2);
                break;
            case 'controls':
                document.getElementById('pause-menu').style.display = 'none';
                document.getElementById('controls-help').style.display = 'flex';
                break;
            case 'stats':
                document.getElementById('pause-menu').style.display = 'none';
                this.showStats();
                break;
            case 'credits':
                document.getElementById('pause-menu').style.display = 'none';
                this.game.setState('playing');
                this.showCredits();
                break;
            case 'newgame':
                this.showConfirm('Are you sure? All progress will be lost.', () => {
                    this.game.systems.save.clear();
                    location.reload();
                });
                break;
        }
    }

    showStats() {
        const s = this.game.stats;
        const p = this.game.systems.player;
        const content = document.getElementById('stats-content');

        const hours = Math.floor(s.playtime / 3600);
        const mins = Math.floor((s.playtime % 3600) / 60);
        const secs = Math.floor(s.playtime % 60);
        const timeStr = hours > 0 ? `${hours}h ${mins}m ${secs}s` : `${mins}m ${secs}s`;

        content.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;text-align:left;">
                <span style="color:#888">Playtime</span><span>${timeStr}</span>
                <span style="color:#888">Cash</span><span style="color:#4c4">$${Math.floor(p.cash).toLocaleString()}</span>
                <span style="color:#888">Missions Complete</span><span>${s.missionsComplete}/15</span>
                <span style="color:#888">Side Missions</span><span>${s.sideMissionsComplete}</span>
                <span style="color:#888">Strangers & Freaks</span><span>${s.strangersComplete}</span>
                <span style="color:#888">Total Kills</span><span>${s.totalKills}</span>
                <span style="color:#888">Vehicles Stolen</span><span>${s.vehiclesStolen}</span>
                <span style="color:#888">Distance Walked</span><span>${(s.distanceWalked / 1000).toFixed(1)} km</span>
                <span style="color:#888">Distance Driven</span><span>${(s.distanceDriven / 1000).toFixed(1)} km</span>
                <span style="color:#888">Max Wanted Survived</span><span>${'★'.repeat(s.maxWantedSurvived)}${'☆'.repeat(5 - s.maxWantedSurvived)}</span>
                <span style="color:#888">Stunt Jumps</span><span>${s.stuntJumpsCompleted}/10</span>
                <span style="color:#888">Vehicles Collected</span><span>${s.vehiclesCollected}/5</span>
                <span style="color:#888">Properties Owned</span><span>${s.propertiesOwned}/5</span>
                <span style="color:#888">Hidden Packages</span><span>${s.hiddenPackagesFound}/20</span>
            </div>
        `;
        document.getElementById('stats-screen').style.display = 'flex';
    }

    showConfirm(text, onConfirm) {
        document.getElementById('confirm-text').textContent = text;
        document.getElementById('confirm-dialog').style.display = 'block';

        const yesBtn = document.getElementById('confirm-yes');
        const noBtn = document.getElementById('confirm-no');

        const cleanup = () => {
            document.getElementById('confirm-dialog').style.display = 'none';
            yesBtn.removeEventListener('click', yesHandler);
            noBtn.removeEventListener('click', noHandler);
        };

        const yesHandler = () => { cleanup(); onConfirm(); };
        const noHandler = () => { cleanup(); };

        yesBtn.addEventListener('click', yesHandler);
        noBtn.addEventListener('click', noHandler);
    }

    openWeaponWheel() {
        this.weaponWheelOpen = true;
        document.getElementById('weapon-wheel').style.display = 'flex';
        this.drawWeaponWheel();
    }

    closeWeaponWheel() {
        this.weaponWheelOpen = false;
        this.weaponWheelHovered = -1;
        document.getElementById('weapon-wheel').style.display = 'none';
    }

    updateWeaponWheel() {
        if (this.weaponWheelOpen) {
            this.drawWeaponWheel();
        }
    }

    drawWeaponWheel() {
        const ctx = this.weaponWheelCtx;
        if (!ctx) return;
        const size = 400;
        const cx = size / 2;
        const cy = size / 2;

        ctx.clearRect(0, 0, size, size);

        const weapons = this.game.systems.player.weapons;
        const weaponDefs = this.game.systems.weapons.weaponDefs;
        const currentIdx = this.game.systems.player.currentWeaponIndex;
        const sliceAngle = (Math.PI * 2) / weapons.length;

        // Background circle
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.arc(cx, cy, 160, 0, Math.PI * 2);
        ctx.fill();

        // Inner circle
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.beginPath();
        ctx.arc(cx, cy, 35, 0, Math.PI * 2);
        ctx.fill();

        for (let i = 0; i < weapons.length; i++) {
            const startAngle = i * sliceAngle - Math.PI / 2;
            const endAngle = startAngle + sliceAngle;
            const midAngle = startAngle + sliceAngle / 2;

            const isHovered = i === this.weaponWheelHovered;
            const isCurrent = i === currentIdx;

            // Draw slice
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, 150, startAngle, endAngle);
            ctx.closePath();

            if (isHovered) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            } else if (isCurrent) {
                ctx.fillStyle = 'rgba(232, 200, 64, 0.1)';
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
            }
            ctx.fill();

            // Slice border
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            const bx = cx + Math.cos(startAngle) * 150;
            const by = cy + Math.sin(startAngle) * 150;
            ctx.lineTo(bx, by);
            ctx.stroke();

            // Weapon icon/label
            const def = weaponDefs[weapons[i].id];
            const labelR = 95;
            const lx = cx + Math.cos(midAngle) * labelR;
            const ly = cy + Math.sin(midAngle) * labelR;

            // Weapon type color
            const typeColors = {
                melee: '#ff8844',
                ranged: '#4488ff',
                thrown: '#44ff44',
                special: '#aa44ff'
            };

            ctx.fillStyle = isHovered ? '#ffffff' : (isCurrent ? '#e8c840' : 'rgba(255,255,255,0.6)');
            ctx.font = 'bold 14px Rajdhani';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(def ? def.icon : weapons[i].id.toUpperCase(), lx, ly - 6);

            // Ammo count
            if (weapons[i].ammo !== Infinity && weapons[i].ammo !== undefined) {
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.font = '11px Space Mono';
                ctx.fillText(weapons[i].ammo.toString(), lx, ly + 12);
            }

            // Type indicator dot
            if (def) {
                ctx.fillStyle = typeColors[def.type] || '#ffffff';
                ctx.beginPath();
                ctx.arc(lx, ly + 24, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Center text
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '10px Rajdhani';
        ctx.textAlign = 'center';
        if (this.weaponWheelHovered >= 0 && weapons[this.weaponWheelHovered]) {
            const hoveredDef = weaponDefs[weapons[this.weaponWheelHovered].id];
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Rajdhani';
            ctx.fillText(hoveredDef ? hoveredDef.icon : '', cx, cy);
        }

        // Outer ring
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 150, 0, Math.PI * 2);
        ctx.stroke();
    }

    showCredits() {
        const creditsEl = document.getElementById('credits-screen');
        const contentEl = document.getElementById('credits-content');
        if (!creditsEl || !contentEl) return;

        contentEl.innerHTML = `
            <div style="height:50vh"></div>
            <h1 style="font-size:3rem;color:#e8c840;margin-bottom:0.5em;">SAN CLAUDIO</h1>
            <p style="font-size:1rem;color:rgba(255,255,255,0.4);margin-bottom:3em;">A Claude Production</p>

            <h2 style="color:#e8c840;margin-bottom:0.5em;">DIRECTOR</h2>
            <p>Claude</p>
            <br>

            <h2 style="color:#e8c840;margin-bottom:0.5em;">LEAD PROGRAMMING</h2>
            <p>Claude Opus 4.6</p>
            <br>

            <h2 style="color:#e8c840;margin-bottom:0.5em;">GAME DESIGN</h2>
            <p>Claude</p>
            <p>macdonaldd</p>
            <br>

            <h2 style="color:#e8c840;margin-bottom:0.5em;">ENGINE</h2>
            <p>Three.js r128</p>
            <p>Rapier.js 3D Physics</p>
            <p>Web Audio API</p>
            <br>

            <h2 style="color:#e8c840;margin-bottom:0.5em;">WORLD DESIGN</h2>
            <p>Procedural City Generation</p>
            <p>9 Unique Districts</p>
            <p>Dynamic Weather & Day/Night</p>
            <br>

            <h2 style="color:#e8c840;margin-bottom:0.5em;">AUDIO</h2>
            <p>Procedural Radio Stations</p>
            <p>Animalese Voice System</p>
            <p>Dynamic Sound Effects</p>
            <br>

            <h2 style="color:#e8c840;margin-bottom:0.5em;">SYSTEMS</h2>
            <p>15 Story Missions</p>
            <p>Side Missions & Random Encounters</p>
            <p>10 Weapons & Weapon Wheel</p>
            <p>5 Vehicle Types</p>
            <p>5-Star Wanted System</p>
            <p>Ragdoll Physics</p>
            <p>Stunt Jumps</p>
            <br>

            <h2 style="color:#e8c840;margin-bottom:0.5em;">SPECIAL THANKS</h2>
            <p>Anthropic</p>
            <p>The Open Source Community</p>
            <p>You, the Player</p>
            <br><br>

            <p style="font-size:1.5rem;color:#e8c840;">Thank you for playing</p>
            <p style="font-size:1rem;color:rgba(255,255,255,0.4);">San Claudio</p>
            <div style="height:100vh"></div>
        `;

        creditsEl.style.display = 'flex';

        // Close on any key
        const closeHandler = () => {
            creditsEl.style.display = 'none';
            document.removeEventListener('keydown', closeHandler);
        };
        setTimeout(() => {
            document.addEventListener('keydown', closeHandler);
        }, 2000);

        // Auto-close after scroll finishes
        setTimeout(() => {
            creditsEl.style.display = 'none';
            document.removeEventListener('keydown', closeHandler);
        }, 32000);
    }

    // --- Clothing Shop UI ---
    openClothingShop(storeName) {
        const player = this.game.systems.player;
        this._clothingShopOpen = true;

        if (!this._clothingShopEl) {
            this._clothingShopEl = document.createElement('div');
            this._clothingShopEl.id = 'clothing-shop-ui';
            this._clothingShopEl.style.cssText = `
                position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
                width: 340px; background: rgba(10,10,20,0.95);
                border: 2px solid rgba(255,68,204,0.6); border-radius: 12px;
                padding: 24px; z-index: 200; font-family: Rajdhani, sans-serif;
                box-shadow: 0 0 40px rgba(255,68,204,0.3);
            `;
            document.body.appendChild(this._clothingShopEl);
        }
        this._clothingShopEl.style.display = 'block';
        this._drawClothingShopUI(storeName);

        // Pause player movement
        this.game.systems.input._clothingShopBlock = true;
    }

    closeClothingShop() {
        this._clothingShopOpen = false;
        if (this._clothingShopEl) {
            this._clothingShopEl.style.display = 'none';
        }
        this.game.systems.input._clothingShopBlock = false;
        // Clean up escape key listener
        if (this._csEscHandler) {
            document.removeEventListener('keydown', this._csEscHandler);
            this._csEscHandler = null;
        }
    }

    _drawClothingShopUI(storeName) {
        const player = this.game.systems.player;
        const a = player.appearance;

        const shirtHex = '#' + a.shirtColor.toString(16).padStart(6, '0');
        const pantsHex = '#' + a.pantsColor.toString(16).padStart(6, '0');

        const html = `
            <div style="color:#ff44cc;font-size:18px;text-align:center;margin-bottom:14px;border-bottom:1px solid rgba(255,68,204,0.3);padding-bottom:10px;">
                ${storeName || 'CLOTHING STORE'}
            </div>
            <div style="color:#aaa;font-size:12px;text-align:center;margin-bottom:16px;">
                Cash: <span style="color:#4c4">$${player.cash.toLocaleString()}</span>
            </div>

            <div style="margin-bottom:14px;">
                <label style="color:#ddd;font-size:13px;display:flex;align-items:center;justify-content:space-between;">
                    Shirt Color — $100
                    <input type="color" id="cs-shirt-color" value="${shirtHex}"
                        style="width:50px;height:28px;border:1px solid #555;background:#222;cursor:pointer;">
                </label>
            </div>

            <div style="margin-bottom:14px;">
                <label style="color:#ddd;font-size:13px;display:flex;align-items:center;justify-content:space-between;">
                    Pants Color — $100
                    <input type="color" id="cs-pants-color" value="${pantsHex}"
                        style="width:50px;height:28px;border:1px solid #555;background:#222;cursor:pointer;">
                </label>
            </div>

            <div style="margin-bottom:14px;">
                <label style="color:#ddd;font-size:13px;display:flex;align-items:center;justify-content:space-between;">
                    Hat — $200
                    <button id="cs-hat-btn" style="padding:4px 16px;background:${a.hasHat ? '#ff44cc' : '#333'};color:#fff;border:1px solid #666;border-radius:4px;cursor:pointer;font-family:Rajdhani,sans-serif;">
                        ${a.hasHat ? 'ON' : 'OFF'}
                    </button>
                </label>
            </div>

            <div style="margin-bottom:18px;">
                <label style="color:#ddd;font-size:13px;display:flex;align-items:center;justify-content:space-between;">
                    Sunglasses — $500
                    <button id="cs-sunglasses-btn" style="padding:4px 16px;background:${a.hasSunglasses ? '#ff44cc' : '#333'};color:#fff;border:1px solid #666;border-radius:4px;cursor:pointer;font-family:Rajdhani,sans-serif;">
                        ${a.hasSunglasses ? 'ON' : 'OFF'}
                    </button>
                </label>
            </div>

            <div style="display:flex;gap:10px;justify-content:center;">
                <button id="cs-buy-btn" style="padding:8px 24px;background:#ff44cc;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:Rajdhani,sans-serif;font-size:14px;font-weight:bold;">
                    BUY CHANGES
                </button>
                <button id="cs-close-btn" style="padding:8px 24px;background:#444;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:Rajdhani,sans-serif;font-size:14px;">
                    CLOSE
                </button>
            </div>
            <div id="cs-message" style="color:#ff4444;font-size:12px;text-align:center;margin-top:10px;min-height:16px;"></div>
        `;

        this._clothingShopEl.innerHTML = html;

        // Wire up events
        const closeBtn = document.getElementById('cs-close-btn');
        closeBtn.addEventListener('click', () => this.closeClothingShop());

        const hatBtn = document.getElementById('cs-hat-btn');
        hatBtn.addEventListener('click', () => {
            this._csHatPending = !this._csHatPending;
            hatBtn.textContent = this._csHatPending ? 'ON' : 'OFF';
            hatBtn.style.background = this._csHatPending ? '#ff44cc' : '#333';
        });

        const sunBtn = document.getElementById('cs-sunglasses-btn');
        sunBtn.addEventListener('click', () => {
            this._csSunglassesPending = !this._csSunglassesPending;
            sunBtn.textContent = this._csSunglassesPending ? 'ON' : 'OFF';
            sunBtn.style.background = this._csSunglassesPending ? '#ff44cc' : '#333';
        });

        // Store pending state from current appearance
        this._csHatPending = a.hasHat;
        this._csSunglassesPending = a.hasSunglasses;

        const buyBtn = document.getElementById('cs-buy-btn');
        buyBtn.addEventListener('click', () => {
            const msgEl = document.getElementById('cs-message');
            const shirtInput = document.getElementById('cs-shirt-color');
            const pantsInput = document.getElementById('cs-pants-color');

            const newShirt = parseInt(shirtInput.value.replace('#', ''), 16);
            const newPants = parseInt(pantsInput.value.replace('#', ''), 16);

            // Calculate cost
            let cost = 0;
            if (newShirt !== a.shirtColor) cost += 100;
            if (newPants !== a.pantsColor) cost += 100;
            if (this._csHatPending !== a.hasHat) cost += 200;
            if (this._csSunglassesPending !== a.hasSunglasses) cost += 500;

            if (cost === 0) {
                msgEl.style.color = '#aaa';
                msgEl.textContent = 'No changes selected.';
                return;
            }

            if (player.cash < cost) {
                msgEl.style.color = '#ff4444';
                msgEl.textContent = `Not enough cash! Need $${cost}.`;
                return;
            }

            // Apply purchase
            player.cash -= cost;
            a.shirtColor = newShirt;
            a.pantsColor = newPants;
            a.hasHat = this._csHatPending;
            a.hasSunglasses = this._csSunglassesPending;
            player.applyAppearance();

            msgEl.style.color = '#44ff44';
            msgEl.textContent = `Purchased! -$${cost}`;

            // Update cash display
            const cashDisplay = this._clothingShopEl.querySelector('span[style*="color:#4c4"]');
            if (cashDisplay) cashDisplay.textContent = '$' + player.cash.toLocaleString();

            this.game.systems.audio.playPickup();
        });

        // Close on Escape key (store handler so closeClothingShop can clean it up)
        if (this._csEscHandler) document.removeEventListener('keydown', this._csEscHandler);
        this._csEscHandler = (e) => {
            if (e.code === 'Escape' && this._clothingShopOpen) {
                this.closeClothingShop();
            }
        };
        document.addEventListener('keydown', this._csEscHandler);
    }

    showMissionComplete(title, reward) {
        const el = document.getElementById('mission-complete');
        const textEl = document.getElementById('mission-complete-text');
        const rewardEl = document.getElementById('mission-reward');

        textEl.textContent = title || 'MISSION COMPLETE';
        rewardEl.textContent = reward ? `+$${reward.toLocaleString()}` : '';

        el.style.display = 'flex';
        setTimeout(() => {
            el.style.display = 'none';
        }, 4000);
    }
}

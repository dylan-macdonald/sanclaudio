// San Claudio - Save System
// localStorage save/load

export class SaveManager {
    constructor(game) {
        this.game = game;
        this.saveKey = 'san-claudio-save';
    }

    hasSave() {
        try {
            return !!localStorage.getItem(this.saveKey);
        } catch (e) {
            return false;
        }
    }

    save() {
        try {
            const player = this.game.systems.player;
            const missions = this.game.systems.missions;

            const data = {
                version: 1,
                timestamp: Date.now(),
                player: {
                    position: { x: player.position.x, y: player.position.y, z: player.position.z },
                    health: player.health,
                    armor: player.armor,
                    cash: player.cash,
                    weapons: player.weapons.map(w => ({ id: w.id, ammo: w.ammo, clipSize: w.clipSize })),
                    currentWeaponIndex: player.currentWeaponIndex,
                    appearance: {
                        shirtColor: player.appearance.shirtColor,
                        pantsColor: player.appearance.pantsColor,
                        hasHat: player.appearance.hasHat,
                        hasSunglasses: player.appearance.hasSunglasses
                    }
                },
                missions: {
                    completedMissions: [...missions.completedMissions],
                    currentMission: missions.currentMission
                },
                timeOfDay: this.game.timeOfDay,
                stats: { ...this.game.stats },
                // Vehicle ownership
                storedVehicles: this.game.systems.vehicles.storedVehicles.map(v => ({
                    type: v.type,
                    color: v.color
                })),
                // Property ownership
                properties: this.game.systems.interiors.properties.map(p => ({
                    id: p.id,
                    owned: p.owned
                })),
                // Strangers & Freaks progress
                sfCompleted: missions.sfCompleted || {},
                rampageCompleted: missions.rampageCompleted ? [...missions.rampageCompleted] : []
            };

            localStorage.setItem(this.saveKey, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Save failed:', e);
            return false;
        }
    }

    load() {
        try {
            const raw = localStorage.getItem(this.saveKey);
            if (!raw) return false;

            const data = JSON.parse(raw);
            const player = this.game.systems.player;
            const missions = this.game.systems.missions;

            // Restore player
            if (data.player) {
                player.position.set(data.player.position.x, data.player.position.y, data.player.position.z);
                player.model.position.copy(player.position);
                player.health = data.player.health;
                player.armor = data.player.armor;
                player.cash = data.player.cash;
                player.weapons = data.player.weapons.map(w => ({
                    ...w,
                    ammo: w.ammo === null ? Infinity : w.ammo,
                    clipSize: w.clipSize === null ? Infinity : w.clipSize
                }));
                player.currentWeaponIndex = data.player.currentWeaponIndex;

                // Restore appearance
                if (data.player.appearance) {
                    player.appearance = { ...player.appearance, ...data.player.appearance };
                    player.applyAppearance();
                }
            }

            // Restore missions
            if (data.missions) {
                missions.completedMissions = new Set(data.missions.completedMissions);
                missions.currentMission = data.missions.currentMission;
                missions.refreshMarkers();
            }

            // Restore time
            if (data.timeOfDay !== undefined) {
                this.game.timeOfDay = data.timeOfDay;
            }

            // Restore stats
            if (data.stats) {
                Object.assign(this.game.stats, data.stats);
            }

            // Restore stored vehicles
            if (data.storedVehicles) {
                this.game.systems.vehicles.storedVehicles = data.storedVehicles;
            }

            // Restore property ownership
            if (data.properties) {
                for (const saved of data.properties) {
                    const prop = this.game.systems.interiors.properties.find(p => p.id === saved.id);
                    if (prop) prop.owned = saved.owned;
                }
            }

            // Restore S&F progress
            if (data.sfCompleted) {
                missions.sfCompleted = data.sfCompleted;
            }
            if (data.rampageCompleted) {
                missions.rampageCompleted = new Set(data.rampageCompleted);
            }

            return true;
        } catch (e) {
            console.error('Load failed:', e);
            return false;
        }
    }

    clear() {
        try {
            localStorage.removeItem(this.saveKey);
        } catch (e) {}
    }
}

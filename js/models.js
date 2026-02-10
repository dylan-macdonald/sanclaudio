// San Claudio - Model Manager
// Async .glb model loading, caching, and cloning

export class ModelManager {
    constructor(game) {
        this.game = game;
        this.models = {};      // name -> GLTF scene
        this.animations = {};  // name -> AnimationClip[]
        this.loader = new THREE.GLTFLoader();
        this.loaded = false;
    }

    async loadAll(progressCallback) {
        const manifest = [
            { name: 'character', url: 'assets/models/character.glb' },
            { name: 'sedan', url: 'assets/models/sedan.glb' },
            { name: 'sports', url: 'assets/models/sports.glb' },
            { name: 'truck', url: 'assets/models/truck.glb' },
            { name: 'motorcycle', url: 'assets/models/motorcycle.glb' },
            { name: 'boat', url: 'assets/models/boat.glb' },
            { name: 'police', url: 'assets/models/police.glb' },
            { name: 'helicopter', url: 'assets/models/helicopter.glb' },
            { name: 'character_female', url: 'assets/models/character_female.glb' },
            // Weapons
            { name: 'weapon_bat', url: 'assets/models/weapon_bat.glb' },
            { name: 'weapon_knife', url: 'assets/models/weapon_knife.glb' },
            { name: 'weapon_pistol', url: 'assets/models/weapon_pistol.glb' },
            { name: 'weapon_smg', url: 'assets/models/weapon_smg.glb' },
            { name: 'weapon_shotgun', url: 'assets/models/weapon_shotgun.glb' },
            { name: 'weapon_rifle', url: 'assets/models/weapon_rifle.glb' },
            { name: 'weapon_sniper', url: 'assets/models/weapon_sniper.glb' },
            { name: 'weapon_grenade', url: 'assets/models/weapon_grenade.glb' },
            { name: 'weapon_atomizer', url: 'assets/models/weapon_atomizer.glb' },
        ];

        let loaded = 0;
        const total = manifest.length;

        const loadPromises = manifest.map(entry => {
            return new Promise((resolve, reject) => {
                this.loader.load(
                    entry.url,
                    (gltf) => {
                        this.models[entry.name] = gltf.scene;
                        this.animations[entry.name] = gltf.animations || [];
                        loaded++;
                        if (progressCallback) {
                            progressCallback(10 + (loaded / total) * 20);
                        }
                        resolve();
                    },
                    undefined,
                    (err) => {
                        console.warn(`Failed to load model: ${entry.url}`, err);
                        // Don't reject - allow game to continue without model
                        loaded++;
                        if (progressCallback) {
                            progressCallback(10 + (loaded / total) * 20);
                        }
                        resolve();
                    }
                );
            });
        });

        await Promise.all(loadPromises);
        this.loaded = true;
    }

    cloneCharacter(gender = 'male') {
        const key = gender === 'female' ? 'character_female' : 'character';
        if (!this.models[key]) return null;
        return THREE.SkeletonUtils.clone(this.models[key]);
    }

    getCharacterAnimations(gender = 'male') {
        const key = gender === 'female' ? 'character_female' : 'character';
        return this.animations[key] || [];
    }

    cloneVehicle(type) {
        if (!this.models[type]) return null;
        return this.models[type].clone();
    }

    hasModel(name) {
        return !!this.models[name];
    }
}

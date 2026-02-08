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

    cloneCharacter() {
        if (!this.models.character) return null;
        return THREE.SkeletonUtils.clone(this.models.character);
    }

    getCharacterAnimations() {
        return this.animations.character || [];
    }

    cloneVehicle(type) {
        if (!this.models[type]) return null;
        return this.models[type].clone();
    }

    hasModel(name) {
        return !!this.models[name];
    }
}

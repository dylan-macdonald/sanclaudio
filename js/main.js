// San Claudio - Main Game Module
// Entry point: initializes Three.js, game loop, state machine

import { ModelManager } from './models.js';
import { World } from './world.js';
import { Player } from './player.js';
import { CameraController } from './camera.js';
import { InputManager } from './input.js';
import { VehicleManager } from './vehicles.js';
import { WeaponManager } from './weapons.js';
import { NPCManager } from './npcs.js';
import { RagdollManager } from './ragdoll.js';
import { WantedSystem } from './wanted.js';
import { InteriorManager } from './interiors.js';
import { UIManager } from './ui.js';
import { AudioManager } from './audio.js';
import { MissionManager } from './missions.js';
import { CutsceneManager } from './cutscenes.js';
import { SaveManager } from './save.js';
import { DevTools } from './devtools.js';
import { PhysicsManager } from './physics.js';

// Height Fog + Vignette + Color Grading custom shader
const HeightFogVignetteShader = {
    uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        cameraNear: { value: 0.1 },
        cameraFar: { value: 1000 },
        fogCameraPosition: { value: new THREE.Vector3() },
        inverseProjectionMatrix: { value: new THREE.Matrix4() },
        inverseViewMatrix: { value: new THREE.Matrix4() },
        fogColor: { value: new THREE.Color(0xb0c8e0) },
        fogDensity: { value: 0.002 },
        fogHeightFalloff: { value: 0.04 },
        fogBaseHeight: { value: 20.0 },
        fogMaxOpacity: { value: 0.85 },
        vignetteIntensity: { value: 0.3 },
        vignetteRadius: { value: 0.75 },
        colorTint: { value: new THREE.Vector3(1.0, 0.98, 0.95) },
        colorSaturation: { value: 1.1 },
        resolution: { value: new THREE.Vector2(1, 1) }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform float cameraNear;
        uniform float cameraFar;
        uniform vec3 fogCameraPosition;
        uniform mat4 inverseProjectionMatrix;
        uniform mat4 inverseViewMatrix;
        uniform vec3 fogColor;
        uniform float fogDensity;
        uniform float fogHeightFalloff;
        uniform float fogBaseHeight;
        uniform float fogMaxOpacity;
        uniform float vignetteIntensity;
        uniform float vignetteRadius;
        uniform vec3 colorTint;
        uniform float colorSaturation;
        uniform vec2 resolution;
        varying vec2 vUv;

        float getDepth(vec2 uv) {
            return texture2D(tDepth, uv).x;
        }

        float linearizeDepth(float d) {
            return cameraNear * cameraFar / (cameraFar - d * (cameraFar - cameraNear));
        }

        vec3 getWorldPosition(vec2 uv, float depth) {
            vec4 clipPos = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
            vec4 viewPos = inverseProjectionMatrix * clipPos;
            viewPos /= viewPos.w;
            vec4 worldPos = inverseViewMatrix * viewPos;
            return worldPos.xyz;
        }

        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            float depth = getDepth(vUv);

            // Height fog (skip sky pixels where depth ~ 1.0)
            if (depth < 0.9999) {
                vec3 worldPos = getWorldPosition(vUv, depth);
                float dist = length(worldPos - fogCameraPosition);

                // Height-attenuated density: thick in valleys, thin at peaks
                float heightAboveBase = max(worldPos.y - fogBaseHeight, 0.0);
                float heightFactor = exp(-heightAboveBase * fogHeightFalloff);

                // Extra density boost for low areas (below base height)
                float valleyBoost = max(fogBaseHeight - worldPos.y, 0.0) * 0.01;
                heightFactor = min(heightFactor + valleyBoost, 1.5);

                float fogAmount = 1.0 - exp(-dist * fogDensity * heightFactor);
                fogAmount = min(fogAmount, fogMaxOpacity);

                color.rgb = mix(color.rgb, fogColor, fogAmount);
            }

            // Color grading: saturation
            float luminance = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
            color.rgb = mix(vec3(luminance), color.rgb, colorSaturation);

            // Color tint
            color.rgb *= colorTint;

            // Vignette
            vec2 uv = vUv * 2.0 - 1.0;
            uv.x *= resolution.x / resolution.y; // Correct aspect ratio
            float vignette = smoothstep(vignetteRadius, vignetteRadius + 0.5, length(uv));
            color.rgb *= 1.0 - vignette * vignetteIntensity;

            gl_FragColor = color;
        }
    `
};

// Game States
const GameState = {
    LOADING: 'loading',
    TITLE: 'title',
    PLAYING: 'playing',
    PAUSED: 'paused',
    CUTSCENE: 'cutscene',
    DEAD: 'dead',
    MAP: 'map',
    MISSION_COMPLETE: 'mission_complete'
};

class Game {
    constructor() {
        this.state = GameState.LOADING;
        this.prevState = null;
        this.clock = new THREE.Clock();
        this.deltaTime = 0;
        this.timeScale = 1.0;
        this.elapsedTime = 0;
        this.frameCount = 0;
        this.fps = 0;
        this.fpsTimer = 0;

        // Day/night cycle: 0-1 over 10 minutes (600 seconds)
        this.timeOfDay = 0.3; // Start at morning
        this.dayDuration = 600; // seconds for full cycle

        // Weather
        this.weatherStates = ['clear', 'overcast', 'rain', 'fog', 'storm'];
        this.currentWeather = 'clear';
        this.targetWeather = 'clear';
        this.weatherTimer = 120; // seconds until next weather change
        this.weatherTransition = 0; // 0-1 transition progress

        // Player stats
        this.stats = {
            totalKills: 0,
            vehiclesStolen: 0,
            distanceWalked: 0,
            distanceDriven: 0,
            missionsComplete: 0,
            sideMissionsComplete: 0,
            strangersComplete: 0,
            playtime: 0,
            maxWantedSurvived: 0,
            longestWantedEscape: 0,
            vehiclesCollected: 0,
            stuntJumpsCompleted: 0,
            propertiesOwned: 0,
            hiddenPackagesFound: 0
        };

        this.systems = {};
    }

    async init() {
        this.setupRenderer();
        this.setupScene();
        this.setupLighting();
        this.createSkyObjects();

        // Load .glb models first (progress 0-30)
        this.systems.models = new ModelManager(this);
        this.updateLoadProgress(5);
        await this.systems.models.loadAll((p) => this.updateLoadProgress(p));
        this.updateLoadProgress(30);

        // Initialize physics engine (Rapier WASM)
        this.systems.physics = new PhysicsManager(this);
        await this.systems.physics.init();
        this.updateLoadProgress(32);

        // Initialize all game systems
        this.systems.input = new InputManager(this);
        this.systems.world = new World(this);
        this.systems.player = new Player(this);
        this.systems.camera = new CameraController(this);
        this.systems.vehicles = new VehicleManager(this);
        this.systems.weapons = new WeaponManager(this);
        this.systems.npcs = new NPCManager(this);
        this.systems.ragdoll = new RagdollManager(this);
        this.systems.wanted = new WantedSystem(this);
        this.systems.interiors = new InteriorManager(this);
        this.systems.ui = new UIManager(this);
        this.systems.audio = new AudioManager(this);
        this.systems.missions = new MissionManager(this);
        this.systems.cutscenes = new CutsceneManager(this);
        this.systems.save = new SaveManager(this);
        this.systems.devtools = new DevTools(this);

        // Setup post-processing pipeline
        this.setupPostProcessing();

        // Build the world (progress 30-100)
        this.updateLoadProgress(35);
        this.systems.world.init();
        // Build physics heightfield from terrain data
        if (this.systems.physics.ready) {
            const world = this.systems.world;
            this.systems.physics.buildTerrainHeightfield(
                (x, z) => world.getTerrainHeight(x, z),
                world.mapSize
            );
        }
        this.updateLoadProgress(50);
        this.systems.player.init();
        this.updateLoadProgress(55);
        this.systems.vehicles.init();
        this.updateLoadProgress(65);
        this.systems.npcs.init();
        this.updateLoadProgress(75);
        this.systems.weapons.init();
        this.updateLoadProgress(80);
        this.systems.interiors.init();
        this.systems.wanted.init();
        this.updateLoadProgress(85);
        this.systems.ui.init();
        this.updateLoadProgress(88);
        this.systems.missions.init();
        this.updateLoadProgress(92);
        this.systems.devtools.init();
        this.updateLoadProgress(96);
        this.systems.audio.init();
        this.updateLoadProgress(100);

        // Hide loading, show title
        setTimeout(() => {
            document.getElementById('loading-screen').style.display = 'none';
            this.showTitleScreen();
        }, 500);

        // Start game loop
        this.loop();
    }

    setupRenderer() {
        const canvas = document.getElementById('game-canvas');
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.isMobile = ('ontouchstart' in window || navigator.maxTouchPoints > 0);

        window.addEventListener('resize', () => this.onResize());
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        // Always-on distance fog hides flat horizon and map edges
        this.scene.fog = new THREE.FogExp2(0xb0c8e0, 0.002);

        // Sky dome, sun, clouds, stars will be created after scene setup
        this.skyDome = null;
        this.sunMesh = null;
        this.clouds = [];
        this.stars = null;
    }

    setupLighting() {
        // Hemisphere light: warm sky, cool ground
        this.hemiLight = new THREE.HemisphereLight(0xb1e1ff, 0x332211, 0.6);
        this.scene.add(this.hemiLight);

        // Directional sun light
        this.sunLight = new THREE.DirectionalLight(0xfff5e6, 1.0);
        this.sunLight.position.set(100, 150, 100);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 4096;
        this.sunLight.shadow.mapSize.height = 4096;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 500;
        this.sunLight.shadow.camera.left = -100;
        this.sunLight.shadow.camera.right = 100;
        this.sunLight.shadow.camera.top = 100;
        this.sunLight.shadow.camera.bottom = -100;
        this.sunLight.shadow.bias = -0.001;
        this.sunLight.shadow.normalBias = 0.02;
        // Reduce shadow quality on mobile for performance
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            this.sunLight.shadow.mapSize.width = 2048;
            this.sunLight.shadow.mapSize.height = 2048;
        }
        this.scene.add(this.sunLight);
        this.scene.add(this.sunLight.target);

        // Fill light (warm, opposite sun)
        this.fillLight = new THREE.DirectionalLight(0xffe0c0, 0.3);
        this.fillLight.position.set(-50, 80, -50);
        this.scene.add(this.fillLight);

        // Cool blue rim light for depth on characters
        this.rimLight = new THREE.DirectionalLight(0x4488cc, 0.3);
        this.rimLight.position.set(0, 40, -100);
        this.scene.add(this.rimLight);

        // Ambient for base illumination
        this.ambientLight = new THREE.AmbientLight(0x404050, 0.2);
        this.scene.add(this.ambientLight);
    }

    createSkyObjects() {
        // Sky dome - large sphere with gradient
        const skyGeo = new THREE.SphereGeometry(450, 32, 16);
        const skyCanvas = document.createElement('canvas');
        skyCanvas.width = 1;
        skyCanvas.height = 256;
        const skyCtx = skyCanvas.getContext('2d');
        const gradient = skyCtx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, '#1a3a6a');
        gradient.addColorStop(0.4, '#5588cc');
        gradient.addColorStop(0.7, '#87CEEB');
        gradient.addColorStop(1.0, '#c8dff0');
        skyCtx.fillStyle = gradient;
        skyCtx.fillRect(0, 0, 1, 256);
        const skyTexture = new THREE.CanvasTexture(skyCanvas);
        const skyMat = new THREE.MeshBasicMaterial({
            map: skyTexture,
            side: THREE.BackSide,
            depthWrite: false
        });
        this.skyDome = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(this.skyDome);

        // Visible sun
        const sunGeo = new THREE.SphereGeometry(8, 16, 16);
        const sunMat = new THREE.MeshBasicMaterial({
            color: 0xffee88,
            transparent: true,
            opacity: 1.0
        });
        this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
        this.scene.add(this.sunMesh);

        // Clouds - 25 flat planes with cloud-like canvas textures
        for (let i = 0; i < 25; i++) {
            const cloudCanvas = document.createElement('canvas');
            cloudCanvas.width = 128;
            cloudCanvas.height = 64;
            const cCtx = cloudCanvas.getContext('2d');
            cCtx.fillStyle = 'rgba(255,255,255,0)';
            cCtx.fillRect(0, 0, 128, 64);
            // Draw cloud blobs
            cCtx.fillStyle = 'rgba(255,255,255,0.8)';
            const cx = 64, cy = 32;
            for (let b = 0; b < 5; b++) {
                const bx = cx + (Math.random() - 0.5) * 60;
                const by = cy + (Math.random() - 0.5) * 20;
                const br = 15 + Math.random() * 20;
                cCtx.beginPath();
                cCtx.arc(bx, by, br, 0, Math.PI * 2);
                cCtx.fill();
            }
            const cloudTexture = new THREE.CanvasTexture(cloudCanvas);
            const cloudSize = 30 + Math.random() * 40;
            const cloudGeo = new THREE.PlaneGeometry(cloudSize, cloudSize * 0.4);
            const cloudMat = new THREE.MeshBasicMaterial({
                map: cloudTexture,
                transparent: true,
                opacity: 0.7,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            const cloud = new THREE.Mesh(cloudGeo, cloudMat);
            cloud.position.set(
                (Math.random() - 0.5) * 700,
                80 + Math.random() * 40,
                (Math.random() - 0.5) * 700
            );
            cloud.rotation.x = -Math.PI / 2;
            cloud.userData.speed = 1 + Math.random() * 2;
            cloud.userData.baseOpacity = 0.5 + Math.random() * 0.3;
            this.scene.add(cloud);
            this.clouds.push(cloud);
        }

        // Moon with canvas texture
        const moonGeo = new THREE.SphereGeometry(5, 16, 16);
        const moonCanvas = document.createElement('canvas');
        moonCanvas.width = 128;
        moonCanvas.height = 128;
        const mctx = moonCanvas.getContext('2d');
        // Base moon color with gradient
        const moonGrad = mctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        moonGrad.addColorStop(0, '#f0eef8');
        moonGrad.addColorStop(0.7, '#d8d4e8');
        moonGrad.addColorStop(1, '#aaa8c0');
        mctx.fillStyle = moonGrad;
        mctx.beginPath();
        mctx.arc(64, 64, 64, 0, Math.PI * 2);
        mctx.fill();
        // Crater circles
        const craters = [
            { x: 40, y: 35, r: 12 }, { x: 75, y: 50, r: 8 }, { x: 55, y: 70, r: 10 },
            { x: 30, y: 65, r: 6 }, { x: 80, y: 30, r: 7 }, { x: 60, y: 40, r: 5 },
            { x: 45, y: 55, r: 4 }, { x: 90, y: 60, r: 5 }
        ];
        for (const c of craters) {
            const cGrad = mctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
            cGrad.addColorStop(0, 'rgba(160,155,175,0.4)');
            cGrad.addColorStop(0.7, 'rgba(170,165,180,0.2)');
            cGrad.addColorStop(1, 'rgba(180,175,190,0)');
            mctx.fillStyle = cGrad;
            mctx.beginPath();
            mctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
            mctx.fill();
            // Crater rim highlight
            mctx.strokeStyle = 'rgba(220,215,230,0.2)';
            mctx.lineWidth = 0.5;
            mctx.beginPath();
            mctx.arc(c.x - 1, c.y - 1, c.r, Math.PI * 0.8, Math.PI * 1.8);
            mctx.stroke();
        }
        // Surface noise
        for (let i = 0; i < 300; i++) {
            mctx.fillStyle = `rgba(200,195,210,${0.03 + Math.random() * 0.05})`;
            mctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
        }
        const moonTexture = new THREE.CanvasTexture(moonCanvas);
        const moonMat = new THREE.MeshBasicMaterial({
            map: moonTexture,
            transparent: true,
            opacity: 0
        });
        this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
        this.scene.add(this.moonMesh);

        // Stars - InstancedMesh of small spheres
        const starGeo = new THREE.SphereGeometry(0.3, 4, 4);
        const starMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0
        });
        this.stars = new THREE.InstancedMesh(starGeo, starMat, 200);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < 200; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI * 0.4 + 0.2; // Above horizon
            const r = 400;
            dummy.position.set(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.cos(phi),
                r * Math.sin(phi) * Math.sin(theta)
            );
            dummy.updateMatrix();
            this.stars.setMatrixAt(i, dummy.matrix);
        }
        this.stars.instanceMatrix.needsUpdate = true;
        this.scene.add(this.stars);
    }

    updateLoadProgress(percent) {
        const fill = document.getElementById('loading-fill');
        if (fill) fill.style.width = percent + '%';
    }

    showTitleScreen() {
        this.state = GameState.TITLE;
        const titleScreen = document.getElementById('title-screen');
        titleScreen.style.display = 'flex';

        // Check for existing save
        const hasSave = this.systems.save.hasSave();
        const continueBtn = document.getElementById('btn-continue');
        if (hasSave) {
            continueBtn.style.display = 'block';
        }

        // Button handlers
        document.getElementById('btn-newgame').addEventListener('click', () => {
            this.startNewGame();
        });

        continueBtn.addEventListener('click', () => {
            this.loadGame();
        });

        // Any key to start (if no buttons)
        const startHandler = (e) => {
            if (this.state !== GameState.TITLE) return;
            // Ignore if clicking buttons
            if (e.target && e.target.tagName === 'BUTTON') return;
            this.startNewGame();
        };

        document.addEventListener('keydown', startHandler, { once: false });
        this._titleStartHandler = startHandler;
    }

    startNewGame() {
        if (this._titleStartHandler) {
            document.removeEventListener('keydown', this._titleStartHandler);
            this._titleStartHandler = null;
        }
        document.getElementById('title-screen').style.display = 'none';
        document.getElementById('hud').style.display = 'block';
        this.state = GameState.PLAYING;
        this.systems.audio.resumeContext();

        // Detect touch device and show touch controls
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            document.getElementById('touch-controls').style.display = 'block';
        }
    }

    loadGame() {
        this.systems.save.load();
        this.startNewGame();
    }

    setState(newState) {
        this.prevState = this.state;
        this.state = newState;
    }

    onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.renderer.setSize(w, h);
        if (this.systems.camera && this.systems.camera.camera) {
            this.systems.camera.camera.aspect = w / h;
            this.systems.camera.camera.updateProjectionMatrix();
        }
        // Resize post-processing passes
        if (this.composer) {
            this.composer.setSize(w, h);
            if (this.ssaoPass) this.ssaoPass.setSize(w, h);
            if (this.bloomPass) {
                const bloomScale = this.isMobile ? 0.5 : 1;
                this.bloomPass.setSize(w * bloomScale, h * bloomScale);
            }
            if (this.heightFogPass) {
                this.heightFogPass.uniforms.resolution.value.set(w, h);
            }
            // Rebuild depth render target at new size
            if (this._depthRenderTarget) {
                this._depthRenderTarget.setSize(w, h);
            }
        }
    }

    setupPostProcessing() {
        const w = window.innerWidth;
        const h = window.innerHeight;

        // Post-processing state
        this.postProcessing = {
            enabled: true,
            quality: this.isMobile ? 'low' : 'high',
            ssaoEnabled: !this.isMobile,
            bloomEnabled: true,
            heightFogEnabled: true,
            vignetteEnabled: true
        };

        // Check for required Three.js postprocessing globals
        if (typeof THREE.EffectComposer === 'undefined' ||
            typeof THREE.RenderPass === 'undefined') {
            console.warn('Post-processing modules not loaded, falling back to direct render');
            this.postProcessing.enabled = false;
            return;
        }

        // Create render target with depth texture for height fog
        const hasDepthTexture = this.renderer.extensions.get('WEBGL_depth_texture');
        this._depthRenderTarget = new THREE.WebGLRenderTarget(w, h, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat
        });
        if (hasDepthTexture) {
            this._depthRenderTarget.depthTexture = new THREE.DepthTexture();
            this._depthRenderTarget.depthTexture.type = THREE.UnsignedIntType;
        } else {
            // No depth texture support — disable height fog, keep built-in FogExp2
            this.postProcessing.heightFogEnabled = false;
        }

        // Effect Composer
        this.composer = new THREE.EffectComposer(this.renderer, this._depthRenderTarget);

        // Pass 1: Render scene
        const camera = this.systems.camera.camera;
        this.renderPass = new THREE.RenderPass(this.scene, camera);
        this.composer.addPass(this.renderPass);

        // Pass 2: SSAO (skip on mobile)
        this.ssaoPass = null;
        if (!this.isMobile && typeof THREE.SSAOPass !== 'undefined') {
            try {
                this.ssaoPass = new THREE.SSAOPass(this.scene, camera, w, h);
                this.ssaoPass.kernelRadius = 8;
                this.ssaoPass.minDistance = 0.005;
                this.ssaoPass.maxDistance = 0.1;
                this.ssaoPass.enabled = this.postProcessing.ssaoEnabled;
                this.composer.addPass(this.ssaoPass);
            } catch (e) {
                console.warn('SSAOPass init failed:', e.message);
                this.ssaoPass = null;
                this.postProcessing.ssaoEnabled = false;
            }
        }

        // Pass 3: Bloom
        this.bloomPass = null;
        if (typeof THREE.UnrealBloomPass !== 'undefined') {
            const bloomScale = this.isMobile ? 0.5 : 1;
            this.bloomPass = new THREE.UnrealBloomPass(
                new THREE.Vector2(w * bloomScale, h * bloomScale),
                0.3,  // strength
                0.4,  // radius
                0.85  // threshold
            );
            this.bloomPass.enabled = this.postProcessing.bloomEnabled;
            this.composer.addPass(this.bloomPass);
        }

        // Pass 4: Height Fog + Vignette + Color Grading (custom shader)
        this.heightFogPass = null;
        if (typeof THREE.ShaderPass !== 'undefined') {
            this.heightFogPass = new THREE.ShaderPass(HeightFogVignetteShader);
            this.heightFogPass.uniforms.tDepth.value = this._depthRenderTarget.depthTexture;
            this.heightFogPass.uniforms.resolution.value.set(w, h);
            this.heightFogPass.enabled = this.postProcessing.heightFogEnabled || this.postProcessing.vignetteEnabled;
            this.composer.addPass(this.heightFogPass);
        }

        // Disable built-in scene fog when custom height fog is active (avoid double-fogging)
        if (this.postProcessing.heightFogEnabled && this.scene.fog) {
            this._originalFog = this.scene.fog;
            this.scene.fog = null;
        }

        this.dayFactor = 0.5; // Default until first updateDayNight
    }

    updatePostProcessingUniforms() {
        if (!this.composer || !this.postProcessing.enabled) return;

        const camera = this.systems.camera.camera;
        const dayFactor = this.dayFactor || 0.5;

        // Update render pass camera reference
        if (this.renderPass) {
            this.renderPass.camera = camera;
        }

        // Update SSAO camera
        if (this.ssaoPass && this.ssaoPass.enabled) {
            this.ssaoPass.camera = camera;
        }

        // Height fog + vignette + color grading uniforms
        if (this.heightFogPass) {
            const u = this.heightFogPass.uniforms;

            // Camera matrices (every frame)
            u.fogCameraPosition.value.copy(camera.position);
            u.cameraNear.value = camera.near;
            u.cameraFar.value = camera.far;
            u.inverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
            u.inverseViewMatrix.value.copy(camera.matrixWorld);

            // Weather-driven fog parameters (smooth lerp)
            const weatherFogParams = {
                clear:    { density: 0.002, baseHeight: 20, falloff: 0.04 },
                overcast: { density: 0.003, baseHeight: 25, falloff: 0.03 },
                rain:     { density: 0.004, baseHeight: 15, falloff: 0.025 },
                storm:    { density: 0.006, baseHeight: 10, falloff: 0.02 },
                fog:      { density: 0.01,  baseHeight: 40, falloff: 0.008 }
            };
            const wp = weatherFogParams[this.currentWeather] || weatherFogParams.clear;
            const lerpSpeed = 0.02;
            u.fogDensity.value += (wp.density - u.fogDensity.value) * lerpSpeed;
            u.fogBaseHeight.value += (wp.baseHeight - u.fogBaseHeight.value) * lerpSpeed;
            u.fogHeightFalloff.value += (wp.falloff - u.fogHeightFalloff.value) * lerpSpeed;

            // Fog color: read from scene background (matches sky) mixed with gray for weather
            if (this.scene.background && this.scene.background.isColor) {
                const weather = this.currentWeather;
                const grayMix = weather === 'fog' ? 0.7 : (weather === 'rain' || weather === 'storm') ? 0.5 : 0.15;
                const target = new THREE.Color().lerpColors(this.scene.background, new THREE.Color(0x888899), grayMix);
                u.fogColor.value.lerp(target, 0.05);
            }

            // Height fog enabled/disabled
            if (!this.postProcessing.heightFogEnabled) {
                u.fogDensity.value = 0;
            }

            // Day/night color grading
            if (dayFactor > 0.5) {
                // Day: warm tint
                u.colorTint.value.set(1.0, 0.98, 0.95);
                u.colorSaturation.value += (1.1 - u.colorSaturation.value) * lerpSpeed;
            } else if (dayFactor > 0.2) {
                // Dusk/dawn: orange tint
                u.colorTint.value.set(1.05, 0.92, 0.85);
                u.colorSaturation.value += (1.2 - u.colorSaturation.value) * lerpSpeed;
            } else {
                // Night: cool blue
                u.colorTint.value.set(0.85, 0.88, 1.0);
                u.colorSaturation.value += (0.9 - u.colorSaturation.value) * lerpSpeed;
            }

            // Vignette
            u.vignetteIntensity.value = this.postProcessing.vignetteEnabled ? 0.3 : 0;
        }

        // Bloom: weather and time-driven
        if (this.bloomPass && this.bloomPass.enabled) {
            const weatherBloom = {
                clear: 0.3, overcast: 0.25, rain: 0.2, storm: 0.5, fog: 0.15
            };
            const targetStrength = weatherBloom[this.currentWeather] || 0.3;
            this.bloomPass.strength += (targetStrength - this.bloomPass.strength) * 0.02;

            // Lower threshold at night so neon signs glow more
            const targetThreshold = dayFactor > 0.5 ? 0.85 : 0.75;
            this.bloomPass.threshold += (targetThreshold - this.bloomPass.threshold) * 0.02;
        }

        // Suppress during showroom mode
        if (this._showroomOverride && this.heightFogPass) {
            this.heightFogPass.uniforms.fogDensity.value = 0;
            this.heightFogPass.uniforms.vignetteIntensity.value = 0;
            this.heightFogPass.uniforms.colorSaturation.value = 1.0;
            this.heightFogPass.uniforms.colorTint.value.set(1, 1, 1);
            if (this.bloomPass) this.bloomPass.strength = 0;
        }
    }

    updateDayNight(dt) {
        this.timeOfDay += dt / this.dayDuration;
        if (this.timeOfDay >= 1) this.timeOfDay -= 1;

        // Sun angle: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
        const sunAngle = this.timeOfDay * Math.PI * 2;
        const sunHeight = Math.sin(sunAngle - Math.PI * 0.5);
        const sunX = Math.cos(sunAngle - Math.PI * 0.5) * 150;

        // Position sun relative to player
        const playerPos = this.systems.player.position;
        this.sunLight.position.set(
            playerPos.x + sunX,
            Math.max(sunHeight * 150, 5),
            playerPos.z + 50
        );
        this.sunLight.target.position.copy(playerPos);

        // Light intensity based on sun height
        const dayFactor = Math.max(0, Math.min(1, sunHeight * 2 + 0.5));
        this.dayFactor = dayFactor;

        if (!this._showroomOverride) {
            this.sunLight.intensity = dayFactor * 1.0;
            this.hemiLight.intensity = 0.2 + dayFactor * 0.4;
            this.ambientLight.intensity = 0.05 + dayFactor * 0.08;
            this.fillLight.intensity = dayFactor * 0.15;
            this.rimLight.intensity = 0.15 + dayFactor * 0.15;
        }

        // Sky color: blue during day, dark blue/purple at night
        const dayColor = new THREE.Color(0x87CEEB);
        const duskColor = new THREE.Color(0xff7744);
        const nightColor = new THREE.Color(0x0a0a1a);

        let skyColor;
        if (dayFactor > 0.6) {
            skyColor = dayColor;
        } else if (dayFactor > 0.3) {
            const t = (dayFactor - 0.3) / 0.3;
            skyColor = new THREE.Color().lerpColors(duskColor, dayColor, t);
        } else if (dayFactor > 0.1) {
            const t = (dayFactor - 0.1) / 0.2;
            skyColor = new THREE.Color().lerpColors(nightColor, duskColor, t);
        } else {
            skyColor = nightColor;
        }

        if (!this._showroomOverride) this.scene.background = skyColor;

        // Update sky dome position to follow player
        const pp = this.systems.player.position;
        if (this.skyDome) {
            this.skyDome.position.set(pp.x, 0, pp.z);
            // Tint sky dome based on time/weather
            const skyTint = skyColor.clone();
            this.skyDome.material.color = skyTint;
        }

        // Update sun mesh position (visible sun sphere)
        if (this.sunMesh) {
            this.sunMesh.position.set(
                pp.x + sunX,
                Math.max(sunHeight * 200, -50),
                pp.z + 50
            );
            // Sun color: yellow at noon, orange at dusk/dawn
            if (dayFactor > 0.5) {
                this.sunMesh.material.color.setHex(0xffee88);
            } else if (dayFactor > 0.2) {
                this.sunMesh.material.color.setHex(0xff8844);
            } else {
                this.sunMesh.material.color.setHex(0xff4422);
            }
            this.sunMesh.material.opacity = Math.max(0, Math.min(1, dayFactor * 3));
            this.sunMesh.visible = dayFactor > 0.05;
        }

        // Update clouds
        for (const cloud of this.clouds) {
            cloud.position.x += cloud.userData.speed * dt;
            if (cloud.position.x > pp.x + 400) {
                cloud.position.x = pp.x - 400;
                cloud.position.z = pp.z + (Math.random() - 0.5) * 700;
            }
        }

        // Update stars visibility with twinkle effect
        if (this.stars) {
            const baseOpacity = dayFactor < 0.3 ? (1 - dayFactor / 0.3) * 0.8 : 0;
            // Twinkle: oscillate opacity with per-star phase offsets
            if (baseOpacity > 0 && this.stars.count > 0) {
                const t = this.timeOfDay * 10;
                for (let i = 0; i < this.stars.count; i++) {
                    const phase = i * 2.37; // Golden ratio-ish offset
                    const twinkle = 0.6 + 0.4 * Math.sin(t + phase + Math.sin(t * 0.3 + phase * 1.5) * 2);
                    const brightness = twinkle * baseOpacity;
                    const starColor = new THREE.Color().setHSL(0.12 + Math.sin(phase) * 0.05, 0.1, brightness);
                    this.stars.setColorAt(i, starColor);
                }
                if (this.stars.instanceColor) this.stars.instanceColor.needsUpdate = true;
            }
            this.stars.material.opacity = baseOpacity;
            this.stars.position.set(pp.x, 0, pp.z);
            this.stars.visible = dayFactor < 0.35;
        }

        // Update moon (opposite the sun)
        if (this.moonMesh) {
            const moonX = -sunX;
            const moonHeight = -sunHeight;
            this.moonMesh.position.set(
                pp.x + moonX,
                Math.max(moonHeight * 200, -50),
                pp.z - 50
            );
            this.moonMesh.lookAt(pp.x, pp.y || 0, pp.z);
            const moonVisible = dayFactor < 0.35;
            this.moonMesh.visible = moonVisible;
            this.moonMesh.material.opacity = moonVisible ? Math.min(1, (0.35 - dayFactor) * 5) : 0;
        }

        // Dynamic sky dome gradient based on time (update every ~2s to save perf)
        if (!this._skyUpdateTimer) this._skyUpdateTimer = 0;
        this._skyUpdateTimer -= dt;
        if (this._skyUpdateTimer <= 0 && this.skyDome && this.skyDome.material.map) {
            this._skyUpdateTimer = 2.0;
            const skyCanvas = this.skyDome.material.map.image;
            const skyCtx = skyCanvas.getContext('2d');
            const gradient = skyCtx.createLinearGradient(0, 0, 0, 256);
            if (dayFactor > 0.6) {
                // Full day
                gradient.addColorStop(0, '#1a3a6a');
                gradient.addColorStop(0.4, '#5588cc');
                gradient.addColorStop(0.7, '#87CEEB');
                gradient.addColorStop(1.0, '#c8dff0');
            } else if (dayFactor > 0.3) {
                // Sunrise/sunset - warm horizon
                const t = (dayFactor - 0.3) / 0.3;
                const topR = Math.round(26 + t * 0);
                const topG = Math.round(30 + t * 28);
                const topB = Math.round(60 + t * 46);
                gradient.addColorStop(0, `rgb(${topR},${topG},${topB})`);
                gradient.addColorStop(0.3, '#5566aa');
                gradient.addColorStop(0.6, '#dd7744');
                gradient.addColorStop(0.8, '#ff8855');
                gradient.addColorStop(1.0, '#ffaa66');
            } else if (dayFactor > 0.1) {
                // Deep dusk/dawn
                gradient.addColorStop(0, '#0a0a1a');
                gradient.addColorStop(0.4, '#1a1a3a');
                gradient.addColorStop(0.7, '#553344');
                gradient.addColorStop(0.9, '#884433');
                gradient.addColorStop(1.0, '#aa5533');
            } else {
                // Night
                gradient.addColorStop(0, '#050510');
                gradient.addColorStop(0.4, '#0a0a1a');
                gradient.addColorStop(0.7, '#0f0f2a');
                gradient.addColorStop(1.0, '#151525');
            }
            skyCtx.fillStyle = gradient;
            skyCtx.fillRect(0, 0, 1, 256);
            this.skyDome.material.map.needsUpdate = true;
        }

        // Sun light color: warm white during day, orange at dusk
        if (dayFactor > 0.5) {
            this.sunLight.color.setHex(0xfff5e6);
        } else if (dayFactor > 0.2) {
            this.sunLight.color.setHex(0xffaa55);
        }

        // Toggle street lamps
        if (this.systems.world) {
            this.systems.world.setNightMode(dayFactor < 0.35);
        }

        // Store dayFactor for world.js to access (window emissive ramp, etc.)
        this._currentDayFactor = dayFactor;

        // Ramp window emissive intensity at night
        if (dayFactor < 0.35 && this.systems.world) {
            const emissiveIntensity = 0.5 * (1 - dayFactor / 0.35);
            this.systems.world.setWindowEmissiveIntensity(emissiveIntensity);
        } else if (this.systems.world) {
            this.systems.world.setWindowEmissiveIntensity(0);
        }
    }

    updateWeather(dt) {
        this.weatherTimer -= dt;
        if (this.weatherTimer <= 0) {
            // Pick new weather
            const choices = this.weatherStates.filter(w => w !== this.currentWeather);
            this.targetWeather = choices[Math.floor(Math.random() * choices.length)];
            this.weatherTimer = 120 + Math.random() * 180; // 2-5 minutes
            this.weatherTransition = 0;
        }

        if (this.currentWeather !== this.targetWeather) {
            this.weatherTransition += dt * 0.2; // 5-second transition
            if (this.weatherTransition >= 1) {
                this.weatherTransition = 1;
                this.currentWeather = this.targetWeather;
            }
        }

        // Apply weather effects
        this.applyWeatherEffects();
    }

    applyWeatherEffects() {
        const weather = this.currentWeather;

        // Fog is ALWAYS on — density varies by weather
        const fogDensities = {
            clear: 0.002,
            overcast: 0.003,
            rain: 0.004,
            storm: 0.006,
            fog: 0.01
        };
        const targetDensity = fogDensities[weather] || 0.002;
        if (!this.scene.fog || !(this.scene.fog instanceof THREE.FogExp2)) {
            this.scene.fog = new THREE.FogExp2(0xb0c8e0, targetDensity);
        }
        if (!this._showroomOverride) {
            // Smooth density transition
            this.scene.fog.density += (targetDensity - this.scene.fog.density) * 0.02;

            // Fog color always matches sky
            const bg = this.scene.background;
            if (bg && bg.isColor) {
                const grayMix = weather === 'fog' ? 0.7 : weather === 'rain' || weather === 'storm' ? 0.5 : 0.15;
                const fogColor = new THREE.Color().lerpColors(bg, new THREE.Color(0x888899), grayMix);
                this.scene.fog.color.lerp(fogColor, 0.05);
            }
        }

        // Weather-based fog color tinting
        if (weather === 'rain') {
            this.scene.fog.color.lerp(new THREE.Color(0x667788), 0.03);
        } else if (weather === 'storm') {
            this.scene.fog.color.lerp(new THREE.Color(0x444455), 0.03);
        } else if (weather === 'fog') {
            this.scene.fog.color.lerp(new THREE.Color(0xaaaaaa), 0.03);
        }

        // Overcast weather: tint hemiLight cooler and reduce sun intensity
        if (weather === 'overcast') {
            this.hemiLight.color.lerp(new THREE.Color(0x99aabb), 0.05);
            this.sunLight.intensity *= 0.6;
        }

        // Weather affects clouds
        if (this.clouds) {
            for (const cloud of this.clouds) {
                if (weather === 'clear') {
                    cloud.material.opacity = cloud.userData.baseOpacity * 0.4;
                    cloud.material.color.setHex(0xffffff);
                } else if (weather === 'overcast') {
                    cloud.material.opacity = cloud.userData.baseOpacity * 1.2;
                    cloud.material.color.setHex(0xcccccc);
                } else if (weather === 'rain' || weather === 'storm') {
                    cloud.material.opacity = cloud.userData.baseOpacity * 1.0;
                    cloud.material.color.setHex(0x888899);
                } else {
                    cloud.material.opacity = cloud.userData.baseOpacity * 0.6;
                    cloud.material.color.setHex(0xffffff);
                }
            }
        }

        // Weather affects lighting
        if (weather === 'overcast' || weather === 'rain' || weather === 'storm') {
            const reduction = weather === 'storm' ? 0.4 : weather === 'rain' ? 0.5 : 0.65;
            this.sunLight.intensity *= reduction;
            this.hemiLight.intensity *= reduction;
        }

        // Storm lightning flashes (enhanced)
        if (weather === 'storm') {
            if (!this._lastLightningTime) this._lastLightningTime = 0;
            if (!this._lightningBoltMesh) this._lightningBoltMesh = null;
            if (!this._nextLightningInterval) this._nextLightningInterval = 6 + Math.random() * 12;
            const now = this.elapsedTime;

            if (now - this._lastLightningTime > this._nextLightningInterval) {
                this._lastLightningTime = now;
                this._nextLightningInterval = 6 + Math.random() * 12; // Set next interval once
                this._triggerLightningStrike();
            }

            // Cleanup bolt mesh
            if (this._lightningBoltMesh && this._lightningBoltLife !== undefined) {
                this._lightningBoltLife -= this.deltaTime;
                if (this._lightningBoltLife <= 0) {
                    this.scene.remove(this._lightningBoltMesh);
                    this._lightningBoltMesh.geometry.dispose();
                    this._lightningBoltMesh.material.dispose();
                    this._lightningBoltMesh = null;
                }
            }
        }

        // Update weather HUD
        const weatherLabels = { clear: 'CLEAR', overcast: 'OVERCAST', rain: 'RAIN', fog: 'FOG', storm: 'STORM' };
        const el = document.getElementById('hud-weather');
        if (el) el.textContent = weatherLabels[weather] || 'CLEAR';

        // Rain particles handled by world system
        if (this.systems.world) {
            this.systems.world.updateWeather(weather, this.deltaTime);
        }
    }

    _triggerLightningStrike() {
        const playerPos = this.systems.player.position;

        // Lightning strike position: random offset from player
        const boltX = playerPos.x + (Math.random() - 0.5) * 200;
        const boltZ = playerPos.z + (Math.random() - 0.5) * 200;
        const dist = Math.sqrt((boltX - playerPos.x) ** 2 + (boltZ - playerPos.z) ** 2);

        // Multi-flash sequence (2-3 quick flashes)
        // Use a flag instead of capturing stale light values — updateDayNight will restore correct values
        this._lightningFlashing = true;
        const flashCount = 2 + Math.floor(Math.random() * 2);

        for (let f = 0; f < flashCount; f++) {
            const delay = f * 80 + Math.random() * 40;
            setTimeout(() => {
                if (this._showroomOverride) return;
                this.ambientLight.intensity = 4;
                this.sunLight.intensity = 3;
                this.sunLight.color.setHex(0xccccff);

                // Screen flash overlay
                const flashEl = document.getElementById('hud-flash');
                if (flashEl) {
                    flashEl.style.display = 'block';
                    flashEl.style.opacity = '0.3';
                    setTimeout(() => {
                        flashEl.style.opacity = '0';
                        setTimeout(() => { flashEl.style.display = 'none'; }, 100);
                    }, 50);
                }

                setTimeout(() => {
                    // Let updateDayNight restore correct values on next frame
                    this._lightningFlashing = false;
                }, 60);
            }, delay);
        }

        // Create lightning bolt geometry
        this._createLightningBolt(boltX, boltZ);

        // Thunder sound with distance-based delay
        const thunderDelay = Math.max(200, dist * 15); // ~speed of sound feel
        setTimeout(() => {
            this._playThunder(dist);
        }, thunderDelay);

        // Camera shake for close strikes
        if (dist < 50) {
            setTimeout(() => {
                this.systems.camera.addShake(0.3 * (1 - dist / 50));
            }, thunderDelay);
        }
    }

    _createLightningBolt(x, z) {
        // Remove old bolt
        if (this._lightningBoltMesh) {
            this.scene.remove(this._lightningBoltMesh);
            this._lightningBoltMesh.geometry.dispose();
            this._lightningBoltMesh.material.dispose();
        }

        // Draw bolt as line segments
        const points = [];
        let curX = 0, curY = 50;

        points.push(new THREE.Vector3(curX, curY, 0));
        const segments = 8 + Math.floor(Math.random() * 6);
        const segHeight = 50 / segments;

        for (let i = 0; i < segments; i++) {
            curX += (Math.random() - 0.5) * 6;
            curY -= segHeight;
            points.push(new THREE.Vector3(curX, Math.max(0, curY), 0));

            // Branch with 30% chance
            if (Math.random() < 0.3 && i > 1 && i < segments - 1) {
                const branchLen = 3 + Math.random() * 5;
                const branchAngle = (Math.random() - 0.5) * 1.5;
                points.push(new THREE.Vector3(curX, curY, 0));
                points.push(new THREE.Vector3(
                    curX + Math.sin(branchAngle) * branchLen,
                    curY - Math.cos(branchAngle) * branchLen,
                    0
                ));
                points.push(new THREE.Vector3(curX, curY, 0));
            }
        }

        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
            color: 0xccccff,
            transparent: true,
            opacity: 0.9,
            linewidth: 2
        });
        const bolt = new THREE.Line(geo, mat);
        bolt.position.set(x, 0, z);

        // Billboard: face the camera
        const cam = this.systems.camera;
        if (cam && cam.camera) {
            bolt.lookAt(cam.camera.position);
        }

        this.scene.add(bolt);
        this._lightningBoltMesh = bolt;
        this._lightningBoltLife = 0.15;
    }

    _playThunder(distance) {
        const audio = this.systems.audio;
        if (!audio || !audio.ctx) return;

        const ctx = audio.ctx;
        const now = ctx.currentTime;

        // Volume based on distance
        const volume = Math.max(0.05, 0.6 * (1 - distance / 200));

        // Thunder: low-frequency noise burst with decay
        const duration = 1.5 + Math.random();
        const bufSize = ctx.sampleRate * duration;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);

        for (let i = 0; i < bufSize; i++) {
            const t = i / ctx.sampleRate;
            // Rumble envelope: quick attack, long decay with crackle
            const env = Math.exp(-t * 2) * (1 + 0.3 * Math.sin(t * 30));
            data[i] = (Math.random() * 2 - 1) * env;
        }

        const src = ctx.createBufferSource();
        src.buffer = buf;

        // Low-pass filter for rumble
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200 + Math.random() * 100;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(audio.masterGain || ctx.destination);
        src.start(now);
        src.stop(now + duration);

        // Disconnect nodes after playback to prevent audio graph leak
        src.onended = () => {
            src.disconnect();
            filter.disconnect();
            gain.disconnect();
        };
    }

    loop() {
        requestAnimationFrame(() => this.loop());

        const rawDelta = Math.min(this.clock.getDelta(), 0.05);
        this.deltaTime = rawDelta * this.timeScale; // Cap delta, apply time scale
        this.elapsedTime += this.deltaTime;
        this.frameCount++;

        // FPS counter (use raw unscaled delta so it's accurate regardless of timeScale)
        this._fpsTimerRaw = (this._fpsTimerRaw || 0) + rawDelta;
        if (this._fpsTimerRaw >= 0.5) {
            this.fps = Math.round(this.frameCount / this._fpsTimerRaw);
            this.frameCount = 0;
            this._fpsTimerRaw = 0;
        }

        // Always poll input
        this.systems.input.update();

        try {
            if (this.state === GameState.PLAYING) {
                this.stats.playtime += this.deltaTime;

                // Update all game systems
                this.updateDayNight(this.deltaTime);
                this.updateWeather(this.deltaTime);
                this.systems.world.update(this.deltaTime);
                this.systems.player.update(this.deltaTime);
                this.systems.vehicles.update(this.deltaTime);
                this.systems.physics.step(this.deltaTime);
                this.systems.vehicles.syncFromPhysics();
                this.systems.npcs.update(this.deltaTime);
                this.systems.ragdoll.update(this.deltaTime);
                this.systems.weapons.update(this.deltaTime);
                this.systems.wanted.update(this.deltaTime);
                this.systems.interiors.update(this.deltaTime);
                this.systems.ui.update(this.deltaTime);
                this.systems.audio.update(this.deltaTime);
                this.systems.missions.update(this.deltaTime);

                // Weapon wheel toggle (Tab)
                if (this.systems.input.justPressed('minimapZoom')) {
                    if (this.systems.ui.weaponWheelOpen) {
                        this.systems.ui.closeWeaponWheel();
                    } else {
                        this.systems.ui.openWeaponWheel();
                    }
                }
                if (this.systems.ui.weaponWheelOpen) {
                    this.systems.ui.updateWeaponWheel();
                }

                // Handle pause
                if (this.systems.input.justPressed('pause')) {
                    this.setState(GameState.PAUSED);
                    document.getElementById('pause-menu').style.display = 'flex';
                }

                // Handle map toggle
                if (this.systems.input.justPressed('map')) {
                    this.setState(GameState.MAP);
                    this.systems.ui.showFullMap();
                }
            } else if (this.state === GameState.PAUSED) {
                // Handle unpause
                if (this.systems.input.justPressed('pause') || this.systems.input.justPressed('cancel')) {
                    this.setState(GameState.PLAYING);
                    document.getElementById('pause-menu').style.display = 'none';
                }
            } else if (this.state === GameState.MAP) {
                this.systems.ui.updateFullMap();
                if (this.systems.input.justPressed('map') || this.systems.input.justPressed('cancel')) {
                    this.setState(GameState.PLAYING);
                    this.systems.ui.hideFullMap();
                }
            } else if (this.state === GameState.CUTSCENE) {
                this.systems.cutscenes.update(this.deltaTime);
            } else if (this.state === GameState.DEAD) {
                this.systems.ragdoll.update(this.deltaTime);
            }
        } catch (err) {
            // Show error on screen so we can debug
            if (!this._errorShown) {
                this._errorShown = true;
                const errEl = document.createElement('div');
                errEl.style.cssText = 'position:fixed;top:10px;left:10px;background:rgba(200,0,0,0.9);color:#fff;padding:12px 18px;z-index:9999;font:13px monospace;max-width:80vw;white-space:pre-wrap;border-radius:4px;';
                errEl.textContent = 'GAME ERROR: ' + err.message + '\n' + err.stack;
                document.body.appendChild(errEl);
            }
        }

        // ALWAYS update camera and render (even if systems errored above)
        try {
            this.systems.camera.update(this.deltaTime);
        } catch (e) {}

        if (this.systems.camera && this.systems.camera.camera) {
            this.updatePostProcessingUniforms();
            if (this.composer && this.postProcessing.enabled) {
                this.composer.render(this.deltaTime);
            } else {
                this.renderer.render(this.scene, this.systems.camera.camera);
            }
        }

        // Dev tools overlay (always updates)
        try {
            this.systems.devtools.update(this.deltaTime);
        } catch (e) {}
    }
}

// Export game instance and GameState
export { GameState };

// Initialize
const game = new Game();
window.game = game; // For dev console access
game.init().catch(err => {
    console.error('Game initialization failed:', err);
    const loadingEl = document.getElementById('loading-screen');
    if (loadingEl) loadingEl.innerHTML = '<div style="color:red;padding:20px;">Failed to load game. Check console for details.</div>';
});

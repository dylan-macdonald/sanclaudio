// San Claudio - Mission System
// Story missions, mission markers, objectives

export class MissionManager {
    constructor(game) {
        this.game = game;
        this.currentMission = -1; // -1 = no active mission
        this.missionPhase = 0;
        this.missionTimer = 0;
        this.missionActive = false;
        this.objectives = [];
        this.markers = [];
        this.completedMissions = new Set();

        // Mission definitions
        this.missionDefs = this.defineMissions();
    }

    init() {
        this.createMissionMarkers();
        this.initSideMissions();
        this.initStrangersFreaks();
        this.initRampages();
    }

    defineMissions() {
        return [
            // Mission 1: Fresh Off the Bus (Tutorial)
            {
                id: 1, title: 'Fresh Off the Bus', giver: 'sal',
                markerPos: { x: 10, z: 10 },
                reward: { cash: 100 },
                intro: [
                    { speaker: 'sal', text: "You must be Claudius. Come on, I'll show you where you're staying." },
                    { speaker: 'marco', text: "Thanks. This city... it's something." },
                    { speaker: 'sal', text: "San Claudio. It'll eat you alive if you let it. Follow me." }
                ],
                objectives: [
                    { type: 'goto', target: { x: 0, z: 0 }, radius: 5, text: 'Follow Sal to the safehouse' },
                    { type: 'interact', target: 'safehouse', text: 'Enter the safehouse' }
                ],
                outro: [
                    { speaker: 'sal', text: "This is your place now. Get some rest. I'll have work for you tomorrow." },
                    { speaker: 'marco', text: "I appreciate it, Sal." }
                ],
                unlocks: ['safehouse']
            },
            // Mission 2: Borrowed Wheels
            {
                id: 2, title: 'Borrowed Wheels', giver: 'sal',
                markerPos: { x: 200, z: 220 },
                reward: { cash: 200 },
                intro: [
                    { speaker: 'sal', text: "I need you to pick up a car from Hillside. Blue sedan. Don't ask whose." },
                    { speaker: 'marco', text: "You want me to steal it?" },
                    { speaker: 'sal', text: "I want you to MOVE it. Semantics." }
                ],
                objectives: [
                    { type: 'goto', target: { x: -200, z: -200 }, radius: 10, text: 'Go to Hillside' },
                    { type: 'steal_vehicle', text: 'Steal the blue sedan' },
                    { type: 'goto', target: { x: 200, z: 220 }, radius: 10, text: "Drive it to Sal's garage" }
                ],
                outro: [
                    { speaker: 'sal', text: "Nice work. Clean job. Here's your cut." },
                    { speaker: 'marco', text: "This isn't exactly what I had in mind when I came to this city." },
                    { speaker: 'sal', text: "Nobody comes to San Claudio with a plan. Plans find you." }
                ]
            },
            // Mission 3: Pest Control
            {
                id: 3, title: 'Pest Control', giver: 'sal',
                markerPos: { x: 200, z: 220 },
                reward: { cash: 300, weapon: { id: 'bat', ammo: Infinity, clipSize: Infinity } },
                intro: [
                    { speaker: 'sal', text: "Some punks have been harassing my dock workers. Go to the warehouse and clear them out." },
                    { speaker: 'marco', text: "How many?" },
                    { speaker: 'sal', text: "Four. Maybe five. Use your fists, use a bat, I don't care. Just make it stop." }
                ],
                objectives: [
                    { type: 'goto', target: { x: 220, z: 220 }, radius: 5, text: 'Go to the Docks warehouse' },
                    { type: 'kill_enemies', count: 4, text: 'Beat up the gang members (0/4)' }
                ],
                outro: [
                    { speaker: 'sal', text: "You know, I used to work with a guy named Tommy. Real hothead. Loved Hawaiian shirts." },
                    { speaker: 'sal', text: "You remind me of him. Here, take this bat. You earned it." }
                ]
            },
            // Mission 4: Collections
            {
                id: 4, title: 'Collections', giver: 'sal',
                markerPos: { x: 200, z: 220 },
                reward: { cash: 500, weapon: { id: 'pistol', ammo: 34, clipSize: 17 } },
                intro: [
                    { speaker: 'sal', text: "I need you to make some collections for me. Three stops, around the city." },
                    { speaker: 'sal', text: "Be polite, but firm. Time is money — five minutes, tops." }
                ],
                objectives: [
                    { type: 'goto', target: { x: 50, z: -50 }, radius: 5, text: 'Go to collection point 1' },
                    { type: 'goto', target: { x: 200, z: -200 }, radius: 5, text: 'Go to collection point 2' },
                    { type: 'goto', target: { x: -50, z: 50 }, radius: 5, text: 'Go to collection point 3' },
                    { type: 'goto', target: { x: 200, z: 220 }, radius: 5, text: 'Return to Sal' }
                ],
                timed: 300, // 5 minutes
                outro: [
                    { speaker: 'sal', text: "Good work. Fast. Here's something with a bit more punch." },
                    { speaker: 'sal', text: "There's a woman at Club Neon on The Strip. Nina. She has work for you." },
                    { speaker: 'marco', text: "Club Neon. Got it." }
                ]
            },
            // Mission 5-15 would follow same pattern...
            // Abbreviated for initial build - full missions to be implemented
            {
                id: 5, title: 'VIP Treatment', giver: 'nina',
                markerPos: { x: 280, z: -280 },
                reward: { cash: 800, weapon: { id: 'smg', ammo: 60, clipSize: 30 } },
                intro: [
                    { speaker: 'nina', text: "Marco, right? Sal told me about you. I need a package from Industrial Park." },
                    { speaker: 'nina', text: "My cousin keeps calling me. Wants to go bowling. I keep saying no." },
                    { speaker: 'marco', text: "I'll get your package." }
                ],
                objectives: [
                    { type: 'goto', target: { x: -200, z: 200 }, radius: 10, text: 'Go to Industrial Park' },
                    { type: 'kill_enemies', count: 4, text: 'Survive the ambush!' },
                    { type: 'goto', target: { x: 280, z: -280 }, radius: 10, text: 'Deliver to Club Neon' }
                ],
                outro: [
                    { speaker: 'nina', text: "You handled that well. Here, you'll need something with more firepower." }
                ]
            },
            // Missions 6-15 follow same structure
            { id: 6, title: 'The Repo', giver: 'nina', markerPos: { x: 280, z: -280 }, reward: { cash: 1000 },
                intro: [{ speaker: 'nina', text: "There's a red sports car on The Strip I need. It's guarded." }],
                objectives: [
                    { type: 'goto', target: { x: 250, z: -250 }, radius: 10, text: 'Go to the guarded lot' },
                    { type: 'kill_enemies', count: 5, text: 'Clear the guards' },
                    { type: 'steal_vehicle', text: 'Steal the sports car' },
                    { type: 'goto', target: { x: 280, z: -280 }, radius: 10, text: 'Deliver to Nina' }
                ],
                outro: [{ speaker: 'nina', text: "Beautiful. This one's a keeper." }]
            },
            { id: 7, title: 'Waterfront Run', giver: 'nina', markerPos: { x: 280, z: -280 }, reward: { cash: 1200, weapon: { id: 'shotgun', ammo: 16, clipSize: 8 } },
                intro: [{ speaker: 'nina', text: "Boat job. Pick up cargo from the water, bring it to the Docks." }],
                objectives: [
                    { type: 'goto', target: { x: 300, z: 300 }, radius: 5, text: 'Get to the boat' },
                    { type: 'goto', target: { x: 350, z: 350 }, radius: 10, text: 'Pick up the cargo' },
                    { type: 'goto', target: { x: 250, z: 250 }, radius: 10, text: 'Deliver to the Docks' }
                ],
                timed: 240,
                outro: [{ speaker: 'nina', text: "Right on time. Take this shotgun. You'll need it." }]
            },
            { id: 8, title: 'Club Business', giver: 'nina', markerPos: { x: 280, z: -280 }, reward: { cash: 1500 },
                intro: [{ speaker: 'nina', text: "Someone's been skimming from the club. He's hiding in Hillside." }],
                objectives: [
                    { type: 'goto', target: { x: -250, z: -250 }, radius: 10, text: 'Go to the Hillside house' },
                    { type: 'goto', target: { x: -280, z: -200 }, radius: 5, text: 'Chase him down!' },
                ],
                outro: [
                    { speaker: 'nina', text: "He talked. Turns out Chief Reyes is behind everything. The corruption runs deep." },
                    { speaker: 'marco', text: "Reyes? The police chief?" },
                    { speaker: 'nina', text: "There's a guy in Industrial. Goes by Vex. He has a plan." }
                ]
            },
            { id: 9, title: 'Meet the Geek', giver: 'vex', markerPos: { x: -220, z: 220 }, reward: { cash: 500, weapon: { id: 'rifle', ammo: 60, clipSize: 30 } },
                intro: [
                    { speaker: 'vex', text: "Three approaches. Loud, smart, or stupid. We're going smart." },
                    { speaker: 'vex', text: "Reyes has a slush fund in the Downtown bank. We're going to take it all." },
                    { speaker: 'marco', text: "A bank heist? That's insane." },
                    { speaker: 'vex', text: "That's the smart approach. First, we need to scope the bank." }
                ],
                objectives: [
                    { type: 'goto', target: { x: 250, z: -220 }, radius: 5, text: 'Go to the bank' },
                    { type: 'goto', target: { x: 250, z: -230 }, radius: 3, text: 'Identify the vault location' },
                    { type: 'goto', target: { x: -220, z: 220 }, radius: 10, text: 'Return to Vex' }
                ],
                outro: [{ speaker: 'vex', text: "Good intel. Now we need to get some hardware." }]
            },
            { id: 10, title: 'Hardware Shopping', giver: 'vex', markerPos: { x: -220, z: 220 }, reward: { cash: 2000, weapon: { id: 'grenade', ammo: 5, clipSize: 10 } },
                intro: [{ speaker: 'vex', text: "There's a military convoy in Industrial. We need their truck." }],
                objectives: [
                    { type: 'goto', target: { x: -300, z: 300 }, radius: 10, text: 'Find the military convoy' },
                    { type: 'steal_vehicle', text: 'Steal the truck' },
                    { type: 'goto', target: { x: -220, z: 220 }, radius: 10, text: "Drive to Vex's garage" }
                ],
                outro: [{ speaker: 'vex', text: "Perfect. Two more things to set up." }]
            },
            { id: 11, title: 'Inside Man', giver: 'vex', markerPos: { x: -220, z: 220 }, reward: { cash: 2000, weapon: { id: 'sniper', ammo: 10, clipSize: 5 } },
                intro: [{ speaker: 'vex', text: "Nina has a contact in the bank. Time for some stealth work." }],
                objectives: [
                    { type: 'goto', target: { x: 280, z: -280 }, radius: 5, text: 'Meet the contact at Club Neon' },
                    { type: 'goto', target: { x: 250, z: -220 }, radius: 5, text: 'Plant the device in the bank' }
                ],
                outro: [{ speaker: 'vex', text: "Device is live. One more setup mission." }]
            },
            { id: 12, title: 'Getaway Plan', giver: 'vex', markerPos: { x: -220, z: 220 }, reward: { cash: 2000, weapon: { id: 'atomizer', ammo: 20, clipSize: 20 } },
                intro: [
                    { speaker: 'vex', text: "Park getaway vehicles at three spots. Sports car at the bank, boat at the Docks, motorcycle behind The Strip." },
                    { speaker: 'vex', text: "Oh, and take this. Personal gift. Have fun." }
                ],
                objectives: [
                    { type: 'goto', target: { x: 250, z: -220 }, radius: 5, text: 'Park sports car at the bank' },
                    { type: 'goto', target: { x: 300, z: 300 }, radius: 5, text: 'Park boat at the Docks' },
                    { type: 'goto', target: { x: 250, z: -150 }, radius: 5, text: 'Park motorcycle behind The Strip' }
                ],
                outro: [{ speaker: 'vex', text: "We're ready. Meet me tomorrow. The San Claudio Job goes down." }]
            },
            { id: 13, title: 'The San Claudio Job', giver: 'vex', markerPos: { x: -220, z: 220 }, reward: { cash: 15000 },
                intro: [
                    { speaker: 'vex', text: "This is it. Drive to the bank. Stay sharp." },
                    { speaker: 'marco', text: "Let's do this." }
                ],
                objectives: [
                    { type: 'goto', target: { x: 250, z: -220 }, radius: 5, text: 'Drive to the bank' },
                    { type: 'kill_enemies', count: 9, text: 'Hold the lobby! Protect Vex!' },
                    { type: 'goto', target: { x: 250, z: -230 }, radius: 3, text: 'Grab the cash from the vault' },
                    { type: 'goto', target: { x: 250, z: -210 }, radius: 5, text: 'Fight out of the bank' },
                    { type: 'goto', target: { x: 300, z: 300 }, radius: 10, text: 'Escape to the Docks!' },
                    { type: 'goto', target: { x: 350, z: 350 }, radius: 15, text: 'Take the boat offshore' }
                ],
                outro: [
                    { speaker: 'vex', text: "WE DID IT!" },
                    { speaker: 'nina', text: "Not bad, Claudius. Not bad at all." },
                    { speaker: 'sal', text: "Drinks are on Marco tonight." }
                ]
            },
            { id: 14, title: 'Loose Ends', giver: 'sal', markerPos: { x: 0, z: 0 }, reward: { cash: 5000 },
                intro: [
                    { speaker: 'sal', text: "Reyes knows it was you. He's sent a death squad." },
                    { speaker: 'marco', text: "Then I'll be ready." }
                ],
                objectives: [
                    { type: 'kill_enemies', count: 6, text: 'Defend the safehouse!' },
                    { type: 'goto', target: { x: 50, z: 50 }, radius: 5, text: "Chase Reyes's lieutenant" },
                    { type: 'kill_enemies', count: 1, text: 'Take down the lieutenant' }
                ],
                outro: [
                    { speaker: 'marco', text: "Where is Reyes?" },
                    { speaker: 'sal', text: "Hillside mansion. The top of the hill. End this." }
                ]
            },
            { id: 15, title: 'King of San Claudio', giver: 'sal', markerPos: { x: 0, z: 0 }, reward: { cash: 25000 },
                intro: [
                    { speaker: 'marco', text: "Time to finish this." },
                    { speaker: 'sal', text: "Be careful up there. Reyes has an army." }
                ],
                objectives: [
                    { type: 'goto', target: { x: -350, z: -350 }, radius: 10, text: "Drive to Reyes's compound" },
                    { type: 'kill_enemies', count: 10, text: 'Storm the compound' },
                    { type: 'goto', target: { x: -350, z: -360 }, radius: 5, text: 'Enter the mansion' },
                    { type: 'kill_enemies', count: 3, text: 'Defeat Chief Reyes and his bodyguards' }
                ],
                outro: [
                    { speaker: 'reyes', text: "You came to the wrong house, fool." },
                    { speaker: 'marco', text: "No. I came to the right one." },
                    { speaker: 'marco', text: "San Claudio is mine now." }
                ],
                isFinale: true
            }
        ];
    }

    createMissionMarkers() {
        // Create glowing column markers for available missions
        for (const mission of this.missionDefs) {
            if (this.completedMissions.has(mission.id)) continue;

            // Only show if prerequisites are met
            if (mission.id > 1 && !this.completedMissions.has(mission.id - 1)) continue;

            const geo = new THREE.CylinderGeometry(0.5, 0.5, 8, 8);
            const mat = new THREE.MeshStandardMaterial({
                color: 0xffcc00,
                emissive: 0xffcc00,
                emissiveIntensity: 0.5,
                transparent: true,
                opacity: 0.5
            });
            const marker = new THREE.Mesh(geo, mat);
            marker.position.set(mission.markerPos.x, 4, mission.markerPos.z);
            this.game.scene.add(marker);

            this.markers.push({
                mesh: marker,
                missionId: mission.id
            });
        }
    }

    checkProximity(playerPos) {
        if (this.missionActive) return;

        for (const marker of this.markers) {
            if (!marker.mesh.visible) continue;

            const dist = playerPos.distanceTo(new THREE.Vector3(
                marker.mesh.position.x, 0, marker.mesh.position.z
            ));

            if (dist < 3) {
                const promptEl = document.getElementById('hud-interact-prompt');
                const mission = this.missionDefs.find(m => m.id === marker.missionId);
                if (mission && promptEl) {
                    promptEl.textContent = `Press E to start: ${mission.title}`;
                    promptEl.classList.add('visible');

                    if (this.game.systems.input.justPressed('interact')) {
                        this.startMission(mission);
                    }
                }
            }
        }
    }

    startMission(mission) {
        this.currentMission = mission.id;
        this.missionPhase = 0;
        this.missionActive = true;
        this.objectives = [...mission.objectives];

        // Hide marker
        const marker = this.markers.find(m => m.missionId === mission.id);
        if (marker) marker.mesh.visible = false;

        // Show mission title
        this.game.systems.ui.showMissionText(mission.title, 3);

        // Play intro dialogue
        if (mission.intro) {
            this.game.systems.cutscenes.playDialogueSequence(mission.intro, () => {
                // Start objectives
                this.showCurrentObjective();
            });
        } else {
            this.showCurrentObjective();
        }

        // Timer
        if (mission.timed) {
            this.missionTimer = mission.timed;
        }
    }

    showCurrentObjective() {
        if (this.missionPhase >= this.objectives.length) return;
        const obj = this.objectives[this.missionPhase];
        this.game.systems.ui.showMissionText(obj.text, 4);
    }

    update(dt) {
        // Always update side missions
        this.updateSideMissions(dt);
        this.updateStrangersFreaks(dt);
        this.updateRampages(dt);

        if (!this.missionActive) return;

        // Timer
        if (this.missionTimer > 0) {
            this.missionTimer -= dt;
            if (this.missionTimer <= 0) {
                this.failMission();
                return;
            }
        }

        // Check current objective
        if (this.missionPhase >= this.objectives.length) return;
        const obj = this.objectives[this.missionPhase];
        const player = this.game.systems.player;

        switch (obj.type) {
            case 'goto':
                const target = new THREE.Vector3(obj.target.x, 0, obj.target.z);
                const dist = player.position.distanceTo(target);
                if (dist < (obj.radius || 5)) {
                    this.advanceObjective();
                }
                break;

            case 'kill_enemies':
                // For now, auto-complete after a short delay (enemies would be spawned)
                if (!obj.started) {
                    obj.started = true;
                    obj.timer = 5; // Simulated combat time
                    // Spawn enemies
                    this.spawnMissionEnemies(obj.count || 4);
                }
                obj.timer -= dt;
                if (obj.timer <= 0) {
                    this.advanceObjective();
                }
                break;

            case 'steal_vehicle':
                if (player.inVehicle) {
                    this.advanceObjective();
                }
                break;

            case 'interact':
                // Handled by interaction system
                break;
        }

        // Animate mission markers
        for (const marker of this.markers) {
            if (marker.mesh.visible) {
                marker.mesh.rotation.y += dt * 2;
            }
        }
    }

    spawnMissionEnemies(count) {
        const player = this.game.systems.player;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const dist = 8 + Math.random() * 5;
            const x = player.position.x + Math.cos(angle) * dist;
            const z = player.position.z + Math.sin(angle) * dist;

            // Spawn hostile NPC
            const npc = this.game.systems.npcs.spawnPedestrian();
            if (npc && npc.mesh) {
                npc.mesh.position.set(x, 0, z);
                npc.isFleeing = false;
                npc.health = 30;
            }
        }
    }

    advanceObjective() {
        this.missionPhase++;
        if (this.missionPhase >= this.objectives.length) {
            this.completeMission();
        } else {
            this.showCurrentObjective();
        }
    }

    completeMission() {
        const mission = this.missionDefs.find(m => m.id === this.currentMission);
        if (!mission) return;

        this.missionActive = false;
        this.completedMissions.add(mission.id);
        this.game.systems.ui.waypoint = null;
        this.game.stats.missionsComplete++;

        // Play outro dialogue
        if (mission.outro) {
            this.game.systems.cutscenes.playDialogueSequence(mission.outro, () => {
                this.grantRewards(mission);
            });
        } else {
            this.grantRewards(mission);
        }

        // Auto-save
        this.game.systems.save.save();
    }

    grantRewards(mission) {
        const player = this.game.systems.player;

        if (mission.reward.cash) {
            player.addCash(mission.reward.cash);
        }

        if (mission.reward.weapon) {
            player.addWeapon(mission.reward.weapon);
        }

        // Show mission complete
        this.game.systems.ui.showMissionComplete(
            'MISSION COMPLETE',
            mission.reward.cash
        );

        // Refresh mission markers
        this.refreshMarkers();

        // Check for finale
        if (mission.isFinale) {
            this.triggerFinale();
        }
    }

    failMission() {
        this.missionActive = false;
        this.game.systems.ui.waypoint = null;
        this.game.systems.ui.showMissionText('MISSION FAILED', 3);

        // Re-show marker
        const marker = this.markers.find(m => m.missionId === this.currentMission);
        if (marker) marker.mesh.visible = true;
    }

    refreshMarkers() {
        // Show markers for newly available missions
        for (const mission of this.missionDefs) {
            if (this.completedMissions.has(mission.id)) continue;
            if (mission.id > 1 && !this.completedMissions.has(mission.id - 1)) continue;

            const existing = this.markers.find(m => m.missionId === mission.id);
            if (existing) {
                existing.mesh.visible = true;
            } else {
                // Create new marker
                const geo = new THREE.CylinderGeometry(0.5, 0.5, 8, 8);
                const mat = new THREE.MeshStandardMaterial({
                    color: 0xffcc00, emissive: 0xffcc00,
                    emissiveIntensity: 0.5, transparent: true, opacity: 0.5
                });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(mission.markerPos.x, 4, mission.markerPos.z);
                this.game.scene.add(mesh);
                this.markers.push({ mesh, missionId: mission.id });
            }
        }
    }

    triggerFinale() {
        // Show ending text, then roll credits
        setTimeout(() => {
            this.game.systems.ui.showMissionText('San Claudio is yours.', 8);
        }, 5000);
        setTimeout(() => {
            this.game.systems.ui.showCredits();
        }, 14000);
    }

    // Skip to a specific mission (for dev tools)
    skipToMission(id) {
        for (let i = 1; i < id; i++) {
            this.completedMissions.add(i);
        }
        this.missionActive = false;
        this.refreshMarkers();
    }

    // === SIDE MISSIONS / RANDOM ENCOUNTERS ===

    initSideMissions() {
        this.sideMissions = [];
        this.activeSideMission = null;
        this.sideMissionCooldown = 30; // seconds between side mission offers
        this.sideMissionMarkers = [];

        this.sideMissionDefs = [
            // Street Races
            {
                type: 'race',
                title: 'Street Race: Downtown Circuit',
                reward: 500,
                checkpoints: [
                    { x: 50, z: 0 }, { x: 100, z: -50 }, { x: 100, z: -150 },
                    { x: 0, z: -100 }, { x: -50, z: 0 }, { x: 0, z: 50 }
                ],
                timeLimit: 120
            },
            {
                type: 'race',
                title: 'Street Race: Strip Sprint',
                reward: 800,
                checkpoints: [
                    { x: 200, z: -200 }, { x: 300, z: -250 }, { x: 350, z: -350 },
                    { x: 250, z: -380 }, { x: 200, z: -300 }
                ],
                timeLimit: 90
            },
            {
                type: 'race',
                title: 'Street Race: Harbor Run',
                reward: 600,
                checkpoints: [
                    { x: -200, z: 200 }, { x: -300, z: 250 }, { x: -350, z: 350 },
                    { x: -250, z: 300 }, { x: -200, z: 200 }
                ],
                timeLimit: 100
            },
            // Assassination Targets
            {
                type: 'assassination',
                title: 'Hit: The Accountant',
                reward: 1000,
                targetPos: { x: -80, z: -80 },
                targetDesc: 'Target is near the Hillside safehouse'
            },
            {
                type: 'assassination',
                title: 'Hit: Dock Worker',
                reward: 750,
                targetPos: { x: -280, z: 280 },
                targetDesc: 'Target is working at the docks'
            },
            {
                type: 'assassination',
                title: 'Hit: Club Owner',
                reward: 1500,
                targetPos: { x: 220, z: -220 },
                targetDesc: 'Target is in The Strip'
            },
            // Package Delivery
            {
                type: 'delivery',
                title: 'Package: Express Delivery',
                reward: 400,
                pickup: { x: 30, z: 30 },
                dropoff: { x: -250, z: 250 },
                timeLimit: 60
            },
            {
                type: 'delivery',
                title: 'Package: Cross-City Rush',
                reward: 600,
                pickup: { x: -200, z: -200 },
                dropoff: { x: 300, z: -300 },
                timeLimit: 90
            },
            {
                type: 'delivery',
                title: 'Package: Dockside Drop',
                reward: 350,
                pickup: { x: 100, z: 100 },
                dropoff: { x: -300, z: 300 },
                timeLimit: 75
            },
        ];

        // Place side mission markers
        this._placeSideMissionMarkers();
    }

    _placeSideMissionMarkers() {
        // Place a few phone/marker locations for side missions
        const phoneLocations = [
            { x: 20, z: -20 },    // Downtown
            { x: -180, z: -180 }, // Hillside
            { x: 220, z: -220 },  // Strip
            { x: -220, z: 220 },  // Docks
            { x: 280, z: 280 },   // Industrial
        ];

        for (const loc of phoneLocations) {
            const geo = new THREE.CylinderGeometry(0.3, 0.3, 5, 6);
            const mat = new THREE.MeshStandardMaterial({
                color: 0x44aaff,
                emissive: 0x44aaff,
                emissiveIntensity: 0.4,
                transparent: true,
                opacity: 0.5
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(loc.x, 2.5, loc.z);
            this.game.scene.add(mesh);

            this.sideMissionMarkers.push({
                mesh: mesh,
                position: new THREE.Vector3(loc.x, 0, loc.z),
                available: true
            });
        }
    }

    updateSideMissions(dt) {
        // Animate side mission markers
        for (const marker of this.sideMissionMarkers) {
            if (marker.available && marker.mesh.visible) {
                marker.mesh.rotation.y += dt * 1.5;
                marker.mesh.position.y = 2.5 + Math.sin(Date.now() * 0.002) * 0.3;
            }
        }

        // Check proximity to side mission markers
        if (!this.activeSideMission && !this.missionActive) {
            const player = this.game.systems.player;
            for (const marker of this.sideMissionMarkers) {
                if (!marker.available) continue;
                const dist = player.position.distanceTo(marker.position);
                if (dist < 4) {
                    const promptEl = document.getElementById('hud-interact-prompt');
                    promptEl.textContent = 'Press E for a side job';
                    promptEl.classList.add('visible');

                    if (this.game.systems.input.justPressed('interact')) {
                        this._startRandomSideMission(marker);
                    }
                    break;
                }
            }
        }

        // Update active side mission
        if (this.activeSideMission) {
            this._updateActiveSideMission(dt);
        }
    }

    _startRandomSideMission(marker) {
        // Pick a random side mission
        const available = this.sideMissionDefs.filter(sd => !sd.completed);
        if (available.length === 0) return;

        const sideMission = available[Math.floor(Math.random() * available.length)];
        this.activeSideMission = { ...sideMission, marker, phase: 0, timer: sideMission.timeLimit || 0 };

        marker.available = false;
        marker.mesh.visible = false;

        this.game.systems.ui.showMissionText(sideMission.title, 3);

        // Set up based on type
        switch (sideMission.type) {
            case 'race':
                this.activeSideMission.currentCheckpoint = 0;
                this.activeSideMission.checkpointMeshes = [];
                this._createCheckpointMarkers();
                // Set waypoint to first checkpoint
                if (sideMission.checkpoints && sideMission.checkpoints.length > 0) {
                    this.game.systems.ui.waypoint = { x: sideMission.checkpoints[0].x, z: sideMission.checkpoints[0].z };
                }
                break;
            case 'assassination':
                this._spawnAssassinationTarget();
                break;
            case 'delivery':
                this.activeSideMission.phase = 'pickup';
                this._createDeliveryMarker();
                break;
        }
    }

    _createCheckpointMarkers() {
        const sm = this.activeSideMission;
        for (let i = 0; i < sm.checkpoints.length; i++) {
            const cp = sm.checkpoints[i];
            const geo = new THREE.RingGeometry(2, 3, 16);
            const mat = new THREE.MeshBasicMaterial({
                color: i === 0 ? 0x44ff44 : 0xffaa00,
                transparent: true,
                opacity: i === 0 ? 0.7 : 0.3,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(cp.x, 0.1, cp.z);
            this.game.scene.add(mesh);
            sm.checkpointMeshes.push(mesh);
        }
    }

    _spawnAssassinationTarget() {
        const sm = this.activeSideMission;
        const npc = this.game.systems.npcs.spawnPedestrian();
        if (npc && npc.mesh) {
            npc.mesh.position.set(sm.targetPos.x, 0, sm.targetPos.z);
            npc.health = 80;
            npc.isTarget = true;
            sm.targetNPC = npc;

            // Red marker above target
            const geo = new THREE.ConeGeometry(0.3, 1, 4);
            const mat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
            const marker = new THREE.Mesh(geo, mat);
            marker.position.y = 2.5;
            marker.rotation.x = Math.PI;
            npc.mesh.add(marker);
            sm.targetMarker = marker;
        }

        this.game.systems.ui.showMissionText(sm.targetDesc, 4);

        // Set waypoint to target
        this.game.systems.ui.waypoint = { x: sm.targetPos.x, z: sm.targetPos.z };
    }

    _createDeliveryMarker() {
        const sm = this.activeSideMission;

        // Pickup marker
        const geo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x44ff44,
            emissive: 0x44ff44,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.7
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(sm.pickup.x, 0.6, sm.pickup.z);
        this.game.scene.add(mesh);
        sm.pickupMesh = mesh;

        this.game.systems.ui.waypoint = { x: sm.pickup.x, z: sm.pickup.z };
        this.game.systems.ui.showMissionText('Pick up the package', 3);
    }

    _updateActiveSideMission(dt) {
        const sm = this.activeSideMission;
        const player = this.game.systems.player;

        // Timer countdown
        if (sm.timer > 0) {
            sm.timer -= dt;
            // Show timer
            const timerEl = document.getElementById('hud-escape-timer');
            if (timerEl) {
                timerEl.style.display = 'block';
                timerEl.textContent = Math.ceil(sm.timer) + 's';
                timerEl.style.color = sm.timer < 10 ? '#dd4444' : '#5599dd';
            }

            if (sm.timer <= 0) {
                this._failSideMission();
                return;
            }
        }

        switch (sm.type) {
            case 'race':
                this._updateRace(sm, player, dt);
                break;
            case 'assassination':
                this._updateAssassination(sm, player);
                break;
            case 'delivery':
                this._updateDelivery(sm, player);
                break;
        }
    }

    _updateRace(sm, player, dt) {
        if (!player.inVehicle) return;

        const cp = sm.checkpoints[sm.currentCheckpoint];
        const dist = Math.sqrt(
            (player.position.x - cp.x) ** 2 + (player.position.z - cp.z) ** 2
        );

        if (dist < 8) {
            // Hit checkpoint
            const mesh = sm.checkpointMeshes[sm.currentCheckpoint];
            if (mesh) {
                this.game.scene.remove(mesh);
                mesh.geometry.dispose();
                mesh.material.dispose();
            }

            sm.currentCheckpoint++;

            if (sm.currentCheckpoint >= sm.checkpoints.length) {
                // Race complete!
                this._completeSideMission();
            } else {
                // Highlight next checkpoint
                const nextMesh = sm.checkpointMeshes[sm.currentCheckpoint];
                if (nextMesh) {
                    nextMesh.material.color.setHex(0x44ff44);
                    nextMesh.material.opacity = 0.7;
                }
                // Update waypoint
                const next = sm.checkpoints[sm.currentCheckpoint];
                this.game.systems.ui.waypoint = { x: next.x, z: next.z };
            }
        }
    }

    _updateAssassination(sm, player) {
        if (!sm.targetNPC) return;

        if (!sm.targetNPC.alive) {
            // Target killed
            if (sm.targetMarker && sm.targetMarker.parent) {
                sm.targetMarker.parent.remove(sm.targetMarker);
            }
            this._completeSideMission();
        }
    }

    _updateDelivery(sm, player) {
        if (sm.phase === 'pickup') {
            const dist = Math.sqrt(
                (player.position.x - sm.pickup.x) ** 2 + (player.position.z - sm.pickup.z) ** 2
            );
            if (dist < 3) {
                // Picked up package
                if (sm.pickupMesh) {
                    this.game.scene.remove(sm.pickupMesh);
                    sm.pickupMesh.geometry.dispose();
                    sm.pickupMesh.material.dispose();
                }
                sm.phase = 'dropoff';

                // Create dropoff marker
                const geo = new THREE.BoxGeometry(1, 0.3, 1);
                const mat = new THREE.MeshBasicMaterial({
                    color: 0xff4444,
                    transparent: true,
                    opacity: 0.5
                });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(sm.dropoff.x, 0.15, sm.dropoff.z);
                this.game.scene.add(mesh);
                sm.dropoffMesh = mesh;

                this.game.systems.ui.waypoint = { x: sm.dropoff.x, z: sm.dropoff.z };
                this.game.systems.ui.showMissionText('Deliver the package', 3);

                this.game.systems.audio.playPickup();
            }
        } else if (sm.phase === 'dropoff') {
            const dist = Math.sqrt(
                (player.position.x - sm.dropoff.x) ** 2 + (player.position.z - sm.dropoff.z) ** 2
            );
            if (dist < 3) {
                if (sm.dropoffMesh) {
                    this.game.scene.remove(sm.dropoffMesh);
                    sm.dropoffMesh.geometry.dispose();
                    sm.dropoffMesh.material.dispose();
                }
                this._completeSideMission();
            }
        }
    }

    _completeSideMission() {
        const sm = this.activeSideMission;

        // Mark as completed
        const def = this.sideMissionDefs.find(d => d.title === sm.title);
        if (def) def.completed = true;

        // Grant reward
        this.game.systems.player.addCash(sm.reward);
        this.game.stats.sideMissionsComplete++;

        this.game.systems.ui.showMissionComplete(
            'SIDE JOB COMPLETE',
            sm.reward
        );

        // Cleanup
        this._cleanupSideMission();

        // Re-enable marker after delay
        if (sm.marker) {
            setTimeout(() => {
                sm.marker.available = true;
                sm.marker.mesh.visible = true;
            }, 60000); // Available again after 60 seconds
        }

        this.activeSideMission = null;

        // Hide timer
        const timerEl = document.getElementById('hud-escape-timer');
        if (timerEl) timerEl.style.display = 'none';

        this.game.systems.ui.waypoint = null;
    }

    _failSideMission() {
        this.game.systems.ui.showMissionText('SIDE JOB FAILED', 3);
        this._cleanupSideMission();

        // Re-enable marker
        if (this.activeSideMission.marker) {
            this.activeSideMission.marker.available = true;
            this.activeSideMission.marker.mesh.visible = true;
        }

        this.activeSideMission = null;

        const timerEl = document.getElementById('hud-escape-timer');
        if (timerEl) timerEl.style.display = 'none';

        this.game.systems.ui.waypoint = null;
    }

    // === STRANGERS & FREAKS ===

    initStrangersFreaks() {
        this.sfCompleted = {};  // { chainId: stagesCompleted }
        this.sfActive = null;   // Currently active S&F mission
        this.sfMarkers = [];    // Contact markers
        this.sfMeshes = [];     // Temp meshes for active mission

        this.sfChains = [
            {
                id: 'street_racer', character: 'Rick', color: 0xff4444,
                contactPos: { x: 60, z: -60 },
                stages: [
                    {
                        title: 'Street Race: Warm-Up Lap',
                        intro: [{ speaker: 'rick', text: "Think you're fast? Beat my Downtown circuit. Go!" }],
                        type: 'sf_race',
                        checkpoints: [
                            { x: 100, z: -60 }, { x: 100, z: -120 }, { x: 50, z: -120 },
                            { x: 0, z: -80 }, { x: 0, z: -20 }, { x: 60, z: -60 }
                        ],
                        timeLimit: 90, reward: 400,
                        outro: [{ speaker: 'rick', text: "Decent! But I got harder circuits. Come back." }]
                    },
                    {
                        title: 'Street Race: Strip Sprint',
                        intro: [{ speaker: 'rick', text: "This one goes through The Strip. Tight corners. Don't crash." }],
                        type: 'sf_race',
                        checkpoints: [
                            { x: 200, z: -200 }, { x: 280, z: -280 }, { x: 300, z: -350 },
                            { x: 250, z: -380 }, { x: 200, z: -300 }, { x: 200, z: -200 }
                        ],
                        timeLimit: 75, reward: 800,
                        outro: [{ speaker: 'rick', text: "You actually beat my time! One more. The big one." }]
                    },
                    {
                        title: 'Street Race: Full City Circuit',
                        intro: [{ speaker: 'rick', text: "The whole city. Every district. This is the ultimate run." }],
                        type: 'sf_race',
                        checkpoints: [
                            { x: 60, z: -60 }, { x: 200, z: -200 }, { x: 280, z: -350 },
                            { x: 200, z: 200 }, { x: -200, z: 200 }, { x: -200, z: -200 },
                            { x: 0, z: -100 }, { x: 60, z: -60 }
                        ],
                        timeLimit: 120, reward: 2000,
                        outro: [{ speaker: 'rick', text: "King of the road! Here, you earned this." }]
                    }
                ]
            },
            {
                id: 'fitness_freak', character: 'Flex', color: 0x44ff44,
                contactPos: { x: 240, z: -260 },
                stages: [
                    {
                        title: 'Fitness Challenge: Morning Jog',
                        intro: [{ speaker: 'flex', text: "You look soft, bro. Sprint to the park and back. ON FOOT. Go!" }],
                        type: 'sf_sprint',
                        waypoints: [{ x: 80, z: -80 }, { x: 240, z: -260 }],
                        timeLimit: 60, reward: 300,
                        outro: [{ speaker: 'flex', text: "Not bad for a beginner. Come back for the real workout." }]
                    },
                    {
                        title: 'Fitness Challenge: Cross-City Run',
                        intro: [{ speaker: 'flex', text: "Docks and back! No vehicles! CARDIO, baby!" }],
                        type: 'sf_sprint',
                        waypoints: [{ x: -220, z: 220 }, { x: 0, z: 0 }, { x: 240, z: -260 }],
                        timeLimit: 90, reward: 600,
                        outro: [{ speaker: 'flex', text: "You're getting stronger! One more challenge." }]
                    },
                    {
                        title: 'Fitness Challenge: Iron Marathon',
                        intro: [{ speaker: 'flex', text: "Full city loop. On foot. This separates the men from the boys." }],
                        type: 'sf_sprint',
                        waypoints: [
                            { x: -200, z: -200 }, { x: -200, z: 200 }, { x: 200, z: 200 },
                            { x: 200, z: -200 }, { x: 240, z: -260 }
                        ],
                        timeLimit: 150, reward: 1500,
                        outro: [{ speaker: 'flex', text: "BEAST MODE! You're officially swole, bro." }]
                    }
                ]
            },
            {
                id: 'conspiracy_nut', character: 'Tinfoil Ted', color: 0xaaaa00,
                contactPos: { x: -200, z: -200 },
                stages: [
                    {
                        title: 'The Truth: Hidden Signals',
                        intro: [{ speaker: 'tinfoil_ted', text: "They're watching us! Go to the radio tower on the hill. Find the signal box." }],
                        type: 'sf_investigate',
                        locations: [{ x: -300, z: -300, hint: 'Check the radio tower base' }],
                        reward: 400,
                        outro: [{ speaker: 'tinfoil_ted', text: "I KNEW IT! A government frequency! Come back, there's more." }]
                    },
                    {
                        title: 'The Truth: Paper Trail',
                        intro: [{ speaker: 'tinfoil_ted', text: "Documents at the bank and the police station. Get evidence!" }],
                        type: 'sf_investigate',
                        locations: [
                            { x: 250, z: -220, hint: 'Search the bank rear entrance' },
                            { x: 30, z: 30, hint: 'Check behind the government building' }
                        ],
                        reward: 700,
                        outro: [{ speaker: 'tinfoil_ted', text: "Deep state confirmed! One final lead..." }]
                    },
                    {
                        title: 'The Truth: The Bunker',
                        intro: [{ speaker: 'tinfoil_ted', text: "There's an underground bunker in Industrial. The mother lode of secrets!" }],
                        type: 'sf_investigate',
                        locations: [
                            { x: -280, z: 280, hint: 'Find the hidden hatch near the warehouses' },
                            { x: -300, z: 300, hint: 'Locate the server room' },
                            { x: -250, z: 250, hint: 'Retrieve the master file' }
                        ],
                        reward: 1500,
                        outro: [{ speaker: 'tinfoil_ted', text: "The truth is out! They can't hide anymore! ...I need to lay low." }]
                    }
                ]
            },
            {
                id: 'collector', character: 'Margaret', color: 0xff88ff,
                contactPos: { x: 80, z: -80 },
                stages: [
                    {
                        title: 'Collection: Lost Heirlooms',
                        intro: [{ speaker: 'margaret', text: "My late husband hid valuables around Downtown. Find 5 for me, dear." }],
                        type: 'sf_collect',
                        area: { x: 0, z: 0, radius: 150 }, count: 5, timeLimit: 120,
                        reward: 500,
                        outro: [{ speaker: 'margaret', text: "Oh wonderful! There are more in other parts of the city..." }]
                    },
                    {
                        title: 'Collection: Dockside Treasures',
                        intro: [{ speaker: 'margaret', text: "He had a storage unit at the Docks. Find 7 items, would you?" }],
                        type: 'sf_collect',
                        area: { x: -250, z: 250, radius: 120 }, count: 7, timeLimit: 150,
                        reward: 900,
                        outro: [{ speaker: 'margaret', text: "Marvelous! One last set of treasures remains." }]
                    },
                    {
                        title: 'Collection: City-Wide Hunt',
                        intro: [{ speaker: 'margaret', text: "The final pieces are scattered across the city. Find all 10!" }],
                        type: 'sf_collect',
                        area: { x: 0, z: 0, radius: 350 }, count: 10, timeLimit: 240,
                        reward: 2500,
                        outro: [{ speaker: 'margaret', text: "You found everything! My husband would be so grateful. Take this." }]
                    }
                ]
            },
            {
                id: 'pest_exterminator', character: 'Ratko', color: 0x886633,
                contactPos: { x: -250, z: 250 },
                stages: [
                    {
                        title: 'Extermination: Dock Rats',
                        intro: [{ speaker: 'ratko', text: "Rats everywhere at the docks. Kill 8 of the little monsters!" }],
                        type: 'sf_exterminate',
                        area: { x: -250, z: 250, radius: 80 }, count: 8, timeLimit: 90,
                        reward: 400,
                        outro: [{ speaker: 'ratko', text: "Good work! But there's a bigger infestation elsewhere." }]
                    },
                    {
                        title: 'Extermination: Sewer Snakes',
                        intro: [{ speaker: 'ratko', text: "Snakes in the Industrial pipes. Clear out 10 of them." }],
                        type: 'sf_exterminate',
                        area: { x: 250, z: 250, radius: 100 }, count: 10, timeLimit: 120,
                        reward: 800,
                        outro: [{ speaker: 'ratko', text: "You're a natural! One more job — the big nest." }]
                    },
                    {
                        title: 'Extermination: The Nest',
                        intro: [{ speaker: 'ratko', text: "The mother of all infestations. Hillside caves. Kill everything." }],
                        type: 'sf_exterminate',
                        area: { x: -250, z: -250, radius: 100 }, count: 15, timeLimit: 150,
                        reward: 2000,
                        outro: [{ speaker: 'ratko', text: "Clean as a whistle! You're my best exterminator." }]
                    }
                ]
            },
            {
                id: 'photographer', character: 'Artie', color: 0x44aaff,
                contactPos: { x: 260, z: -220 },
                stages: [
                    {
                        title: 'Photo Op: Strip Sights',
                        intro: [{ speaker: 'artie', text: "I need photos of 3 landmarks on The Strip for my gallery. Get close and press E!" }],
                        type: 'sf_photograph',
                        landmarks: [
                            { x: 250, z: -250, name: 'Neon Arch', radius: 8 },
                            { x: 280, z: -300, name: 'Club Neon Entrance', radius: 8 },
                            { x: 220, z: -280, name: 'Strip Fountain', radius: 8 }
                        ],
                        reward: 500,
                        outro: [{ speaker: 'artie', text: "Magnificent shots! I need more from around the city." }]
                    },
                    {
                        title: 'Photo Op: City Landmarks',
                        intro: [{ speaker: 'artie', text: "Downtown and Hillside have incredible architecture. Photograph 4 spots." }],
                        type: 'sf_photograph',
                        landmarks: [
                            { x: 0, z: 0, name: 'City Center Plaza', radius: 10 },
                            { x: 50, z: -50, name: 'Downtown Tower', radius: 8 },
                            { x: -250, z: -280, name: 'Hillside Overlook', radius: 10 },
                            { x: -200, z: -250, name: 'Old Church', radius: 8 }
                        ],
                        reward: 1000,
                        outro: [{ speaker: 'artie', text: "These are gallery-worthy! One last assignment." }]
                    },
                    {
                        title: 'Photo Op: Hidden Gems',
                        intro: [{ speaker: 'artie', text: "Secret spots. The rooftop view, the dock cranes, the bridge. Find and shoot them all!" }],
                        type: 'sf_photograph',
                        landmarks: [
                            { x: -280, z: 280, name: 'Dock Cranes', radius: 10 },
                            { x: 0, z: 250, name: 'Harbor Bridge', radius: 10 },
                            { x: 300, z: 0, name: 'Eastern Overlook', radius: 10 },
                            { x: -300, z: 0, name: 'Western Cliffs', radius: 10 },
                            { x: 0, z: -300, name: 'Northern Lighthouse', radius: 10 }
                        ],
                        reward: 2500,
                        outro: [{ speaker: 'artie', text: "You have an eye for beauty! My gallery is complete. Thank you!" }]
                    }
                ]
            }
        ];

        this._placeSFMarkers();
    }

    _placeSFMarkers() {
        for (const chain of this.sfChains) {
            const completedStages = this.sfCompleted[chain.id] || 0;
            if (completedStages >= chain.stages.length) continue;

            // Green "?" marker
            const group = new THREE.Group();

            // Question mark post
            const postGeo = new THREE.CylinderGeometry(0.2, 0.2, 4, 6);
            const postMat = new THREE.MeshStandardMaterial({
                color: chain.color,
                emissive: chain.color,
                emissiveIntensity: 0.5,
                transparent: true,
                opacity: 0.6
            });
            const post = new THREE.Mesh(postGeo, postMat);
            post.position.y = 2;
            group.add(post);

            // "?" sphere on top
            const sphereGeo = new THREE.SphereGeometry(0.5, 8, 8);
            const sphere = new THREE.Mesh(sphereGeo, postMat.clone());
            sphere.position.y = 4.5;
            group.add(sphere);

            group.position.set(chain.contactPos.x, 0, chain.contactPos.z);
            this.game.scene.add(group);

            this.sfMarkers.push({
                mesh: group,
                chainId: chain.id,
                visible: true
            });
        }
    }

    updateStrangersFreaks(dt) {
        const player = this.game.systems.player;
        const input = this.game.systems.input;

        // Animate S&F markers
        for (const marker of this.sfMarkers) {
            if (marker.visible && marker.mesh.visible) {
                marker.mesh.rotation.y += dt * 1.5;
                marker.mesh.children[1].position.y = 4.5 + Math.sin(Date.now() * 0.003) * 0.3;
            }
        }

        // Check for active S&F mission
        if (this.sfActive) {
            this._updateSFMission(dt);
            return;
        }

        // Check proximity to S&F contacts
        if (this.missionActive || this.activeSideMission) return;

        for (const marker of this.sfMarkers) {
            if (!marker.visible || !marker.mesh.visible) continue;
            const chain = this.sfChains.find(c => c.id === marker.chainId);
            if (!chain) continue;

            const pos = chain.contactPos;
            const dx = player.position.x - pos.x;
            const dz = player.position.z - pos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 4) {
                const stage = this.sfCompleted[chain.id] || 0;
                const promptEl = document.getElementById('hud-interact-prompt');
                promptEl.textContent = `Press E to talk to ${chain.character}`;
                promptEl.classList.add('visible');

                if (input.justPressed('interact')) {
                    this._startSFMission(chain, stage);
                    marker.mesh.visible = false;
                    marker.visible = false;
                }
                break;
            }
        }
    }

    _startSFMission(chain, stageIndex) {
        const stage = chain.stages[stageIndex];

        this.sfActive = {
            chainId: chain.id,
            stageIndex: stageIndex,
            stage: { ...stage },
            phase: 0,
            timer: stage.timeLimit || 0,
            targets: [],
            collected: 0,
            photographed: new Set()
        };

        this.game.systems.ui.showMissionText(stage.title, 3);

        // Play intro dialogue
        if (stage.intro) {
            this.game.systems.cutscenes.playDialogueSequence(stage.intro, () => {
                this._setupSFObjectives();
            });
        } else {
            this._setupSFObjectives();
        }
    }

    _setupSFObjectives() {
        const sf = this.sfActive;
        const stage = sf.stage;

        switch (stage.type) {
            case 'sf_race':
                sf.currentCheckpoint = 0;
                sf.checkpointMeshes = [];
                for (let i = 0; i < stage.checkpoints.length; i++) {
                    const cp = stage.checkpoints[i];
                    const geo = new THREE.RingGeometry(2, 3, 16);
                    const mat = new THREE.MeshBasicMaterial({
                        color: i === 0 ? 0x44ff44 : 0xffaa00,
                        transparent: true,
                        opacity: i === 0 ? 0.7 : 0.3,
                        side: THREE.DoubleSide
                    });
                    const mesh = new THREE.Mesh(geo, mat);
                    mesh.rotation.x = -Math.PI / 2;
                    mesh.position.set(cp.x, 0.1, cp.z);
                    this.game.scene.add(mesh);
                    sf.checkpointMeshes.push(mesh);
                    this.sfMeshes.push(mesh);
                }
                this.game.systems.ui.waypoint = { x: stage.checkpoints[0].x, z: stage.checkpoints[0].z };
                break;

            case 'sf_sprint':
                sf.currentWaypoint = 0;
                sf.waypointMeshes = [];
                for (let i = 0; i < stage.waypoints.length; i++) {
                    const wp = stage.waypoints[i];
                    const geo = new THREE.CylinderGeometry(1.5, 1.5, 0.3, 16);
                    const mat = new THREE.MeshBasicMaterial({
                        color: i === 0 ? 0x44ff44 : 0xffaa00,
                        transparent: true,
                        opacity: i === 0 ? 0.7 : 0.3
                    });
                    const mesh = new THREE.Mesh(geo, mat);
                    mesh.position.set(wp.x, 0.15, wp.z);
                    this.game.scene.add(mesh);
                    sf.waypointMeshes.push(mesh);
                    this.sfMeshes.push(mesh);
                }
                this.game.systems.ui.waypoint = { x: stage.waypoints[0].x, z: stage.waypoints[0].z };
                this.game.systems.ui.showMissionText('Sprint to each checkpoint! No vehicles!', 3);
                break;

            case 'sf_investigate':
                sf.currentLocation = 0;
                sf.locationMeshes = [];
                for (const loc of stage.locations) {
                    const geo = new THREE.ConeGeometry(0.5, 1.5, 4);
                    const mat = new THREE.MeshBasicMaterial({
                        color: 0xaaaa00,
                        transparent: true,
                        opacity: 0.6
                    });
                    const mesh = new THREE.Mesh(geo, mat);
                    mesh.position.set(loc.x, 2, loc.z);
                    mesh.rotation.x = Math.PI;
                    this.game.scene.add(mesh);
                    sf.locationMeshes.push(mesh);
                    this.sfMeshes.push(mesh);
                }
                const firstLoc = stage.locations[0];
                this.game.systems.ui.waypoint = { x: firstLoc.x, z: firstLoc.z };
                this.game.systems.ui.showMissionText(firstLoc.hint, 4);
                break;

            case 'sf_collect':
                sf.collected = 0;
                sf.collectibles = [];
                for (let i = 0; i < stage.count; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = Math.random() * stage.area.radius;
                    const x = stage.area.x + Math.cos(angle) * dist;
                    const z = stage.area.z + Math.sin(angle) * dist;
                    const geo = new THREE.OctahedronGeometry(0.3, 0);
                    const mat = new THREE.MeshStandardMaterial({
                        color: 0xff88ff,
                        emissive: 0xff88ff,
                        emissiveIntensity: 0.5
                    });
                    const mesh = new THREE.Mesh(geo, mat);
                    mesh.position.set(x, 1, z);
                    this.game.scene.add(mesh);
                    sf.collectibles.push({ mesh, collected: false });
                    this.sfMeshes.push(mesh);
                }
                this.game.systems.ui.showMissionText(`Find ${stage.count} items! (0/${stage.count})`, 3);
                break;

            case 'sf_exterminate':
                sf.killCount = 0;
                sf.pests = [];
                for (let i = 0; i < stage.count; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 10 + Math.random() * stage.area.radius;
                    const x = stage.area.x + Math.cos(angle) * dist;
                    const z = stage.area.z + Math.sin(angle) * dist;

                    const npc = this.game.systems.npcs.spawnPedestrian();
                    if (npc && npc.mesh) {
                        npc.mesh.position.set(x, 0, z);
                        npc.health = 20;
                        npc.isPest = true;
                        // Make pests look different — small and dark
                        npc.mesh.scale.set(0.5, 0.5, 0.5);
                        npc.mesh.traverse(child => {
                            if (child.isMesh && child.material) {
                                child.material = child.material.clone();
                                child.material.color.setHex(0x332211);
                            }
                        });
                        // Red indicator
                        const indicator = new THREE.Mesh(
                            new THREE.SphereGeometry(0.15, 4, 4),
                            new THREE.MeshBasicMaterial({ color: 0xff0000 })
                        );
                        indicator.position.y = 2.5;
                        npc.mesh.add(indicator);
                        sf.pests.push(npc);
                    }
                }
                this.game.systems.ui.showMissionText(`Kill ${stage.count} pests! (0/${stage.count})`, 3);
                break;

            case 'sf_photograph':
                sf.photographed = new Set();
                sf.photoMarkers = [];
                for (const lm of stage.landmarks) {
                    const geo = new THREE.TorusGeometry(1.5, 0.15, 8, 16);
                    const mat = new THREE.MeshBasicMaterial({
                        color: 0x44aaff,
                        transparent: true,
                        opacity: 0.5
                    });
                    const mesh = new THREE.Mesh(geo, mat);
                    mesh.rotation.x = -Math.PI / 2;
                    mesh.position.set(lm.x, 0.2, lm.z);
                    this.game.scene.add(mesh);
                    sf.photoMarkers.push(mesh);
                    this.sfMeshes.push(mesh);
                }
                const firstLandmark = stage.landmarks[0];
                this.game.systems.ui.waypoint = { x: firstLandmark.x, z: firstLandmark.z };
                this.game.systems.ui.showMissionText(`Photograph ${stage.landmarks.length} landmarks`, 3);
                break;
        }
    }

    _updateSFMission(dt) {
        const sf = this.sfActive;
        const stage = sf.stage;
        const player = this.game.systems.player;
        const input = this.game.systems.input;

        // Timer
        if (sf.timer > 0) {
            sf.timer -= dt;
            const timerEl = document.getElementById('hud-escape-timer');
            if (timerEl) {
                timerEl.style.display = 'block';
                timerEl.textContent = Math.ceil(sf.timer) + 's';
                timerEl.style.color = sf.timer < 10 ? '#dd4444' : '#aaddff';
            }
            if (sf.timer <= 0) {
                this._failSFMission();
                return;
            }
        }

        switch (stage.type) {
            case 'sf_race': {
                if (!player.inVehicle) break;
                const cp = stage.checkpoints[sf.currentCheckpoint];
                const dist = Math.sqrt((player.position.x - cp.x) ** 2 + (player.position.z - cp.z) ** 2);
                if (dist < 8) {
                    if (sf.checkpointMeshes[sf.currentCheckpoint]) {
                        this.game.scene.remove(sf.checkpointMeshes[sf.currentCheckpoint]);
                    }
                    sf.currentCheckpoint++;
                    if (sf.currentCheckpoint >= stage.checkpoints.length) {
                        this._completeSFMission();
                    } else {
                        const next = stage.checkpoints[sf.currentCheckpoint];
                        if (sf.checkpointMeshes[sf.currentCheckpoint]) {
                            sf.checkpointMeshes[sf.currentCheckpoint].material.color.setHex(0x44ff44);
                            sf.checkpointMeshes[sf.currentCheckpoint].material.opacity = 0.7;
                        }
                        this.game.systems.ui.waypoint = { x: next.x, z: next.z };
                    }
                }
                break;
            }

            case 'sf_sprint': {
                // Must be on foot
                if (player.inVehicle) {
                    this.game.systems.ui.showMissionText('Get out of the vehicle!', 2);
                    break;
                }
                const wp = stage.waypoints[sf.currentWaypoint];
                const dist = Math.sqrt((player.position.x - wp.x) ** 2 + (player.position.z - wp.z) ** 2);
                if (dist < 5) {
                    if (sf.waypointMeshes[sf.currentWaypoint]) {
                        this.game.scene.remove(sf.waypointMeshes[sf.currentWaypoint]);
                    }
                    sf.currentWaypoint++;
                    if (sf.currentWaypoint >= stage.waypoints.length) {
                        this._completeSFMission();
                    } else {
                        const next = stage.waypoints[sf.currentWaypoint];
                        if (sf.waypointMeshes[sf.currentWaypoint]) {
                            sf.waypointMeshes[sf.currentWaypoint].material.color.setHex(0x44ff44);
                            sf.waypointMeshes[sf.currentWaypoint].material.opacity = 0.7;
                        }
                        this.game.systems.ui.waypoint = { x: next.x, z: next.z };
                    }
                }
                break;
            }

            case 'sf_investigate': {
                const loc = stage.locations[sf.currentLocation];
                const dist = Math.sqrt((player.position.x - loc.x) ** 2 + (player.position.z - loc.z) ** 2);
                if (dist < 5) {
                    const promptEl = document.getElementById('hud-interact-prompt');
                    promptEl.textContent = 'Press E to investigate';
                    promptEl.classList.add('visible');

                    if (input.justPressed('interact')) {
                        if (sf.locationMeshes[sf.currentLocation]) {
                            this.game.scene.remove(sf.locationMeshes[sf.currentLocation]);
                        }
                        this.game.systems.audio.playPickup();
                        sf.currentLocation++;
                        if (sf.currentLocation >= stage.locations.length) {
                            this._completeSFMission();
                        } else {
                            const nextLoc = stage.locations[sf.currentLocation];
                            this.game.systems.ui.waypoint = { x: nextLoc.x, z: nextLoc.z };
                            this.game.systems.ui.showMissionText(nextLoc.hint, 4);
                        }
                    }
                }
                break;
            }

            case 'sf_collect': {
                for (const item of sf.collectibles) {
                    if (item.collected) continue;
                    item.mesh.rotation.y += dt * 3;
                    item.mesh.position.y = 1 + Math.sin(Date.now() * 0.004 + item.mesh.position.x) * 0.2;
                    const dist = Math.sqrt(
                        (player.position.x - item.mesh.position.x) ** 2 +
                        (player.position.z - item.mesh.position.z) ** 2
                    );
                    if (dist < 2.5) {
                        item.collected = true;
                        this.game.scene.remove(item.mesh);
                        sf.collected++;
                        this.game.systems.audio.playPickup();
                        if (sf.collected >= stage.count) {
                            this._completeSFMission();
                        } else {
                            this.game.systems.ui.showMissionText(
                                `Found! (${sf.collected}/${stage.count})`, 2
                            );
                        }
                    }
                }
                break;
            }

            case 'sf_exterminate': {
                let killed = 0;
                for (const pest of sf.pests) {
                    if (!pest.alive) killed++;
                }
                if (killed > sf.killCount) {
                    sf.killCount = killed;
                    if (sf.killCount >= stage.count) {
                        this._completeSFMission();
                    } else {
                        this.game.systems.ui.showMissionText(
                            `Pests eliminated: ${sf.killCount}/${stage.count}`, 2
                        );
                    }
                }
                break;
            }

            case 'sf_photograph': {
                for (let i = 0; i < stage.landmarks.length; i++) {
                    if (sf.photographed.has(i)) continue;
                    const lm = stage.landmarks[i];
                    const dist = Math.sqrt(
                        (player.position.x - lm.x) ** 2 + (player.position.z - lm.z) ** 2
                    );
                    if (dist < (lm.radius || 8)) {
                        const promptEl = document.getElementById('hud-interact-prompt');
                        promptEl.textContent = `Press E to photograph: ${lm.name}`;
                        promptEl.classList.add('visible');

                        if (input.justPressed('interact')) {
                            sf.photographed.add(i);
                            if (sf.photoMarkers[i]) {
                                this.game.scene.remove(sf.photoMarkers[i]);
                            }
                            this.game.systems.audio.playPickup();

                            // Camera flash effect
                            const flashEl = document.createElement('div');
                            flashEl.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;opacity:0.8;z-index:9999;pointer-events:none;';
                            document.body.appendChild(flashEl);
                            setTimeout(() => flashEl.remove(), 150);

                            this.game.systems.ui.showMissionText(
                                `Photographed: ${lm.name} (${sf.photographed.size}/${stage.landmarks.length})`, 3
                            );

                            if (sf.photographed.size >= stage.landmarks.length) {
                                this._completeSFMission();
                            } else {
                                // Point to next un-photographed landmark
                                for (let j = 0; j < stage.landmarks.length; j++) {
                                    if (!sf.photographed.has(j)) {
                                        this.game.systems.ui.waypoint = { x: stage.landmarks[j].x, z: stage.landmarks[j].z };
                                        break;
                                    }
                                }
                            }
                        }
                        break; // Only show prompt for one landmark at a time
                    }
                }
                break;
            }
        }
    }

    _completeSFMission() {
        const sf = this.sfActive;
        const chain = this.sfChains.find(c => c.id === sf.chainId);
        const stage = sf.stage;

        // Grant reward
        this.game.systems.player.addCash(stage.reward);

        // Update completion
        if (!this.sfCompleted[sf.chainId]) this.sfCompleted[sf.chainId] = 0;
        this.sfCompleted[sf.chainId]++;
        this.game.stats.strangersComplete++;

        // Show completion
        this.game.systems.ui.showMissionComplete(
            `${chain.character}: Stage ${sf.stageIndex + 1} Complete!`,
            stage.reward
        );

        // Play outro
        if (stage.outro) {
            this.game.systems.cutscenes.playDialogueSequence(stage.outro, () => {});
        }

        // Cleanup
        this._cleanupSFMission();

        // Re-show marker if more stages
        if (this.sfCompleted[sf.chainId] < chain.stages.length) {
            const marker = this.sfMarkers.find(m => m.chainId === sf.chainId);
            if (marker) {
                setTimeout(() => {
                    marker.mesh.visible = true;
                    marker.visible = true;
                }, 30000); // Available again after 30s
            }
        }

        this.sfActive = null;

        // Hide timer
        const timerEl = document.getElementById('hud-escape-timer');
        if (timerEl) timerEl.style.display = 'none';
        this.game.systems.ui.waypoint = null;

        // Auto-save
        this.game.systems.save.save();
    }

    _failSFMission() {
        this.game.systems.ui.showMissionText('CHALLENGE FAILED', 3);
        this._cleanupSFMission();

        // Re-show marker
        const marker = this.sfMarkers.find(m => m.chainId === this.sfActive.chainId);
        if (marker) {
            marker.mesh.visible = true;
            marker.visible = true;
        }

        this.sfActive = null;

        const timerEl = document.getElementById('hud-escape-timer');
        if (timerEl) timerEl.style.display = 'none';
        this.game.systems.ui.waypoint = null;
    }

    _cleanupSFMission() {
        // Remove all temp meshes
        for (const mesh of this.sfMeshes) {
            this.game.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        }
        this.sfMeshes = [];

        const sf = this.sfActive;
        if (!sf) return;

        // Cleanup checkpoints
        if (sf.checkpointMeshes) {
            for (const mesh of sf.checkpointMeshes) {
                this.game.scene.remove(mesh);
                if (mesh.geometry) mesh.geometry.dispose();
                if (mesh.material) mesh.material.dispose();
            }
        }

        // Cleanup collectibles
        if (sf.collectibles) {
            for (const item of sf.collectibles) {
                if (!item.collected) {
                    this.game.scene.remove(item.mesh);
                    item.mesh.geometry.dispose();
                    item.mesh.material.dispose();
                }
            }
        }

        // Cleanup pests (they'll die naturally or despawn)
        if (sf.pests) {
            for (const pest of sf.pests) {
                if (pest.alive && pest.mesh) {
                    pest.health = 0;
                    pest.alive = false;
                }
            }
        }
    }

    // === RAMPAGES ===

    initRampages() {
        this.rampages = [];
        this.activeRampage = null;
        this.rampageMarkers = [];

        this.rampageDefs = [
            {
                id: 'rampage_downtown', name: 'Downtown Rampage',
                pos: { x: 40, z: -100 },
                weapon: 'smg', ammo: 120,
                killTarget: 15, timeLimit: 60, reward: 1000
            },
            {
                id: 'rampage_strip', name: 'Strip Rampage',
                pos: { x: 230, z: -300 },
                weapon: 'shotgun', ammo: 40,
                killTarget: 12, timeLimit: 60, reward: 1200
            },
            {
                id: 'rampage_docks', name: 'Docks Rampage',
                pos: { x: -260, z: 270 },
                weapon: 'rifle', ammo: 90,
                killTarget: 18, timeLimit: 60, reward: 1500
            },
            {
                id: 'rampage_hillside', name: 'Hillside Rampage',
                pos: { x: -230, z: -270 },
                weapon: 'grenade', ammo: 15,
                killTarget: 10, timeLimit: 60, reward: 2000
            },
            {
                id: 'rampage_industrial', name: 'Industrial Rampage',
                pos: { x: 270, z: 270 },
                weapon: 'atomizer', ammo: 30,
                killTarget: 20, timeLimit: 60, reward: 2500
            }
        ];

        this.rampageCompleted = new Set();
        this._placeRampageMarkers();
    }

    _placeRampageMarkers() {
        for (const ramp of this.rampageDefs) {
            if (this.rampageCompleted.has(ramp.id)) continue;

            // Skull-shaped marker (red pulsing sphere)
            const geo = new THREE.SphereGeometry(0.4, 6, 6);
            const mat = new THREE.MeshStandardMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 0.8,
                transparent: true,
                opacity: 0.5
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(ramp.pos.x, 1, ramp.pos.z);
            this.game.scene.add(mesh);

            this.rampageMarkers.push({
                mesh, rampageId: ramp.id, visible: true
            });
        }
    }

    updateRampages(dt) {
        const player = this.game.systems.player;
        const input = this.game.systems.input;

        // Animate markers
        for (const marker of this.rampageMarkers) {
            if (marker.visible && marker.mesh.visible) {
                marker.mesh.material.emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.005) * 0.3;
                marker.mesh.position.y = 1 + Math.sin(Date.now() * 0.003) * 0.2;
            }
        }

        // Active rampage
        if (this.activeRampage) {
            this._updateActiveRampage(dt);
            return;
        }

        // Check proximity
        if (this.missionActive || this.activeSideMission || this.sfActive) return;

        for (const marker of this.rampageMarkers) {
            if (!marker.visible || !marker.mesh.visible) continue;
            const ramp = this.rampageDefs.find(r => r.id === marker.rampageId);
            if (!ramp) continue;

            const dx = player.position.x - ramp.pos.x;
            const dz = player.position.z - ramp.pos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 3) {
                const promptEl = document.getElementById('hud-interact-prompt');
                promptEl.textContent = `Press E — ${ramp.name} (Kill ${ramp.killTarget} in ${ramp.timeLimit}s)`;
                promptEl.classList.add('visible');

                if (input.justPressed('interact')) {
                    this._startRampage(ramp, marker);
                }
                break;
            }
        }
    }

    _startRampage(ramp, marker) {
        marker.mesh.visible = false;
        marker.visible = false;

        // Store original weapon state
        const player = this.game.systems.player;
        this._rampageOrigWeapons = player.weapons.map(w => ({ ...w }));
        this._rampageOrigIndex = player.currentWeaponIndex;

        // Give rampage weapon
        player.addWeapon({ id: ramp.weapon, ammo: ramp.ammo, clipSize: this.game.systems.weapons.weaponDefs[ramp.weapon].clipSize });
        // Select it
        const wIdx = player.weapons.findIndex(w => w.id === ramp.weapon);
        if (wIdx >= 0) player.currentWeaponIndex = wIdx;

        // Spawn enemies around the area
        const enemies = [];
        for (let i = 0; i < ramp.killTarget + 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 10 + Math.random() * 30;
            const x = ramp.pos.x + Math.cos(angle) * dist;
            const z = ramp.pos.z + Math.sin(angle) * dist;
            const npc = this.game.systems.npcs.spawnPedestrian();
            if (npc && npc.mesh) {
                npc.mesh.position.set(x, 0, z);
                npc.health = 30;
                npc.isRampageTarget = true;
                enemies.push(npc);
            }
        }

        this.activeRampage = {
            def: ramp,
            marker: marker,
            timer: ramp.timeLimit,
            killCount: 0,
            enemies: enemies
        };

        this.game.systems.ui.showMissionText(`RAMPAGE! Kill ${ramp.killTarget} in ${ramp.timeLimit}s!`, 3);
    }

    _updateActiveRampage(dt) {
        const ar = this.activeRampage;

        ar.timer -= dt;

        // Show timer
        const timerEl = document.getElementById('hud-escape-timer');
        if (timerEl) {
            timerEl.style.display = 'block';
            timerEl.textContent = `${ar.killCount}/${ar.def.killTarget} — ${Math.ceil(ar.timer)}s`;
            timerEl.style.color = ar.timer < 10 ? '#dd4444' : '#ff8844';
        }

        // Count kills
        let killed = 0;
        for (const enemy of ar.enemies) {
            if (!enemy.alive) killed++;
        }
        ar.killCount = killed;

        if (ar.killCount >= ar.def.killTarget) {
            this._completeRampage();
            return;
        }

        if (ar.timer <= 0) {
            this._failRampage();
        }
    }

    _completeRampage() {
        const ar = this.activeRampage;
        this.rampageCompleted.add(ar.def.id);
        this.game.systems.player.addCash(ar.def.reward);
        this.game.systems.ui.showMissionComplete('RAMPAGE COMPLETE!', ar.def.reward);

        this._cleanupRampage();
    }

    _failRampage() {
        this.game.systems.ui.showMissionText('RAMPAGE FAILED', 3);

        // Re-show marker
        this.activeRampage.marker.mesh.visible = true;
        this.activeRampage.marker.visible = true;

        this._cleanupRampage();
    }

    _cleanupRampage() {
        // Restore original weapons
        const player = this.game.systems.player;
        if (this._rampageOrigWeapons) {
            player.weapons = this._rampageOrigWeapons;
            player.currentWeaponIndex = this._rampageOrigIndex;
            this._rampageOrigWeapons = null;
        }

        // Despawn rampage enemies
        if (this.activeRampage && this.activeRampage.enemies) {
            for (const enemy of this.activeRampage.enemies) {
                if (enemy.alive && enemy.mesh) {
                    enemy.health = 0;
                    enemy.alive = false;
                }
            }
        }

        const timerEl = document.getElementById('hud-escape-timer');
        if (timerEl) timerEl.style.display = 'none';
        this.activeRampage = null;
    }

    _cleanupSideMission() {
        const sm = this.activeSideMission;
        if (!sm) return;

        // Cleanup race checkpoints
        if (sm.checkpointMeshes) {
            for (const mesh of sm.checkpointMeshes) {
                this.game.scene.remove(mesh);
                mesh.geometry.dispose();
                mesh.material.dispose();
            }
        }

        // Cleanup delivery markers
        if (sm.pickupMesh) {
            this.game.scene.remove(sm.pickupMesh);
            sm.pickupMesh.geometry.dispose();
            sm.pickupMesh.material.dispose();
        }
        if (sm.dropoffMesh) {
            this.game.scene.remove(sm.dropoffMesh);
            sm.dropoffMesh.geometry.dispose();
            sm.dropoffMesh.material.dispose();
        }

        // Cleanup assassination target marker
        if (sm.targetMarker && sm.targetMarker.parent) {
            sm.targetMarker.parent.remove(sm.targetMarker);
        }
    }
}

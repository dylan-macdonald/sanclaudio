// San Claudio - Dev Tools & Cheat Codes
// Console overlay, cheat commands, debug shortcuts

export class DevTools {
    constructor(game) {
        this.game = game;
        this.consoleVisible = false;
        this.commandHistory = [];
        this.historyIndex = -1;
        this.debugOverlayVisible = false;
        this.collisionBoxesVisible = false;
        this.wireframeMode = false;
        this.godMode = false;

        this.consoleEl = document.getElementById('dev-console');
        this.consoleOutput = document.getElementById('console-output');
        this.consoleInput = document.getElementById('console-input');

        // Test suite state
        this.testSuiteActive = false;
        this.testSuiteId = null;
        this.testResults = [];
        this.bugReports = [];
        this.currentTestIndex = 0;
        this.awaitingRating = false;
        this.awaitingFeedback = false;
        this.currentRating = null;

        this.testSuites = {
            physics: {
                name: 'Rapier.js Physics Integration',
                tests: [
                    { id: 'P1', name: 'Physics Engine Load', instruction: 'Check if the game loaded without console errors. Press F1 to show debug overlay and confirm it works. Walk around a bit.' },
                    { id: 'P2', name: 'Player-Building Collision', instruction: 'Walk into a building wall. You should be stopped smoothly without clipping through. Try sliding along the wall by walking at an angle.' },
                    { id: 'P3', name: 'Player Ground Detection', instruction: 'Jump (Space) and land. Player should land on the ground properly. Try jumping near building walls.' },
                    { id: 'P4', name: 'Vehicle-Building Collision', instruction: 'Get in a car (E near vehicle) and drive into a building. Car should bounce back at ~30% speed, not clip through.' },
                    { id: 'P5', name: 'Vehicle-Vehicle Collision', instruction: 'Drive a car into another parked vehicle. Both should deflect/interact, not pass through each other.' },
                    { id: 'P6', name: 'Driving Feel Preserved', instruction: 'Drive a sedan then a sports car. Steering, acceleration, and speed limits should feel the same as before. Try both W/S and A/D.' },
                    { id: 'P7', name: 'Bullets Blocked by Walls', instruction: 'Pick up a weapon (walk over the glowing cubes). Position yourself so a building is between you and an NPC. Shoot — bullet should hit the wall (small flash), not the NPC.' },
                    { id: 'P8', name: 'Camera Building Collision', instruction: 'Stand next to a tall building and orbit the camera (mouse) so it would go behind the building. Camera should pull in instead of clipping through.' }
                ]
            },
            trees: {
                name: 'Tree Variety & Density',
                tests: [
                    { id: 'T1', name: 'Tree Density Increase', instruction: 'Teleport to hillside (open console, type: tp hillside). Look around — there should be many more trees than a sparse field. Forests should feel lush.' },
                    { id: 'T2', name: 'Tree Color Variety', instruction: 'Look closely at groups of trees. Each tree should have a slightly different shade of green — not all identical. Some lighter, some darker.' },
                    { id: 'T3', name: 'Tree Size & Rotation Variety', instruction: 'Look at the trees more closely. They should vary in size (0.8x to 1.3x) and each face a different direction, not all identical clones.' }
                ]
            },
            map: {
                name: 'Zoomable Full Map',
                tests: [
                    { id: 'M1', name: 'Map Opens & Shows Player', instruction: 'Press M to open the full map. You should see your position indicated by a white arrow, centered on the map.' },
                    { id: 'M2', name: 'Map Zoom', instruction: 'With map open, scroll mouse wheel up to zoom in, and down to zoom out. Should zoom smoothly between 0.5x and 8x.' },
                    { id: 'M3', name: 'Map Pan', instruction: 'With map open, right-click and drag to pan around the map. The view should move smoothly.' },
                    { id: 'M4', name: 'Waypoint at Correct Position', instruction: 'Zoom in on the map, then left-click to set a waypoint. Close map (M), then open minimap — the red dot should be in the correct world position. Walk toward it.' }
                ]
            },
            general: {
                name: 'General Gameplay',
                tests: [
                    { id: 'G1', name: 'NPC Behavior', instruction: 'Walk around downtown and observe NPCs. They should walk on sidewalks, turn at intersections, and not behave erratically.' },
                    { id: 'G2', name: 'Ragdoll System', instruction: 'Attack an NPC (left click with fists or weapon). When they die, ragdoll should launch them properly.' },
                    { id: 'G3', name: 'Wanted System', instruction: 'Attack several NPCs or steal a car. Stars should appear. Police should respond.' },
                    { id: 'G4', name: 'Performance', instruction: 'Toggle FPS counter (open console, type: fps). Walk around the city. FPS should be stable — similar or better than before the physics update.' }
                ]
            },
            audio: {
                name: 'Audio & Sound Systems',
                tests: [
                    { id: 'A1', name: 'Ambient City Sounds', instruction: 'Stand still in the city. You should hear a low background traffic hum. Listen for occasional distant car honks. Birds should chirp during daytime.' },
                    { id: 'A2', name: 'Night Ambient Sounds', instruction: 'Open console, type: time 22. Listen for crickets chirping instead of birds. Traffic should be quieter.' },
                    { id: 'A3', name: 'Engine Sound', instruction: 'Get in a vehicle (E). The engine sound should start and increase in pitch as you accelerate. It should idle when stopped.' },
                    { id: 'A4', name: 'Tire Screech', instruction: 'While driving fast (W), turn sharply (A or D). You should hear a tire screech sound. Louder at higher speeds.' },
                    { id: 'A5', name: 'Crash Sound & Shake', instruction: 'Drive a car into a building at speed. You should hear a crash sound, the screen should shake, and the vehicle should take damage.' },
                    { id: 'A6', name: 'Engine Stops on Exit', instruction: 'Drive a vehicle, then exit (E). The engine sound should stop immediately.' }
                ]
            },
            weather: {
                name: 'Weather & Rain System',
                tests: [
                    { id: 'W1', name: 'Rain Particles', instruction: 'Open console, type: weather rain. Rain should appear as falling streaks. They should be angled, not perfectly vertical.' },
                    { id: 'W2', name: 'Rain Splashes', instruction: 'During rain, look at the ground. You should see small expanding splash rings where raindrops land.' },
                    { id: 'W3', name: 'Storm Weather', instruction: 'Open console, type: weather storm. Rain should be heavier and more angled. Wind should be audible.' },
                    { id: 'W4', name: 'Weather Clear', instruction: 'Open console, type: weather clear. Rain should stop, sky should clear up.' }
                ]
            },
            npcs: {
                name: 'NPC Variety & Behavior',
                tests: [
                    { id: 'N1', name: 'District Color Palettes', instruction: 'Walk around Downtown — NPCs should wear business/neutral colors. Then tp strip — NPCs should have neon/bright colors. tp docks — workwear blues/browns.' },
                    { id: 'N2', name: 'Idle Behaviors', instruction: 'Observe NPCs closely. Some should be checking phones (subtle head bob), some standing around looking idle, and most walking.' },
                    { id: 'N3', name: 'NPC Conversations', instruction: 'Walk near groups of NPCs and wait. Two nearby NPCs should occasionally have a conversation (back-and-forth dialogue bubbles).' },
                    { id: 'N4', name: 'District Dialogue', instruction: 'Walk near NPCs in different districts. Their dialogue lines should reference the district (e.g., Strip NPCs talk about clubs, Docks NPCs about ships).' }
                ]
            },
            vehicles_ext: {
                name: 'Vehicle Features',
                tests: [
                    { id: 'V1', name: 'Garage Store', instruction: 'Find the garage (tp to x:-215 z:225 or check minimap for blue G icon). Drive a car to it and press E. Vehicle should be stored with a message.' },
                    { id: 'V2', name: 'Garage Retrieve', instruction: 'Walk to the garage without a vehicle. Press E to retrieve a stored vehicle. It should spawn nearby.' },
                    { id: 'V3', name: 'Vehicle Collection', instruction: 'Store different vehicle types (sedan, sports, truck, motorcycle). Each new type should show "X/5 types" collection message.' },
                    { id: 'V4', name: 'Carjacking', instruction: 'Find a traffic vehicle (NPC-driven). Walk up and press E. There should be a brief delay, an NPC ejected from the car saying something, and nearby NPCs fleeing. You should get wanted heat.' },
                    { id: 'V5', name: 'Traffic Lights', instruction: 'Watch traffic vehicles at intersections. They should stop at red lights and proceed on green. Lights cycle every ~10 seconds.' }
                ]
            },
            shops: {
                name: 'Shops & Economy',
                tests: [
                    { id: 'S1', name: 'Ammu-Nation Marker', instruction: 'Check minimap for orange crosshair icons. Walk toward one. A floating rotating gun marker and "AMMU-NATION" sign should be visible.' },
                    { id: 'S2', name: 'Ammu-Nation Browse', instruction: 'Stand near the Ammu-Nation marker and press E. A shop menu should open with weapons and ammo listed with prices. Navigate with W/S.' },
                    { id: 'S3', name: 'Buy Weapon', instruction: 'In the shop, select a weapon and press E to buy. Cash should decrease and weapon should be added to your inventory.' },
                    { id: 'S4', name: 'Close Shop', instruction: 'Press Escape to close the shop. You should return to normal gameplay.' }
                ]
            },
            wanted_ext: {
                name: 'Wanted System & Pay N Spray',
                tests: [
                    { id: 'WE1', name: 'Edge Flash When Wanted', instruction: 'Get a wanted level (attack NPCs). Screen edges should pulse red. Stronger pulse at higher stars.' },
                    { id: 'WE2', name: 'Pay N Spray Locations', instruction: 'Check minimap for green circle icons. Navigate to one. You should see a small garage building with a "PAY N SPRAY" sign and floating green marker.' },
                    { id: 'WE3', name: 'Pay N Spray Usage', instruction: 'While wanted, drive a vehicle to a Pay N Spray. Press E to pay. Wanted level should clear, vehicle should flash white then get a new random color. Vehicle health should be fully restored.' },
                    { id: 'WE4', name: 'Pay N Spray Cost', instruction: 'Get different wanted levels and check the Pay N Spray price. Higher stars should cost more ($200 at 1 star, up to $5000 at 5 stars).' }
                ]
            },
            minimap_ext: {
                name: 'Minimap & Navigation',
                tests: [
                    { id: 'MM1', name: 'POI Icons on Minimap', instruction: 'Check the minimap. You should see: orange crosshairs (Ammu-Nation), green circles (Pay N Spray), blue G (Garage), yellow dots (Missions).' },
                    { id: 'MM2', name: 'Street Names', instruction: 'Walk along a road. At the bottom of the minimap, a street name should appear. At intersections, it should show "X St & Y St".' },
                    { id: 'MM3', name: 'District Name', instruction: 'Walk away from roads into a district. The minimap bottom text should show the district name instead of a street name.' },
                    { id: 'MM4', name: 'Full Map POIs', instruction: 'Press M to open the full map. Zoom in. You should see labeled icons: "Ammu-Nation" (orange), "Pay N Spray" (green), "Garage" (blue).' }
                ]
            },
            phone: {
                name: 'Phone System',
                tests: [
                    { id: 'PH1', name: 'Open Phone', instruction: 'Press T to open the phone. A contact list should appear on the right side of the screen with 6 contacts.' },
                    { id: 'PH2', name: 'Navigate & Call', instruction: 'Use W/S to navigate contacts, E to call. Call "Taxi Service" — a yellow taxi should spawn nearby.' },
                    { id: 'PH3', name: 'Mission Giver Call', instruction: 'Call Sal, Nina, or Vex. They should respond with dialogue about available missions or "nothing right now".' },
                    { id: 'PH4', name: 'Mechanic Call', instruction: 'Get in a damaged vehicle, open phone (T), call Mechanic. If you have $300, vehicle should be repaired. If not, they tell you the price.' },
                    { id: 'PH5', name: 'Close Phone', instruction: 'Press T again or Escape to close the phone. Player should be able to move again immediately.' }
                ]
            },
            properties: {
                name: 'Properties & Wardrobe',
                tests: [
                    { id: 'PR1', name: 'For Sale Signs', instruction: 'Walk around the city. You should find "For Sale" signs at 5 locations with property names and prices displayed.' },
                    { id: 'PR2', name: 'Buy Property', instruction: 'Walk to a For Sale sign with enough cash. Press E to buy. Sign should change to "OWNED". Cash should decrease.' },
                    { id: 'PR3', name: 'Rest at Property', instruction: 'Go to an owned property. Press E to rest. Health should restore to max, armor should increase by 25, and game should auto-save.' },
                    { id: 'PR4', name: 'Wardrobe', instruction: 'At an owned property, press C to open the wardrobe. Use W/S to browse outfits — player model colors should change in real-time. Press E to confirm.' },
                    { id: 'PR5', name: 'Outfit Variety', instruction: 'Cycle through all 8 outfits. Each should have a different shirt and pants color combination. Check: Default (blue), Street (red), Business (white), etc.' }
                ]
            },
            collectibles: {
                name: 'Hidden Packages',
                tests: [
                    { id: 'HP1', name: 'Package Visibility', instruction: 'Look around the city for green glowing rotating briefcases. They have a pulsing ring on the ground. One should be near the starter safehouse (0,0).' },
                    { id: 'HP2', name: 'Package Pickup', instruction: 'Walk into a hidden package. It should disappear, give you $500, and show "Hidden Package X/20".' },
                    { id: 'HP3', name: 'Package Count', instruction: 'Collect a second package. The counter should increment correctly (2/20). Open console, type: stats — hidden packages count should match.' }
                ]
            },
            daynight: {
                name: 'Day/Night Cycle Visuals',
                tests: [
                    { id: 'DN1', name: 'Sunrise Sky', instruction: 'Open console, type: time 6. The sky dome should show warm orange/pink colors at the horizon, transitioning to blue above. The sun should be low and orange.' },
                    { id: 'DN2', name: 'Midday Sky', instruction: 'Open console, type: time 12. Sky should be bright blue. Sun high and yellow-white. No stars or moon visible.' },
                    { id: 'DN3', name: 'Sunset Sky', instruction: 'Open console, type: time 18. Sky should show sunset colors — orange/purple horizon, darkening above. Sun should be low and red-orange.' },
                    { id: 'DN4', name: 'Night Sky & Moon', instruction: 'Open console, type: time 0. Sky should be very dark. Stars should be visible. A moon should appear in the sky opposite where the sun was.' },
                    { id: 'DN5', name: 'Streetlights at Night', instruction: 'While at time 0 (night), walk around. Streetlamp fixtures should glow, and nearby ground should be lit by warm point lights. Neon signs should be visible in The Strip.' },
                    { id: 'DN6', name: 'Vehicle Taillights', instruction: 'At night (time 0), look at parked cars from behind. Red taillight dots should be visible on the rear of vehicles.' }
                ]
            },
            helicopter: {
                name: 'Helicopter Vehicle',
                tests: [
                    { id: 'HE1', name: 'Helipad Exists', instruction: 'Open console, type: tp downtown. Look for concrete helipads with an "H" marking. There should be 2 in the city.' },
                    { id: 'HE2', name: 'Helicopter Spawn', instruction: 'Open console, type: spawn helicopter. A helicopter should appear ahead with a fuselage, cockpit bubble, tail boom, main rotor (4 blades), and landing skids.' },
                    { id: 'HE3', name: 'Enter Helicopter', instruction: 'Walk to the spawned helicopter and press E to enter. You should enter the cockpit. The HUD should show altitude (ALT).' },
                    { id: 'HE4', name: 'Helicopter Flight Controls', instruction: 'Press Space to gain altitude, Shift to descend. A/D to rotate (yaw). W to pitch forward and fly forward, S to pitch back. The main rotor should spin visibly.' },
                    { id: 'HE5', name: 'Helicopter Engine Sound', instruction: 'While flying, listen for the engine sound. It should have a distinct helicopter-like pitch that changes with throttle.' },
                    { id: 'HE6', name: 'Exit Helicopter', instruction: 'Land the helicopter (Shift to descend gently), then press E to exit. Player should appear on the ground next to it.' }
                ]
            },
            police: {
                name: 'Police Dispatch System',
                tests: [
                    { id: 'PO1', name: 'Police at 1 Star', instruction: 'Open console, type: wanted 1. Police should spawn on foot nearby and chase you, shouting dialogue. They attack with melee.' },
                    { id: 'PO2', name: 'Police Cars at 2 Stars', instruction: 'Type: wanted 2. Some police should arrive in white police cars. You should hear sirens periodically.' },
                    { id: 'PO3', name: 'Police Car Chase', instruction: 'Get in a vehicle and drive away at 2+ stars. Police cars should follow/drive toward you, not just sit still.' },
                    { id: 'PO4', name: 'Roadblocks at 3 Stars', instruction: 'Type: wanted 3. After 15-25 seconds, a roadblock should appear ahead of you — two white police cars angled across the road with flashing red/blue lights and a spike strip.' },
                    { id: 'PO5', name: 'Spike Strip Damage', instruction: 'Drive over a spike strip at speed. Your tires should blow (speed and handling reduced) and you should see "TIRES BLOWN!" message.' },
                    { id: 'PO6', name: 'Roadblock Cleanup', instruction: 'Clear your wanted level (Pay N Spray or type: wanted 0). All police, police cars, and roadblocks should despawn.' }
                ]
            },
            npc_drivers: {
                name: 'NPC Vehicle Occupants',
                tests: [
                    { id: 'ND1', name: 'Traffic Vehicle Drivers', instruction: 'Look at traffic vehicles (NPC-driven cars). You should see a small NPC driver model visible through the windshield — a head, torso, and arms reaching for the steering wheel.' },
                    { id: 'ND2', name: 'Driver Removed on Carjack', instruction: 'Approach a traffic vehicle and press E to carjack it. After the carjack animation, the NPC driver model should be gone from inside the vehicle.' },
                    { id: 'ND3', name: 'Different Driver Appearances', instruction: 'Look at several different traffic vehicles. The drivers should have varied skin tones and shirt colors.' }
                ]
            },
            vehicle_damage: {
                name: 'Vehicle Damage Visuals',
                tests: [
                    { id: 'VD1', name: 'Dent Deformation', instruction: 'Get in a car and drive it into buildings repeatedly. As health drops, the car body panels should visibly shift/jitter, becoming increasingly misaligned.' },
                    { id: 'VD2', name: 'Color Darkening', instruction: 'Continue damaging the car. The vehicle color should progressively darken as it takes more damage, looking dirtier/burnt.' },
                    { id: 'VD3', name: 'Smoke Stage', instruction: 'Damage the car to about 50% health. Gray/white smoke should start coming from the hood area. Below 25% it should become heavy black smoke.' },
                    { id: 'VD4', name: 'Fire Stage', instruction: 'Damage the car below 15% health. Orange/yellow fire particles should appear. After a few seconds, the car should explode.' },
                    { id: 'VD5', name: 'Explosion', instruction: 'Let the car explode (or hit it more). There should be a visible explosion effect with debris particles flying outward.' }
                ]
            },
            population: {
                name: 'Dynamic NPC Population',
                tests: [
                    { id: 'PD1', name: 'Downtown Day Crowds', instruction: 'Type: tp downtown, then time 12. Walk around. There should be a noticeable number of NPCs on the sidewalks (busy city daytime).' },
                    { id: 'PD2', name: 'Downtown Night Empty', instruction: 'Type: time 0. Stay downtown. After 30 seconds, there should be noticeably fewer NPCs walking around than during the day.' },
                    { id: 'PD3', name: 'Strip Night Crowds', instruction: 'Type: tp strip, then time 0. The Strip should have MORE NPCs at night than during the day (nightlife area).' },
                    { id: 'PD4', name: 'Hillside Sparse', instruction: 'Type: tp hillside, then time 12. Even during the day, Hillside should have fewer NPCs than Downtown — it is a quiet residential area.' }
                ]
            },
            boats: {
                name: 'Boat Gameplay',
                tests: [
                    { id: 'BT1', name: 'Dock Structures', instruction: 'Teleport to the water area (open console, type: tp docks). Look for wooden dock platforms extending into the water with support posts and cleats.' },
                    { id: 'BT2', name: 'Boat Spawns', instruction: 'Look around the water near the docks. There should be 3 boats spawned on the water.' },
                    { id: 'BT3', name: 'Enter Boat', instruction: 'Walk to a boat and press E to enter. You should enter the boat.' },
                    { id: 'BT4', name: 'Boat Bobbing', instruction: 'While in the boat, observe that it gently bobs up and down and rocks side to side, simulating waves.' },
                    { id: 'BT5', name: 'Boat Driving', instruction: 'Drive the boat with W/S (forward/back) and A/D (turn). It should move on the water surface at a reasonable speed.' },
                    { id: 'BT6', name: 'Wake Spray', instruction: 'Drive the boat at speed. Look behind — you should see small white spray particles in the wake.' },
                    { id: 'BT7', name: 'Water Boundary', instruction: 'Try driving the boat to the edge of the water area. It should slow down and be pushed back, preventing driving onto land.' }
                ]
            },
            pedestrians: {
                name: 'Pedestrian Traffic System',
                tests: [
                    { id: 'PT1', name: 'Pedestrians Wait at Red', instruction: 'Walk to an intersection with traffic lights. Watch NPCs approaching the crosswalk. When the light is red for their direction, most should stop and wait.' },
                    { id: 'PT2', name: 'Pedestrians Cross on Green', instruction: 'Continue watching the same intersection. When the light changes to green for the waiting pedestrians, they should start crossing.' },
                    { id: 'PT3', name: 'Jaywalking NPCs', instruction: 'Watch intersections for a minute. About 10% of NPCs should ignore the red light and cross anyway (jaywalking).' },
                    { id: 'PT4', name: 'Vehicle Avoidance', instruction: 'Drive toward NPCs on the road at moderate speed. They should jump out of the way of oncoming vehicles.' }
                ]
            },
            world_events: {
                name: 'Random World Events',
                tests: [
                    { id: 'EV1', name: 'Event Spawning', instruction: 'Walk around for 1-2 minutes. A random event should spawn: car chase, car accident, or robbery. A text notification should appear.' },
                    { id: 'EV2', name: 'Car Chase Event', instruction: 'If you see "A police chase races by!" — look for two vehicles speeding through, one white (police), one colored. They should follow roads.' },
                    { id: 'EV3', name: 'Accident Event', instruction: 'If you see "A car accident" — look for a damaged smoking car with 2-3 NPCs standing around it.' },
                    { id: 'EV4', name: 'Event Cleanup', instruction: 'After ~30-45 seconds, the event vehicles should despawn if you are not in them. A new event should eventually spawn.' }
                ]
            },
            strangers_freaks: {
                name: 'Strangers & Freaks',
                tests: [
                    { id: 'SF1', name: 'S&F Contact Markers', instruction: 'Look around the map — there should be 6 colored glowing "?" markers for S&F contacts: Rick (Downtown 60,-60), Flex (Strip 240,-260), Tinfoil Ted (Hillside -200,-200), Margaret (Downtown 80,-80), Ratko (Docks -250,250), Artie (Strip 260,-220). Type: tp downtown to start checking.' },
                    { id: 'SF2', name: 'Street Racer (Rick)', instruction: 'Type: tp 60 -60. Walk to Rick\'s green marker and press E. He should give dialogue, then race checkpoints appear. You must be in a vehicle. Drive through ring checkpoints. Should be timed.' },
                    { id: 'SF3', name: 'Fitness Freak (Flex)', instruction: 'Type: tp 240 -260. Walk to Flex\'s marker and press E. He should challenge you to sprint ON FOOT. Getting in a vehicle should show a warning. Sprint to waypoints within time limit.' },
                    { id: 'SF4', name: 'Conspiracy Nut (Ted)', instruction: 'Type: tp -200 -200. Walk to Ted\'s marker and press E. He should send you to investigate locations. At each location, press E to "investigate". Yellow cone markers should appear at targets.' },
                    { id: 'SF5', name: 'The Collector (Margaret)', instruction: 'Type: tp 80 -80. Walk to Margaret\'s marker and press E. She should ask you to find collectible items. Pink octahedron shapes should spawn in the area. Walk into them to collect.' },
                    { id: 'SF6', name: 'Pest Exterminator (Ratko)', instruction: 'Type: tp -250 250. Walk to Ratko\'s marker and press E. Small dark enemies with red indicators should spawn. Kill them all within the time limit.' },
                    { id: 'SF7', name: 'The Photographer (Artie)', instruction: 'Type: tp 260 -220. Walk to Artie\'s marker and press E. Go to landmark locations (blue ring markers on ground). Stand in the ring and press E to "photograph". A white flash should appear.' },
                    { id: 'SF8', name: 'S&F Chain Progression', instruction: 'After completing one stage of any S&F chain, wait 30 seconds. The contact marker should reappear for the next stage. Each chain has 3 stages.' },
                    { id: 'SF9', name: 'S&F Stats', instruction: 'After completing S&F stages, open the pause menu. The "Strangers & Freaks" stat should increment for each stage completed.' }
                ]
            },
            rampages: {
                name: 'Rampage System',
                tests: [
                    { id: 'RP1', name: 'Rampage Markers', instruction: 'Look for 5 red pulsing spheres around the map: Downtown (40,-100), Strip (230,-300), Docks (-260,270), Hillside (-230,-270), Industrial (270,270). Type: tp 40 -100 to find the first one.' },
                    { id: 'RP2', name: 'Start Rampage', instruction: 'Walk to a red rampage marker and press E. You should receive a weapon and enemies should spawn around you. A kill counter and timer should appear.' },
                    { id: 'RP3', name: 'Kill Counter', instruction: 'During a rampage, kill enemies. The HUD should show "X/Y — Zs" with kills vs target and remaining seconds.' },
                    { id: 'RP4', name: 'Rampage Complete', instruction: 'Kill enough enemies before time runs out. You should see "RAMPAGE COMPLETE!" and receive a cash reward.' },
                    { id: 'RP5', name: 'Rampage Fail', instruction: 'Start a rampage and let the timer run out without reaching the kill target. You should see "RAMPAGE FAILED" and the marker should reappear for retry.' }
                ]
            },
            heli_spotlight: {
                name: 'Police Helicopter Spotlight',
                tests: [
                    { id: 'HS1', name: 'Helicopter Spawns at 3 Stars', instruction: 'Open console, type: wanted 3. A police helicopter should appear above you with flashing red/blue lights.' },
                    { id: 'HS2', name: 'Spotlight Tracking', instruction: 'With 3+ stars, look up — the helicopter should have a visible spotlight cone pointing down at you. A light circle should be on the ground near you.' },
                    { id: 'HS3', name: 'Helicopter Follows', instruction: 'Run or drive around with 3+ stars. The helicopter should follow your position from above, circling slightly.' },
                    { id: 'HS4', name: 'Helicopter Despawns', instruction: 'Type: wanted 0 to clear wanted level. The helicopter, spotlight cone, and ground circle should all disappear.' }
                ]
            },
            grenade_arc: {
                name: 'Grenade Arc Preview',
                tests: [
                    { id: 'GA1', name: 'Arc Appears on Hold', instruction: 'Pick up grenades (type: give grenade 10). Hold the G key. A green dotted arc line should appear showing the trajectory.' },
                    { id: 'GA2', name: 'Arc Updates with Aim', instruction: 'While holding G, move the mouse to aim in different directions. The arc should update in real-time to match your aim direction.' },
                    { id: 'GA3', name: 'Landing Indicator', instruction: 'While holding G, look at the end of the arc. There should be a small red ring on the ground where the grenade will land.' },
                    { id: 'GA4', name: 'Throw on Release', instruction: 'Hold G to see the arc, then release G. The grenade should be thrown along the previewed arc path. The arc line should disappear.' }
                ]
            },
            melee_combos: {
                name: 'Melee Combo System',
                tests: [
                    { id: 'MC1', name: 'Fist Combo (3-hit)', instruction: 'Equip fists (press 1). Click attack 3 times quickly. You should see: Jab → Cross → Uppercut! Each hit does more damage. Camera shakes more with each hit.' },
                    { id: 'MC2', name: 'Bat Combo (2-hit)', instruction: 'Pick up a bat. Click attack 2 times quickly. You should see: Swing → HOME RUN! The second hit should knock the NPC back.' },
                    { id: 'MC3', name: 'Knife Combo (3-hit)', instruction: 'Equip the knife. Click attack 3 times quickly. You should see: Slash → Stab → Eviscerate! Each hit does more damage.' },
                    { id: 'MC4', name: 'Combo Reset', instruction: 'Attack once with fists, then wait 1.5 seconds. Attack again — it should restart at "Jab", not continue the combo.' },
                    { id: 'MC5', name: 'Final Hit Knockback', instruction: 'Do a full fist combo (3 hits) on an NPC. The final "Uppercut!" should knock the NPC back a few meters.' }
                ]
            },
            save_system: {
                name: 'Save System',
                tests: [
                    { id: 'SV1', name: 'Save Vehicles', instruction: 'Store a vehicle in the garage (drive to garage marker, press E). Then save the game (pause menu or safehouse). Reload the page and load save. Check that stored vehicles are preserved.' },
                    { id: 'SV2', name: 'Save Properties', instruction: 'Buy a property (if you have cash). Save the game. Reload and load save. The property should still show as owned.' },
                    { id: 'SV3', name: 'Save S&F Progress', instruction: 'Complete a Strangers & Freaks stage. Save the game. Reload and load save. The S&F progress should be preserved — completed stages should not repeat.' }
                ]
            },
            vehicle_radio: {
                name: 'Vehicle Radio System',
                tests: [
                    { id: 'VR1', name: 'Radio Station Switching', instruction: 'Get in a car (E near vehicle). Press R repeatedly. A radio display should appear at the bottom center showing station name and current song. Cycle through: Radio Off → San Claudio Rock → The Beat 107.5 → Pulse FM → Smooth Jazz 98.1 → WCSC Talk Radio → back to Radio Off.' },
                    { id: 'VR2', name: 'Radio Display Fade', instruction: 'Press R to switch station. The station/song display should appear then fade out after ~3 seconds.' },
                    { id: 'VR3', name: 'Song Rotation', instruction: 'Stay on a station for ~20-30 seconds. The display should briefly flash again showing a new song title.' },
                    { id: 'VR4', name: 'Radio Off on Exit', instruction: 'Press R until you see "Radio Off" — the display should show gray text. Exit the vehicle (E) — the display should hide.' }
                ]
            },
            ambient_wildlife: {
                name: 'Ambient Wildlife Effects',
                tests: [
                    { id: 'AW1', name: 'Bird Flocks', instruction: 'Look up at the sky around Downtown or Hillside areas. You should see small dark dots (birds) circling in flocks. There should be 4 flocks total across the map.' },
                    { id: 'AW2', name: 'Bird Scatter', instruction: 'Walk toward a bird flock. When you get close (~25 units), the birds should scatter rapidly upward and away from you.' },
                    { id: 'AW3', name: 'Butterflies', instruction: 'Visit a park area (around x:80, z:-80 or similar green zones). You should see small colorful shapes (butterflies) floating in figure-eight patterns with wing flap animation.' },
                    { id: 'AW4', name: 'Blowing Leaves', instruction: 'Look around at ground level. Small leaf particles should be drifting with the wind, spinning and falling. They respawn near you when they drift away.' }
                ]
            },
            taxi_mode: {
                name: 'Taxi Side Job System',
                tests: [
                    { id: 'TX1', name: 'Taxi Prompt', instruction: 'Find a yellow vehicle or type "spawn sedan" in console then paint it yellow. Get in — you should see "Press R to start Taxi missions" prompt (only when no mission is active).' },
                    { id: 'TX2', name: 'Fare Pickup', instruction: 'Press R to start taxi mode. A yellow marker should appear nearby. Drive to it. When close enough, the fare is picked up and a green destination marker appears.' },
                    { id: 'TX3', name: 'Fare Delivery', instruction: 'Drive to the green destination marker. A timer and fare amount should be shown. Arrive before time runs out to earn cash.' },
                    { id: 'TX4', name: 'Taxi Exit', instruction: 'While taxi mode is active, exit the vehicle (E). Taxi mode should end and display total earnings.' }
                ]
            },
            vigilante_mode: {
                name: 'Vigilante Mode',
                tests: [
                    { id: 'VG1', name: 'Vigilante Prompt', instruction: 'Find a police-style sedan or white vehicle. Get in — you should see "Press R to start Vigilante missions" prompt.' },
                    { id: 'VG2', name: 'Criminal Chase', instruction: 'Press R to start vigilante mode. A red criminal car should appear nearby. It drives away from you. A waypoint should track it.' },
                    { id: 'VG3', name: 'Criminal Takedown', instruction: 'Chase the criminal and ram into them at speed (>5 units). You should get a cash reward and "Criminal Stopped!" message. A new criminal spawns after a few seconds.' },
                    { id: 'VG4', name: 'Criminal Escape', instruction: 'Start a vigilante level and let the timer run out. The criminal should escape and vigilante mode ends.' }
                ]
            },
            stunt_scoring: {
                name: 'Stunt Jump Scoring & Slow-Mo',
                tests: [
                    { id: 'SJ1', name: 'Slow-Mo on Launch', instruction: 'Drive a car fast toward a stunt ramp (yellow arrow markers on the map). When you hit the ramp at speed, the game should slow down dramatically for a cinematic effect.' },
                    { id: 'SJ2', name: 'Time Restores on Descent', instruction: 'During a stunt jump, as the vehicle starts descending, time should gradually speed back up to normal. By landing, it should be at full speed.' },
                    { id: 'SJ3', name: 'Detailed Score Breakdown', instruction: 'Complete a stunt jump (air time >1s, distance >15m). You should see a detailed breakdown: distance, height, air time, score, and cash reward.' },
                    { id: 'SJ4', name: 'Vehicle Rotation in Air', instruction: 'During a stunt jump, the vehicle should have a slight pitch/tilt animation while airborne, adding to the cinematic feel.' },
                    { id: 'SJ5', name: 'Landing Impact', instruction: 'On landing from a stunt jump, there should be a noticeable screen shake effect.' }
                ]
            },
            drift_system: {
                name: 'Vehicle Drift/Burnout System',
                tests: [
                    { id: 'DR1', name: 'Handbrake Drift', instruction: 'Get in a car and reach decent speed (W key). Hold Space while steering (A or D). The car should slide sideways with reduced traction and tire smoke from the rear wheels.' },
                    { id: 'DR2', name: 'Drift Score Counter', instruction: 'While drifting, look at the speed display — it should show "DRIFT" with a growing point counter. Points accumulate faster at higher speed and sharper angles.' },
                    { id: 'DR3', name: 'Drift Multiplier', instruction: 'Hold a drift for over 2 seconds — multiplier should increase to x2. Over 4 seconds → x3. Over 6 seconds → x4. The color changes as multiplier increases.' },
                    { id: 'DR4', name: 'Drift Cash Reward', instruction: 'Release the handbrake (let go of Space) after a drift with 50+ points. You should get a cash bonus and a "DRIFT!" message showing final score.' },
                    { id: 'DR5', name: 'Tire Smoke Effect', instruction: 'While drifting, gray smoke particles should rise from both rear wheels of the vehicle. They should expand and fade out.' }
                ]
            },
            clothing_shop: {
                name: 'Clothing & Appearance Shop',
                tests: [
                    { id: 'CS1', name: 'Clothing Store Markers', instruction: 'Look for pink/magenta cone markers at 3 locations: Downtown (50,-50), Strip (230,-230), Docks (-200,230). Each should have a floating "CLOTHING" sign. Type: tp downtown and walk to x:50, z:-50.' },
                    { id: 'CS2', name: 'Open Shop UI', instruction: 'Walk to a clothing store marker and press E. A shop overlay should appear with color pickers for shirt/pants, toggle buttons for hat/sunglasses, and a BUY CHANGES button. Your cash should be displayed.' },
                    { id: 'CS3', name: 'Buy Shirt/Pants Color', instruction: 'In the shop, change the shirt color picker to red and pants to white. Press BUY CHANGES. $200 should be deducted and the player model torso/arms should turn red, legs should turn white.' },
                    { id: 'CS4', name: 'Toggle Hat & Sunglasses', instruction: 'In the shop, toggle Hat to ON and Sunglasses to ON. Press BUY CHANGES. $700 should be deducted. A small dark cylinder should appear on the player head (hat) and a dark bar across the eyes (sunglasses).' },
                    { id: 'CS5', name: 'Insufficient Funds', instruction: 'Open console, type: give money -99999 to reduce cash. Open the shop and try to buy changes. It should show "Not enough cash!" error message and not apply changes.' }
                ]
            },
            spike_strips: {
                name: 'Spike Strips & Roadblocks',
                tests: [
                    { id: 'SS1', name: 'Spike Strip Deployment', instruction: 'Get 2+ wanted stars (open console, type: wanted 2). Drive around for 8-15 seconds. Black spike strips should appear on roads ahead of you.' },
                    { id: 'SS2', name: 'Tire Popping Effect', instruction: 'With 2+ stars, drive over a spike strip. Your vehicle should slow dramatically (max speed reduced to ~30%). The vehicle may lower slightly.' },
                    { id: 'SS3', name: 'Spike Strip Cleanup', instruction: 'Drive far away from a spike strip (>80 units). It should be removed. Maximum 2 spike strips active at once.' },
                    { id: 'SS4', name: 'Spike Strips Removed on Clear', instruction: 'Clear your wanted level (console: wanted 0). All spike strips should be removed from the map.' }
                ]
            },
            lightning_storm: {
                name: 'Lightning Storm Effects',
                tests: [
                    { id: 'LS1', name: 'Lightning Flash', instruction: 'Open console, type: weather storm. Wait 6-18 seconds. You should see a bright white flash illuminating the entire scene — multiple rapid flashes in sequence.' },
                    { id: 'LS2', name: 'Lightning Bolt Visual', instruction: 'During a storm, when lightning strikes, look for a jagged bolt line in the sky. It appears briefly (~0.15s) with possible branches.' },
                    { id: 'LS3', name: 'Thunder Sound', instruction: 'After a lightning flash, a low rumbling thunder sound should play after a short delay (simulating sound travel). Closer strikes have louder thunder.' },
                    { id: 'LS4', name: 'Screen Flash Overlay', instruction: 'During lightning, a brief white screen overlay should flash and fade, creating a dramatic effect.' },
                    { id: 'LS5', name: 'Close Strike Camera Shake', instruction: 'When lightning strikes close to the player, there should be a subtle camera shake when the thunder hits.' }
                ]
            },
            nitro_boost: {
                name: 'Vehicle Nitro Boost System',
                tests: [
                    { id: 'NB1', name: 'Nitro Pickups', instruction: 'Look for blue glowing octahedron pickups scattered around the map (8 locations). Walk or drive over one — you should see "NITRO +1" message. Maximum 3 charges.' },
                    { id: 'NB2', name: 'Nitro Activation', instruction: 'Collect at least 1 nitro pickup. Get in a car and reach some speed. Press Shift — the car should accelerate dramatically, doubling max speed for 3 seconds.' },
                    { id: 'NB3', name: 'Nitro FOV Effect', instruction: 'While nitro is active, the camera FOV should widen noticeably (from 65 to 85 degrees), creating a speed sensation. It should smoothly return to normal after boost ends.' },
                    { id: 'NB4', name: 'Nitro Flame Effect', instruction: 'During nitro boost, blue flame particles should appear from the rear of the vehicle, creating a rocket-like exhaust effect.' },
                    { id: 'NB5', name: 'Nitro Pickup Respawn', instruction: 'Collect a nitro pickup. After 60 seconds, it should respawn at the same location. The pickup should bob and rotate while visible.' }
                ]
            },
            skid_marks: {
                name: 'Vehicle Skid Marks',
                tests: [
                    { id: 'SK1', name: 'Sharp Turn Marks', instruction: 'Get in a car and drive at speed. Turn sharply (A/D at high speed). Dark tire marks should appear on the road behind the rear wheels.' },
                    { id: 'SK2', name: 'Drift Skid Marks', instruction: 'Hold Space while steering to drift. Continuous dark skid marks should trail behind both rear wheels during the entire drift.' },
                    { id: 'SK3', name: 'Mark Fade Out', instruction: 'Leave some skid marks and wait 15-20 seconds. The marks should gradually fade to transparent and then disappear.' },
                    { id: 'SK4', name: 'Mark Limit', instruction: 'Drive around making lots of skid marks. There should be a maximum of ~100 marks visible at once — oldest ones are removed first.' }
                ]
            },
            bribe_escape: {
                name: 'Bribe Stars & Escape Zones',
                tests: [
                    { id: 'BE1', name: 'Bribe Star Pickups', instruction: 'Type "wanted 2" in console. Look for golden star pickups (5 around the map). Walk or drive through one — your wanted level should drop by 1 star. Stars only appear when you are wanted.' },
                    { id: 'BE2', name: 'Bribe Star Respawn', instruction: 'Collect a bribe star. It should disappear and respawn after ~90 seconds at the same location.' },
                    { id: 'BE3', name: 'Escape Zone Visibility', instruction: 'Type "wanted 2" in console. Look for green glowing rings on the ground at 3 locations (garage, downtown alley, docks warehouse). They pulse slightly.' },
                    { id: 'BE4', name: 'Escape Zone Timer', instruction: 'Enter a green escape zone while wanted. You should see "SAFE ZONE" message. Stay inside for 15 seconds — wanted level should be fully cleared with "ESCAPED!" message.' },
                    { id: 'BE5', name: 'Escape Zone Speed Boost', instruction: 'Get 2+ stars and enter an escape zone. The escape timer (top of screen) should count down faster than normal while inside the zone.' }
                ]
            },
            npc_reactions: {
                name: 'NPC Reaction System',
                tests: [
                    { id: 'NR1', name: 'Gunfire Duck Reaction', instruction: 'Walk near pedestrians and fire a gun (equip via "give pistol"). Nearby NPCs (<10m) should crouch/duck with hands over head and say things like "GET DOWN!" or "SHOTS FIRED!". They hold the pose for 2-3 seconds then stand back up.' },
                    { id: 'NR2', name: 'Gunfire Record Reaction', instruction: 'Fire a gun near pedestrians. NPCs at medium range (10-25m) should either flee OR pull out their phone to record. Recording NPCs hold their right arm up, face toward you, and may say "WorldStar!" or "This is going viral!"' },
                    { id: 'NR3', name: 'Explosion Cower Reaction', instruction: 'Throw a grenade near pedestrians (equip via "give grenade"). NPCs within 15m should cower (crouch low with head-shaking). NPCs 15-35m away should flee. Cowering NPCs may say "PLEASE NO!" or "I have a family!"' },
                    { id: 'NR4', name: 'Stunt Jump Cheer', instruction: 'Find a stunt ramp and complete a stunt jump successfully. Nearby pedestrians (<30m) should react by either cheering (pumping fists in the air with slight jumping) or pulling out phones to record. They should face the landing point.' },
                    { id: 'NR5', name: 'Reaction Cooldown', instruction: 'Fire a gun to trigger reactions, wait for NPCs to finish reacting (2-3s). Fire again immediately — the SAME NPCs should NOT react again for ~8-13 seconds (cooldown). Other NPCs without cooldown should still react.' }
                ]
            },
            vehicle_horn: {
                name: 'Vehicle Horn & Dodge',
                tests: [
                    { id: 'VH1', name: 'Horn Sound', instruction: 'Enter a vehicle and press H. You should hear a horn sound. Try different vehicle types (sedan, sports, truck, motorcycle) — each should have a distinct horn pitch.' },
                    { id: 'VH2', name: 'Pedestrian Dodge', instruction: 'Drive slowly toward pedestrians and press H. NPCs ahead of the vehicle should jump sideways out of the path (not just flee in a random direction). NPCs behind the vehicle should not react as strongly.' },
                    { id: 'VH3', name: 'Horn Cooldown', instruction: 'Press H rapidly. The horn should have a ~0.5s cooldown — you cannot spam it faster than that.' }
                ]
            },
            wheel_spin: {
                name: 'Vehicle Wheel Animation',
                tests: [
                    { id: 'WS1', name: 'Wheel Spin', instruction: 'Enter any vehicle and drive forward. All four wheels should visibly spin. Faster speed = faster spin. Reverse should spin wheels backward.' },
                    { id: 'WS2', name: 'Front Wheel Steering', instruction: 'While driving, steer left/right (A/D). The two front wheels should visually turn in the steering direction. Rear wheels should not turn.' },
                    { id: 'WS3', name: 'Fallback Vehicle Wheels', instruction: 'Check that non-GLB (fallback box-model) vehicles also have spinning wheels. All vehicle types should animate.' }
                ]
            }
        };
    }

    init() {
        // Console toggle
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Backquote') {
                e.preventDefault();
                this.toggleConsole();
            }

            // Debug shortcuts
            if (e.code === 'F1') { e.preventDefault(); this.toggleDebugOverlay(); }
            if (e.code === 'F2') { e.preventDefault(); this.toggleCollisionBoxes(); }
            if (e.code === 'F4') { e.preventDefault(); this.cycleWeather(); }
            if (e.code === 'F5') { e.preventDefault(); this.quickSave(); }
            if (e.code === 'F9') { e.preventDefault(); this.quickLoad(); }
        });

        // Console input
        this.consoleInput.addEventListener('keydown', (e) => {
            if (e.code === 'Enter') {
                const cmd = this.consoleInput.value.trim();
                if (cmd) {
                    this.executeCommand(cmd);
                    this.commandHistory.push(cmd);
                    this.historyIndex = this.commandHistory.length;
                }
                this.consoleInput.value = '';
            } else if (e.code === 'ArrowUp') {
                e.preventDefault();
                if (this.historyIndex > 0) {
                    this.historyIndex--;
                    this.consoleInput.value = this.commandHistory[this.historyIndex];
                }
            } else if (e.code === 'ArrowDown') {
                e.preventDefault();
                if (this.historyIndex < this.commandHistory.length - 1) {
                    this.historyIndex++;
                    this.consoleInput.value = this.commandHistory[this.historyIndex];
                } else {
                    this.historyIndex = this.commandHistory.length;
                    this.consoleInput.value = '';
                }
            } else if (e.code === 'Backquote') {
                e.preventDefault();
                this.toggleConsole();
            }

            e.stopPropagation();
        });

        // Prevent console input keys from reaching game input
        this.consoleInput.addEventListener('keyup', (e) => e.stopPropagation());
    }

    toggleConsole() {
        this.consoleVisible = !this.consoleVisible;
        this.consoleEl.style.display = this.consoleVisible ? 'flex' : 'none';
        if (this.consoleVisible) {
            this.consoleInput.focus();
        } else {
            this.consoleInput.blur();
        }
    }

    log(text, color) {
        const line = document.createElement('div');
        line.className = 'console-line';
        line.textContent = text;
        if (color) line.style.color = color;
        this.consoleOutput.appendChild(line);
        this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;

        // Fade after 3s
        setTimeout(() => line.classList.add('fading'), 3000);
    }

    executeCommand(cmd) {
        this.log('> ' + cmd, '#0f0');

        // During test suite: intercept rating and feedback before parsing as command
        if (this.testSuiteActive && this.awaitingRating) {
            const rating = parseInt(cmd.trim());
            if (rating >= 1 && rating <= 10) {
                this.currentRating = rating;
                this.awaitingRating = false;
                this.awaitingFeedback = true;
                this.log(`Rating: ${rating}/10. Now type feedback (or "skip" for no feedback):`, '#0ff');
            } else {
                this.log('Please enter a rating from 1-10:', '#f44');
            }
            return;
        }
        if (this.testSuiteActive && this.awaitingFeedback) {
            const feedback = cmd.trim().toLowerCase() === 'skip' ? '' : cmd.trim();
            this.recordTestResult(this.currentRating, feedback);
            return;
        }

        const parts = cmd.toLowerCase().split(' ');
        const command = parts[0];
        const args = parts.slice(1);

        const player = this.game.systems.player;

        switch (command) {
            case 'god':
                this.godMode = !this.godMode;
                this.log(`God mode: ${this.godMode ? 'ON' : 'OFF'}`, '#ff0');
                if (this.godMode) {
                    player.health = player.maxHealth;
                    player.armor = player.maxArmor;
                }
                break;

            case 'give':
                if (args[0] === 'weapons') {
                    const allWeapons = ['fists', 'bat', 'knife', 'pistol', 'smg', 'shotgun', 'rifle', 'sniper', 'grenade', 'atomizer'];
                    const weaponDefs = this.game.systems.weapons.weaponDefs;
                    for (const id of allWeapons) {
                        player.addWeapon({
                            id: id,
                            ammo: weaponDefs[id].clipSize === Infinity ? Infinity : weaponDefs[id].clipSize * 10,
                            clipSize: weaponDefs[id].clipSize
                        });
                    }
                    this.log('All weapons unlocked with max ammo', '#ff0');
                } else if (args[0] === 'money') {
                    const amount = parseInt(args[1]) || 99999;
                    player.addCash(amount);
                    this.log(`Added $${amount}`, '#0f0');
                }
                break;

            case 'spawn': {
                const type = args[0] || 'sedan';
                const forward = this.game.systems.camera.getForwardDirection();
                const x = player.position.x + forward.x * 8;
                const z = player.position.z + forward.z * 8;
                const v = this.game.systems.vehicles.spawnAtPosition(x, z, type);
                if (v) {
                    this.log(`Spawned ${type}`, '#ff0');
                } else {
                    this.log(`Unknown vehicle type: ${type}`, '#f44');
                }
                break;
            }

            case 'wanted': {
                const level = parseInt(args[0]);
                if (level >= 0 && level <= 5) {
                    this.game.systems.wanted.setLevel(level);
                    this.log(`Wanted level set to ${level}`, '#ff0');
                } else {
                    this.log('Usage: wanted [0-5]', '#f44');
                }
                break;
            }

            case 'tp': {
                const dest = args[0];
                const districts = {
                    downtown: { x: 0, z: 0 },
                    docks: { x: 200, z: 200 },
                    hillside: { x: -200, z: -200 },
                    strip: { x: 200, z: -200 },
                    industrial: { x: -200, z: 200 }
                };
                const interiors = ['safehouse', 'bank', 'warehouse', 'club', 'garage'];

                if (districts[dest]) {
                    player.position.set(districts[dest].x, 0, districts[dest].z);
                    player.model.position.copy(player.position);
                    this.log(`Teleported to ${dest}`, '#ff0');
                } else if (interiors.includes(dest)) {
                    this.game.systems.interiors.teleportToInterior(dest);
                    this.log(`Teleported to ${dest} interior`, '#ff0');
                } else {
                    this.log(`Unknown location: ${dest}. Try: downtown, docks, hillside, strip, industrial, safehouse, bank, warehouse, club, garage`, '#f44');
                }
                break;
            }

            case 'time': {
                const hour = parseFloat(args[0]);
                if (!isNaN(hour) && hour >= 0 && hour <= 24) {
                    this.game.timeOfDay = hour / 24;
                    this.log(`Time set to ${hour}:00`, '#ff0');
                } else {
                    this.log('Usage: time [0-24]', '#f44');
                }
                break;
            }

            case 'weather': {
                const type = args[0];
                const valid = ['clear', 'overcast', 'rain', 'fog', 'storm'];
                if (valid.includes(type)) {
                    this.game.currentWeather = type;
                    this.game.targetWeather = type;
                    this.log(`Weather set to ${type}`, '#ff0');
                } else {
                    this.log(`Usage: weather [${valid.join('/')}]`, '#f44');
                }
                break;
            }

            case 'speed': {
                const mult = parseFloat(args[0]) || 1;
                player.speedMultiplier = mult;
                this.log(`Speed multiplier: ${mult}x`, '#ff0');
                break;
            }

            case 'mission': {
                const id = parseInt(args[0]);
                if (id >= 1 && id <= 15) {
                    this.game.systems.missions.skipToMission(id);
                    this.log(`Skipped to mission ${id}`, '#ff0');
                } else {
                    this.log('Usage: mission [1-15]', '#f44');
                }
                break;
            }

            case 'complete':
                if (this.game.systems.missions.missionActive) {
                    this.game.systems.missions.completeMission();
                    this.log('Mission auto-completed', '#ff0');
                } else {
                    this.log('No active mission', '#f44');
                }
                break;

            case 'ragdoll':
                this.game.systems.ragdoll.triggerPlayerRagdoll(player);
                this.log('Ragdoll triggered', '#ff0');
                break;

            case 'explode': {
                const forward = this.game.systems.camera.getForwardDirection();
                const pos = player.position.clone().add(forward.multiplyScalar(10));
                pos.y = 0;
                this.game.systems.weapons.explode(pos, 8, 80);
                this.log('Explosion!', '#f80');
                break;
            }

            case 'noclip':
                player.noclip = !player.noclip;
                this.log(`Noclip: ${player.noclip ? 'ON' : 'OFF'}`, '#ff0');
                break;

            case 'fps':
                const fpsEl = document.getElementById('hud-fps');
                const show = fpsEl.style.display === 'none';
                fpsEl.style.display = show ? 'block' : 'none';
                this.log(`FPS counter: ${show ? 'ON' : 'OFF'}`, '#ff0');
                break;

            case 'wireframe':
                this.wireframeMode = !this.wireframeMode;
                this.game.scene.traverse((obj) => {
                    if (obj.isMesh && obj.material) {
                        obj.material.wireframe = this.wireframeMode;
                    }
                });
                this.log(`Wireframe: ${this.wireframeMode ? 'ON' : 'OFF'}`, '#ff0');
                break;

            case 'stats':
                const s = this.game.stats;
                for (const [key, val] of Object.entries(s)) {
                    this.log(`  ${key}: ${typeof val === 'number' ? val.toFixed(1) : val}`, '#aaa');
                }
                break;

            case 'killall':
                for (const npc of this.game.systems.npcs.pedestrians) {
                    npc.alive = false;
                    if (npc.mesh) npc.mesh.visible = false;
                }
                this.log('All NPCs removed', '#ff0');
                break;

            case 'heal':
                player.health = player.maxHealth;
                player.armor = player.maxArmor;
                this.log('Full health + armor', '#0f0');
                break;

            case 'hesoyam':
                this.godMode = true;
                player.health = player.maxHealth;
                player.armor = player.maxArmor;
                player.addCash(250000);
                this.log('HESOYAM activated! God mode + $250,000', '#ff0');
                break;

            case 'reset':
                this.game.systems.save.clear();
                this.log('Save wiped. Reloading...', '#f44');
                setTimeout(() => location.reload(), 500);
                break;

            case 'testsuite': {
                const suiteId = args[0];
                if (!suiteId) {
                    this.log('Available test suites:', '#ff0');
                    for (const [id, suite] of Object.entries(this.testSuites)) {
                        this.log(`  testsuite ${id} — ${suite.name} (${suite.tests.length} tests)`, '#aaa');
                    }
                    this.log('  testsuite all — Run ALL tests', '#aaa');
                    break;
                }
                if (suiteId === 'all') {
                    this.startTestSuiteAll();
                } else if (this.testSuites[suiteId]) {
                    this.startTestSuite(suiteId);
                } else {
                    this.log(`Unknown suite: ${suiteId}. Type 'testsuite' for list.`, '#f44');
                }
                break;
            }

            case 'reportbug': {
                const desc = args.join(' ');
                if (!desc) {
                    this.log('Usage: reportbug <description of bug>', '#f44');
                    break;
                }
                const report = {
                    timestamp: new Date().toISOString(),
                    description: desc,
                    playerPos: `${player.position.x.toFixed(1)}, ${player.position.y.toFixed(1)}, ${player.position.z.toFixed(1)}`,
                    district: this.game.systems.world.getDistrictName(player.position.x, player.position.z),
                    fps: this.game.fps,
                    weather: this.game.currentWeather,
                    inVehicle: player.inVehicle ? player.currentVehicle?.type : 'no'
                };
                this.bugReports.push(report);
                this.log(`Bug #${this.bugReports.length} reported: "${desc}"`, '#f80');
                this.log('Context saved (pos, district, fps, weather, vehicle).', '#aaa');
                break;
            }

            case 'endtest':
                if (this.testSuiteActive) {
                    this.finishTestSuite();
                } else {
                    this.log('No test suite active.', '#f44');
                }
                break;

            case 'copyresults':
                this.copyResultsToClipboard();
                break;

            case 'help':
                const cmds = [
                    'god - Toggle god mode',
                    'give weapons - All weapons + ammo',
                    'give money [amt] - Add cash',
                    'spawn [type] - Spawn vehicle',
                    'wanted [0-5] - Set wanted level',
                    'tp [place] - Teleport',
                    'time [0-24] - Set time',
                    'weather [type] - Set weather',
                    'speed [x] - Speed multiplier',
                    'mission [1-15] - Skip to mission',
                    'complete - Complete current mission',
                    'ragdoll - Ragdoll player',
                    'explode - Explosion ahead',
                    'noclip - Fly through walls',
                    'fps - Toggle FPS counter',
                    'wireframe - Toggle wireframe',
                    'stats - Show stats',
                    'killall - Remove NPCs',
                    'heal - Full health/armor',
                    'hesoyam - God + $250K (SA cheat)',
                    'reset - Wipe save + reload',
                    '--- QA / TESTING ---',
                    'testsuite [id] - Start test suite (physics/trees/map/general/all)',
                    'reportbug [desc] - Report a bug with context',
                    'endtest - End current test suite early',
                    'copyresults - Copy all results to clipboard'
                ];
                for (const c of cmds) this.log('  ' + c, '#aaa');
                break;

            default:
                this.log(`Unknown command: ${command}. Type 'help' for commands.`, '#f44');
        }
    }

    update(dt) {
        // God mode
        if (this.godMode) {
            const player = this.game.systems.player;
            player.health = player.maxHealth;
            player.armor = player.maxArmor;
        }

        // Update debug overlay
        this.updateDebugOverlay();
    }

    toggleDebugOverlay() {
        this.debugOverlayVisible = !this.debugOverlayVisible;

        let overlay = document.getElementById('debug-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'debug-overlay';
            overlay.style.cssText = 'position:fixed;top:40px;left:16px;font-family:"Space Mono",monospace;font-size:0.7rem;color:rgba(255,255,255,0.6);z-index:12;pointer-events:none;line-height:1.6;';
            document.body.appendChild(overlay);
        }

        overlay.style.display = this.debugOverlayVisible ? 'block' : 'none';
    }

    updateDebugOverlay() {
        if (!this.debugOverlayVisible) return;

        const overlay = document.getElementById('debug-overlay');
        if (!overlay) return;

        const player = this.game.systems.player;
        const pos = player.position;
        const district = this.game.systems.world.getDistrictName(pos.x, pos.z);

        overlay.innerHTML = `
            Pos: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}<br>
            District: ${district}<br>
            FPS: ${this.game.fps}<br>
            Draw calls: ${this.game.renderer.info.render.calls}<br>
            Triangles: ${this.game.renderer.info.render.triangles}<br>
            NPCs: ${this.game.systems.npcs.pedestrians.filter(n => n.alive).length}<br>
            Weather: ${this.game.currentWeather}<br>
            Time: ${(this.game.timeOfDay * 24).toFixed(1)}h<br>
            Wanted: ${this.game.systems.wanted.level} stars<br>
            Vehicle: ${player.inVehicle ? player.currentVehicle?.type : 'none'}<br>
            God: ${this.godMode ? 'ON' : 'OFF'}<br>
            Noclip: ${player.noclip ? 'ON' : 'OFF'}
        `;
    }

    toggleCollisionBoxes() {
        this.collisionBoxesVisible = !this.collisionBoxesVisible;

        if (this.collisionBoxesVisible) {
            // Add wireframe boxes for all colliders
            const world = this.game.systems.world;
            for (const c of world.colliders) {
                if (c._debugMesh) continue;

                const w = c.maxX - c.minX;
                const d = c.maxZ - c.minZ;
                const h = c.height || 5;
                const geo = new THREE.BoxGeometry(w, h, d);
                const mat = new THREE.MeshBasicMaterial({
                    color: 0x00ff00,
                    wireframe: true,
                    transparent: true,
                    opacity: 0.3
                });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set((c.minX + c.maxX) / 2, h / 2, (c.minZ + c.maxZ) / 2);
                this.game.scene.add(mesh);
                c._debugMesh = mesh;
            }
        } else {
            const world = this.game.systems.world;
            for (const c of world.colliders) {
                if (c._debugMesh) {
                    this.game.scene.remove(c._debugMesh);
                    c._debugMesh.geometry.dispose();
                    c._debugMesh.material.dispose();
                    c._debugMesh = null;
                }
            }
        }

        this.log(`Collision boxes: ${this.collisionBoxesVisible ? 'ON' : 'OFF'}`, '#ff0');
    }

    cycleWeather() {
        const states = ['clear', 'overcast', 'rain', 'fog', 'storm'];
        const idx = states.indexOf(this.game.currentWeather);
        this.game.currentWeather = states[(idx + 1) % states.length];
        this.game.targetWeather = this.game.currentWeather;
        this.log(`Weather: ${this.game.currentWeather}`, '#ff0');
    }

    quickSave() {
        if (this.game.systems.save.save()) {
            this.game.systems.ui.showMissionText('Quick Save', 1.5);
        }
    }

    quickLoad() {
        if (this.game.systems.save.load()) {
            this.game.systems.ui.showMissionText('Quick Load', 1.5);
        }
    }

    // --- TEST SUITE SYSTEM ---

    startTestSuite(suiteId) {
        const suite = this.testSuites[suiteId];
        if (!suite) return;
        this.testSuiteActive = true;
        this.testSuiteId = suiteId;
        this.currentTestIndex = 0;
        this.testResults = [];
        this.currentTests = suite.tests;
        this.log(`=== TEST SUITE: ${suite.name} ===`, '#0ff');
        this.log(`${suite.tests.length} tests to complete. Type 'endtest' to finish early.`, '#aaa');
        this.log('', '#aaa');
        this.presentCurrentTest();
    }

    startTestSuiteAll() {
        this.testSuiteActive = true;
        this.testSuiteId = 'all';
        this.currentTestIndex = 0;
        this.testResults = [];
        // Concatenate all tests
        this.currentTests = [];
        for (const [id, suite] of Object.entries(this.testSuites)) {
            for (const test of suite.tests) {
                this.currentTests.push({ ...test, suite: suite.name });
            }
        }
        this.log(`=== FULL TEST SUITE ===`, '#0ff');
        this.log(`${this.currentTests.length} total tests across all suites.`, '#aaa');
        this.log(`Type 'endtest' to finish early. Type 'reportbug <desc>' anytime for ad-hoc bugs.`, '#aaa');
        this.log('', '#aaa');
        this.presentCurrentTest();
    }

    presentCurrentTest() {
        if (this.currentTestIndex >= this.currentTests.length) {
            this.finishTestSuite();
            return;
        }
        const test = this.currentTests[this.currentTestIndex];
        const progress = `[${this.currentTestIndex + 1}/${this.currentTests.length}]`;
        this.log(`${progress} TEST ${test.id}: ${test.name}`, '#ff0');
        this.log(`  ${test.instruction}`, '#ddd');
        this.log('', '#aaa');
        this.log('When done testing, enter a rating (1-10):', '#0ff');
        this.awaitingRating = true;
        this.awaitingFeedback = false;
        this.currentRating = null;
    }

    recordTestResult(rating, feedback) {
        const test = this.currentTests[this.currentTestIndex];
        this.testResults.push({
            id: test.id,
            name: test.name,
            suite: test.suite || this.testSuites[this.testSuiteId]?.name || 'unknown',
            rating: rating,
            feedback: feedback,
            timestamp: new Date().toISOString()
        });
        this.awaitingFeedback = false;
        this.awaitingRating = false;

        const stars = rating >= 8 ? '#0f0' : rating >= 5 ? '#ff0' : '#f44';
        this.log(`  Recorded: ${test.id} — ${rating}/10${feedback ? ' — "' + feedback + '"' : ''}`, stars);
        this.log('', '#aaa');

        this.currentTestIndex++;
        this.presentCurrentTest();
    }

    finishTestSuite() {
        this.testSuiteActive = false;
        this.awaitingRating = false;
        this.awaitingFeedback = false;

        this.log('', '#aaa');
        this.log('=== TEST SUITE COMPLETE ===', '#0ff');

        if (this.testResults.length > 0) {
            const avg = this.testResults.reduce((sum, r) => sum + r.rating, 0) / this.testResults.length;
            this.log(`Tests completed: ${this.testResults.length}`, '#aaa');
            this.log(`Average rating: ${avg.toFixed(1)}/10`, avg >= 7 ? '#0f0' : avg >= 4 ? '#ff0' : '#f44');
            this.log(`Bug reports: ${this.bugReports.length}`, '#aaa');
        }

        this.log('', '#aaa');
        this.log("Type 'copyresults' to copy the full report to clipboard.", '#0ff');
        this.log("You can also use 'reportbug <desc>' to add more bugs.", '#aaa');
    }

    copyResultsToClipboard() {
        let report = '# San Claudio QA Test Report\n';
        report += `Date: ${new Date().toISOString()}\n`;
        report += `Suite: ${this.testSuiteId || 'N/A'}\n\n`;

        // Test results
        if (this.testResults.length > 0) {
            report += '## Test Results\n\n';
            report += '| ID | Test | Suite | Rating | Feedback |\n';
            report += '|----|------|-------|--------|----------|\n';
            for (const r of this.testResults) {
                const fb = r.feedback ? r.feedback.replace(/\|/g, '/') : '-';
                report += `| ${r.id} | ${r.name} | ${r.suite} | ${r.rating}/10 | ${fb} |\n`;
            }
            const avg = this.testResults.reduce((sum, r) => sum + r.rating, 0) / this.testResults.length;
            report += `\n**Average Rating: ${avg.toFixed(1)}/10**\n\n`;
        }

        // Bug reports
        if (this.bugReports.length > 0) {
            report += '## Bug Reports\n\n';
            for (let i = 0; i < this.bugReports.length; i++) {
                const b = this.bugReports[i];
                report += `### Bug #${i + 1}\n`;
                report += `- **Description:** ${b.description}\n`;
                report += `- **Position:** ${b.playerPos}\n`;
                report += `- **District:** ${b.district}\n`;
                report += `- **FPS:** ${b.fps}\n`;
                report += `- **Weather:** ${b.weather}\n`;
                report += `- **Vehicle:** ${b.inVehicle}\n`;
                report += `- **Time:** ${b.timestamp}\n\n`;
            }
        }

        // System info
        report += '## System Info\n\n';
        report += `- Physics Engine: Rapier.js (${this.game.systems.physics?.ready ? 'loaded' : 'NOT loaded'})\n`;
        report += `- Colliders: ${this.game.systems.world?.colliders?.length || 0}\n`;
        report += `- FPS (current): ${this.game.fps}\n`;
        report += `- Draw calls: ${this.game.renderer.info.render.calls}\n`;
        report += `- Triangles: ${this.game.renderer.info.render.triangles}\n`;
        report += `- NPCs alive: ${this.game.systems.npcs?.pedestrians?.filter(n => n.alive).length || 0}\n`;
        report += `- Vehicles: ${this.game.systems.vehicles?.vehicles?.length || 0}\n`;

        // Copy to clipboard
        navigator.clipboard.writeText(report).then(() => {
            this.log('Full report copied to clipboard!', '#0f0');
            this.log('Paste it back to Claude for bug fixes and improvements.', '#aaa');
        }).catch(() => {
            // Fallback: create a textarea overlay
            this.log('Clipboard access denied. Showing report in overlay...', '#f80');
            this.showReportOverlay(report);
        });
    }

    showReportOverlay(text) {
        let overlay = document.getElementById('test-report-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'test-report-overlay';
            overlay.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:80vw;height:70vh;background:#111;border:2px solid #0ff;z-index:10000;display:flex;flex-direction:column;padding:16px;border-radius:8px;';
            const header = document.createElement('div');
            header.style.cssText = 'color:#0ff;font:bold 14px "Space Mono",monospace;margin-bottom:8px;';
            header.textContent = 'TEST REPORT — Select All (Ctrl+A) and Copy (Ctrl+C):';
            const textarea = document.createElement('textarea');
            textarea.style.cssText = 'flex:1;background:#1a1a2a;color:#ddd;border:1px solid #333;font:12px "Space Mono",monospace;resize:none;padding:8px;';
            textarea.id = 'test-report-text';
            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Close';
            closeBtn.style.cssText = 'margin-top:8px;padding:8px 16px;background:#333;color:#fff;border:1px solid #555;cursor:pointer;font:12px "Space Mono",monospace;';
            closeBtn.onclick = () => overlay.remove();
            overlay.appendChild(header);
            overlay.appendChild(textarea);
            overlay.appendChild(closeBtn);
            document.body.appendChild(overlay);
        }
        const textarea = document.getElementById('test-report-text');
        textarea.value = text;
        textarea.focus();
        textarea.select();
    }
}

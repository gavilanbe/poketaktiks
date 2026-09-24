// ============================================================================
// campaign.js — chapters: maps (ASCII), units, objectives, dialogue, rewards.
// Legend: . plains , meadow t tall grass T forest M mountain ^ cliff ~ water = bridge # road s sand
//         C Poké Center G gym H house c cave r rubble W cave wall f floor b wall L lava p pillar x crates i ice S snow
// ============================================================================
'use strict';
const STARTERS = [1, 4, 7];
const CHAPTERS = [
  {
    id: 'meadow', title: 'Pallet Meadow', num: 1, level: 5, slots: 3, par: 6, music: 'calm',
    foe: 'Youngster Joey', brief: 'Team Rocket pays me to keep trainers away from this Center. Easy money!',
    intro: [
      { who: 'Prof. Oak', text: 'This meadow\'s Poké Center is the only one Rocket *has not locked*. Your PC Box works here.' },
      { who: 'Prof. Oak', text: 'Pick a Pokémon, walk to a tile, then *Attack*. Blue tiles are where you can go, red is where you can hit.' },
      { who: 'Youngster Joey', mon: 19, text: 'Hey! Rocket pays me to guard this meadow. And my Rattata is in the *top percentage* of Rattata!' },
      { who: 'Prof. Oak', text: 'Caterpie is here for catching practice: *weaken it*, stand next to it, then *Catch*. Catches wait in your Box.' },
    ],
    outro: [{ who: 'Youngster Joey', mon: 19, text: 'Nooo! My top-percentage Rattata!' }, { who: 'Bill', text: 'Nice work! I patched this Center back into my network. Next stop: *Viridian Forest*. Rocket is moving north.' }],
    rewards: { pokeball: 3 },
    map: {
      name: 'Pallet Meadow', seed: 11, objective: { type: 'rout' },
      war: { owners: { '0,5': 0, '14,5': 1 }, names: { '0,5': 'YOUR HQ', '14,5': "JOEY'S CAMP" } },
      rows: [
        '.....,...TT..T.',
        '..,......T..T..',
        '....##.......,.',
        '.,..#...t......',
        '#####...tt.,...',
        'Q...#..,~~~...Q',
        '....#...~~~..T.',
        '..,.##...~..TT.',
        '......#....,...',
      ],
      deploy: [{ x: 1, y: 3 }, { x: 1, y: 6 }, { x: 2, y: 4 }],
      units: [{ mon: 19, level: 3, x: 12, y: 2 }, { mon: 19, level: 2, x: 13, y: 4 }, { mon: 16, level: 3, x: 12, y: 7, ai: 'guard' }, { mon: 16, level: 2, team: 2, x: 8, y: 3, ai: 'aggro' }, { mon: 10, level: 3, team: 2, x: 3, y: 4, ai: 'stay' }],
      items: [{ x: 9, y: 0, item: 'pokeball' }],
    },
  },
  {
    id: 'forest', title: 'Viridian Forest', num: 2, level: 7, slots: 4, par: 8, music: 'calm',
    foe: 'Bug Catcher Timmy', brief: 'Rocket gave me a whole Field Center to guard. And my bugs to guard it with!',
    intro: [
      { who: 'Bug Catcher Timmy', mon: 11, text: 'Halt! Team Rocket gave me a *Field Center* to guard, and all these bugs to guard it with!' },
      { who: 'Prof. Oak', text: 'Take that *outpost*: capture it twice at full health and it heals your team for good.' },
      { who: 'Prof. Oak', text: 'Forests give 20% defence and slow walkers down. And I hear a *Pikachu* lives here... electrifying.' },
    ],
    outro: [{ who: 'Bug Catcher Timmy', mon: 11, text: 'My beautiful cocoons! Fine, go on. Rocket is digging in *Mt. Moon*... and they have Brock.' }, { who: 'Bill', text: 'Brock? The Pewter Gym Leader? If Rocket is holding his family, he has *no choice* but to fight you.' }],
    rewards: { pokeball: 3 },
    map: {
      name: 'Viridian Forest', seed: 22, objective: { type: 'rout' },
      war: { owners: { '0,4': 0, '15,6': 1 }, names: { '0,4': 'YOUR HQ', '15,6': "TIMMY'S CAMP" } },
      outposts: [{ x: 6, y: 5, name: 'FOREST OUTPOST' }],
      rows: [
        'TTT.TTTT..TTTTTT',
        'T..t..TT.t..TTTT',
        '..tt...T.tt..TTT',
        '.,.....TT..t..TT',
        'Q.T.,.......T..T',
        '.TTT..C#..T.tT..',
        '..T..##.....t..Q',
        '...,#..TT.,.....',
        '.T..#..TTT..T.TT',
        'TTT.#.TTTT.TTTTT',
      ],
      deploy: [{ x: 1, y: 3 }, { x: 0, y: 6 }, { x: 2, y: 7 }, { x: 1, y: 8 }],
      units: [{ mon: 10, level: 5, x: 11, y: 3 }, { mon: 13, level: 5, x: 12, y: 6 }, { mon: 11, level: 6, x: 14, y: 2, ai: 'guard' }, { mon: 14, level: 6, x: 13, y: 7, ai: 'guard' }, { mon: 12, level: 8, x: 14, y: 4, ai: 'guard', boss: true, nick: 'Timmy\'s Butterfree' }, { mon: 13, level: 4, x: 9, y: 1 },
        { mon: 25, level: 6, team: 2, x: 7, y: 3, ai: 'aggro' }, { mon: 43, level: 5, team: 2, x: 4, y: 1, ai: 'aggro' }, { mon: 16, level: 5, team: 2, x: 10, y: 8, ai: 'aggro' }],
      items: [{ x: 3, y: 1, item: 'pokeball' }, { x: 14, y: 8, item: 'pokeball' }],
    },
  },
  {
    id: 'moon', title: 'Mt. Moon', num: 3, level: 10, slots: 4, par: 9, music: 'player',
    co: 'brock', brief: 'Team Rocket has my family. I am sorry, kid. I have to hold this mountain.',
    intro: [
      { who: 'Brock', mon: 95, text: 'You are the Tactician? Rocket has my *brothers and sisters*. I cannot let you through.' },
      { who: 'Rocket Grunt', mon: 41, text: 'That\'s right, Brock. And our *Raticate* is keeping an eye on you too.' },
      { who: 'Prof. Oak', text: 'Defeat that Raticate and Brock is free. Their *Field Center* keeps calling in Rock types: capture it and the flow stops.' },
      { who: 'Prof. Oak', text: 'Brock commands now: his *Onix* wears the crown, and his Rock types near it shrug off hits.' },
    ],
    outro: [{ who: 'Rocket Grunt', mon: 41, text: 'Raticate down?! Abort! Everybody out!' }, { who: 'Brock', mon: 95, text: 'My family is safe... thank you. From now on my *Rock Tomb* is yours to call. Count me in, Tactician.' }, { who: 'Bill', text: 'Rocket\'s next checkpoint is *Nugget Bridge*. Word is they have Misty guarding it.' }],
    rewards: { pokeball: 4 },
    map: {
      name: 'Mt. Moon', seed: 33, objective: { type: 'boss', bossName: 'Raticate' },
      rows: [
        'WWWWWWWWWWWWWWWWWW',
        'WJccccrWWccrccccWW',
        'WccccccWWWcccrccWW',
        'WcccrcccccWcccccrW',
        'WccWWcrcccccWWccJW',
        'WccWWccccrcccWcccW',
        'WcccccWWccccccccrW',
        'WcrcccWcccrccWWccW',
        'WccccccccccccWcKcW',
        'WWWWWWWWWWWWWWWWWW',
      ],
      war: { owners: { '1,1': 0, '16,4': 1, '15,8': 1 }, names: { '1,1': 'YOUR HQ', '16,4': "ROCKET HQ", '15,8': 'ROCKET CENTER' } },
      deploy: [{ x: 2, y: 2 }, { x: 1, y: 3 }, { x: 2, y: 4 }, { x: 1, y: 5 }],
      units: [{ mon: 41, level: 8, x: 8, y: 2 }, { mon: 41, level: 8, x: 9, y: 6 }, { mon: 41, level: 9, x: 13, y: 3, ai: 'guard' }, { mon: 74, level: 9, x: 7, y: 4, ai: 'guard' }, { mon: 74, level: 9, x: 11, y: 7, ai: 'guard' }, { mon: 23, level: 9, x: 12, y: 1 }, { mon: 27, level: 9, x: 10, y: 8, ai: 'guard' }, { mon: 95, level: 11, x: 14, y: 6, ai: 'guard' }, { mon: 20, level: 11, x: 15, y: 5, ai: 'boss', boss: true, nick: 'Boss Raticate' }, { mon: 109, level: 10, x: 15, y: 2, ai: 'guard' },
        { mon: 35, level: 9, team: 2, x: 5, y: 7, ai: 'aggro' }, { mon: 74, level: 8, team: 2, x: 5, y: 1, ai: 'aggro' }],
      items: [{ x: 16, y: 8, item: 'pokeball' }, { x: 3, y: 8, item: 'pokeball' }],
      reinforce: [{ turn: 4, units: [{ mon: 41, level: 9, x: 16, y: 1 }, { mon: 41, level: 9, x: 16, y: 7 }] }],
    },
  },
  {
    id: 'bridge', title: 'Nugget Bridge', num: 4, level: 13, slots: 5, par: 10, music: 'player',
    co: 'misty', brief: 'They took my Gym. Until I get it back, this bridge stays shut!',
    intro: [
      { who: 'Misty', mon: 121, text: 'Team Rocket seized my *Cerulean Gym*. If I don\'t keep this bridge shut, I never get it back!' },
      { who: 'Swimmer Ana', mon: 55, text: 'Nobody crosses Nugget Bridge without a swim! Water types, get \'em!' },
      { who: 'Prof. Oak', text: 'Take the bridge and *seize the Gym* on the far side. That frees it, and Misty with it.' },
      { who: 'Prof. Oak', text: 'Something big sleeps in the lake. Do not poke it unless you mean it.' },
    ],
    outro: [{ who: 'Misty', mon: 121, text: 'You got my Gym back? Okay... you are not bad. My *Rain Dance* is yours when you need it.' }, { who: 'Bill', text: 'A Rocket hideout under the *Celadon Game Corner*! Erika has not been seen since they moved in.' }],
    rewards: { pokeball: 4 },
    map: {
      name: 'Nugget Bridge', seed: 44, objective: { type: 'seize', what: 'Gym' }, seize: { x: 17, y: 4 }, par: 10,
      outposts: [{ x: 8, y: 4, name: 'BRIDGE OUTPOST' }, { x: 17, y: 4, name: 'GYM', owner: 1, goal: true }],
      war: { owners: { '1,1': 0, '17,8': 1, '16,6': 1 }, names: { '1,1': 'YOUR HQ', '17,8': "ROCKET HQ", '16,6': 'ROCKET CENTER' } },
      rows: [
        '..t..~~~~~~~~..TT.',
        '.Q...~~~~~~~~~..T.',
        '.....s~~~~~~~s..,.',
        '#####s~~~~~~~s####',
        '.....===C=====...G',
        '.....s~~~~~~~s.#..',
        '..,..s~~~~~~s~.#C.',
        '.t..s~~~~~~~~~.#..',
        '....~~~~~~~~~~..#Q',
        'TT..~~~~~~~~~~..TT',
      ],
      deploy: [{ x: 1, y: 3 }, { x: 1, y: 5 }, { x: 2, y: 4 }, { x: 0, y: 4 }, { x: 2, y: 2 }],
      units: [{ mon: 60, level: 10, x: 8, y: 3, ai: 'aggro' }, { mon: 60, level: 10, x: 8, y: 5, ai: 'aggro' }, { mon: 118, level: 11, x: 10, y: 6, ai: 'guard' }, { mon: 120, level: 11, x: 11, y: 2, ai: 'guard' }, { mon: 72, level: 10, x: 6, y: 8, ai: 'aggro' }, { mon: 55, level: 12, x: 12, y: 4, ai: 'guard' }, { mon: 121, level: 12, x: 16, y: 7, ai: 'guard' }, { mon: 54, level: 11, x: 15, y: 5, ai: 'guard' }, { mon: 79, level: 12, x: 16, y: 3, ai: 'guard' }, { mon: 130, level: 15, x: 9, y: 1, ai: 'guard', boss: true, nick: 'Lake Gyarados' },
        { mon: 129, level: 6, team: 2, x: 4, y: 8, ai: 'aggro' }, { mon: 98, level: 11, team: 2, x: 5, y: 2, ai: 'aggro' }, { mon: 116, level: 11, team: 2, x: 13, y: 7, ai: 'aggro' }],
      items: [{ x: 16, y: 1, item: 'pokeball' }, { x: 17, y: 8, item: 'pokeball' }],
      reinforce: [{ turn: 4, units: [{ mon: 72, level: 11, x: 13, y: 1 }, { mon: 72, level: 11, x: 13, y: 8 }] }],
    },
  },
  {
    id: 'hideout', title: 'Rocket Hideout', num: 5, level: 16, slots: 5, par: 10, music: 'enemy',
    co: 'giovanni', brief: 'A child playing general. Let us see how you fare against a professional.',
    intro: [
      { who: 'Giovanni', mon: 53, text: 'So the meddling Tactician found my hideout. *Persian*, show them how a professional plays.' },
      { who: 'Erika', text: 'Tactician! They locked me in the back office... please, *hurry*!' },
      { who: 'Prof. Oak', text: 'Their Pokémon love *Poison*. Crates give cover, pillars block the way. Beat Persian and the hideout falls.' },
      { who: 'Giovanni', mon: 53, text: 'Zubat, seal the doors in four turns. Nobody leaves.' },
    ],
    outro: [{ who: 'Giovanni', mon: 53, text: 'Tch. A tactician indeed. We will meet again, and I will have something... *legendary*.' }, { who: 'Erika', text: 'Thank you... my garden is yours to call on. *Aromatherapy* will keep your team standing.' }, { who: 'Bill', text: 'The *Power Plant* is throwing lightning, and Lt. Surge is running its defence. Something is very wrong there.' }],
    rewards: { pokeball: 5 },
    map: {
      name: 'Rocket Hideout', seed: 55, objective: { type: 'boss', bossName: 'Persian' }, music: 'enemy',
      war: { owners: { '1,4': 0, '16,8': 1, '14,5': 1 }, names: { '1,4': 'YOUR HQ', '16,8': "ROCKET HQ", '14,5': 'ROCKET CENTER' } },
      rows: [
        'bbbbbbbbbbbbbbbbbb',
        'bffffxfbfffffpffbb',
        'bffffxfbffxfffffbb',
        'bfffffffffxffpffbb',
        'bJpfffbbbfffffffbb',
        'bfffffbxxffffxKfbb',
        'bffxffffffpfffffbb',
        'bffxfffbfffffffffb',
        'bfffffpbffxfffffJb',
        'bbbbbbbbbbbbbbbbbb',
      ],
      deploy: [{ x: 1, y: 2 }, { x: 2, y: 3 }, { x: 1, y: 5 }, { x: 2, y: 6 }, { x: 1, y: 7 }],
      units: [{ mon: 88, level: 13, x: 8, y: 2, ai: 'aggro' }, { mon: 88, level: 13, x: 9, y: 7, ai: 'aggro' }, { mon: 109, level: 14, x: 11, y: 3, ai: 'guard' }, { mon: 109, level: 14, x: 12, y: 6, ai: 'aggro' }, { mon: 23, level: 13, x: 6, y: 1 }, { mon: 24, level: 15, x: 14, y: 2, ai: 'guard' }, { mon: 96, level: 14, x: 15, y: 7, ai: 'guard' }, { mon: 52, level: 14, x: 13, y: 8, ai: 'guard' }, { mon: 53, level: 18, x: 15, y: 4, ai: 'boss', boss: true, nick: 'Giovanni\'s Persian' }, { mon: 89, level: 16, x: 16, y: 5, ai: 'guard' },
        { mon: 132, level: 14, team: 2, x: 6, y: 5, ai: 'aggro', nick: 'Ditto' }, { mon: 50, level: 13, team: 2, x: 9, y: 3, ai: 'aggro' }],
      items: [{ x: 4, y: 8, item: 'pokeball' }, { x: 16, y: 1, item: 'pokeball' }, { x: 12, y: 1, item: 'pokeball' }],
      reinforce: [{ turn: 4, units: [{ mon: 41, level: 13, x: 1, y: 1 }, { mon: 41, level: 13, x: 1, y: 8 }, { mon: 42, level: 15, x: 16, y: 8 }] }],
    },
  },
  {
    id: 'plant', title: 'Power Plant', num: 6, level: 20, slots: 6, par: 10, music: 'player',
    co: 'surge', brief: 'Rocket has a legendary bird in my reactor and my crew as hostages. Orders are orders, kid!',
    intro: [
      { who: 'Lt. Surge', mon: 26, text: 'Hey, kid! Rocket has *Zapdos* caged in this plant and my Vermilion crew held hostage. Orders are orders!' },
      { who: 'Engineer Watt', mon: 81, text: 'The turbines are spinning backwards! Careful with the Voltorbs: they are *not* Poké Balls.' },
      { who: 'Blue', mon: 17, text: 'Heh, the Tactician! I came for Zapdos too. My team fights *with* you today. Try not to slow me down.' },
      { who: 'Prof. Oak', text: 'Defeat *Zapdos* and the plant is free. Ground types are immune to Electric; Rock and Ice hurt it. It waits for you, so choose the moment.' },
    ],
    outro: [{ who: 'Engineer Watt', mon: 81, text: 'The lights are back! You fought Zapdos and lived!' }, { who: 'Lt. Surge', mon: 26, text: 'Ha! My crew is free and you have my respect, soldier. *Thunder Wave* on your call!' }, { who: 'Blue', mon: 17, text: 'Not bad. But I am still one step ahead. Smell ya later!' }, { who: 'Bill', text: 'Blaine\'s lab on *Cinnabar* went dark. Rocket is after the fire bird nesting in the volcano.' }],
    rewards: { pokeball: 5 },
    map: {
      name: 'Power Plant', seed: 66, objective: { type: 'boss', bossName: 'Zapdos' },
      war: { owners: { '1,8': 0, '18,8': 1, '16,7': 1 }, names: { '1,8': 'YOUR HQ', '18,8': "ROCKET HQ", '16,7': 'ROCKET CENTER' } },
      rows: [
        'bbbbbbbbbbbbbbbbbbbb',
        'bffffpfffbfffxffffpb',
        'bffxffffffffffpfffbb',
        'bfffffpfbbbfffffffbb',
        'bfffxfffbfbffxffpffb',
        'bffffffpbfbfffffffbb',
        'bfxfffffffffpfffxffb',
        'bfffpffbbbffffffKfbb',
        'bJfffffffffxffpfffJb',
        'bbbbbbbbbbbbbbbbbbbb',
      ],
      deploy: [{ x: 1, y: 2 }, { x: 2, y: 3 }, { x: 1, y: 4 }, { x: 2, y: 5 }, { x: 1, y: 6 }, { x: 2, y: 7 }],
      units: [{ mon: 17, level: 19, team: 3, x: 2, y: 8, ai: 'aggro', nick: 'Blue\'s Pidgeotto' }, { mon: 8, level: 19, team: 3, x: 3, y: 8, ai: 'aggro', nick: 'Blue\'s Wartortle' }, { mon: 100, level: 17, x: 7, y: 2, ai: 'aggro' }, { mon: 100, level: 17, x: 8, y: 6, ai: 'guard' }, { mon: 100, level: 16, x: 6, y: 8, ai: 'aggro' }, { mon: 81, level: 17, x: 10, y: 1, ai: 'guard' }, { mon: 82, level: 19, x: 13, y: 4, ai: 'guard' }, { mon: 125, level: 19, x: 12, y: 2, ai: 'guard' }, { mon: 26, level: 19, x: 15, y: 6, ai: 'guard' }, { mon: 101, level: 19, x: 16, y: 2, ai: 'guard' }, { mon: 145, level: 23, x: 17, y: 4, ai: 'boss', boss: true, nick: 'Zapdos' },
        { mon: 100, level: 17, team: 2, x: 5, y: 5, ai: 'aggro' }, { mon: 81, level: 17, team: 2, x: 9, y: 4, ai: 'aggro' }],
      items: [{ x: 18, y: 8, item: 'pokeball' }, { x: 4, y: 1, item: 'pokeball' }],
    },
  },
  {
    id: 'volcano', title: 'Cinnabar Volcano', num: 7, level: 24, slots: 6, par: 8, music: 'boss',
    co: 'blaine', brief: 'Rocket wants my Moltres. They will have to get past me... and so will you!',
    intro: [
      { who: 'Blaine', mon: 59, text: 'My volcano, my rules! Rocket has my lab and they want *Moltres*. Nobody reaches the rim. Not them, not you!' },
      { who: 'Prof. Oak', text: 'Blaine thinks you are with Rocket. *Survive seven turns* and he will see you are not.' },
      { who: 'Prof. Oak', text: 'Lava burns anything that is not Fire or flying. Hold the rubble, it gives cover. Water and Rock are your friends here.' },
    ],
    outro: [{ who: 'Blaine', mon: 59, text: 'Seven turns! Hah! You have fire in you after all. My *Sunny Day* is yours, kid.' }, { who: 'Koga', text: 'Well fought. Rocket forced my hand too, from the shadows. My *poison* serves you now.' }, { who: 'Moltres', mon: 146, text: '*screeches and flies away, dropping a feather*' }, { who: 'Bill', text: 'One last front: *Cerulean Cave*. Giovanni is there... with something he made.' }],
    rewards: { pokeball: 5 },
    map: {
      name: 'Cinnabar Volcano', seed: 77, objective: { type: 'survive', turns: 7 }, music: 'boss',
      war: { owners: { '1,1': 0, '16,5': 1, '15,6': 1 }, names: { '1,1': 'YOUR HQ', '16,5': "ROCKET HQ", '15,6': 'ROCKET CENTER' } },
      rows: [
        'WWWWWWWWWWWWWWWWWW',
        'WJccLLLcccLLcccrcW',
        'WcrcLLccrcLLcLccLW',
        'WcccLccccccLLcLLLW',
        'WrcccccrccccccLLcW',
        'WccrccLLccrcccccJW',
        'WcccLLLLcccLLcrKcW',
        'WcrccLLccrcLLLccrW',
        'WccccLccccccLccccW',
        'WWWWWWWWWWWWWWWWWW',
      ],
      deploy: [{ x: 1, y: 3 }, { x: 2, y: 4 }, { x: 1, y: 5 }, { x: 2, y: 6 }, { x: 3, y: 5 }, { x: 1, y: 7 }],
      units: [{ mon: 58, level: 21, x: 9, y: 2, ai: 'aggro' }, { mon: 58, level: 21, x: 10, y: 7, ai: 'aggro' }, { mon: 77, level: 21, x: 12, y: 4, ai: 'guard' }, { mon: 77, level: 21, x: 8, y: 5, ai: 'aggro' }, { mon: 126, level: 23, x: 14, y: 2, ai: 'guard', nick: 'Blaine\'s Magmar' }, { mon: 78, level: 23, x: 15, y: 8, ai: 'guard' }, { mon: 59, level: 26, x: 16, y: 4, ai: 'guard', boss: true, nick: 'Blaine\'s Arcanine' }, { mon: 146, level: 26, x: 16, y: 1, ai: 'boss', boss: true, nick: 'Moltres' },
        { mon: 37, level: 22, team: 2, x: 6, y: 8, ai: 'aggro' }],
      items: [{ x: 7, y: 1, item: 'pokeball' }, { x: 16, y: 6, item: 'pokeball' }],
      reinforce: [{ turn: 3, units: [{ mon: 58, level: 22, x: 16, y: 2 }] }, { turn: 4, units: [{ mon: 77, level: 22, x: 16, y: 8 }] }, { turn: 5, units: [{ mon: 126, level: 24, x: 16, y: 5 }] }, { turn: 6, units: [{ mon: 78, level: 24, x: 16, y: 2 }, { mon: 58, level: 23, x: 16, y: 8 }] }],
    },
  },
  {
    id: 'cave', title: 'Cerulean Cave', num: 8, level: 30, slots: 7, par: 14, army: 3, music: 'boss',
    co: 'giovanni', brief: 'My greatest creation waits for you, Tactician. It will be the last thing you see.',
    intro: [
      { who: 'Giovanni', mon: 34, text: 'You again. Meet my greatest creation. It does not obey me, but it hates you *plenty*.' },
      { who: 'Mewtwo', mon: 150, text: '...I was made to fight. Show me a reason not to.' },
      { who: 'Sabrina', text: 'I foresaw this battle, Tactician. Win it, and every PC in Kanto *comes back online*.' },
      { who: 'Prof. Oak', text: 'Mewtwo resists Psychic and shreds Fighting and Poison. *Bug and Ghost* bite it. Wear it down and strike together!' },
    ],
    outro: [{ who: 'Mewtwo', mon: 150, text: '...So this is what a team is. Go. I have thinking to do.' }, { who: 'Giovanni', mon: 34, text: 'Team Rocket... is finished. For now.' }, { who: 'Bill', text: 'Every Poké Center in Kanto is back online! Trainers are getting their Pokémon back as we speak!' }, { who: 'Prof. Oak', text: 'You did it, Tactician. Kanto is free, every Gym Leader stands with you... and so does *Blue*, I hear.' }],
    rewards: { pokeball: 6 },
    map: {
      name: 'Cerulean Cave', seed: 88, objective: { type: 'boss', bossName: 'Mewtwo' }, music: 'boss',
      rows: [
        'WWWWWWWWWWWWWWWWWWWW',
        'WccwwccrcccwwcccrccW',
        'WcccwwcccrcwwwccccrW',
        'WrccccccwwccccwcccWW',
        'WcccwwccccwccccccwcW',
        'WJrcwwwccccwcWcccwcW',
        'WccccwccrcccwcWcrccW',
        'WcccccccwwcccwccccrW',
        'WcrccwccccwwcccwccJW',
        'WccccccrccccccccKccW',
        'WWWWWWWWWWWWWWWWWWWW',
      ],
      war: { owners: { '1,5': 0, '18,8': 1, '16,9': 1 }, names: { '1,5': 'YOUR HQ', '18,8': "ROCKET HQ", '16,9': 'ROCKET CENTER' } },
      deploy: [{ x: 1, y: 2 }, { x: 2, y: 3 }, { x: 1, y: 4 }, { x: 2, y: 6 }, { x: 1, y: 7 }, { x: 2, y: 8 }, { x: 3, y: 9 }],
      units: [{ mon: 64, level: 27, x: 8, y: 2, ai: 'aggro' }, { mon: 75, level: 27, x: 7, y: 5, ai: 'guard' }, { mon: 76, level: 28, x: 12, y: 3, ai: 'guard' }, { mon: 93, level: 27, x: 11, y: 6, ai: 'guard' }, { mon: 94, level: 29, x: 14, y: 8, ai: 'guard' }, { mon: 148, level: 28, x: 13, y: 1, ai: 'guard' }, { mon: 34, level: 27, x: 15, y: 3, ai: 'guard' }, { mon: 68, level: 29, x: 15, y: 5, ai: 'guard' }, { mon: 65, level: 30, x: 17, y: 2, ai: 'guard' }, { mon: 150, level: 34, x: 17, y: 5, ai: 'boss', boss: true, nick: 'Mewtwo' },
        { mon: 147, level: 26, team: 2, x: 5, y: 8, ai: 'aggro' }, { mon: 42, level: 27, team: 2, x: 6, y: 1, ai: 'aggro' }],
      items: [{ x: 18, y: 9, item: 'pokeball' }, { x: 9, y: 1, item: 'pokeball' }, { x: 4, y: 5, item: 'pokeball' }],
      reinforce: [{ turn: 5, units: [{ mon: 42, level: 28, x: 18, y: 1 }, { mon: 42, level: 28, x: 18, y: 9 }] }],
    },
  },
];
// Biomes for generated battlefields: terrain from a noise value (low → water, high → rock), the ground at the map's
// edges, the road and what replaces impassable tiles on it, the center tile, the wild Pokémon that live there and the
// weather the Battle Tower gives it. The duel scene reads the biome back from the tiles.
const BIOMES = {
  field: { name: 'Fields', tile: null, wild: null },
  forest: { name: 'Forest', tile: (v, r) => v < .24 ? '~' : v > .82 ? 'M' : v > .52 ? 'T' : v > .4 ? 't' : r() < .1 ? ',' : '.', wild: [10, 13, 43, 46, 48, 69, 102, 123] },
  sea: { name: 'Coast', tile: (v, r) => v < .42 ? '~' : v < .5 ? 's' : v > .8 ? 'M' : v > .7 ? 'T' : v > .6 ? 't' : r() < .06 ? ',' : '.', wild: [72, 90, 98, 116, 118, 120, 129, 54], weather: 'rain' },
  mountain: { name: 'Mountains', tile: (v, r) => v < .24 ? '~' : v > .8 ? '^' : v > .62 ? 'M' : v > .55 ? 'T' : v > .48 ? 't' : r() < .06 ? 's' : '.', wild: [74, 27, 50, 56, 66, 95, 104, 111], weather: 'sand' },
  snow: { name: 'Snowfield', tile: (v, r) => v < .3 ? 'i' : v > .76 ? 'M' : v > .6 ? 'S' : 'n', edge: v => v > .62 ? 'S' : 'n', ground: 'n', wild: [86, 90, 124, 131, 72, 41, 19, 29], weather: 'snow' },
  volcano: { name: 'Volcano', tile: (v, r) => v < .37 ? 'L' : v > .74 ? 'W' : v > .6 ? 'r' : r() < .06 ? 'r' : 'c', edge: v => v > .64 ? 'r' : 'c', ground: 'c', path: 'c', road: { L: 'r' }, center: 'K', wild: [4, 37, 58, 77, 126, 74, 109, 66], weather: 'sun' },
  cave: { name: 'Cave', tile: (v, r) => v < .34 ? 'w' : v > .72 ? 'W' : v > .6 ? 'r' : 'c', edge: v => v > .64 ? 'r' : 'c', ground: 'c', path: 'c', road: { w: '=' }, center: 'K', wild: [41, 74, 95, 50, 104, 66, 27, 92] },
};
// Random Skirmish battlefield: value noise → water / mountains / forests / tall grass (or the biome's own terrain), a road
// from HQ to HQ, each side's own center and two neutral ones in the middle, placed point-symmetrically so neither side
// starts on better ground. The foe commander's opening squad waits by their HQ; wild Pokémon roam in between (and breed
// in the grass). opt.foe: the enemy commander (CO_TEAMS picks the squad); opt.biome. Objective: rout the foe or take
// their HQ.
function skirmishMap(seed, w = 16, h = 11, avgLevel = 12, opt = {}) {
  const r = mulberry32(seed); const noise = (x, y, s) => { const n = Math.sin((x * 12.9898 + y * 78.233 + s) * 43758.5453) * 1e4; return n - Math.floor(n); };
  const grid = []; const base = r() * 1000;
  for (let y = 0; y < h; y++) { const row = []; for (let x = 0; x < w; x++) { let v = 0; for (let o = 1; o <= 3; o++) { const s = o * 2; const fx = x / s, fy = y / s; const x0 = Math.floor(fx), y0 = Math.floor(fy); const tx = fx - x0, ty = fy - y0; const a = noise(x0, y0, base + o), b = noise(x0 + 1, y0, base + o), c = noise(x0, y0 + 1, base + o), d = noise(x0 + 1, y0 + 1, base + o); v += lerp(lerp(a, b, tx), lerp(c, d, tx), ty) / o; } row.push(v / 1.83); } grid.push(row); }
  const biome = BIOMES[opt.biome] ? opt.biome : 'field', Bm = BIOMES[biome], rows = []; const theme = Math.floor(r() * 3);
  for (let y = 0; y < h; y++) { let s = ''; for (let x = 0; x < w; x++) { const v = grid[y][x]; let ch = '.'; if (x <= 1 || x >= w - 2) ch = Bm.edge ? Bm.edge(v) : v > .62 ? 'T' : v > .5 ? 't' : '.'; else if (Bm.tile) ch = Bm.tile(v, r); else if (v < .3) ch = '~'; else if (v < .36) ch = 's'; else if (v > .74) ch = theme === 2 ? '^' : 'M'; else if (v > .62) ch = 'T'; else if (v > .52) ch = 't'; else if (r() < .08) ch = ','; s += ch; } rows.push(s); }
  const put = (x, y, ch) => { rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1); };
  const ground = Bm.ground || '.', path = Bm.path || '#', blocked = '~wLM^W', road = Object.assign({ '~': '=', w: '=', L: '=', M: ground, '^': ground, W: ground }, Bm.road || {});
  // the road across the middle, bridged over water, with an HQ at each end
  const ry = Math.floor(h / 2) + Math.floor(r() * 3) - 1; rows[ry] = rows[ry].split('').map(c => road[c] || path).join('');
  const hqCh = Bm.center === 'K' ? 'J' : 'Q'; put(1, ry, hqCh); put(w - 2, ry, hqCh);
  // a center: a path to the road (a causeway over water, a pass through rock) and walkable ground beside it
  const center = (x, y) => { const step = y < ry ? 1 : -1; for (let yy = y + step; yy !== ry; yy += step) if (blocked.includes(rows[yy][x])) put(x, yy, path); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h && '~^wLW'.includes(rows[Y][X])) put(X, Y, ground); } put(x, y, Bm.center || 'C'); };
  const dy = (r() < .5 ? -1 : 1) * Math.max(1, Math.min(3, ry - 1, h - 2 - ry)), cy = (y) => clamp(y, 1, h - 2), mx = Math.floor(w / 2); // as far off the road as the map allows, the same on both sides
  const own = [{ x: 3, y: cy(ry + dy) }, { x: w - 4, y: cy(ry - dy) }], neutral = [{ x: mx - 2, y: cy(ry - dy) }, { x: w - 1 - (mx - 2), y: cy(ry + dy) }];
  for (const c of own.concat(neutral)) center(c.x, c.y);
  // deploy tiles: open ground in the first three columns, nearest the HQ first
  const order = []; for (let y = 0; y < h; y++) for (let x = 0; x < 3; x++) order.push({ x, y }); order.sort((a, b) => (Math.abs(a.x - 1) + Math.abs(a.y - ry)) - (Math.abs(b.x - 1) + Math.abs(b.y - ry)));
  const open = '.,t#csSinr', deploy = order.filter(c => open.includes(rows[c.y][c.x])).slice(0, 8);
  const taken = new Set(deploy.map(d => key(d.x, d.y)));
  const spot = (x0, x1, near) => { const opts = []; for (let y = 0; y < h; y++) for (let x = x0; x <= x1; x++) if ((open + 'TM').includes(rows[y][x]) && !taken.has(key(x, y))) opts.push({ x, y }); if (near) opts.sort((a, b) => dist(a, near) - dist(b, near) || r() - .5); const s = near ? opts[Math.floor(r() * Math.min(4, opts.length))] : opts[Math.floor(r() * opts.length)]; if (s) taken.add(key(s.x, s.y)); return s || null; };
  // the foe's opening squad: three of their commander's Pokémon by their HQ (the Ace joins them at the start)
  const units = [], foe = opt.foe && CO_TEAMS[opt.foe] ? opt.foe : 'rocket', hq = { x: w - 2, y: ry };
  const squad = CO_TEAMS[foe].filter(n => n !== (COS[foe] && COS[foe].ace)).slice(0, 5).sort(() => r() - .5).slice(0, 3);
  squad.forEach((num, i) => { const s = spot(w - 5, w - 1, hq), level = Math.max(2, avgLevel + (i === 0 ? 1 : Math.floor(r() * 3) - 1)); if (s) units.push({ mon: formAt(num, level), level, x: s.x, y: s.y, ai: 'aggro', box: true }); });
  // wild Pokémon in the middle band (their species breed in the tall grass later)
  const pool = Bm.wild ? Bm.wild.map(n => DEX[n]) : DEX_LIST.filter(d => d.num < 144 && d.num !== 132 && d.num !== 143 && LINE_ROOT[d.num] === d.num);
  for (let i = 0; i < 3; i++) { const s = spot(4, w - 5); if (!s) break; const d = pool[Math.floor(r() * pool.length)], level = Math.max(2, avgLevel - 2 + Math.floor(r() * 3)); units.push({ mon: formAt(d.num, level), level, x: s.x, y: s.y, team: 2, ai: 'aggro' }); }
  const items = []; for (let i = 0; i < 2; i++) { const s = spot(4, w - 5); if (s) items.push({ x: s.x, y: s.y, item: 'pokeball' }); }
  const war = { owners: { [key(own[0].x, own[0].y)]: 0, [key(own[1].x, own[1].y)]: 1 }, names: { [key(1, ry)]: 'YOUR HQ', [key(w - 2, ry)]: TR('{0}\'S HQ', COS[foe] ? COS[foe].name.toUpperCase() : TR('FOE')) } };
  return { name: (biome === 'field' ? TR('Skirmish') : Bm.name) + ' #' + (seed % 1000), seed, objective: { type: 'war' }, rows, deploy, units, items, par: 12, music: pick(['player', 'calm']), war, foe, biome };
}

// Skirmish options (the setup screen's rules). Both armies count twelve: four on the map and eight in the Box (the rest of
// your collection, topped up with loaners from Oak's lab when it is small; the foe's squad, Ace and army).
// Difficulty is the foe's war chest: starting funds and daily income scaled, and on Hard their army two levels up.
const SK_DIFF = { easy: { name: 'Easy', funds: .5, income: .75, level: 0 }, normal: { name: 'Normal', funds: 1, income: 1, level: 0 }, hard: { name: 'Hard', funds: 1.5, income: 1.25, level: 2 } };
const SKIRMISH = { sizes: { s: [14, 9, 'Small'], m: [16, 11, 'Medium'], l: [20, 13, 'Large'] }, biomes: ['field', 'forest', 'sea', 'mountain', 'snow', 'volcano', 'cave', 'random'], slots: 4, box: 8, funds: [0, 1000, 2000, 5000, 10000], weather: ['none', 'rain', 'sun', 'sand', 'snow', 'random'], levels: [5, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 30, 33, 36, 40, 45, 50] };
const LOANERS = [16, 19, 25, 1, 4, 7, 74, 63, 43, 60, 66, 92, 41, 23, 56, 100, 109, 111];
function skirmishBiome(S) { return S.biome === 'random' || !BIOMES[S.biome] ? SKIRMISH.biomes[S.seed % 7] : S.biome; }
function skirmishLoaners(party, level, n) { const have = new Set(party.map(p => LINE_ROOT[p.num])); return LOANERS.filter(num => !have.has(LINE_ROOT[num])).slice(0, Math.max(0, n)).map(num => ({ num: formAt(num, level), level })); }

// Versus: both trainers deploy from the same catalog (at the match level, grown into their evolutions), plus catches.
const VS_CATALOG = [16, 19, 25, 74, 43, 60, 23, 129];
const VS_FUNDS = [0, 1000, 2000, 5000];
function vsCatalog(level) { return VS_CATALOG.map(num => ({ num: formAt(num, level), level })); }
// ---------------------------------------------------------------- versus arenas
// Mirror-symmetric arena for two trainers: the left half is generated with value noise and reflected.
function versusMap(seed, w = 18, h = 11, opt = {}) {
  const r = mulberry32(seed * 3 + 11); const noise = (x, y, s) => { const n = Math.sin((x * 12.9898 + y * 78.233 + s) * 43758.5453) * 1e4; return n - Math.floor(n); };
  const half = Math.ceil(w / 2); const grid = []; const base = r() * 1000;
  for (let y = 0; y < h; y++) { const row = []; for (let x = 0; x < half; x++) { let v = 0; for (let o = 1; o <= 3; o++) { const s = o * 2; const fx = x / s, fy = y / s; const x0 = Math.floor(fx), y0 = Math.floor(fy); const tx = fx - x0, ty = fy - y0; const a = noise(x0, y0, base + o), b = noise(x0 + 1, y0, base + o), c = noise(x0, y0 + 1, base + o), d = noise(x0 + 1, y0 + 1, base + o); v += lerp(lerp(a, b, tx), lerp(c, d, tx), ty) / o; } row.push(v / 1.83); } grid.push(row); }
  const rows = []; const theme = Math.floor(r() * 3);
  for (let y = 0; y < h; y++) { let s = ''; for (let x = 0; x < half; x++) { const v = grid[y][x]; let ch = '.'; if (x <= 1) ch = v > .6 ? 'T' : v > .5 ? 't' : '.'; else if (v < .3) ch = '~'; else if (v < .35) ch = 's'; else if (v > .74) ch = theme === 2 ? '^' : 'M'; else if (v > .63) ch = 'T'; else if (v > .53) ch = 't'; else if (r() < .07) ch = ','; s += ch; } const left = s.slice(0, Math.floor(w / 2)); const mid = w % 2 ? s[half - 1] : ''; rows.push(left + mid + left.split('').reverse().join('')); }
  const ry = Math.floor(h / 2); rows[ry] = rows[ry].split('').map(c => c === '~' ? '=' : (c === 'M' || c === '^') ? '.' : '#').join('');
  const put = (x, y, ch) => { rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1); };
  // an HQ at each end of the road, each side's own Poké Center and two neutral ones further in (a path to the road
  // through water or rock, open ground beside them), all mirrored
  const cy = ry - 2 >= 0 ? ry - 2 : ry + 2, ny = clamp(ry + 3, 1, h - 2), nx = Math.max(4, Math.floor(w / 2) - 3);
  const center = (x, y) => { const step = y < ry ? 1 : -1; for (let yy = y + step; yy !== ry; yy += step) if ('~M^'.includes(rows[yy][x])) { put(x, yy, '#'); put(w - 1 - x, yy, '#'); } for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h && '~^'.includes(rows[Y][X])) { put(X, Y, '.'); put(w - 1 - X, Y, '.'); } } put(x, y, 'C'); put(w - 1 - x, y, 'C'); };
  center(3, cy); center(nx, ny); put(1, ry, 'Q'); put(w - 2, ry, 'Q');
  // mode furniture: flag bases at the road's ends behind each HQ, or a 3×3 hill of open ground in the centre
  const flags = opt.mode === 'ctf' ? [{ team: 0, x: 0, y: ry }, { team: 1, x: w - 1, y: ry }] : null; if (flags) for (const f of flags) put(f.x, f.y, '#');
  // deploy zones: the two outer columns, nearest the middle row first, skipping the HQ and the flag; P2 mirrors P1
  const order = []; for (let y = 0; y < h; y++) for (let x = 0; x < 2; x++) if (!(y === ry && (x === 1 || flags))) order.push({ x, y }); order.sort((a, b) => Math.abs(a.y - ry) - Math.abs(b.y - ry) || a.x - b.x);
  const deploy = []; for (const c of order) { if (deploy.length >= 6) break; if (!'.,t#'.includes(rows[c.y][c.x])) { put(c.x, c.y, '.'); put(w - 1 - c.x, c.y, '.'); } deploy.push(c); }
  const deploy2 = deploy.map(c => ({ x: w - 1 - c.x, y: c.y }));
  const hill = opt.mode === 'hill' ? { x: Math.floor(w / 2), y: ry, r: 1 } : null; if (hill) for (let y = ry - 1; y <= ry + 1; y++) for (let x = hill.x - 1; x <= hill.x + 1; x++) if (y >= 0 && y < h && x >= 0 && x < w) put(x, y, y === ry ? '#' : '.');
  const units = [], items = []; const taken = new Set([...deploy, ...deploy2].map(d => key(d.x, d.y))); if (flags) for (const f of flags) taken.add(key(f.x, f.y)); if (hill) for (let y = ry - 1; y <= ry + 1; y++) for (let x = hill.x - 1; x <= hill.x + 1; x++) taken.add(key(x, y));
  const pool = DEX_LIST.filter(d => d.num < 144 && d.num !== 132 && d.num !== 143);
  const spot = () => { for (let i = 0; i < 200; i++) { const x = 3 + Math.floor(r() * (half - 3)), y = Math.floor(r() * h); if ('.,t#TsM'.includes(rows[y][x]) && !taken.has(key(x, y)) && !taken.has(key(w - 1 - x, y))) { taken.add(key(x, y)); taken.add(key(w - 1 - x, y)); return { x, y }; } } return null; };
  if (opt.wild !== false) for (let i = 0; i < 2; i++) { const s = spot(); if (!s) break; const d = pool[Math.floor(r() * pool.length)]; const lvl = Math.max(2, (opt.level || 20) - 3); units.push({ mon: d.num, level: lvl, x: s.x, y: s.y, team: 2, ai: 'aggro' }); if (s.x !== w - 1 - s.x) units.push({ mon: d.num, level: lvl, x: w - 1 - s.x, y: s.y, team: 2, ai: 'aggro' }); }
  const war = { owners: { [key(3, cy)]: 0, [key(w - 4, cy)]: 1 }, names: { [key(1, ry)]: 'P1 HQ', [key(w - 2, ry)]: 'P2 HQ' } };
  return { name: TR('Arena #{0}', seed % 1000), seed, objective: { type: 'versus', mode: opt.mode || 'elim' }, rows, deploy, deploy2, units, items, par: 0, music: 'player', turnLimit: opt.turns == null ? 30 : opt.turns, flags, hill, fog: !!opt.fog, war };
}

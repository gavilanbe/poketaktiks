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
    intro: [
      { who: 'Prof. Oak', mon: 143, text: 'So you want to be a Tactician? Then remember: a battle is won with position, not power.' },
      { who: 'Prof. Oak', mon: 143, text: 'Pick a Pokémon, walk to a tile, then Attack. Blue tiles are where you can go, red is where you can hit.' },
      { who: 'Youngster Joey', mon: 19, text: 'Hey! My Rattata is in the top percentage of Rattata! Let\'s battle!' },
      { who: 'Prof. Oak', mon: 143, text: 'Those yellow ones are WILD. Weaken one, stand next to it and use Catch. I packed you some Poké Balls.' },
    ],
    outro: [{ who: 'Youngster Joey', mon: 19, text: 'Nooo! My top-percentage Rattata!' }, { who: 'Prof. Oak', mon: 143, text: 'Well done. Head north through Viridian Forest. Mind the bugs.' }],
    rewards: { pokeball: 3, potion: 2 },
    map: {
      name: 'Pallet Meadow', seed: 11, objective: { type: 'rout' },
      rows: [
        '.....,...TT..T.',
        '..,......T..T..',
        '....##.......,.',
        '.,..#...t......',
        '#####...tt.,...',
        'C...#..,~~~....',
        '....#...~~~..T.',
        '..,.##...~..TT.',
        '......#....,...',
      ],
      deploy: [{ x: 1, y: 3 }, { x: 1, y: 6 }, { x: 2, y: 4 }],
      units: [{ mon: 19, level: 3, x: 12, y: 2 }, { mon: 19, level: 2, x: 13, y: 4 }, { mon: 16, level: 3, x: 12, y: 7, ai: 'guard' }, { mon: 16, level: 2, team: 2, x: 8, y: 3, ai: 'aggro' }, { mon: 10, level: 2, team: 2, x: 6, y: 8, ai: 'aggro' }],
      items: [{ x: 9, y: 0, item: 'potion' }],
    },
  },
  {
    id: 'forest', title: 'Viridian Forest', num: 2, level: 7, slots: 4, par: 8, music: 'calm',
    intro: [
      { who: 'Bug Catcher Timmy', mon: 11, text: 'Halt! Nobody crosses my forest without smelling my bug collection!' },
      { who: 'Prof. Oak', mon: 143, text: 'Forests give 20% defence and slow walkers down. Bugs and grass types stroll right through.' },
      { who: 'Prof. Oak', mon: 143, text: 'I heard a Pikachu lives here. Catching one would be... electrifying.' },
    ],
    outro: [{ who: 'Bug Catcher Timmy', mon: 11, text: 'My beautiful cocoons! Fine, take the road to Mt. Moon. Team Rocket is digging there.' }],
    rewards: { pokeball: 2, greatball: 1, potion: 1 },
    map: {
      name: 'Viridian Forest', seed: 22, objective: { type: 'rout' },
      rows: [
        'TTT.TTTT..TTTTTT',
        'T..t..TT.t..TTTT',
        '..tt...T.tt..TTT',
        '.,.....TT..t..TT',
        '..T.,.......T..T',
        '.TTT..##..T.tT..',
        '..T..##.....t..,',
        '...,#..TT.,.....',
        '.T..#..TTT..T.TT',
        'TTT.#.TTTT.TTTTT',
      ],
      deploy: [{ x: 1, y: 3 }, { x: 0, y: 6 }, { x: 2, y: 7 }, { x: 1, y: 8 }],
      units: [{ mon: 10, level: 5, x: 11, y: 3 }, { mon: 13, level: 5, x: 12, y: 6 }, { mon: 11, level: 6, x: 14, y: 2, ai: 'guard' }, { mon: 14, level: 6, x: 13, y: 7, ai: 'guard' }, { mon: 12, level: 8, x: 14, y: 4, ai: 'guard', boss: true, nick: 'Timmy\'s Butterfree' }, { mon: 13, level: 4, x: 9, y: 1 },
        { mon: 25, level: 6, team: 2, x: 7, y: 3, ai: 'aggro' }, { mon: 43, level: 5, team: 2, x: 4, y: 1, ai: 'aggro' }, { mon: 16, level: 5, team: 2, x: 10, y: 8, ai: 'aggro' }],
      items: [{ x: 3, y: 1, item: 'pokeball' }, { x: 14, y: 8, item: 'candy' }],
    },
  },
  {
    id: 'moon', title: 'Mt. Moon', num: 3, level: 10, slots: 4, par: 9, music: 'player',
    intro: [
      { who: 'Rocket Grunt', mon: 41, text: 'Team Rocket is mining moon stones here. Scram, kid, or the bats eat well tonight.' },
      { who: 'Prof. Oak', mon: 143, text: 'Their boss is a Raticate hiding deep in the cave. Beat it and the grunts will scatter.' },
      { who: 'Prof. Oak', mon: 143, text: 'Zubat fly over rubble. Geodude climb it. A wild Geodude lives here: Rock and Ground types will matter later, hint hint.' },
    ],
    outro: [{ who: 'Rocket Grunt', mon: 41, text: 'Raticate down?! The boss will hear about this... run!' }, { who: 'Prof. Oak', mon: 143, text: 'A Clefairy waved at you on the way out. What a night. Next: Cerulean and its famous bridge.' }],
    rewards: { pokeball: 3, greatball: 1, superpotion: 1, fullheal: 1 },
    map: {
      name: 'Mt. Moon', seed: 33, objective: { type: 'boss', bossName: 'Raticate' },
      rows: [
        'WWWWWWWWWWWWWWWWWW',
        'WcccccrWWccrccccWW',
        'WccccccWWWcccrccWW',
        'WcccrcccccWcccccrW',
        'WccWWcrcccccWWcccW',
        'WccWWccccrcccWcccW',
        'WcccccWWccccccccrW',
        'WcrcccWcccrccWWccW',
        'WccccccccccccWcccW',
        'WWWWWWWWWWWWWWWWWW',
      ],
      deploy: [{ x: 2, y: 2 }, { x: 1, y: 3 }, { x: 2, y: 4 }, { x: 1, y: 5 }],
      units: [{ mon: 41, level: 8, x: 8, y: 2 }, { mon: 41, level: 8, x: 9, y: 6 }, { mon: 41, level: 9, x: 13, y: 3, ai: 'guard' }, { mon: 74, level: 9, x: 7, y: 4, ai: 'guard' }, { mon: 74, level: 9, x: 11, y: 7, ai: 'guard' }, { mon: 23, level: 9, x: 12, y: 1 }, { mon: 27, level: 9, x: 10, y: 8, ai: 'guard' }, { mon: 20, level: 11, x: 15, y: 5, ai: 'boss', boss: true, nick: 'Boss Raticate' }, { mon: 109, level: 10, x: 15, y: 2, ai: 'guard' },
        { mon: 35, level: 9, team: 2, x: 5, y: 7, ai: 'aggro' }, { mon: 74, level: 8, team: 2, x: 5, y: 1, ai: 'aggro' }],
      items: [{ x: 16, y: 8, item: 'candy' }, { x: 3, y: 8, item: 'greatball' }],
      reinforce: [{ turn: 4, units: [{ mon: 41, level: 9, x: 16, y: 1 }, { mon: 41, level: 9, x: 16, y: 7 }] }],
    },
  },
  {
    id: 'bridge', title: 'Nugget Bridge', num: 4, level: 13, slots: 5, par: 10, music: 'player',
    intro: [
      { who: 'Swimmer Ana', mon: 55, text: 'Nobody crosses Nugget Bridge without a swim! Water types, get \'em!' },
      { who: 'Prof. Oak', mon: 143, text: 'Take the bridge and SEIZE the Gym on the far side. Water types swim, fliers glide over everything.' },
      { who: 'Prof. Oak', mon: 143, text: 'Something big sleeps in the lake. Do not poke it unless you mean it.' },
    ],
    outro: [{ who: 'Swimmer Ana', mon: 55, text: 'You seized my gym?! Ugh. Fine. Rumour says Team Rocket has a hideout under the Game Corner.' }],
    rewards: { pokeball: 2, greatball: 2, potion: 2, candy: 1 },
    map: {
      name: 'Nugget Bridge', seed: 44, objective: { type: 'seize', what: 'Gym' }, seize: { x: 16, y: 4 }, par: 10,
      rows: [
        '..t..~~~~~~~~..TT.',
        '.,...~~~~~~~~~..T.',
        '.....s~~~~~~~s..,.',
        '#####s~~~~~~~s####',
        '.....=========...G',
        '.....s~~~~~~~s.#..',
        '..,..s~~~~~~s~.#..',
        '.t..s~~~~~~~~~.#..',
        '....~~~~~~~~~~..#.',
        'TT..~~~~~~~~~~..TT',
      ],
      deploy: [{ x: 1, y: 3 }, { x: 1, y: 5 }, { x: 2, y: 4 }, { x: 0, y: 4 }, { x: 2, y: 2 }],
      units: [{ mon: 60, level: 10, x: 8, y: 3, ai: 'aggro' }, { mon: 60, level: 10, x: 8, y: 5, ai: 'aggro' }, { mon: 118, level: 11, x: 10, y: 6, ai: 'guard' }, { mon: 120, level: 11, x: 11, y: 2, ai: 'guard' }, { mon: 72, level: 10, x: 6, y: 8, ai: 'aggro' }, { mon: 55, level: 12, x: 12, y: 4, ai: 'guard' }, { mon: 54, level: 11, x: 15, y: 5, ai: 'guard' }, { mon: 79, level: 12, x: 16, y: 3, ai: 'guard' }, { mon: 130, level: 15, x: 9, y: 1, ai: 'guard', boss: true, nick: 'Lake Gyarados' },
        { mon: 129, level: 6, team: 2, x: 4, y: 8, ai: 'aggro' }, { mon: 98, level: 11, team: 2, x: 5, y: 2, ai: 'aggro' }, { mon: 116, level: 11, team: 2, x: 13, y: 7, ai: 'aggro' }],
      items: [{ x: 16, y: 1, item: 'superpotion' }, { x: 17, y: 8, item: 'candy' }],
      reinforce: [{ turn: 4, units: [{ mon: 72, level: 11, x: 13, y: 1 }, { mon: 72, level: 11, x: 13, y: 8 }] }],
    },
  },
  {
    id: 'hideout', title: 'Rocket Hideout', num: 5, level: 16, slots: 5, par: 10, music: 'enemy',
    intro: [
      { who: 'Giovanni', mon: 53, text: 'So the meddling Tactician found my hideout. Persian, show them how a professional plays.' },
      { who: 'Prof. Oak', mon: 143, text: 'Their Pokémon love Poison. Pack a Full Heal. Crates give cover, pillars block the way.' },
      { who: 'Giovanni', mon: 53, text: 'Zubat, seal the doors in four turns. Nobody leaves.' },
    ],
    outro: [{ who: 'Giovanni', mon: 53, text: 'Tch. A tactician indeed. We will meet again, and I will have something... legendary.' }, { who: 'Prof. Oak', mon: 143, text: 'Legendary? The Power Plant reported strange lightning. Go look, and bring an umbrella.' }],
    rewards: { ultraball: 1, greatball: 2, superpotion: 2, fullheal: 1, candy: 1 },
    map: {
      name: 'Rocket Hideout', seed: 55, objective: { type: 'boss', bossName: 'Persian' }, music: 'enemy',
      rows: [
        'bbbbbbbbbbbbbbbbbb',
        'bffffxfbfffffpffbb',
        'bffffxfbffxfffffbb',
        'bfffffffffxffpffbb',
        'bfpfffbbbfffffffbb',
        'bfffffbxxffffxffbb',
        'bffxffffffpfffffbb',
        'bffxfffbfffffffffb',
        'bfffffpbffxffffffb',
        'bbbbbbbbbbbbbbbbbb',
      ],
      deploy: [{ x: 1, y: 2 }, { x: 2, y: 3 }, { x: 1, y: 5 }, { x: 2, y: 6 }, { x: 1, y: 7 }],
      units: [{ mon: 88, level: 13, x: 8, y: 2, ai: 'aggro' }, { mon: 88, level: 13, x: 9, y: 7, ai: 'aggro' }, { mon: 109, level: 14, x: 11, y: 3, ai: 'guard' }, { mon: 109, level: 14, x: 12, y: 6, ai: 'aggro' }, { mon: 23, level: 13, x: 6, y: 1 }, { mon: 24, level: 15, x: 14, y: 2, ai: 'guard' }, { mon: 96, level: 14, x: 15, y: 7, ai: 'guard' }, { mon: 52, level: 14, x: 13, y: 8, ai: 'guard' }, { mon: 53, level: 18, x: 15, y: 4, ai: 'boss', boss: true, nick: 'Giovanni\'s Persian' }, { mon: 89, level: 16, x: 16, y: 5, ai: 'guard' },
        { mon: 132, level: 14, team: 2, x: 6, y: 5, ai: 'aggro', nick: 'Ditto' }, { mon: 50, level: 13, team: 2, x: 9, y: 3, ai: 'aggro' }],
      items: [{ x: 4, y: 8, item: 'fullheal' }, { x: 16, y: 1, item: 'candy' }, { x: 12, y: 1, item: 'ultraball' }],
      reinforce: [{ turn: 4, units: [{ mon: 41, level: 13, x: 1, y: 1 }, { mon: 41, level: 13, x: 1, y: 8 }, { mon: 42, level: 15, x: 16, y: 8 }] }],
    },
  },
  {
    id: 'plant', title: 'Power Plant', num: 6, level: 20, slots: 6, par: 10, music: 'player',
    intro: [
      { who: 'Engineer Watt', mon: 81, text: 'The turbines are spinning backwards! Something in the reactor room is throwing lightning!' },
      { who: 'Prof. Oak', mon: 143, text: 'Zapdos. A legendary bird. Ground types are immune to Electric; Rock and Ice hurt it. It will wait for you, so choose the moment.' },
      { who: 'Engineer Watt', mon: 81, text: 'Careful with the Voltorbs, they look like Poké Balls. They are NOT Poké Balls.' },
    ],
    outro: [{ who: 'Engineer Watt', mon: 81, text: 'The lights are back! You... you fought Zapdos and lived. Legends say a fire bird nests in the Cinnabar volcano.' }],
    rewards: { ultraball: 2, greatball: 2, superpotion: 2, candy: 1 },
    map: {
      name: 'Power Plant', seed: 66, objective: { type: 'boss', bossName: 'Zapdos' },
      rows: [
        'bbbbbbbbbbbbbbbbbbbb',
        'bffffpfffbfffxffffpb',
        'bffxffffffffffpfffbb',
        'bfffffpfbbbfffffffbb',
        'bfffxfffbfbffxffpffb',
        'bffffffpbfbfffffffbb',
        'bfxfffffffffpfffxffb',
        'bfffpffbbbffffffffbb',
        'bffffffffffxffpffffb',
        'bbbbbbbbbbbbbbbbbbbb',
      ],
      deploy: [{ x: 1, y: 2 }, { x: 2, y: 3 }, { x: 1, y: 4 }, { x: 2, y: 5 }, { x: 1, y: 6 }, { x: 2, y: 7 }],
      units: [{ mon: 100, level: 17, x: 7, y: 2, ai: 'aggro' }, { mon: 100, level: 17, x: 8, y: 6, ai: 'guard' }, { mon: 100, level: 16, x: 6, y: 8, ai: 'aggro' }, { mon: 81, level: 17, x: 10, y: 1, ai: 'guard' }, { mon: 82, level: 19, x: 13, y: 4, ai: 'guard' }, { mon: 125, level: 19, x: 12, y: 2, ai: 'guard' }, { mon: 26, level: 19, x: 15, y: 6, ai: 'guard' }, { mon: 101, level: 19, x: 16, y: 2, ai: 'guard' }, { mon: 145, level: 23, x: 17, y: 4, ai: 'boss', boss: true, nick: 'Zapdos' },
        { mon: 100, level: 17, team: 2, x: 5, y: 5, ai: 'aggro' }, { mon: 81, level: 17, team: 2, x: 9, y: 4, ai: 'aggro' }],
      items: [{ x: 18, y: 8, item: 'candy' }, { x: 4, y: 1, item: 'ultraball' }],
    },
  },
  {
    id: 'volcano', title: 'Cinnabar Volcano', num: 7, level: 24, slots: 6, par: 8, music: 'boss',
    intro: [
      { who: 'Blaine', mon: 126, text: 'My volcano, my rules! Moltres is nesting and my fire team will keep you off the rim. Survive seven turns... if you can!' },
      { who: 'Prof. Oak', mon: 143, text: 'Lava burns anything that is not Fire or flying. Hold the rubble, it gives cover. Water and Rock are your friends here.' },
    ],
    outro: [{ who: 'Blaine', mon: 126, text: 'Seven turns! Hah! You have fire in you after all. Go, the last riddle waits in Cerulean Cave.' }, { who: 'Moltres', mon: 146, text: '*screeches and flies away, dropping a feather*' }],
    rewards: { ultraball: 2, superpotion: 3, fullheal: 2, candy: 2 },
    map: {
      name: 'Cinnabar Volcano', seed: 77, objective: { type: 'survive', turns: 7 }, music: 'boss',
      rows: [
        'WWWWWWWWWWWWWWWWWW',
        'WcccLLLcccLLcccrcW',
        'WcrcLLccrcLLcLccLW',
        'WcccLccccccLLcLLLW',
        'WrcccccrccccccLLcW',
        'WccrccLLccrccccccW',
        'WcccLLLLcccLLcrccW',
        'WcrccLLccrcLLLccrW',
        'WccccLccccccLccccW',
        'WWWWWWWWWWWWWWWWWW',
      ],
      deploy: [{ x: 1, y: 3 }, { x: 2, y: 4 }, { x: 1, y: 5 }, { x: 2, y: 6 }, { x: 3, y: 5 }, { x: 1, y: 7 }],
      units: [{ mon: 58, level: 21, x: 9, y: 2, ai: 'aggro' }, { mon: 58, level: 21, x: 10, y: 7, ai: 'aggro' }, { mon: 77, level: 21, x: 12, y: 4, ai: 'guard' }, { mon: 77, level: 21, x: 8, y: 5, ai: 'aggro' }, { mon: 126, level: 23, x: 14, y: 2, ai: 'guard', nick: 'Blaine\'s Magmar' }, { mon: 78, level: 23, x: 15, y: 8, ai: 'guard' }, { mon: 59, level: 26, x: 16, y: 4, ai: 'guard', boss: true, nick: 'Blaine\'s Arcanine' }, { mon: 146, level: 26, x: 16, y: 1, ai: 'boss', boss: true, nick: 'Moltres' },
        { mon: 37, level: 22, team: 2, x: 6, y: 8, ai: 'aggro' }],
      items: [{ x: 7, y: 1, item: 'superpotion' }, { x: 16, y: 6, item: 'candy' }],
      reinforce: [{ turn: 3, units: [{ mon: 58, level: 22, x: 16, y: 2 }] }, { turn: 4, units: [{ mon: 77, level: 22, x: 16, y: 8 }] }, { turn: 5, units: [{ mon: 126, level: 24, x: 16, y: 5 }] }, { turn: 6, units: [{ mon: 78, level: 24, x: 16, y: 2 }, { mon: 58, level: 23, x: 16, y: 8 }] }],
    },
  },
  {
    id: 'cave', title: 'Cerulean Cave', num: 8, level: 30, slots: 7, par: 12, music: 'boss',
    intro: [
      { who: 'Giovanni', mon: 53, text: 'You again. Meet my greatest creation. It does not obey me, but it hates you plenty.' },
      { who: 'Mewtwo', mon: 150, text: '...I was made to fight. Show me a reason not to.' },
      { who: 'Prof. Oak', mon: 143, text: 'Mewtwo resists Psychic and shreds Fighting and Poison. Bug, Ghost and Dark bite it. Wear it down and strike together!' },
    ],
    outro: [{ who: 'Mewtwo', mon: 150, text: '...So this is what a team is. Go. I have thinking to do.' }, { who: 'Prof. Oak', mon: 143, text: 'You did it. The region is safe, the Rockets are scattered, and you owe me a Pokédex. Congratulations, Tactician!' }],
    rewards: { ultraball: 3, superpotion: 3, candy: 3 },
    map: {
      name: 'Cerulean Cave', seed: 88, objective: { type: 'boss', bossName: 'Mewtwo' }, music: 'boss',
      rows: [
        'WWWWWWWWWWWWWWWWWWWW',
        'WccwwccrcccwwcccrccW',
        'WcccwwcccrcwwwccccrW',
        'WrccccccwwccccwcccWW',
        'WcccwwccccwccccccwcW',
        'WcrcwwwccccwcWcccwcW',
        'WccccwccrcccwcWcrccW',
        'WcccccccwwcccwccccrW',
        'WcrccwccccwwcccwcccW',
        'WccccccrcccccccccccW',
        'WWWWWWWWWWWWWWWWWWWW',
      ],
      deploy: [{ x: 1, y: 2 }, { x: 2, y: 3 }, { x: 1, y: 4 }, { x: 2, y: 6 }, { x: 1, y: 7 }, { x: 2, y: 8 }, { x: 3, y: 9 }],
      units: [{ mon: 64, level: 27, x: 8, y: 2, ai: 'aggro' }, { mon: 75, level: 27, x: 7, y: 5, ai: 'guard' }, { mon: 76, level: 28, x: 12, y: 3, ai: 'guard' }, { mon: 93, level: 27, x: 11, y: 6, ai: 'guard' }, { mon: 94, level: 29, x: 14, y: 8, ai: 'guard' }, { mon: 148, level: 28, x: 13, y: 1, ai: 'guard' }, { mon: 68, level: 29, x: 15, y: 5, ai: 'guard' }, { mon: 65, level: 30, x: 17, y: 2, ai: 'guard' }, { mon: 150, level: 34, x: 17, y: 5, ai: 'boss', boss: true, nick: 'Mewtwo' },
        { mon: 147, level: 26, team: 2, x: 5, y: 8, ai: 'aggro' }, { mon: 42, level: 27, team: 2, x: 6, y: 1, ai: 'aggro' }],
      items: [{ x: 18, y: 9, item: 'candy' }, { x: 9, y: 1, item: 'ultraball' }, { x: 4, y: 5, item: 'superpotion' }],
      reinforce: [{ turn: 5, units: [{ mon: 42, level: 28, x: 18, y: 1 }, { mon: 42, level: 28, x: 18, y: 9 }] }],
    },
  },
];
// Random skirmish map generator: value noise → water / mountains / forests / tall grass, a road, a Poké Center.
function skirmishMap(seed, w = 16, h = 11, avgLevel = 12) {
  const r = mulberry32(seed); const noise = (x, y, s) => { const n = Math.sin((x * 12.9898 + y * 78.233 + s) * 43758.5453) * 1e4; return n - Math.floor(n); };
  const grid = []; const base = r() * 1000;
  for (let y = 0; y < h; y++) { const row = []; for (let x = 0; x < w; x++) { let v = 0; for (let o = 1; o <= 3; o++) { const s = o * 2; const fx = x / s, fy = y / s; const x0 = Math.floor(fx), y0 = Math.floor(fy); const tx = fx - x0, ty = fy - y0; const a = noise(x0, y0, base + o), b = noise(x0 + 1, y0, base + o), c = noise(x0, y0 + 1, base + o), d = noise(x0 + 1, y0 + 1, base + o); v += lerp(lerp(a, b, tx), lerp(c, d, tx), ty) / o; } row.push(v / 1.83); } grid.push(row); }
  const rows = []; const theme = Math.floor(r() * 3);
  for (let y = 0; y < h; y++) { let s = ''; for (let x = 0; x < w; x++) { const v = grid[y][x]; let ch = '.'; if (x <= 1 || x >= w - 2) ch = v > .62 ? 'T' : v > .5 ? 't' : '.'; else if (v < .3) ch = '~'; else if (v < .36) ch = 's'; else if (v > .74) ch = theme === 2 ? '^' : 'M'; else if (v > .62) ch = 'T'; else if (v > .52) ch = 't'; else if (r() < .08) ch = ','; s += ch; } rows.push(s); }
  // a road across the middle with bridges over water
  const ry = Math.floor(h / 2) + Math.floor(r() * 3) - 1; rows[ry] = rows[ry].split('').map(c => c === '~' ? '=' : (c === 'M' || c === '^') ? '.' : '#').join('');
  const cx = Math.floor(w / 2) + Math.floor(r() * 3) - 1; const cy = ry > 2 ? ry - 2 : ry + 2; rows[cy] = rows[cy].slice(0, cx) + 'C' + rows[cy].slice(cx + 1);
  const deploy = []; for (let y = 0; y < h && deploy.length < 8; y++) for (let x = 0; x < 2 && deploy.length < 8; x++) if ('.,t#'.includes(rows[y][x])) deploy.push({ x, y });
  const pool = DEX_LIST.filter(d => d.num !== 150 && d.num !== 151 && d.num < 144 && d.num !== 132); const units = []; const taken = new Set(deploy.map(d => key(d.x, d.y)));
  const spot = (minX) => { for (let i = 0; i < 200; i++) { const x = minX + Math.floor(r() * (w - minX)), y = Math.floor(r() * h); const ch = rows[y][x]; if ('.,t#TsM'.includes(ch) && !taken.has(key(x, y))) { taken.add(key(x, y)); return { x, y }; } } return null; };
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) { const s = spot(Math.floor(w * .55)); if (!s) break; const d = pool[Math.floor(r() * pool.length)]; const lvl = Math.max(2, avgLevel + Math.floor(r() * 5) - 2); units.push({ mon: d.num, level: lvl, x: s.x, y: s.y, ai: r() < .6 ? 'aggro' : 'guard', boss: i === 0, nick: i === 0 ? 'Rival ' + d.name : null }); if (i === 0) units[0].level += 3; }
  for (let i = 0; i < 3; i++) { const s = spot(3); if (!s) break; const d = pool[Math.floor(r() * pool.length)]; units.push({ mon: d.num, level: Math.max(2, avgLevel - 2 + Math.floor(r() * 4)), x: s.x, y: s.y, team: 2, ai: 'aggro' }); }
  const items = []; for (let i = 0; i < 2; i++) { const s = spot(3); if (s) items.push({ x: s.x, y: s.y, item: pick(['potion', 'pokeball', 'greatball', 'candy', 'superpotion']) }); }
  return { name: 'Skirmish #' + (seed % 1000), seed, objective: { type: 'boss', bossName: 'the Rival' }, rows, deploy, units, items, par: 10, music: pick(['player', 'calm']) };
}

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
  // a Poké Center for each side
  const cy = ry - 2 >= 0 ? ry - 2 : ry + 2; put(3, cy, 'C'); put(w - 4, cy, 'C');
  // deploy zones: the two outer columns, nearest the middle row first; P2 mirrors P1
  const order = []; for (let y = 0; y < h; y++) for (let x = 0; x < 2; x++) order.push({ x, y }); order.sort((a, b) => Math.abs(a.y - ry) - Math.abs(b.y - ry) || a.x - b.x);
  const deploy = []; for (const c of order) { if (deploy.length >= 6) break; if (!'.,t#'.includes(rows[c.y][c.x])) { put(c.x, c.y, '.'); put(w - 1 - c.x, c.y, '.'); } deploy.push(c); }
  const deploy2 = deploy.map(c => ({ x: w - 1 - c.x, y: c.y }));
  // mode furniture: flag bases at each end of the middle road, or a 3×3 hill of open ground in the centre
  const flags = opt.mode === 'ctf' ? [{ team: 0, x: 1, y: ry }, { team: 1, x: w - 2, y: ry }] : null; if (flags) for (const f of flags) put(f.x, f.y, '.');
  const hill = opt.mode === 'hill' ? { x: Math.floor(w / 2), y: ry, r: 1 } : null; if (hill) for (let y = ry - 1; y <= ry + 1; y++) for (let x = hill.x - 1; x <= hill.x + 1; x++) if (y >= 0 && y < h && x >= 0 && x < w) put(x, y, y === ry ? '#' : '.');
  const units = [], items = []; const taken = new Set([...deploy, ...deploy2].map(d => key(d.x, d.y))); if (flags) for (const f of flags) taken.add(key(f.x, f.y)); if (hill) for (let y = ry - 1; y <= ry + 1; y++) for (let x = hill.x - 1; x <= hill.x + 1; x++) taken.add(key(x, y));
  const pool = DEX_LIST.filter(d => d.num < 144 && d.num !== 132 && d.num !== 143);
  const spot = () => { for (let i = 0; i < 200; i++) { const x = 3 + Math.floor(r() * (half - 3)), y = Math.floor(r() * h); if ('.,t#TsM'.includes(rows[y][x]) && !taken.has(key(x, y)) && !taken.has(key(w - 1 - x, y))) { taken.add(key(x, y)); taken.add(key(w - 1 - x, y)); return { x, y }; } } return null; };
  if (opt.wild !== false) for (let i = 0; i < 2; i++) { const s = spot(); if (!s) break; const d = pool[Math.floor(r() * pool.length)]; const lvl = Math.max(2, (opt.level || 20) - 3); units.push({ mon: d.num, level: lvl, x: s.x, y: s.y, team: 2, ai: 'aggro' }); if (s.x !== w - 1 - s.x) units.push({ mon: d.num, level: lvl, x: w - 1 - s.x, y: s.y, team: 2, ai: 'aggro' }); }
  for (let i = 0; i < 2; i++) { const s = spot(); if (!s) break; const it = ['potion', 'pokeball', 'superpotion', 'greatball'][Math.floor(r() * 4)]; items.push({ x: s.x, y: s.y, item: it }); if (s.x !== w - 1 - s.x) items.push({ x: w - 1 - s.x, y: s.y, item: it }); }
  return { name: 'Arena #' + (seed % 1000), seed, objective: { type: 'versus', mode: opt.mode || 'elim' }, rows, deploy, deploy2, units, items, par: 0, music: 'player', turnLimit: opt.turns == null ? 30 : opt.turns, flags, hill, fog: !!opt.fog };
}

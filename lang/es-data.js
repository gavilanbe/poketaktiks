// ============================================================================
// lang/es-data.js — Spanish for the game's data: types, moves (their official Spanish names), roles and skills,
// status, items, terrain, weather, lands, trainers and commanders, places, and what the Pokémon say.
// ============================================================================
'use strict';
Object.assign(ES, {
  // ---------------------------------------------------------------- types
  'Normal': 'Normal', 'Fire': 'Fuego', 'Water': 'Agua', 'Electric': 'Eléctrico', 'Grass': 'Planta', 'Ice': 'Hielo', 'Fighting': 'Lucha', 'Poison': 'Veneno', 'Ground': 'Tierra',
  'Flying': 'Volador', 'Psychic': 'Psíquico', 'Bug': 'Bicho', 'Rock': 'Roca', 'Ghost': 'Fantasma', 'Dragon': 'Dragón', 'Dark': 'Siniestro', 'Steel': 'Acero', 'Fairy': 'Hada',
  'NO EFFECT': 'SIN EFECTO', 'SUPER!!': '¡¡SÚPER!!', 'SUPER': 'SÚPER', 'BARELY': 'APENAS', 'WEAK': 'DÉBIL',

  // ---------------------------------------------------------------- moves
  'Tackle': 'Placaje', 'Scratch': 'Arañazo', 'Body Slam': 'Golpe Cuerpo', 'Hyper Beam': 'Hiperrayo', 'Ember': 'Ascuas', 'Flamethrower': 'Lanzallamas', 'Fire Blast': 'Llamarada',
  'Water Gun': 'Pistola Agua', 'Bubble Beam': 'Rayo Burbuja', 'Surf': 'Surf', 'Hydro Pump': 'Hidrobomba', 'Vine Whip': 'Látigo Cepa', 'Razor Leaf': 'Hoja Afilada', 'Giga Drain': 'Gigadrenado',
  'Solar Beam': 'Rayo Solar', 'Thunder Shock': 'Impactrueno', 'Thunderbolt': 'Rayo', 'Thunder': 'Trueno', 'Ice Shard': 'Canto Helado', 'Ice Beam': 'Rayo Hielo', 'Blizzard': 'Ventisca',
  'Karate Chop': 'Golpe Kárate', 'Brick Break': 'Demolición', 'Cross Chop': 'Tajo Cruzado', 'Poison Sting': 'Picotazo Veneno', 'Sludge': 'Residuos', 'Sludge Bomb': 'Bomba Lodo',
  'Mud-Slap': 'Bofetón Lodo', 'Dig': 'Excavar', 'Earthquake': 'Terremoto', 'Gust': 'Tornado', 'Wing Attack': 'Ataque Ala', 'Drill Peck': 'Pico Taladro', 'Confusion': 'Confusión',
  'Psybeam': 'Psicorrayo', 'Bug Bite': 'Picadura', 'X-Scissor': 'Tijera X', 'Megahorn': 'Megacuerno', 'Rock Throw': 'Lanzarrocas', 'Rock Slide': 'Avalancha', 'Stone Edge': 'Roca Afilada',
  'Lick': 'Lengüetazo', 'Hex': 'Infortunio', 'Shadow Ball': 'Bola Sombra', 'Twister': 'Ciclón', 'Dragon Claw': 'Garra Dragón', 'Outrage': 'Enfado', 'Bite': 'Mordisco', 'Crunch': 'Triturar',
  'Metal Claw': 'Garra Metal', 'Iron Head': 'Cabeza de Hierro', 'Flash Cannon': 'Foco Resplandor', 'Fairy Wind': 'Viento Feérico', 'Draining Kiss': 'Beso Drenaje', 'Moonblast': 'Fuerza Lunar',
  // what a hit sounds like, by type
  'BONK!': '¡PUM!', 'FWOOSH!': '¡FUUSH!', 'SPLASH!': '¡CHOF!', 'BZZT!': '¡BZZZ!', 'SWISH!': '¡ZAS!', 'CRACK!': '¡CRAC!', 'POW!': '¡POM!', 'BLORP!': '¡BLORP!', 'THUD!': '¡TUM!',
  'WHOOSH!': '¡FIUUU!', 'WOOOM!': '¡UUUM!', 'CHOMP!': '¡ÑAM!', 'CRUNCH!': '¡CRUNCH!', 'BOO!': '¡BU!', 'ROAR!': '¡GRAAH!', 'GRR!': '¡GRR!', 'CLANG!': '¡CLANC!', 'TWINKLE!': '¡CLIN!',

  // ---------------------------------------------------------------- status
  'PSN': 'ENV', 'BRN': 'QUE', 'PAR': 'PAR', 'FRZ': 'CON', 'SLP': 'DOR',
  'poisoned': 'envenenado', 'burned': 'quemado', 'paralyzed': 'paralizado', 'frozen': 'congelado', 'asleep': 'dormido',

  // ---------------------------------------------------------------- roles and their skills
  'Scout': 'Explorador', 'Defender': 'Defensor', 'Amphibious': 'Anfibio', 'Controller': 'Controlador', 'Ranged': 'A distancia', 'Support': 'Apoyo', 'Striker': 'Atacante',
  'SCT': 'EXP', 'AMP': 'ANF', 'CTL': 'CTR', 'RNG': 'DIS', 'SUP': 'APO', 'STK': 'ATA',
  'Flanker. After attacking it darts up to 2 tiles. Strikes twice when 10+ SPE faster.': 'Flanqueador. Tras atacar se repliega hasta 2 casillas. Golpea dos veces si le saca 10+ de VEL.',
  'Wall. Brace instead of attacking to take 40% less damage until its next turn.': 'Muro. En vez de atacar puede ponerse en guardia: recibe un 40% menos de daño hasta su siguiente turno.',
  'Swims. On water it is at home: DEF 20% and AVO 20.': 'Nada. En el agua está en su elemento: DEF 20% y EVA 20.',
  'Root a foe within 2 tiles: it cannot move on its next turn. Every other turn; fliers are immune.': 'Enraíza a un enemigo a 2 casillas o menos: no podrá moverse en su siguiente turno. Cada dos turnos; los voladores son inmunes.',
  'Reach: its ranged moves hit one tile further, out of most counters.': 'Alcance: sus movimientos a distancia llegan una casilla más lejos, fuera del alcance de casi todos los contraataques.',
  'Mend an adjacent ally: 30% HP and cures status and root. Every other turn.': 'Sana a un aliado adyacente: 30% de PS y le cura el estado y las raíces. Cada dos turnos.',
  'Plain attacker. Strikes twice when 10+ SPE faster.': 'Atacante puro. Golpea dos veces si le saca 10+ de VEL.',
  'Dart': 'Repliegue', 'Brace': 'Guardia', 'Root': 'Raíces', 'Mend': 'Sanar', 'Reach': 'Alcance', 'Tide': 'Marea',
  'Dart: moves up to 2 tiles after attacking': 'Repliegue: tras atacar se mueve hasta 2 casillas',
  'Brace: 40% less damage until its next turn': 'Guardia: un 40% menos de daño hasta su siguiente turno',
  'Take 40% less damage until your next turn': 'Recibe un 40% menos de daño hasta tu siguiente turno',
  'Root: a foe within 2 cannot move next turn': 'Raíces: un enemigo a 2 casillas no se moverá el próximo turno',
  'A foe within 2 tiles cannot move on its next turn': 'Un enemigo a 2 casillas o menos no podrá moverse en su siguiente turno',
  'Mend: adjacent ally +30% HP, cures status': 'Sanar: aliado adyacente +30% de PS y cura su estado',
  'Heal an adjacent ally 30% and cure it': 'Cura un 30% a un aliado adyacente y sana su estado',
  'Reach: ranged moves hit one tile further': 'Alcance: los movimientos a distancia llegan una casilla más',
  'Tide: DEF 20% and AVO 20 on water': 'Marea: DEF 20% y EVA 20 en el agua',
  'Striker: plain attacker, strikes twice when 10+ SPE faster': 'Atacante: ataca sin más y golpea dos veces si le saca 10+ de VEL',
  'plain attacker': 'ataque puro',
  'Controller · roots foes': 'Controlador · enraíza enemigos', 'Striker · hits twice when faster': 'Atacante · golpea dos veces si es más rápido', 'Amphibious · at home in water': 'Anfibio · como pez en el agua',

  // ---------------------------------------------------------------- items
  'Poké Ball': 'Poké Ball', 'Catch a weakened wild Pokémon.': 'Atrapa a un Pokémon salvaje debilitado.',
  'Practice Ball': 'Ball de prácticas', 'Oak\'s free practice ball. Guaranteed at half HP.': 'La Ball de prácticas gratuita de Oak. Captura segura a mitad de PS.',

  // ---------------------------------------------------------------- terrain
  'Plains': 'Llanura', 'Meadow': 'Prado', 'Tall Grass': 'Hierba alta', 'Forest': 'Bosque', 'Mountain': 'Montaña', 'Cliff': 'Acantilado', 'Cave Pool': 'Charca de cueva', 'Bridge': 'Puente',
  'Road': 'Camino', 'Sand': 'Arena', 'Poké Center': 'Centro Pokémon', 'Field Center': 'Centro de campaña', 'Gym': 'Gimnasio', 'HQ': 'Cuartel', 'House': 'Casa', 'Cave Floor': 'Suelo de cueva',
  'Rubble': 'Escombros', 'Cave Wall': 'Pared de cueva', 'Floor': 'Suelo', 'Wall': 'Muro', 'Lava': 'Lava', 'Pillar': 'Columna', 'Crates': 'Cajas', 'Snow': 'Nieve', 'Snowfield': 'Campo nevado',

  // ---------------------------------------------------------------- weather and lands
  'Rain': 'Lluvia', 'It started to rain!': '¡Ha empezado a llover!', 'The rain stopped.': 'Ha dejado de llover.',
  'Harsh sun': 'Sol abrasador', 'The sunlight turned harsh!': '¡El sol pega con fuerza!', 'The sunlight faded.': 'El sol se ha suavizado.',
  'Sandstorm': 'Tormenta de arena', 'A sandstorm kicked up!': '¡Se ha levantado una tormenta de arena!', 'The sandstorm subsided.': 'La tormenta de arena ha amainado.',
  'It started to snow!': '¡Ha empezado a nevar!', 'The snow stopped.': 'Ha dejado de nevar.',
  'Fields': 'Campo', 'Coast': 'Costa', 'Mountains': 'Montañas', 'Volcano': 'Volcán', 'Cave': 'Cueva',
  'Easy': 'Fácil', 'Hard': 'Difícil', 'Small': 'Pequeño', 'Medium': 'Mediano', 'Large': 'Grande',
  'Common': 'Común', 'Uncommon': 'Poco común', 'Rare': 'Raro', 'Very rare': 'Muy raro',

  // ---------------------------------------------------------------- trainers, commanders, places
  'Prof. Oak': 'Prof. Oak', 'You': 'Tú', 'Nurse Joy': 'Enfermera Joy', 'Youngster Joey': 'Joven Joey', 'Bug Catcher Timmy': 'Cazabichos Timmy', 'Rocket Grunt': 'Recluta Rocket',
  'Engineer Watt': 'Ingeniero Watt', 'Swimmer Ana': 'Nadadora Ana', 'Hiker': 'Montañero', 'Blue': 'Azul', 'Lt. Surge': 'Tte. Surge', 'Team Rocket': 'Team Rocket', 'Tactician': 'Táctico',
  'Timmy\'s Butterfree': 'Butterfree de Timmy', 'Boss Raticate': 'Raticate jefe', 'Lake Gyarados': 'Gyarados del lago', 'Giovanni\'s Persian': 'Persian de Giovanni',
  'Blue\'s Pidgeotto': 'Pidgeotto de Azul', 'Blue\'s Wartortle': 'Wartortle de Azul', 'Blaine\'s Magmar': 'Magmar de Blaine', 'Blaine\'s Arcanine': 'Arcanine de Blaine',
  'Pallet Meadow': 'Pradera de Paleta', 'Viridian Forest': 'Bosque Verde', 'Mt. Moon': 'Mt. Moon', 'Nugget Bridge': 'Puente Pepita', 'Rocket Hideout': 'Guarida Rocket',
  'Power Plant': 'Central Energía', 'Cinnabar Volcano': 'Volcán Canela', 'Cerulean Cave': 'Cueva Celeste',
  'YOUR HQ': 'TU CUARTEL', 'ENEMY HQ': 'CUARTEL ENEMIGO', 'ROCKET HQ': 'CUARTEL ROCKET', 'ROCKET CENTER': 'CENTRO ROCKET', 'FIELD CENTER': 'CENTRO DE CAMPAÑA', 'POKé CENTER': 'CENTRO POKéMON',
  'JOEY\'S CAMP': 'CAMPAMENTO DE JOEY', 'TIMMY\'S CAMP': 'CAMPAMENTO DE TIMMY', 'FOREST OUTPOST': 'PUESTO DEL BOSQUE', 'BRIDGE OUTPOST': 'PUESTO DEL PUENTE', 'GYM': 'GIMNASIO',
  'P1 HQ': 'CUARTEL J1', 'P2 HQ': 'CUARTEL J2', 'WEST HQ': 'CUARTEL OESTE', 'EAST HQ': 'CUARTEL ESTE', '{0}\'S HQ': 'CUARTEL DE {0}',

  // the commanders
  'Your own style: it follows your partner': 'Tu propio estilo: sigue a tu compañero',
  'Partner bond: allies near your partner deal 10% more, take 10% less': 'Vínculo: los aliados cerca de tu compañero hacen un 10% más y reciben un 10% menos',
  'Rock-solid defence': 'Defensa de piedra', 'Rock and Ground allies take 15% less': 'Los aliados Roca y Tierra reciben un 15% menos',
  'Rock Tomb': 'Tumba Rocas', 'Enemies lose 1 move next turn and take 10%': 'Los enemigos pierden 1 de movimiento el próximo turno y reciben un 10%',
  'Sandstorm Fort': 'Fortaleza de Arena', 'Allies take 30% less; 2 days of sandstorm': 'Los aliados reciben un 30% menos; 2 días de tormenta de arena',
  'The tide is hers': 'La marea es suya', 'Water moves +10%, +1 move on water': 'Movimientos Agua +10% y +1 de movimiento en el agua',
  'Rain Dance': 'Danza Lluvia', '2 days of rain: Water ×1.5, Fire ×0.5': '2 días de lluvia: Agua ×1,5 y Fuego ×0,5',
  'Hydro Surge': 'Marejada', '3 days of rain; Water moves +30%; heal 20%': '3 días de lluvia; movimientos Agua +30%; cura un 20%',
  'Lightning strikes first': 'El rayo golpea primero', '+10% critical chance': '+10% de probabilidad de crítico',
  'Thunder Wave': 'Onda Trueno', 'Paralyse the three strongest enemies': 'Paraliza a los tres enemigos más fuertes',
  'Thunderstorm': 'Tormenta Eléctrica', 'Lightning hits every enemy for 20%; crits +30%': 'Los rayos quitan un 20% a cada enemigo; críticos +30%',
  'Gardens that mend': 'Jardines que curan', 'Centers heal 10% more': 'Los centros curan un 10% más',
  'Aromatherapy': 'Aromaterapia', 'Heal every ally 20% and cure them': 'Cura un 20% a cada aliado y sana sus estados',
  'Petal Blizzard': 'Tormenta Floral', 'Heal every ally 30%; enemies on grass take 15%': 'Cura un 30% a cada aliado; los enemigos sobre hierba reciben un 15%',
  'Poison and smoke': 'Veneno y humo', 'Status chances +10%': 'Probabilidad de estado +10%',
  'Toxic Spikes': 'Púas Tóxicas', 'Poison every enemy on open ground': 'Envenena a todos los enemigos a campo abierto',
  'Smokescreen': 'Pantalla de Humo', 'Allies +25 evasion; enemies lose 1 move': 'Aliados +25 de evasión; los enemigos pierden 1 de movimiento',
  'She saw it coming': 'Lo vio venir', 'Psychic moves +10%': 'Movimientos Psíquico +10%',
  'Calm Mind': 'Paz Mental', 'Special moves +30%': 'Movimientos especiales +30%',
  'Future Sight': 'Premonición', 'Every enemy takes 25% at your next turn': 'Cada enemigo recibe un 25% en tu próximo turno',
  'Hot-headed fire': 'Fuego impetuoso', 'Fire moves +10%': 'Movimientos Fuego +10%',
  'Sunny Day': 'Día Soleado', '2 days of sun: Fire ×1.5, Water ×0.5': '2 días de sol: Fuego ×1,5 y Agua ×0,5',
  'Eruption': 'Estallido', 'Every enemy takes 20% and burns; 2 days of sun': 'Cada enemigo recibe un 20% y se quema; 2 días de sol',
  'Always one step ahead': 'Siempre un paso por delante', '+10% damage': '+10% de daño',
  'Smell Ya Later': 'Hasta Luego', 'Allies +1 move': 'Aliados +1 de movimiento',
  'Champion\'s Pride': 'Orgullo de Campeón', 'Allies +40% damage and +1 move': 'Aliados +40% de daño y +1 de movimiento',
  'Money and might': 'Dinero y poder', 'Income +10%': 'Ingresos +10%',
  'Enemies on the ground take 20%': 'Los enemigos en tierra reciben un 20%',
  'Rocket Supremacy': 'Supremacía Rocket', 'Earthquake; allies +30% damage, take 30% less': 'Terremoto; aliados +30% de daño y un 30% menos de daño recibido',
  'Dirty tricks': 'Juego sucio', 'Poison moves +10%': 'Movimientos Veneno +10%',
  'Pickpocket': 'Carterista', 'Steal ₽1000 from the enemy': 'Roba ₽1.000 al enemigo',
  'Rocket Rush': 'Asalto Rocket', 'Allies +25% damage and +1 move': 'Aliados +25% de daño y +1 de movimiento',
  // your partner's family of powers
  'OFFENSE': 'ATAQUE', 'Rally': 'Arenga', 'Blaze Rush': 'Carga Ígnea', 'Break through the enemy line.': 'Rompe la línea enemiga.',
  'Each ally: next attack +25% damage.': 'Cada aliado: su próximo ataque hace un 25% más.', 'Each ally: next attack +50% damage.': 'Cada aliado: su próximo ataque hace un 50% más.',
  'PROTECTION': 'PROTECCIÓN', 'Shell Guard': 'Caparazón', 'Tidal Shield': 'Escudo Marea', 'Keep the whole team standing.': 'Mantén en pie a todo el equipo.',
  'All allies take 20% less damage.': 'Todos los aliados reciben un 20% menos de daño.', 'All allies take 40% less damage.': 'Todos los aliados reciben un 40% menos de daño.',
  'RECOVERY': 'RECUPERACIÓN', 'Life Link': 'Vínculo Vital', 'Verdant Bloom': 'Floración', 'Recover and hold your ground.': 'Recupérate y aguanta la posición.',
  'All allies heal 20% HP and are cured.': 'Todos los aliados recuperan un 20% de PS y sanan.', 'Heal 40%, cure and block new status.': 'Cura un 40%, sana y bloquea nuevos estados.',

  // ---------------------------------------------------------------- modes' rules
  'HQ War': 'Guerra de cuarteles', 'WAR': 'GUERRA', 'Capture the Flag': 'Captura la bandera', 'CTF': 'BANDERA', 'King of the Hill': 'Rey de la colina', 'HILL': 'COLINA',
  'Knock out every Pokémon on the other team or capture their HQ. Centers pay funds each day; deploy from your Box at the ones you hold. At the turn limit the larger team wins.': 'Debilita a todos los Pokémon del otro equipo o captura su cuartel. Los centros dan fondos cada día; despliega desde tu Caja en los que tengas. Al llegar al límite de turnos gana el equipo más numeroso.',
  'Take the flag from the enemy base and carry it back to your own flag. A fainted carrier drops it; step on your own dropped flag to send it home.': 'Coge la bandera de la base enemiga y llévala hasta la tuya. Si quien la lleva se debilita, la suelta; pisa tu bandera caída para devolverla a casa.',
  'Start three of your turns with more Pokémon than the other team on the hill, the 3×3 zone in the middle of the arena.': 'Empieza tres de tus turnos con más Pokémon que el otro equipo en la colina, la zona de 3×3 del centro de la arena.',

  // ---------------------------------------------------------------- what the Pokémon say (when selected)
  'Bulba!': '¡Bulba!', 'Saur saur!': '¡Saur saur!', 'Char!': '¡Char!', 'Charmander!': '¡Charmander!', 'Squirtle squirt!': '¡Squirtle squirt!', 'Turtle time.': 'Hora tortuga.',
  'Chomp.': 'Ñam.', 'Leaf!': '¡Hoja!', 'Pidgey!': '¡Pidgey!', 'Coo!': '¡Curruc!', 'Rattata!': '¡Rattata!', 'Nibble!': '¡Mordisquito!', 'Sssss.': 'Sssss.', 'Hisss!': '¡Fsss!',
  'Pika pika!': '¡Pika pika!', 'Pikaaa!': '¡Pikaaa!', 'Chu!': '¡Chu!', 'Sand!': '¡Sand!', '*curls up*': '*se hace una bola*', 'Clefa!': '¡Clefa!', 'Fairy!': '¡Fairy!', 'Vul!': '¡Vul!',
  '*flicks tails*': '*mueve las colas*', 'La la la~': 'La la la~', 'Puff!': '¡Puff!', 'Screee!': '¡Iiiik!', 'Skree!': '¡Kiii!', 'Meowth, that\'s right!': '¡Meowth, así es!', 'Nyaa!': '¡Miau!',
  'Psy...': 'Psy...', 'My head...': 'Mi cabeza...', 'Raaargh!': '¡Raaargh!', '*angry*': '*enfadado*', 'Arf!': '¡Guau!', 'Growl!': '¡Grrr!', 'Poli!': '¡Poli!', '*wiggles*': '*se menea*',
  '*teleports*': '*se teletransporta*', 'Zzz.': 'Zzz.', 'Hup!': '¡Hop!', 'Chop chop!': '¡Aúpa, aúpa!', 'Bell!': '¡Bell!', '*sways*': '*se balancea*', '*jellies*': '*tiembla como un flan*',
  'Blub.': 'Blub.', 'Rock.': 'Roca.', 'Geodude!': '¡Geodude!', 'Neigh!': '¡Hiiii!', '*flames*': '*echa llamas*', '... slow.': '... despacio.', 'Huh?': '¿Eh?', 'Beep.': 'Bip.', 'Boop.': 'Bup.',
  'Blorp.': 'Blorp.', 'Squish.': 'Chof.', '*clam*': '*se cierra*', 'Shell!': '¡Concha!', 'Gas... tly.': 'Gas... tly.', 'Hehe.': 'Jeje.', 'Hehehe!': '¡Jejeje!', 'Boo.': 'Bu.',
  'GRRAAAH!': '¡GRRAAAH!', '*rumbles*': '*retumba*', 'Sleepy...': 'Qué sueño...', 'Cookie cookie!': '¡Galleta, galleta!', 'Krab!': '¡Krab!', '*rolls*': '*rueda*', 'Volt!': '¡Volt!',
  '*puffs*': '*echa humo*', 'Koff.': 'Cof.', '*protects baby*': '*protege a su cría*', 'Kanga!': '¡Kanga!', 'Horsea!': '¡Horsea!', 'Goldeen!': '¡Goldeen!', '*spins*': '*da vueltas*',
  'Hyah!': '¡Hiya!', 'MOO!': '¡MUUU!', '*stomps*': '*pisotea*', 'Splash.': 'Salpica.', '...splash.': '...salpica.', 'Karp.': 'Karp.', 'Ditto.': 'Ditto.', 'Ditto ditto.': 'Ditto ditto.',
  'Vee!': '¡Vee!', 'Eevee!': '¡Eevee!', '*ancient noises*': '*sonidos antiguos*', '*fossil noises*': '*ruidos de fósil*', 'Zzz...': 'Zzz...', '*yawns*': '*bosteza*',
  'Snack time?': '¿Hora de merendar?', 'Dra...': 'Dra...', 'Tini!': '¡Tini!', 'Why am I here?': '¿Qué hago yo aquí?',
  'Let\'s go!': '¡Vamos!', 'Ready!': '¡Listo!', 'Hm?': '¿Mm?', 'Yeah!': '¡Sí!', '*nods*': '*asiente*', 'Here!': '¡Aquí!', '*bounces*': '*da saltitos*',
});

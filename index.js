// <3 Pinkie Pie :3 - fork by Haku, Includes skip-cutscenes for problematic zones
module.exports = function QuickLoad(mod) {
	let lastZone = -1,
		quick = false,
		modified = false,
		lastLocation = null,
		correctLocation = null,
		correctAngle = null;

	mod.command.add(['ql','quickload'], (...args) => {
		if(!args) {
			mod.settings.enabled = !mod.settings.enabled;
			mod.command.message('Module ' + (mod.settings.enabled ? 'en' : 'dis') + 'abled')
			return;
		}
		switch (args[0]) {
			case 'block':
				let addZone = !args[1] ? lastZone : Number(args[1])
				
				if(isNaN(addZone)) {
					mod.command.message('Error: ' + args[1].toString() + ' is not a number!')
					return;
				}
				mod.settings.blockedZones.push(addZone);
				mod.command.message('Added zone ' + addZone.toString() + ' to blocked zone list.')
				mod.saveSettings();
				break

			case 'unblock':
				let removeZone = !args[1] ? lastZone : Number(args[1])
			
				if(isNaN(removeZone)) {
					mod.command.message('Error: ' + args[1].toString() + ' is not a number!')
					return;
				}
				if(mod.settings.blockedZones.includes(removeZone)) {
					mod.settings.blockedZones.splice(mod.settings.blockedZones.indexOf(removeZone), 1)
					mod.command.message('Removed zone ' + removeZone.toString() + ' from blocked zone list.')
				} else {
					mod.command.message('Error: ' + removeZone.toString() + ' is not currently being blocked.')
				}
				mod.saveSettings();
				break
			
			case 'blockcutscene':
				let addZoneCutscene = !args[1] ? lastZone : Number(args[1])
				
				if(isNaN(addZoneCutscene)) {
					mod.command.message('Error: ' + args[1].toString() + ' is not a number!')
					return;
				}
				mod.settings.skipCutscenesZones.push(addZoneCutscene);
				mod.command.message('Added zone ' + addZoneCutscene.toString() + ' to blocked cutscene zone list.')
				mod.saveSettings();
				break

			case 'unblockcutscene':
				let removeZoneCutscene = !args[1] ? lastZone : Number(args[1])
			
				if(isNaN(removeZoneCutscene)) {
					mod.command.message('Error: ' + args[1].toString() + ' is not a number!')
					return;
				}
				if(mod.settings.skipCutscenesZones.includes(removeZoneCutscene)) {
					mod.settings.skipCutscenesZones.splice(mod.settings.skipCutscenesZones.indexOf(removeZoneCutscene), 1)
					mod.command.message('Removed zone ' + removeZoneCutscene.toString() + ' from blocked cutscene zone list.')
				} else {
					mod.command.message('Error: Cutscenes in zone ' + removeZoneCutscene.toString() + ' are not currently being blocked.')
				}
				mod.saveSettings();
				break

			case 'list':
				mod.command.message('Blocked Zones: ' + mod.settings.blockedZones.toString())
				mod.command.message('Cutscenes are blocked in the following zones: ' + mod.settings.skipCutscenesZones.toString())
				break

			default:
				mod.command.message('Error: ' + args[0].toString() + ' is not a valid command! Available commands: block, unblock, blockcutscene, unblockcutscene, list')

		}
	});

	mod.game.on('enter_game', () => {
		lastZone = -1;
		lastLocation = null;
	})

	mod.hook('S_LOAD_TOPO', 3, {order: 100}, event => {
		quick = event.quick;
		if(mod.settings.enabled && event.zone === lastZone && (mod.settings.loadExtra || event.loc.dist3D(lastLocation) <= mod.settings.loadDistance) && !mod.settings.blockedZones.includes(event.zone)) {
			return modified = event.quick = true; 
		    }

		lastZone = event.zone;
		modified = false;
	});

	mod.hook('S_SPAWN_ME', 3, {order: 100}, event => {
		if(!quick) {
			correctLocation = event.loc;
			correctAngle = event.w;
		};

		if(modified) {
			if(!lastLocation || event.loc.dist3D(lastLocation) > mod.settings.loadDistance) {
				process.nextTick(() => { mod.send('S_ADMIN_HOLD_CHARACTER', 2, {hold: true}) })
			}
			else modified = false;

			mod.send('S_SPAWN_ME', 3, event) // Bring our character model back from the void
			mod.send('C_PLAYER_LOCATION', 5, { // Update our position on the server
				loc: event.loc,
				w: event.w,
				lookDirection: 0,
				dest: event.loc,
				type: 7,
				jumpDistance: 0,
				inShuttle: 0,
				time: 0
			});
		}
	});

	mod.hook('S_ADMIN_HOLD_CHARACTER', 'raw', () => !modified && undefined);

	mod.hook('C_PLAYER_LOCATION', 5, event => {
		if(correctLocation) {
			// Did we accidentally spawn under the map? Let's fix that!
			if(event.loc.z !== correctLocation.z) {
				mod.send('S_INSTANT_MOVE', 3, {
					gameId: mod.game.me.gameId,
					loc: correctLocation,
					w: correctAngle
				});
				correctLocation = null;
				return false;
			}
			correctLocation = null;
		}
	});

	mod.hook('C_PLAYER_LOCATION', 5, {order: 100, filter: {fake: null}}, event => {
		lastLocation = event.loc;
	});

	mod.hook('C_VISIT_NEW_SECTION', 'raw', () => {
		// If our client doesn't send C_PLAYER_LOCATION before this packet, then it's most likely user input
		correctLocation = null;

		if(modified) {
			setTimeout(() => { mod.send('S_ADMIN_HOLD_CHARACTER', 2, {hold: false}) }, mod.settings.loadExtraMs);
			modified = false;
		}
	})
	mod.hook('S_PLAY_MOVIE', 1, {order: 100}, event => {
		if(mod.settings.skipCutscenesZones.includes(lastZone) && mod.settings.skipCutscenes && mod.settings.enabled) {
			
			mod.send('C_END_MOVIE', 1, Object.assign({ unk: true }, event));
			return false;
		}
	});
	this.destructor = () => {mod.command.remove(['ql','quickload'])}
};
`tabs.main.js` is Herdr's shipped tab bar (`~/.config/herdr-app/mods/tabs/main.js`,
tabs 0.1.11) as `mods/doubletap/main.js` was cloned from. `test/upstream.test.js` fails
when the installed Herdr ships a different tab bar: diff the new one against this file,
port the change into `mods/doubletap/main.js`, then replace this file with it.

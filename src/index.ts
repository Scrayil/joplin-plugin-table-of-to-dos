import joplin from 'api';
import {manageTotNotes, manageTotNotesStates} from "./tot_note";
import {registerSettings} from "./settings";
import {registerJoplinCommands} from "./pluginCommands";
import {ContentScriptType} from "../api/types";
import {registerCodeMirrorExtension} from "./utils";


joplin.plugins.register({
	onStart: async function() {
		// As soon as the current note changes, this updates the related TOT content
		await joplin.workspace.onNoteChange(async () => {
			await manageTotNotes(true);
		});

		// As soon as a TOT note is selected, saves it's content for later
		await joplin.workspace.onNoteSelectionChange(async () => {
			await manageTotNotesStates();
		});

		// Registering the plugin's settings
		await registerSettings();

		// Registering commands and related menu options
		await  registerJoplinCommands()

		// Registering a CodeMirror extension to set the Markdown editors as read.only (TOT notes only)
		await registerCodeMirrorExtension()
	},
})
.then(_ => console.info("TOT Plugin registered successfully!"))
.catch(err => console.error("Failed to register TOT Plugin:", err));
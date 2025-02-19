import joplin from "../api";
import {MenuItemLocation} from "../api/types";
import {manageTotNotes} from "./tot_note";


export const registerJoplinCommands = async () => {
    // Registers a command that creates the TOT note.
    // This is triggered by the below button's click
    await joplin.commands.register({
        name: 'table_of_todos_createTotNote',
        label: 'Create TOT note',
        iconName: 'fas fa-check-square',
        execute: async () => {
            const totNoteId = await manageTotNotes(false);
            if(totNoteId.length > 0) {
                await joplin.commands.execute('openNote', totNoteId);
            }
        },
    });

    // Adds also a context menu entry for the note editor, to generate the corresponding TOT
    await joplin.views.menuItems.create('noteEditorContextTotMenu', 'table_of_todos_createTotNote', MenuItemLocation.EditorContextMenu, {accelerator: 'Ctrl+Alt+Space'});
    // Adds also a menu entry to generate a TOT note in the main toolbar under "Note"
    await joplin.views.menus.create('toolbarToolsTotMenu', 'TOT (Table Of To-Dos)', [{
        commandName: 'table_of_todos_createTotNote',
        accelerator: 'Ctrl+Alt+Space'
    }], MenuItemLocation.Note);
}
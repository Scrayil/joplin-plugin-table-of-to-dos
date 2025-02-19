import joplin from 'api';
import {cacheTotNotesState, generateTotMarkdown, updateTotNoteCheckboxes} from './utils';


// Global variable to keep track of the latest update on each TOT note
let lastEditedTs = {};


// Function used to handle TOT notes updates
async function handleTotNoteDirectUpdates(totNote) {
    console.debug(`Handling TOT note content change and state...`)
    // Avoids entering into an infinite loop of updates, since changing the note's content triggers a new update event
    if(totNote.updated_time > (lastEditedTs[totNote.id] ?? 0)) {
        const newBody = updateTotNoteCheckboxes(totNote);
        // Updates the cache again, since we have just edited the TOT note's content
        totNote.body = newBody;
        cacheTotNotesState(totNote);
        // Updates the note's data in the database
        await joplin.data.put(['notes', totNote.id], null, { body: newBody });
        // The following two lines allow replacing the note's content in the editor, without scrolling to the top
        await joplin.commands.execute('textSelectAll');
        await joplin.commands.execute("replaceSelection", newBody);
        // Keeps track of the last plugin's updates to the notes
        lastEditedTs[totNote.id] = new Date().getTime();
    }
}


// Function to update the existing TOT note
async function updateTotNote(currNote, currTotBody, newTotBody, totNoteId) {
    console.debug(`Updating note ${currNote.title}'s TOT content...`)
    for(const line of currTotBody.split('\n')) {
        if(line.indexOf("[x]") > -1) {
            const match = line.substring(line.indexOf("]")).match(/\[(.*?)\]/)
            newTotBody = newTotBody.replace("- [ ] [" + match[1], "- [x] [" + match[1]);
        }
    }
    await joplin.data.put(['notes', totNoteId], null, { body: newTotBody });
}

// Function used to create a new TOT note
async function createTotNote(currNote, totBody, totNoteTitle) {
    console.debug(`Creating note ${currNote.title}'s tot...`)
    const newNote = await joplin.data.post(['notes'], null, { is_todo: 1, body: totBody, title: totNoteTitle, parent_id: currNote.parent_id });
    return newNote.id;
}

// Main TOT notes core used to detect the current state and act based on it.
// This can either generate a new TOT or update the existing one
export async function manageTotNotes(isNoteChange: boolean) {
    console.debug(`Managing the selected note/TOT logic...`)
    let totNoteId = ""
    const currNote = await joplin.workspace.selectedNote();

    if(currNote) {
        // Checks if the current note is a TOT note itself, but acts only if the setting is enabled
        if(isNoteChange && currNote.is_todo && (await joplin.settings.values("parent_child"))["parent_child"] && currNote.title.endsWith("[tot]")) {
            await handleTotNoteDirectUpdates(currNote)
            totNoteId = currNote.id;
        // Handle the note's related TOT
        } else {
            // Used to get all the notes contained in the current folder
            const allNotes = await joplin.data.get(['folders', currNote.parent_id, 'notes'], {fields: ['id', 'title', 'body']})
            let totExistsAlready = false

            // Checks if the current note already has a related TOT
            const totNoteTitle = currNote.title + " [tot]"
            let currTotBody = ""
            for (const note of allNotes.items) {
                if(note.title === totNoteTitle) {
                    totExistsAlready = true
                    totNoteId = note.id;
                    currTotBody = note.body;
                    break;
                }
            }

            // Generates the corresponding TOT Markdown string
            const newTotBody = await generateTotMarkdown(currNote);
            if(newTotBody == -1) {
                if(!isNoteChange) {
                    await joplin.views.dialogs.showMessageBox("This note contains no headings!")
                }
                return ""
            }
            // Creates the note only if the function has been explicitly called (not during notes' updates)
            if(!totExistsAlready && !isNoteChange) {
                totNoteId = await createTotNote(currNote, newTotBody, totNoteTitle)
                // Updates the notes only if it exists
            } else if(totExistsAlready) {
                await updateTotNote(currNote, currTotBody, newTotBody, totNoteId)
            }
        }
    }

    return totNoteId;
}

// Function used to cache TOT notes' states, and detect toggled checkboxes later
export async function manageTotNotesStates() {
    console.debug(`Updating TOT notes states...`)
    if(await joplin.settings.values("parent_child")) {
        const currentNote = await joplin.workspace.selectedNote();
        if(currentNote && currentNote.is_todo && currentNote.title.endsWith("[tot]")) {
            const errorMsg = cacheTotNotesState(currentNote);
            if(errorMsg) {
                await joplin.views.dialogs.showMessageBox(errorMsg);
            }
        }
    }
}
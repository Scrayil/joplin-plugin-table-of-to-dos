import joplin from 'api';
import {ContentScriptType} from "../api/types";
const uslug = require('@joplin/fork-uslug');

// Global variable for slugs
let slugs: any = {};

// From https://stackoverflow.com/a/6234804/561309
function escapeHtml(unsafe:string) {
    if (unsafe != null) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    return unsafe;
}

function noteHeaders(noteBody:string) {
    const headers = [];
    const lines = noteBody.split('\n');
    for (const line of lines) {
        const match = line.match(/^(#+)\s(.*)*/);
        if (!match) continue;
        headers.push({
            level: match[1].length,
            text: match[2],
        });
    }
    return headers;
}

function removeFormulas(headerText:string) {
    // Removing $$ characters for inline formulas
    headerText = headerText.replace('$$', '');
    // Removing inline formulas (es. $...$)
    headerText = headerText.replace(/\$[^$]+\$/g, '');
    return headerText;
}

function headerSlug(headerText:string) {
    headerText = removeFormulas(headerText);
    const s = uslug(headerText);
    let num = slugs[s] ? slugs[s] : 1;
    const output = [s];
    if (num > 1) output.push(num);
    slugs[s] = num + 1;
    return output.join('-');
}

// This function determines the heading level of each line in the TOT's note
function getHeadingLevelFromTotLine(line:string):number {
    for (let i = 0; i < line.length; i++) {
        if(line[i] !== "\t") return i;
    }
}

// This function toggles all the note's checkboxes to reflect the main TOT's state
function setAllCheckboxes(mark:boolean, totLines: string[]):string[] {
    const initialCheckBoxState = mark ? "- [ ]" : "- [x]";
    const finalCheckboxState = mark ? "- [x]" : "- [ ]";
    for(let i = 0; i < totLines.length; i++) {
        totLines[i] = totLines[i].replace(initialCheckBoxState, finalCheckboxState);
    }
    return totLines;
}

// This function toggles all the subheadings' checkboxes based onto their parents
function setSubheadingCheckboxes(mark:boolean, leadingLineIndex:number, lines:string[]):string[] {
    const finalLines = lines;
    const initialCheckBoxState = mark ? "- [ ]" : "- [x]";
    const finalCheckboxState = mark ? "- [x]" : "- [ ]";
   // Leading lines are relative to subheadings' parents, and they enforce their checkboxes' statuses
    const leadingLineLevel = getHeadingLevelFromTotLine(lines[leadingLineIndex]);
    // Iterates over all the possible subheadings of the currently leading one, but skips the already evaluated subheadings
    for (let j= leadingLineIndex + 1; j < lines.length; j++) {
        const currTotLineLevel = getHeadingLevelFromTotLine(lines[j]);
        if(currTotLineLevel > leadingLineLevel) {
            // Updates the finalLines and not the lines object to avoid altering the original state
            finalLines[j] = lines[j].replace(initialCheckBoxState, finalCheckboxState);
        } else if (currTotLineLevel <= leadingLineLevel) {
            break;
        }
    }
    return finalLines;
}

// This function ensures that a parent checkbox change is reflected in all its subheadings
export function updateTotNoteCheckboxes(totNote):string {
    let totLines = totNote.body.split("\n");
    const cachedTotNoteState = getCachedTotNotesStates()[totNote.id];
    if(cachedTotNoteState) {
        const currentTotNoteState = getStateObjectFromTotNote(totNote);
        // Checks if the main TOT's checkbox has been toggled
        if(cachedTotNoteState["{NOTE_CHECKED}"] !== currentTotNoteState["{NOTE_CHECKED}"]) {
            totLines = setAllCheckboxes(currentTotNoteState["{NOTE_CHECKED}"], totLines);
        // Manage checkbox changes happened inside the note
        } else {
            // This function can be triggered only if the currently selected note is a TOT.
            // And we also have an event handler for note changes that updates the TOTs cached versions.
            // We can assume that the keys in the states are exactly the same at this point.
            let changedLineIndex = -1;
            let changedLineChecked = false;
            Object.keys(currentTotNoteState).forEach((headingLnk:string) => {
                if(changedLineIndex === -1 && cachedTotNoteState[headingLnk].checked !== currentTotNoteState[headingLnk].checked) {
                    changedLineIndex = currentTotNoteState[headingLnk].lineIdx;
                    changedLineChecked = currentTotNoteState[headingLnk].checked;
                }
            });

            if(changedLineIndex > -1) {
                totLines = setSubheadingCheckboxes(changedLineChecked, changedLineIndex, totLines);
            }
        }
    }

    return totLines.join("\n");
}

// This function is responsible for generating the TOT note corresponding to the given note's content
export async function generateTotMarkdown(note) {
    // Important: Resets the slugs before generating
    slugs = {};
    let mdString = ""
    const headers = noteHeaders(note.body);
    if(headers.length == 0) return -1;
    let prevHeadingIndentation = -1;
    for (const header of headers) {
        // Skips higher headings values;
        if(header.level > (await joplin.settings.values("max_heading_level"))["max_heading_level"]) continue;
        const slug = headerSlug(header.text);
        // Automatically fixes format issues where notes headings are placed wrongly.
        // (subheadings must have higher or equal levels of their parent,
        // and main headings should normally start with level 1)
        // e.g. Wrong format:
        // ## Main heading
        // # Subheading
        // ### Sub-Subheading
        const currIndentation = Math.min(header.level - 1, prevHeadingIndentation + 1)
        for (let i = 0; i < currIndentation; i++) {
            mdString += "\t"
        }
        prevHeadingIndentation = currIndentation;
        mdString += `- [ ] [${escapeHtml(header.text)}](:/${note.id}#${escapeHtml(slug)})\n`;
    }
    return mdString;
}

// This function extracts all checkbox states from the given TOT note
function getStateObjectFromTotNote(totNote):object {
    const totNoteStates = {};
    const totNoteLines = totNote.body.trim().split("\n");
    for (let i = 0; i < totNoteLines.length; i++) {
        const currLine = totNoteLines[i];
        // Regex to capture the heading unique link
        const headingName = currLine.match(/(\(:\/.*\))/)[1].replace("(:/", "").replace(")", "");
        totNoteStates[headingName] = {checked: currLine.indexOf("[x]") > -1, lineIdx: i};
    }
    totNoteStates["{NOTE_CHECKED}"] = totNote.todo_completed > 0;
    return totNoteStates;
}

// This function is responsible for effectively caching the given TOT notes' states
export function cacheTotNotesState(totNote):string {
    try {
        const cachedTotNotes = getCachedTotNotesStates()
        cachedTotNotes[totNote.id] = getStateObjectFromTotNote(totNote);
        sessionStorage.setItem("table_of_todos_cachedTotNotes", JSON.stringify(cachedTotNotes));
    } catch (error) {
        console.error(error);
        return "Unable to cache TOT note: " + error.message;
    }
    return null;
}

// This function is responsible for retrieving the cached TOT notes' states
export function getCachedTotNotesStates():object {
    const cachedTotNotes = sessionStorage.getItem("table_of_todos_cachedTotNotes")
    if(cachedTotNotes) {
        return JSON.parse(cachedTotNotes);
    }
    return {};
}

// This function registers a Custom CodeMirror plugin that toggles the Markdown editor's editable state, according to
// the currently selected note's type. (TOT notes must not be editable in the editor)
export async function registerCodeMirrorExtension() {
    const contentScriptId = 'table_of_todos_read_only_code_mirror_extension';
    await joplin.contentScripts.register(
        ContentScriptType.CodeMirrorPlugin,
        contentScriptId,
        './codeMirror.js',
    );

    // Listens for messages coming from the ContentScript
    await joplin.contentScripts.onMessage(contentScriptId, async (message: string) => {
        if(message === "is_tot_note") {
            const currNote = await joplin.workspace.selectedNote();
            return currNote && currNote.is_todo && currNote.title.endsWith("[tot]");
        }
    })
}
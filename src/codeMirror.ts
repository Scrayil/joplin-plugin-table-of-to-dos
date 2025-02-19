import { EditorState, Compartment } from '@codemirror/state';
import {EditorView} from "@codemirror/view";

export default function(context) {
    return {
        plugin: async (codeMirror) => {
            // Using a compartment allows reconfiguring the extensions at runtime
            const editor = codeMirror.cm6 as EditorView;
            const extensions = new Compartment();

            // Extension that allows updating the editor functionalities based on the currently selected not type
            // This check is performed by requesting the current state to the main plugin
            const updateListener = EditorView.updateListener.of( async (update) => {
                // Only apply changes after focus or update changes on the editor
                if (update.focusChanged || update.docChanged) {
                    // Contacting the main plugin to retrieve the note's type
                    let isReadOnly = await context.postMessage('is_tot_note');
                    if(isReadOnly !== true) {
                        isReadOnly = isReadOnly === 1
                    }
                    // Toggling content modifications in the editor
                    editor.dispatch({
                        effects: [
                            extensions.reconfigure([
                                EditorState.readOnly.of(isReadOnly),
                                EditorView.editable.of(!isReadOnly),
                            ])
                        ]
                    });
                }
            });
            // Defines the initial extensions' state
            codeMirror.addExtension([
                updateListener,
                extensions.of([]),
            ])
        },
        assets: function() {
            return [
                { name: 'css/codeMirror.css' }
            ];
        },
    };
}
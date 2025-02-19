import joplin from "../api";
import {SettingItemType} from "../api/types";

export const registerSettings = async () => {
    // Creating a new settings' section for the plugin
    await joplin.settings.registerSection('table_of_todos_settings', {
        label: 'Table of To-Dos',
        iconName: 'fas fa-th-list',
    });

    await joplin.settings.registerSettings({
        "max_heading_level": {
            value: 4,
            minimum: 1,
            maximum: 4,
            step: 1,
            type: SettingItemType.Int,
            section: 'table_of_todos_settings',
            public: true,
            label: 'Heading Level',
            description: "Set the maximum heading level to consider for TOT notes. Note that lists with more than four nested levels can't be properly rendered. ℹ️ This takes effect after editing source notes or creating new TOTs.",
        },
        'parent_child': {
            value: true,
            type: SettingItemType.Bool,
            section: 'table_of_todos_settings',
            public: true,
            label: 'Parent-Child',
            description: 'Toggles the parent-child mechanism for TOT notes.',
        },
    })
}
/**
 * True when a keyboard shortcut should be ignored: the user is typing in a field (which
 * keeps its own undo), or a Modal or confirm dialog is open over the screen it would change.
 * The raid Drawer is not a Modal, so shortcuts still work inside it.
 */
export function shortcutsBlocked(e: KeyboardEvent): boolean {
	const target = e.target as HTMLElement | null;
	if (target?.closest('input, textarea, select, [contenteditable="true"]')) return true;
	return document.querySelector('[data-modal]') !== null;
}

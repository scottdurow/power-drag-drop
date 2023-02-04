// Find the first element (including container if includeParent is true) that can accept focus
export const findFirstFocusableElement = (container: HTMLElement, includeParent: boolean): HTMLElement | undefined => {
    if (includeParent && isFocusable(container)) {
        return container;
    }
    return Array.from(container.getElementsByTagName('*')).find(isFocusable) as HTMLElement;
};

const isFocusable = (item: Element): boolean => {
    if ((item as HTMLElement).tabIndex < 0) {
        return false;
    }
    switch (item.tagName) {
        case 'A':
            return !!(item as HTMLAnchorElement).href;
        case 'INPUT': {
            const inputElement = item as HTMLInputElement;
            return inputElement.type !== 'hidden' && !inputElement.disabled;
        }
        case 'SELECT':
            return !(item as HTMLSelectElement).disabled;
        case 'TEXTAREA':
            return !(item as HTMLTextAreaElement).disabled;
        case 'BUTTON':
            return !(item as HTMLButtonElement).disabled;
        default:
            return false;
    }
};

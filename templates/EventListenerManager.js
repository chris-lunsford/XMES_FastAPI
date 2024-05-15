class EventListenerManager {
    constructor() {
        this.listeners = [];
    }

    addListener(element, type, handler) {
        element.addEventListener(type, handler);
        this.listeners.push({element, type, handler});
    }

    removeListeners() {
        for (const {element, type, handler} of this.listeners) {
            element.removeEventListener(type, handler);
        }
        this.listeners = [];
    }
}

const listenerManager = new EventListenerManager();
import { parseHTML } from 'linkedom';

const {
  window,
  document,
  HTMLElement,
  Event,
  CustomEvent,
  Node,
  DOMParser,
} = parseHTML('<html><body></body></html>');

// @ts-ignore
self.window = window;
// @ts-ignore
self.document = document;
// @ts-ignore
self.HTMLElement = HTMLElement;
// @ts-ignore
self.Event = Event;
// @ts-ignore
self.CustomEvent = CustomEvent;
// @ts-ignore
self.Node = Node;
// @ts-ignore
self.DOMParser = DOMParser;

// Final touch for libraries that check specifically for implementation
// @ts-ignore
if (!self.document.implementation) {
  // @ts-ignore
  self.document.implementation = {
    createHTMLDocument: (title) => {
      const { document } = parseHTML(`<html><head><title>${title}</title></head><body></body></html>`);
      return document;
    }
  };
}

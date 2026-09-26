import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom gaps
window.scrollTo = () => {};
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];

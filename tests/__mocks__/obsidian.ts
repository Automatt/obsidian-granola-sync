export const requestUrl = jest.fn();
export const normalizePath = (path: string) => path.replace(/\\/g, '/');
export const App = jest.fn();
export const Editor = jest.fn();
export const MarkdownView = jest.fn();
export const Modal = jest.fn();
export const Notice = jest.fn();
export const Plugin = jest.fn();
export const PluginSettingTab = jest.fn();
export const Setting = jest.fn();
export const moment = {
  format: jest.fn(),
  parseZone: jest.fn()
}; 
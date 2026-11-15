const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tunnelDoctor', {
  async call(method, ...args) {
    const res = await ipcRenderer.invoke('td:call', method, args);
    if (!res.ok) throw new Error(res.error);
    return res.value;
  }
});

// Electron Forge packaging. Windows installers are genuine Squirrel.Windows
// (Setup.exe, RELEASES, full .nupkg). The installer is not code-signed.
module.exports = {
  packagerConfig: {
    name: 'Tunnel Doctor',
    executableName: 'TunnelDoctor',
    appBundleId: 'io.github.ding-ding-projects.tunnel-doctor',
    asar: true,
    ignore: [/^\/(server|site|design|docs|appliance|test|out|\.github|scripts)(\/|$)/, /^\/(compose\.yaml|Dockerfile|host\.bat|build\.bat|build-installer\.bat)$/]
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: { name: 'TunnelDoctor', setupExe: 'TunnelDoctorSetup.exe', noMsi: true }
    }
  ]
};

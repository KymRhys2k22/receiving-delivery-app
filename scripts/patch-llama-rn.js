const fs = require('fs');
const path = require('path');

const pluginPath = path.join(__dirname, '..', 'node_modules', 'llama.rn', 'app.plugin.js');
if (fs.existsSync(pluginPath)) {
  let content = fs.readFileSync(pluginPath, 'utf8');
  if (content.includes('lib/module/expo-plugin/withLlamaRN')) {
    content = content.replace('lib/module/expo-plugin/withLlamaRN', 'lib/commonjs/expo-plugin/withLlamaRN');
    fs.writeFileSync(pluginPath, content, 'utf8');
    console.log('[patch-llama-rn] Patched app.plugin.js');
  }
}

const withLlamaRNPath = path.join(__dirname, '..', 'node_modules', 'llama.rn', 'lib', 'commonjs', 'expo-plugin', 'withLlamaRN.js');
if (fs.existsSync(withLlamaRNPath)) {
  let content = fs.readFileSync(withLlamaRNPath, 'utf8');
  if (content.includes('} = _configPlugins.default;')) {
    content = content.replace('} = _configPlugins.default;', '} = _configPlugins.default || _configPlugins;');
    fs.writeFileSync(withLlamaRNPath, content, 'utf8');
    console.log('[patch-llama-rn] Patched withLlamaRN.js');
  }
}

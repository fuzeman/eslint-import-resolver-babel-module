const path = require('path');
const process = require('process');
const resolve = require('resolve');
const pkgUp = require('pkg-up');
const targetPlugin = require('@fuzeman/babel-plugin-module-resolver').default;
const resolvePath = require('@fuzeman/babel-plugin-module-resolver').resolvePath;
const OptionManager = require('babel-core').OptionManager;


const pluginName = '@fuzeman\\babel-plugin-module-resolver';
const pluginPath = pluginName + '\\lib\\index.js';

const pluginKeys = [
  '@fuzeman\\module-resolver',
  pluginName
];

function getPlugins(file, target) {
  try {
    const manager = new OptionManager();
    const result = manager.init({
      babelrc: true,
      filename: file,
    });

    return result.plugins.filter((plugin) => {
      let key = plugin[0].key;
      
      // Match by key
      if(pluginKeys.indexOf(key) >= 0) {
        return true;
      }

      // Match by path (Babel v7+)
      if(key.indexOf(pluginPath) === key.length - pluginPath.length) {
        return true;
      }

      return false;
    });
  } catch (err) {
    // This error should only occur if something goes wrong with babel's
    // internals. Dump it to console so people know what's going on,
    // elsewise the error will simply be squelched in the calling code.
    console.error('[eslint-import-resolver-babel-module]', err);
    console.error('See: https://github.com/tleunen/eslint-import-resolver-babel-module/pull/34');
    return [];
  }
}

function stripWebpack(src) {
  let source = src;

  // strip loaders
  const finalBang = source.lastIndexOf('!');
  if (finalBang >= 0) {
    source = source.slice(finalBang + 1);
  }

  // strip resource query
  const finalQuestionMark = source.lastIndexOf('?');
  if (finalQuestionMark >= 0) {
    source = source.slice(0, finalQuestionMark);
  }

  return source;
}

exports.interfaceVersion = 2;

/**
 * Find the full path to 'source', given 'file' as a full reference path.
 *
 * resolveImport('./foo', '/Users/ben/bar.js') => '/Users/ben/foo.js'
 * @param  {string} source - the module to resolve; i.e './some-module'
 * @param  {string} file - the importing file's full path; i.e. '/usr/local/bin/file.js'
 * @param  {object} options - the resolver options
 * @return {object}
 */
exports.resolve = (source, file, opts) => {
  const options = opts || {};
  if (resolve.isCore(source)) return { found: true, path: null };

  const projectRootDir = path.dirname(pkgUp.sync(file));

  try {
    const instances = getPlugins(file, targetPlugin);

    const pluginOpts = instances.reduce(
      (config, plugin) => ({
        cwd: plugin[1] && plugin[1].cwd ? plugin[1].cwd : config.cwd,
        root: config.root.concat(plugin[1] && plugin[1].root ? plugin[1].root : []),
        alias: Object.assign(config.alias, plugin[1] ? plugin[1].alias : {}),
        extensions: plugin[1] && plugin[1].extensions ? plugin[1].extensions : config.extensions,
      }),
      { root: [], alias: {}, cwd: projectRootDir },
    );

    if(options.cwd === 'process') {
      pluginOpts.cwd = process.cwd();
    } else if(options.cwd) {
      pluginOpts.cwd = options.cwd;
    }

    const finalSource = stripWebpack(source);
    const src = resolvePath(finalSource, file, pluginOpts);

    const extensions = options.extensions || pluginOpts.extensions;

    return {
      found: true,
      path: resolve.sync(src || source, {
        ...options,
        extensions,
        basedir: path.dirname(file),
      }),
    };
  } catch (e) {
    return { found: false };
  }
};

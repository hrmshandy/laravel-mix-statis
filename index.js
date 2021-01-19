const mix = require('laravel-mix');

const argv = require('yargs').argv;
const command = require('node-cmd');
const fs = require('fs');
const hasbin = require('hasbin');
const path = require('path');

const BrowserSync = require('browser-sync');
const BrowserSyncPlugin = require('browser-sync-webpack-plugin');
const ExtraWatchWebpackPlugin = require('extra-watch-webpack-plugin');

const { SyncHook } = require('tapable');

let browserSyncInstance;

class Statis {
    /**
     * Register the component.
     */
    register(config = {}) {
        if (typeof argv.env === 'string') {
            this.env = argv.env;
        } else {
            this.env = process.env.NODE_ENV || 'local';
            if (this.env === 'development') {
                this.env = 'local';
            }
        }

        this.port = argv.port || 3000;
        this.bin = this.binaryPath();

        this.config = {
            browserSync: true,
            open: true,
            online: true,
            proxy: undefined,
            watch: [
                'config.php',
                'source/**/*.md',
                'source/**/*.php',
                'source/**/*.scss',
                '!source/**/cache/*',
            ],
            browserSyncOptions: {},
            ...config,
        };
    }

    /*
     * Plugins to be merged with the master webpack config.
     */
    webpackPlugins() {
        return [
            this.statisPlugin(),
            this.config.browserSync ? this.browserSyncPlugin(this.config.proxy) : undefined,
            this.config.watch ? this.watchPlugin() : undefined,
        ].filter(plugin => plugin);
    }

    /**
     * Get the path to the Statis binary.
     */
    binaryPath() {
        if (fs.existsSync('./vendor/bin/statis')) {
            return path.normalize('./vendor/bin/statis');
        }

        if (hasbin.sync('statis')) {
            return 'statis';
        }

        console.error('Could not find Statis; please install it via Composer.');
        process.exit();
    }

    /**
     * Get the Statis webpack plugin, to build the Statis site and reload BrowserSync.
     */
    statisPlugin(compiler) {
        let { bin, env } = { bin: this.bin, env: this.env };

        return new class {
            apply(compiler) {
                const statisDone = new SyncHook([]);

                compiler.hooks.done.tap('Statis Webpack Plugin', () => {
                    return command.get(`${bin} build -q ${env}`, (error, stdout, stderr) => {
                        console.log(error ? stderr : stdout);

                        if (browserSyncInstance) {
                            browserSyncInstance.reload();
                        }

                        statisDone.call();
                    });
                });
            }
        };
    }

    /**
     * Get and instance of the ExtraWatchWebpackPlugin.
     */
    watchPlugin() {
        return new ExtraWatchWebpackPlugin({
            files: this.config.watch,
        });
    }

    /**
     * Get an instance of the BrowserSyncPlugin.
     */
    browserSyncPlugin(proxy) {
        return new BrowserSyncPlugin({
            notify: false,
            open: this.config.open,
            online: this.config.online,
            port: this.port,
            proxy: proxy,
            server: proxy ? null : { baseDir: 'build_' + this.env + '/' },
            ...this.config.browserSyncOptions,
        }, {
            reload: false,
            callback: () => browserSyncInstance = BrowserSync.get('bs-webpack-plugin'),
        });
    }
}

mix.extend('statis', new Statis());
